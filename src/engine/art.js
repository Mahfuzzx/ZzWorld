// Draws definition art: a list of shapes in the entity's local box
// (0,0 = top-left, size = def.size). Colours starting with "$" are colour slots.
//
// Shape types:
//   rect, ellipse, circle, path  — outlined shapes, drawn hand-drawn with Rough.js
//   ink                          — freehand pen stroke (perfect-freehand)
//   fill                         — freehand closed area with an ink outline
// Shapes without an outline ("stroke": null) or with "rough": false are drawn plain.
import { getStroke } from '../../vendor/perfect-freehand/index.js';
import rough from '../../vendor/roughjs/rough.esm.js';

export const INK = '#3b2f2a';
export const SHAPE_TYPES = ['rect', 'ellipse', 'circle', 'path', 'ink', 'fill'];

const generator = rough.generator();
// Generated geometry depends only on the shape and its seed, so it is cached.
const geometryCache = new WeakMap();

function cached(shape, key, build) {
  let entry = geometryCache.get(shape);
  if (!entry) geometryCache.set(shape, (entry = new Map()));
  if (!entry.has(key)) entry.set(key, build());
  return entry.get(key);
}

function roundRectD(x, y, w, h, r) {
  r = Math.min(r, w / 2, h / 2);
  return `M${x + r} ${y} H${x + w - r} Q${x + w} ${y} ${x + w} ${y + r} V${y + h - r} `
    + `Q${x + w} ${y + h} ${x + w - r} ${y + h} H${x + r} Q${x} ${y + h} ${x} ${y + h - r} `
    + `V${y + r} Q${x} ${y} ${x + r} ${y} Z`;
}

// Smooth closed SVG path through polygon points (midpoint quadratic curves).
function smoothClosedD(points) {
  if (points.length < 3) return '';
  const mid = (a, b) => [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2];
  const n = points.length;
  let d = `M${mid(points[n - 1], points[0]).join(' ')}`;
  for (let i = 0; i < n; i++) {
    const p = points[i];
    const m = mid(p, points[(i + 1) % n]);
    d += ` Q${p[0]} ${p[1]} ${m[0]} ${m[1]}`;
  }
  return `${d} Z`;
}

export function shapePath(s) {
  switch (s.type) {
    case 'rect': {
      const p = new Path2D();
      if (s.r) p.roundRect(s.x, s.y, s.w, s.h, s.r);
      else p.rect(s.x, s.y, s.w, s.h);
      return p;
    }
    case 'ellipse': {
      const p = new Path2D();
      p.ellipse(s.cx, s.cy, s.rx, s.ry, s.rotation ?? 0, 0, Math.PI * 2);
      return p;
    }
    case 'circle': {
      const p = new Path2D();
      p.arc(s.cx, s.cy, s.r, 0, Math.PI * 2);
      return p;
    }
    case 'path':
      return new Path2D(s.d);
    case 'fill':
      return new Path2D(cached(s, 'fill', () => smoothClosedD(s.points)));
    case 'ink':
      return new Path2D(cached(s, 'ink', () => smoothClosedD(inkOutline(s))));
    default:
      return null;
  }
}

function inkOutline(s, closed = false) {
  const points = closed ? [...s.points, s.points[0]] : s.points;
  const hasPressure = points.some((p) => p[2] !== undefined && p[2] !== 0.5);
  return getStroke(points, {
    size: s.size ?? 6,
    thinning: 0.6,
    smoothing: 0.5,
    streamline: 0.5,
    simulatePressure: !hasPressure,
    last: true,
  });
}

// Rough.js geometry for outlined primitive shapes, as SVG path data.
function roughPaths(s, seed, fill, stroke) {
  const options = {
    seed,
    roughness: 0.9,
    bowing: 0.8,
    stroke,
    strokeWidth: (s.lw ?? 4) * 0.75,
    fill: fill ?? undefined,
    fillStyle: 'solid',
  };
  let drawable;
  switch (s.type) {
    case 'rect':
      drawable = s.r
        ? generator.path(roundRectD(s.x, s.y, s.w, s.h, s.r), options)
        : generator.rectangle(s.x, s.y, s.w, s.h, options);
      break;
    case 'ellipse':
      drawable = generator.ellipse(s.cx, s.cy, s.rx * 2, s.ry * 2, options);
      break;
    case 'circle':
      drawable = generator.circle(s.cx, s.cy, s.r * 2, options);
      break;
    case 'path':
      drawable = generator.path(s.d, options);
      break;
    default:
      return null;
  }
  return generator.toPaths(drawable);
}

export function drawArt(ctx, shapes, color, { seed = 1, rough: roughOn = true } = {}) {
  const resolve = (c) => (typeof c === 'string' && c.startsWith('$') ? color(c.slice(1)) : c);
  shapes.forEach((s, i) => {
    ctx.save();
    if (s.tx || s.ty) ctx.translate(s.tx ?? 0, s.ty ?? 0); // set when a shape is moved in ZzStudio
    ctx.globalAlpha = s.alpha ?? 1;
    // Outlines are on by default (ink); "stroke": null turns them off.
    const stroke = s.stroke === undefined ? INK : resolve(s.stroke);
    const fill = resolve(s.fill);

    if (s.type === 'ink') {
      ctx.fillStyle = resolve(s.color) ?? INK;
      ctx.fill(shapePath(s));
    } else if (s.type === 'fill') {
      if (fill) {
        ctx.fillStyle = fill;
        ctx.fill(shapePath(s));
      }
      if (stroke) {
        ctx.fillStyle = stroke;
        ctx.fill(new Path2D(cached(s, 'outline', () => smoothClosedD(inkOutline({ ...s, size: s.lw ?? 4 }, true)))));
      }
    } else if (roughOn && stroke && s.rough !== false && s.rule !== 'evenodd' && SHAPE_TYPES.includes(s.type)) {
      const key = `rough|${seed + i}|${fill}|${stroke}`;
      const paths = cached(s, key, () => roughPaths(s, seed + i, fill, stroke)) ?? [];
      ctx.lineCap = 'round';
      ctx.lineJoin = 'round';
      for (const p of paths) {
        const path = new Path2D(p.d);
        if (p.fill && p.fill !== 'none') {
          ctx.fillStyle = p.fill;
          ctx.fill(path);
        }
        if (p.stroke && p.stroke !== 'none') {
          ctx.strokeStyle = p.stroke;
          ctx.lineWidth = p.strokeWidth;
          ctx.stroke(path);
        }
      }
    } else {
      const path = shapePath(s);
      if (!path) {
        console.warn(`Unknown shape type: ${s.type}`);
      } else {
        if (fill) {
          ctx.fillStyle = fill;
          ctx.fill(path, s.rule ?? 'nonzero'); // "evenodd" cuts holes (window frames)
        }
        if (stroke) {
          ctx.strokeStyle = stroke;
          ctx.lineWidth = s.lw ?? 4;
          ctx.lineJoin = 'round';
          ctx.lineCap = 'round';
          ctx.stroke(path);
        }
      }
    }
    ctx.restore();
  });
}

// Seed for an entity's art, so every object of a kind looks the same but
// different kinds wobble differently.
export function seedFor(id) {
  let h = 2166136261;
  for (let i = 0; i < id.length; i++) h = Math.imul(h ^ id.charCodeAt(i), 16777619);
  return (h >>> 0) % 100000;
}
