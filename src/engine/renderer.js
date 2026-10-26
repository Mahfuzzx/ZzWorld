import { drawArt, shapePath, seedFor, INK } from './art.js';
import { Backdrop } from './backdrop.js';
import { matchesWhen } from './actions.js';

const MARGIN = 8; // room around cached art for outlines and squash
const NIGHT_SHADE = [24, 32, 90];
const NIGHT_ALPHA = 0.45;

// Canvas 2D renderer. The scene is scaled to fit the viewport height and
// scrolled horizontally by the camera. Drawing order, back to front:
// backdrop layers → wall (with window openings) and floor → entities → night shade.
export class Renderer {
  constructor(canvas) {
    this.canvas = canvas;
    this.ctx = canvas.getContext('2d');
    this.scene = null;
    this.backdrop = null;
    this.highlights = new Set();
    this.cache = new Map();
    this.scale = 1;
    this.dpr = 1;
    this.time = 0;
    // Offscreen layers that need holes cut into them.
    this.wallLayer = document.createElement('canvas');
    this.shadeLayer = document.createElement('canvas');
    new ResizeObserver(() => this.resize()).observe(canvas);
  }

  // `backdropId` is the backdrop resolved by the caller (the scene's own, or one
  // inherited from the map); without it the scene's own backdrop is used.
  setScene(scene, { backdropId = scene.backdrop } = {}) {
    this.scene = scene;
    this.backdrop = backdropId ? new Backdrop(scene.defs.get(backdropId)) : null;
    this.cache.clear();
    this.resize();
  }

  resize() {
    const rect = this.canvas.getBoundingClientRect();
    if (!rect.width || !rect.height) return;
    this.dpr = Math.min(window.devicePixelRatio || 1, 2);
    for (const c of [this.canvas, this.wallLayer, this.shadeLayer]) {
      c.width = Math.round(rect.width * this.dpr);
      c.height = Math.round(rect.height * this.dpr);
    }
    this.viewWidth = rect.width;
    this.cache.clear();
    if (this.scene) {
      this.scale = rect.height / this.scene.height;
      this.clampCamera();
    }
  }

  get visibleWidth() {
    return this.viewWidth / this.scale;
  }

  // Left edge of the view in scene units; centred when the scene is narrower.
  get viewLeft() {
    const extra = this.visibleWidth - this.scene.width;
    return extra > 0 ? -extra / 2 : this.scene.camera.x;
  }

  clampCamera() {
    const max = Math.max(0, this.scene.width - this.visibleWidth);
    this.scene.camera.x = Math.min(Math.max(this.scene.camera.x, 0), max);
  }

  toScene(clientX, clientY) {
    const rect = this.canvas.getBoundingClientRect();
    return {
      x: (clientX - rect.left) / this.scale + this.viewLeft,
      y: (clientY - rect.top) / this.scale,
    };
  }

  #setWorldTransform(ctx, parallax = 1) {
    const s = this.scale * this.dpr;
    ctx.setTransform(s, 0, 0, s, -this.viewLeft * parallax * s, 0);
  }

  draw(dt = 0) {
    const { ctx, scene } = this;
    if (!scene) return;
    this.time += dt;
    const night = scene.services.dayNight?.amount ?? 0;

    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
    this.#drawBackdrop(night);

    const openings = scene.renderList().filter((e) => e.def.opening);
    if (scene.interior) this.#drawInterior(openings);

    this.#setWorldTransform(ctx);
    for (const { entity, front } of scene.drawPasses()) this.#drawEntity(entity, front);

    if (night > 0) this.#drawNightShade(night, openings);
  }

  #drawBackdrop(night) {
    const { ctx } = this;
    if (!this.backdrop) {
      ctx.fillStyle = '#f6e7c8';
      ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);
      return;
    }
    const view = {
      left: this.viewLeft,
      width: this.visibleWidth,
      height: this.scene.height,
      night,
      time: this.time,
      pixelScale: this.scale * this.dpr,
    };
    for (const layer of this.backdrop.layers) {
      this.#setWorldTransform(ctx, layer.parallax);
      layer.draw(ctx, view);
    }
  }

  // Cuts each structure's opening (in its local box) out of a layer.
  #cutOpenings(ctx, openings) {
    ctx.globalCompositeOperation = 'destination-out';
    ctx.fillStyle = '#000';
    for (const e of openings) {
      ctx.save();
      ctx.translate(e.x - e.width / 2, e.y - e.height);
      for (const shape of e.def.opening) ctx.fill(shapePath(shape));
      ctx.restore();
    }
    ctx.globalCompositeOperation = 'source-over';
  }

  #drawInterior(openings) {
    const { scene } = this;
    const { wall = '#f3dcb4', floor = '#d9a66b' } = scene.interior;

    const wctx = this.wallLayer.getContext('2d');
    wctx.setTransform(1, 0, 0, 1, 0, 0);
    wctx.clearRect(0, 0, this.wallLayer.width, this.wallLayer.height);
    this.#setWorldTransform(wctx);
    // Walls and floor fill the whole view, also beyond the room's ends on wide screens.
    const left = Math.min(0, this.viewLeft);
    const width = Math.max(scene.width, this.viewLeft + this.visibleWidth) - left;
    wctx.fillStyle = wall;
    wctx.fillRect(left, 0, width, scene.floorY);
    this.#cutOpenings(wctx, openings);
    this.ctx.setTransform(1, 0, 0, 1, 0, 0);
    this.ctx.drawImage(this.wallLayer, 0, 0);

    const { ctx } = this;
    this.#setWorldTransform(ctx);
    ctx.fillStyle = floor;
    ctx.fillRect(left, scene.floorY, width, scene.height - scene.floorY);
    ctx.strokeStyle = INK;
    ctx.globalAlpha = 0.12;
    ctx.lineWidth = 3;
    for (let y = scene.floorY + 60; y < scene.height; y += 70) {
      ctx.beginPath();
      ctx.moveTo(left, y);
      ctx.lineTo(left + width, y);
      ctx.stroke();
    }
    ctx.globalAlpha = 1;
    ctx.lineWidth = 6;
    ctx.beginPath();
    ctx.moveTo(left, scene.floorY);
    ctx.lineTo(left + width, scene.floorY);
    ctx.stroke();
  }

  // Darkens the scene at night. Window openings stay clear (the backdrop has its
  // own night look) and lights punch soft holes into the shade.
  #drawNightShade(night, openings) {
    const sctx = this.shadeLayer.getContext('2d');
    sctx.setTransform(1, 0, 0, 1, 0, 0);
    sctx.clearRect(0, 0, this.shadeLayer.width, this.shadeLayer.height);
    sctx.fillStyle = `rgba(${NIGHT_SHADE.join(',')}, ${NIGHT_ALPHA * night})`;
    sctx.fillRect(0, 0, this.shadeLayer.width, this.shadeLayer.height);

    this.#setWorldTransform(sctx);
    if (this.scene.interior) this.#cutOpenings(sctx, openings);

    sctx.globalCompositeOperation = 'destination-out';
    for (const e of this.scene.renderList()) {
      const light = e.def.light;
      if (!light || !matchesWhen(light.when, e)) continue;
      const x = e.x - e.width / 2 + light.x;
      const y = e.y - e.height + light.y;
      const glow = sctx.createRadialGradient(x, y, 0, x, y, light.r);
      glow.addColorStop(0, 'rgba(0,0,0,1)');
      glow.addColorStop(0.5, 'rgba(0,0,0,0.7)');
      glow.addColorStop(1, 'rgba(0,0,0,0)');
      sctx.fillStyle = glow;
      sctx.fillRect(x - light.r, y - light.r, light.r * 2, light.r * 2);
    }
    sctx.globalCompositeOperation = 'source-over';

    this.ctx.setTransform(1, 0, 0, 1, 0, 0);
    this.ctx.drawImage(this.shadeLayer, 0, 0);
  }

  #drawEntity(e, front) {
    const { ctx } = this;
    const bitmap = this.#bitmap(e, front ? 'artFront' : 'art');
    if (front && !bitmap) return;
    const w = e.width;
    const h = e.height;
    const fx = e.fx;
    // In edit mode, things that can only move there wiggle gently.
    const wiggle = this.scene.mode === 'edit' && e.mobility === 'edit' && !e.parentId
      ? 0.025 * Math.sin(this.time * 9 + e.order)
      : 0;

    ctx.save();
    ctx.translate(e.x + (fx?.dx ?? 0), e.y + (fx?.dy ?? 0));
    if (fx || wiggle) {
      // rotate around the centre, squash around the base
      ctx.translate(0, -h / 2);
      ctx.rotate((fx?.rot ?? 0) + wiggle);
      ctx.translate(0, h / 2);
      ctx.scale(fx?.sx ?? 1, fx?.sy ?? 1);
    }
    if (this.highlights.has(e) && !front) {
      ctx.shadowColor = '#ffcf4a';
      ctx.shadowBlur = 28 * this.scale * this.dpr;
    }
    if (bitmap) {
      ctx.drawImage(bitmap, -w / 2 - MARGIN, -h - MARGIN, w + MARGIN * 2, h + MARGIN * 2);
    } else {
      ctx.strokeStyle = INK;
      ctx.strokeRect(-w / 2, -h, w, h);
    }
    ctx.restore();
  }

  // `field` is "art" or "artFront"; both map state → shapes, with "default" as fallback.
  #bitmap(e, field) {
    const art = e.def[field]?.[e.state] ?? e.def[field]?.default;
    if (!art) return null;
    const key = `${e.def.id}|${field}|${e.state}|${JSON.stringify(e.colors)}`;
    let bitmap = this.cache.get(key);
    if (!bitmap) {
      const px = this.scale * this.dpr;
      bitmap = document.createElement('canvas');
      bitmap.width = Math.ceil((e.width + MARGIN * 2) * px);
      bitmap.height = Math.ceil((e.height + MARGIN * 2) * px);
      const ctx = bitmap.getContext('2d');
      ctx.scale(px, px);
      ctx.translate(MARGIN, MARGIN);
      drawArt(ctx, art, (slot) => e.color(slot), { seed: seedFor(e.def.id) });
      this.cache.set(key, bitmap);
    }
    return bitmap;
  }
}
