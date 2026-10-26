// Editor tools. All tools share one interface (down/move/up/preview), so the
// editor never needs to know which tool is active.
import { drawArt, shapePath, INK } from '../engine/art.js';

const round1 = (v) => Math.round(v * 10) / 10;
const hitCtx = typeof document !== 'undefined' ? document.createElement('canvas').getContext('2d') : null;

// Index of the topmost shape under p, or -1.
export function hitShape(shapes, p) {
  for (let i = shapes.length - 1; i >= 0; i--) {
    const s = shapes[i];
    const path = shapePath(s);
    if (!path) continue;
    const x = p.x - (s.tx ?? 0);
    const y = p.y - (s.ty ?? 0);
    hitCtx.lineWidth = 14;
    if (hitCtx.isPointInPath(path, x, y) || hitCtx.isPointInStroke(path, x, y)) return i;
  }
  return -1;
}

const dashed = (ctx, color, scale) => {
  ctx.strokeStyle = color;
  ctx.lineWidth = 3 / scale;
  ctx.setLineDash([8 / scale, 6 / scale]);
};

export class Tool {
  static id = 'tool';
  static icon = '';

  constructor(app) {
    this.app = app;
  }

  get doc() {
    return this.app.doc;
  }

  down(p, ev) {}
  move(p, ev) {}
  up(p, ev) {}
  cancel() {}
  preview(ctx, scale) {}
}

export class PenTool extends Tool {
  static id = 'pen';
  static icon = '<path d="M8 40 L12 30 L34 8 L40 14 L18 36 Z" fill="#ffd166"/><path d="M8 40 L12 30 L18 36 Z" fill="#3b2f2a"/>';

  down(p, ev) {
    this.points = [[round1(p.x), round1(p.y), round1(ev.pressure || 0.5)]];
  }

  move(p, ev) {
    if (!this.points) return;
    const last = this.points.at(-1);
    if (Math.hypot(p.x - last[0], p.y - last[1]) < 0.8) return;
    this.points.push([round1(p.x), round1(p.y), round1(ev.pressure || 0.5)]);
    this.app.requestRender();
  }

  #shape() {
    const points = this.points.length === 1 ? [this.points[0], [this.points[0][0] + 0.1, this.points[0][1] + 0.1, this.points[0][2]]] : this.points;
    return { type: 'ink', points, size: this.app.brush, color: this.app.paint ?? INK };
  }

  up() {
    if (!this.points) return;
    this.doc.addShape(this.app.tagPart(this.#shape()));
    this.points = null;
  }

  cancel() {
    this.points = null;
  }

  preview(ctx) {
    if (this.points) drawArt(ctx, [this.#shape()], (slot) => this.app.slotColor(slot));
  }
}

export class FillTool extends Tool {
  static id = 'fill';
  static icon = '<path d="M10 30 C6 16 20 6 32 10 C44 14 44 32 32 38 C22 42 12 40 10 30 Z" fill="#8fc7a4"/>';

  down(p) {
    this.points = [[round1(p.x), round1(p.y)]];
  }

  move(p) {
    if (!this.points) return;
    const last = this.points.at(-1);
    if (Math.hypot(p.x - last[0], p.y - last[1]) < 1.5) return;
    this.points.push([round1(p.x), round1(p.y)]);
    this.app.requestRender();
  }

  #shape() {
    return { type: 'fill', points: this.points, fill: this.app.paint ?? '#ffffff', lw: Math.max(3, this.app.brush * 0.6) };
  }

  up() {
    if (this.points?.length >= 3) this.doc.addShape(this.app.tagPart(this.#shape()));
    this.points = null;
  }

  cancel() {
    this.points = null;
  }

  preview(ctx) {
    if (this.points?.length >= 3) drawArt(ctx, [this.#shape()], (slot) => this.app.slotColor(slot), { rough: false });
  }
}

// Drag a box; subclasses turn it into a shape or a setting.
class BoxTool extends Tool {
  down(p) {
    this.start = p;
    this.end = p;
  }

  move(p) {
    if (!this.start) return;
    this.end = p;
    this.app.requestRender();
  }

  get box() {
    const x = Math.min(this.start.x, this.end.x);
    const y = Math.min(this.start.y, this.end.y);
    return { x: Math.round(x), y: Math.round(y), w: Math.round(Math.abs(this.end.x - this.start.x)), h: Math.round(Math.abs(this.end.y - this.start.y)) };
  }

  up() {
    if (this.start && this.box.w > 3 && this.box.h > 3) this.commit(this.box);
    this.start = null;
  }

  cancel() {
    this.start = null;
  }

  commit(box) {}
}

export class RectTool extends BoxTool {
  static id = 'rect';
  static icon = '<rect x="8" y="12" width="32" height="24" rx="4" fill="#9fd3f2"/>';

  shape(b) {
    return { type: 'rect', ...b, r: Math.min(8, b.w / 4, b.h / 4), fill: this.app.paint, lw: Math.max(3, this.app.brush * 0.6) };
  }

  commit(b) {
    this.doc.addShape(this.app.tagPart(this.shape(b)));
  }

  preview(ctx) {
    if (this.start) drawArt(ctx, [this.shape(this.box)], (slot) => this.app.slotColor(slot), { rough: false });
  }
}

export class EllipseTool extends RectTool {
  static id = 'ellipse';
  static icon = '<ellipse cx="24" cy="24" rx="17" ry="13" fill="#f28dbb"/>';

  shape(b) {
    return { type: 'ellipse', cx: b.x + b.w / 2, cy: b.y + b.h / 2, rx: b.w / 2, ry: b.h / 2, fill: this.app.paint, lw: Math.max(3, this.app.brush * 0.6) };
  }
}

export class EraserTool extends Tool {
  static id = 'eraser';
  static icon = '<path d="M10 30 L26 14 L38 26 L26 38 L18 38 Z" fill="#f2a7b5"/><path d="M18 38 H40"/>';

  #erase(p) {
    const shapes = this.doc.shapes;
    const i = hitShape(shapes, p);
    if (i >= 0) this.doc.replaceShapes(shapes.filter((_, j) => j !== i));
  }

  down(p) {
    this.active = true;
    this.#erase(p);
  }

  move(p) {
    if (this.active) this.#erase(p);
  }

  up() {
    this.active = false;
  }
}

// Select a shape and drag it around.
export class MoveTool extends Tool {
  static id = 'move';
  static icon = '<path d="M24 6 V42 M6 24 H42 M24 6 L18 12 M24 6 L30 12 M24 42 L18 36 M24 42 L30 36 M6 24 L12 18 M6 24 L12 30 M42 24 L36 18 M42 24 L36 30"/>';

  down(p) {
    const i = hitShape(this.doc.shapes, p);
    this.app.select(i);
    if (i < 0) return;
    const s = this.doc.shapes[i];
    this.drag = { index: i, start: p, tx: s.tx ?? 0, ty: s.ty ?? 0 };
  }

  move(p) {
    if (!this.drag) return;
    const s = this.doc.shapes[this.drag.index];
    s.tx = Math.round(this.drag.tx + p.x - this.drag.start.x);
    s.ty = Math.round(this.drag.ty + p.y - this.drag.start.y);
    this.app.requestRender();
  }

  up() {
    if (!this.drag) return;
    const { index, tx, ty } = this.drag;
    const s = this.doc.shapes[index];
    const moved = { tx: s.tx, ty: s.ty };
    s.tx = tx; // restore, then commit through change() so it can be undone
    s.ty = ty;
    this.doc.updateShape(index, (shape) => Object.assign(shape, moved));
    this.drag = null;
  }

  cancel() {
    this.drag = null;
  }
}

// Surfaces: drag a horizontal line where things can be put down. Tap one to remove it.
export class SurfaceTool extends Tool {
  static id = 'surface';
  static icon = '<path d="M6 30 H42" stroke="#3aa76d" stroke-width="5"/><circle cx="18" cy="22" r="6" fill="#e04f3a"/>';

  down(p) {
    const surfaces = this.doc.def.surfaces ?? [];
    const hit = surfaces.findIndex((s) => p.x >= s.x && p.x <= s.x + s.w && Math.abs(p.y - s.y) < 10);
    if (hit >= 0) {
      this.doc.change((def) => {
        def.surfaces.splice(hit, 1);
        if (!def.surfaces.length) delete def.surfaces;
      });
      return;
    }
    this.start = p;
    this.end = p;
  }

  move(p) {
    if (!this.start) return;
    this.end = p;
    this.app.requestRender();
  }

  up() {
    if (!this.start) return;
    const x = Math.round(Math.min(this.start.x, this.end.x));
    const w = Math.round(Math.abs(this.end.x - this.start.x));
    if (w > 10) this.doc.change((def) => (def.surfaces ??= []).push({ x, w, y: Math.round(this.start.y) }));
    this.start = null;
  }

  cancel() {
    this.start = null;
  }

  preview(ctx, scale) {
    if (!this.start) return;
    dashed(ctx, '#3aa76d', scale);
    ctx.beginPath();
    ctx.moveTo(this.start.x, this.start.y);
    ctx.lineTo(this.end.x, this.start.y);
    ctx.stroke();
  }
}

// Where a container shows its contents.
export class AreaTool extends BoxTool {
  static id = 'area';
  static icon = '<rect x="8" y="12" width="32" height="26" rx="3" stroke="#3a7bd5" stroke-dasharray="5 4"/><circle cx="20" cy="28" r="5" fill="#e04f3a"/><circle cx="30" cy="28" r="5" fill="#6aa84f"/>';

  commit(b) {
    const current = this.doc.behavior('Container') ?? { slots: 4 };
    const { type, ...config } = current;
    this.doc.setBehavior('Container', { ...config, area: [b.x, b.y, b.w, b.h] });
  }

  preview(ctx, scale) {
    if (!this.start) return;
    const b = this.box;
    dashed(ctx, '#3a7bd5', scale);
    ctx.strokeRect(b.x, b.y, b.w, b.h);
  }
}

// The see-through part of a window or door.
export class OpeningTool extends BoxTool {
  static id = 'opening';
  static icon = '<rect x="8" y="8" width="32" height="32" rx="2" fill="#9fd3f2"/><path d="M24 8 V40 M8 24 H40" stroke="#fff" stroke-width="4"/>';

  commit(b) {
    this.doc.change((def) => {
      def.opening = [{ type: 'rect', ...b }];
    });
  }

  preview(ctx, scale) {
    if (!this.start) return;
    const b = this.box;
    dashed(ctx, '#8a4fd8', scale);
    ctx.strokeRect(b.x, b.y, b.w, b.h);
  }
}

export class LightTool extends Tool {
  static id = 'light';
  static icon = '<circle cx="24" cy="20" r="11" fill="#ffd166"/><path d="M19 34 H29 M20 39 H28"/>';

  down(p) {
    this.doc.change((def) => {
      def.light = { r: 220, ...def.light, x: Math.round(p.x), y: Math.round(p.y) };
    });
  }
}

// Sets the pivot (turning point) of the part being drawn.
export class PivotTool extends Tool {
  static id = 'pivot';
  static icon = '<circle cx="24" cy="24" r="6" fill="#e8735a"/><path d="M24 6 V16 M24 32 V42 M6 24 H16 M32 24 H42"/><path d="M36 12 A17 17 0 0 1 40 30" stroke-dasharray="3 4"/>';

  down(p) {
    const part = this.app.part;
    if (!part) {
      this.app.toast(this.app.t('studio.animation.pickPart'));
      return;
    }
    this.doc.change((def) => {
      const entry = def.parts?.find((x) => x.id === part);
      if (entry) entry.pivot = [Math.round(p.x), Math.round(p.y)];
    });
  }
}

export const DRAW_TOOLS = [PenTool, FillTool, RectTool, EllipseTool, EraserTool, MoveTool];
export const AREA_TOOLS = [SurfaceTool, AreaTool, OpeningTool, LightTool, PivotTool];
