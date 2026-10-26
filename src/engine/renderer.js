import { drawArt, INK } from './art.js';

const MARGIN = 8; // room around cached art for outlines and squash

// Canvas 2D renderer. The scene is scaled to fit the viewport height and
// scrolled horizontally by the camera. Each entity's art is cached as a bitmap
// per state and colour set, so frames only blit images.
export class Renderer {
  constructor(canvas) {
    this.canvas = canvas;
    this.ctx = canvas.getContext('2d');
    this.scene = null;
    this.highlights = new Set();
    this.cache = new Map();
    this.scale = 1;
    this.dpr = 1;
    new ResizeObserver(() => this.resize()).observe(canvas);
  }

  setScene(scene) {
    this.scene = scene;
    this.cache.clear();
    this.resize();
  }

  resize() {
    const rect = this.canvas.getBoundingClientRect();
    if (!rect.width || !rect.height) return;
    this.dpr = Math.min(window.devicePixelRatio || 1, 2);
    this.canvas.width = Math.round(rect.width * this.dpr);
    this.canvas.height = Math.round(rect.height * this.dpr);
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

  draw() {
    const { ctx, scene } = this;
    if (!scene) return;
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.fillStyle = scene.background.outside ?? '#f6e7c8';
    ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);

    const s = this.scale * this.dpr;
    ctx.setTransform(s, 0, 0, s, -this.viewLeft * s, 0);
    this.#drawBackground();
    for (const { entity, front } of scene.drawPasses()) this.#drawEntity(entity, front);
  }

  #drawBackground() {
    const { ctx, scene } = this;
    const bg = scene.background;
    ctx.fillStyle = bg.wall ?? '#f3dcb4';
    ctx.fillRect(0, 0, scene.width, scene.floorY);
    ctx.fillStyle = bg.floor ?? '#d9a66b';
    ctx.fillRect(0, scene.floorY, scene.width, scene.height - scene.floorY);

    ctx.strokeStyle = INK;
    ctx.globalAlpha = 0.12;
    ctx.lineWidth = 3;
    for (let y = scene.floorY + 60; y < scene.height; y += 70) {
      ctx.beginPath();
      ctx.moveTo(0, y);
      ctx.lineTo(scene.width, y);
      ctx.stroke();
    }
    ctx.globalAlpha = 1;
    ctx.lineWidth = 6;
    ctx.beginPath();
    ctx.moveTo(0, scene.floorY);
    ctx.lineTo(scene.width, scene.floorY);
    ctx.stroke();
  }

  #drawEntity(e, front) {
    const { ctx } = this;
    const bitmap = this.#bitmap(e, front ? 'artFront' : 'art');
    if (front && !bitmap) return;
    const w = e.width;
    const h = e.height;
    const fx = e.fx;

    ctx.save();
    ctx.translate(e.x + (fx?.dx ?? 0), e.y + (fx?.dy ?? 0));
    if (fx) {
      // rotate around the centre, squash around the base
      ctx.translate(0, -h / 2);
      ctx.rotate(fx.rot);
      ctx.translate(0, h / 2);
      ctx.scale(fx.sx, fx.sy);
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
      drawArt(ctx, art, (slot) => e.color(slot));
      this.cache.set(key, bitmap);
    }
    return bitmap;
  }
}
