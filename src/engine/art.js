// Draws definition art: a list of simple shapes in the entity's local box
// (0,0 = top-left, size = def.size). Colours starting with "$" are colour slots.
// Hand-drawn rendering (perfect-freehand / Rough.js) replaces this in ZzStudio's step.

export const INK = '#3b2f2a';

function shapePath(s) {
  const p = new Path2D();
  switch (s.type) {
    case 'rect':
      if (s.r) p.roundRect(s.x, s.y, s.w, s.h, s.r);
      else p.rect(s.x, s.y, s.w, s.h);
      return p;
    case 'ellipse':
      p.ellipse(s.cx, s.cy, s.rx, s.ry, s.rotation ?? 0, 0, Math.PI * 2);
      return p;
    case 'circle':
      p.arc(s.cx, s.cy, s.r, 0, Math.PI * 2);
      return p;
    case 'path':
      return new Path2D(s.d);
    default:
      console.warn(`Unknown shape type: ${s.type}`);
      return null;
  }
}

export function drawArt(ctx, shapes, color) {
  const resolve = (c) => (typeof c === 'string' && c.startsWith('$') ? color(c.slice(1)) : c);
  for (const s of shapes) {
    const path = shapePath(s);
    if (!path) continue;
    ctx.save();
    ctx.globalAlpha = s.alpha ?? 1;
    const fill = resolve(s.fill);
    if (fill) {
      ctx.fillStyle = fill;
      ctx.fill(path);
    }
    // Outlines are on by default (ink); "stroke": null turns them off.
    const stroke = s.stroke === undefined ? INK : resolve(s.stroke);
    if (stroke) {
      ctx.strokeStyle = stroke;
      ctx.lineWidth = s.lw ?? 4;
      ctx.lineJoin = 'round';
      ctx.lineCap = 'round';
      ctx.stroke(path);
    }
    ctx.restore();
  }
}
