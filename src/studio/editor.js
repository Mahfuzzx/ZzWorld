// The drawing canvas: shows the object's box, its art for the current state and
// layer, the special areas (surfaces, container area, opening, light) and the
// active tool's preview. Pointer input is forwarded to the active tool.
import { drawArt, seedFor } from '../engine/art.js';
import { shapeBounds } from './doc.js';

const PAD = 36; // CSS px around the box

export class Editor {
  constructor(canvas, app) {
    this.canvas = canvas;
    this.ctx = canvas.getContext('2d');
    this.app = app;
    this.pointerId = null;
    this.frame = 0;

    canvas.addEventListener('pointerdown', (ev) => this.#down(ev));
    canvas.addEventListener('pointermove', (ev) => this.#move(ev));
    canvas.addEventListener('pointerup', (ev) => this.#up(ev));
    canvas.addEventListener('pointercancel', (ev) => this.#cancel(ev));
    canvas.addEventListener('contextmenu', (ev) => ev.preventDefault());
    new ResizeObserver(() => this.render()).observe(canvas);
  }

  get def() {
    return this.app.doc.def;
  }

  #layout() {
    const rect = this.canvas.getBoundingClientRect();
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    if (this.canvas.width !== Math.round(rect.width * dpr)) this.canvas.width = Math.round(rect.width * dpr);
    if (this.canvas.height !== Math.round(rect.height * dpr)) this.canvas.height = Math.round(rect.height * dpr);
    const [w, h] = this.def.size ?? [100, 100];
    const scale = Math.max(0.1, Math.min((rect.width - PAD * 2) / w, (rect.height - PAD * 2) / h, 6));
    this.view = { rect, dpr, scale, ox: (rect.width - w * scale) / 2, oy: (rect.height - h * scale) / 2 };
  }

  toLocal(ev) {
    const { rect, scale, ox, oy } = this.view;
    return { x: (ev.clientX - rect.left - ox) / scale, y: (ev.clientY - rect.top - oy) / scale };
  }

  #down(ev) {
    if (this.pointerId !== null || !this.app.doc) return; // one finger draws; ignore the rest
    this.pointerId = ev.pointerId;
    this.canvas.setPointerCapture(ev.pointerId);
    this.#layout();
    this.app.tool.down(this.toLocal(ev), ev);
    this.requestRender();
  }

  #move(ev) {
    if (ev.pointerId !== this.pointerId) return;
    // Pens deliver extra samples between frames; use them for smoother lines.
    for (const e of ev.getCoalescedEvents?.() ?? [ev]) this.app.tool.move(this.toLocal(e), e);
  }

  #up(ev) {
    if (ev.pointerId !== this.pointerId) return;
    this.pointerId = null;
    this.app.tool.up(this.toLocal(ev), ev);
    this.requestRender();
  }

  #cancel(ev) {
    if (ev.pointerId !== this.pointerId) return;
    this.pointerId = null;
    this.app.tool.cancel();
    this.requestRender();
  }

  requestRender() {
    if (this.frame) return;
    this.frame = requestAnimationFrame(() => {
      this.frame = 0;
      this.render();
    });
  }

  render() {
    if (!this.app.doc) return;
    this.#layout();
    const { ctx } = this;
    const { dpr, scale, ox, oy } = this.view;
    const def = this.def;
    const [w, h] = def.size ?? [100, 100];
    const doc = this.app.doc;
    const color = (slot) => this.app.slotColor(slot);
    const seed = seedFor(def.id ?? '');

    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
    ctx.setTransform(dpr * scale, 0, 0, dpr * scale, dpr * ox, dpr * oy);

    // the object's box: paper with a dashed border
    ctx.fillStyle = '#fffdf6';
    ctx.fillRect(0, 0, w, h);
    ctx.strokeStyle = '#c9b48f';
    ctx.lineWidth = 2 / scale;
    ctx.setLineDash([6 / scale, 5 / scale]);
    ctx.strokeRect(0, 0, w, h);
    ctx.setLineDash([]);

    // the other layer, faded, for reference
    const other = doc.layer === 'art' ? def.artFront : def.art;
    if (other?.[doc.state]?.length) {
      ctx.globalAlpha = doc.layer === 'art' ? 0.3 : 0.45;
      drawArt(ctx, other[doc.state], color, { seed });
      ctx.globalAlpha = 1;
    }
    drawArt(ctx, doc.shapes, color, { seed });
    this.#drawAreas(ctx, scale);

    const selected = doc.shapes[this.app.selection];
    const b = selected && shapeBounds(selected);
    if (b) {
      ctx.strokeStyle = '#3a7bd5';
      ctx.lineWidth = 2 / scale;
      ctx.setLineDash([5 / scale, 4 / scale]);
      ctx.strokeRect(b.left - 4, b.top - 4, b.right - b.left + 8, b.bottom - b.top + 8);
      ctx.setLineDash([]);
    }

    this.app.tool.preview(ctx, scale);
    ctx.setLineDash([]);
  }

  #drawAreas(ctx, scale) {
    if (!this.app.showAreas) return;
    const def = this.def;
    const line = (color, dash = true) => {
      ctx.strokeStyle = color;
      ctx.lineWidth = 3 / scale;
      ctx.setLineDash(dash ? [8 / scale, 6 / scale] : []);
    };
    for (const s of def.surfaces ?? []) {
      line('#3aa76d', false);
      ctx.beginPath();
      ctx.moveTo(s.x, s.y);
      ctx.lineTo(s.x + s.w, s.y);
      ctx.stroke();
    }
    const area = this.app.doc.behavior('Container')?.area;
    if (area) {
      line('#3a7bd5');
      ctx.strokeRect(...area);
    }
    for (const o of def.opening ?? []) {
      line('#8a4fd8');
      ctx.strokeRect(o.x, o.y, o.w, o.h);
    }
    if (def.light) {
      line('#e0a100');
      ctx.beginPath();
      ctx.arc(def.light.x, def.light.y, def.light.r, 0, Math.PI * 2);
      ctx.stroke();
      ctx.fillStyle = '#ffd166';
      ctx.beginPath();
      ctx.arc(def.light.x, def.light.y, 8 / scale, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.setLineDash([]);
  }
}
