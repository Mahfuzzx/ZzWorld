// Envelope warping: bending one drawing so it hugs the outline of another.
// Used for clothes and hair on characters and for covers (a tablecloth on a
// table). Pure geometry — no canvas — so it works the same everywhere.
//
//   envelope(shapes)          the outline: for any height y, the leftmost and
//                             rightmost x of the drawing (extent(y) → [l, r])
//   warpShape(shape, map)     a copy of the shape with every point moved by
//                             map(x, y) → [x, y]; curves are flattened first

const CURVE_STEPS = 10;
const MAX_SEGMENT = 4; // long straight edges are split so they can bend

// ---------- flattening ----------

function arcPoints(cx, cy, rx, ry, rotation = 0, from = 0, to = Math.PI * 2, steps = 36) {
  const cos = Math.cos(rotation);
  const sin = Math.sin(rotation);
  const out = [];
  for (let i = 0; i <= steps; i++) {
    const a = from + ((to - from) * i) / steps;
    const x = rx * Math.cos(a);
    const y = ry * Math.sin(a);
    out.push([cx + x * cos - y * sin, cy + x * sin + y * cos]);
  }
  return out;
}

function roundRectPoints(x, y, w, h, r) {
  r = Math.max(0, Math.min(r ?? 0, w / 2, h / 2));
  if (!r) return [[x, y], [x + w, y], [x + w, y + h], [x, y + h]];
  const q = Math.PI / 2;
  return [
    ...arcPoints(x + w - r, y + r, r, r, 0, -q, 0, 6),
    ...arcPoints(x + w - r, y + h - r, r, r, 0, 0, q, 6),
    ...arcPoints(x + r, y + h - r, r, r, 0, q, 2 * q, 6),
    ...arcPoints(x + r, y + r, r, r, 0, 2 * q, 3 * q, 6),
  ];
}

// Absolute SVG path commands (M L H V C Q Z) → polylines.
function pathPolylines(d) {
  const tokens = d.match(/[MLHVCQZ]|-?\d*\.?\d+(?:e-?\d+)?/gi) ?? [];
  const lines = [];
  let line = null;
  let cmd = 'M';
  let i = 0;
  let x = 0;
  let y = 0;
  const num = () => Number(tokens[i++]);
  while (i < tokens.length) {
    if (/^[A-Za-z]$/.test(tokens[i])) cmd = tokens[i++].toUpperCase();
    switch (cmd) {
      case 'M':
        x = num(); y = num();
        line = { points: [[x, y]], closed: false };
        lines.push(line);
        cmd = 'L';
        break;
      case 'L':
        x = num(); y = num();
        line.points.push([x, y]);
        break;
      case 'H':
        x = num();
        line.points.push([x, y]);
        break;
      case 'V':
        y = num();
        line.points.push([x, y]);
        break;
      case 'C': {
        const [x1, y1, x2, y2, x3, y3] = [num(), num(), num(), num(), num(), num()];
        for (let s = 1; s <= CURVE_STEPS; s++) {
          const t = s / CURVE_STEPS;
          const m = 1 - t;
          line.points.push([
            m * m * m * x + 3 * m * m * t * x1 + 3 * m * t * t * x2 + t * t * t * x3,
            m * m * m * y + 3 * m * m * t * y1 + 3 * m * t * t * y2 + t * t * t * y3,
          ]);
        }
        x = x3; y = y3;
        break;
      }
      case 'Q': {
        const [x1, y1, x2, y2] = [num(), num(), num(), num()];
        for (let s = 1; s <= CURVE_STEPS; s++) {
          const t = s / CURVE_STEPS;
          const m = 1 - t;
          line.points.push([m * m * x + 2 * m * t * x1 + t * t * x2, m * m * y + 2 * m * t * y1 + t * t * y2]);
        }
        x = x2; y = y2;
        break;
      }
      case 'Z':
        if (line) {
          line.closed = true;
          [x, y] = line.points[0];
        }
        cmd = 'M';
        break;
      default:
        i++; // unsupported command: skip
    }
  }
  return lines.filter((l) => l.points.length > 1);
}

// Shape → [{ points: [[x, y]…], closed }] in the shape's own coordinates.
export function flatten(s) {
  const tx = s.tx ?? 0;
  const ty = s.ty ?? 0;
  let lines;
  switch (s.type) {
    case 'rect': lines = [{ points: roundRectPoints(s.x, s.y, s.w, s.h, s.r), closed: true }]; break;
    case 'ellipse': lines = [{ points: arcPoints(s.cx, s.cy, s.rx, s.ry, s.rotation ?? 0), closed: true }]; break;
    case 'circle': lines = [{ points: arcPoints(s.cx, s.cy, s.r, s.r), closed: true }]; break;
    case 'path': lines = pathPolylines(s.d); break;
    case 'fill': lines = [{ points: s.points.map((p) => [p[0], p[1]]), closed: true }]; break;
    case 'ink': lines = [{ points: s.points.map((p) => [p[0], p[1]]), closed: false }]; break;
    default: lines = [];
  }
  if (tx || ty) for (const l of lines) l.points = l.points.map(([x, y]) => [x + tx, y + ty]);
  return lines;
}

function subdivide(points, closed) {
  const out = [];
  const n = points.length;
  for (let i = 0; i < n; i++) {
    const a = points[i];
    out.push(a);
    if (!closed && i === n - 1) break;
    const b = points[(i + 1) % n];
    const steps = Math.floor(Math.hypot(b[0] - a[0], b[1] - a[1]) / MAX_SEGMENT);
    for (let k = 1; k < steps; k++) out.push([a[0] + ((b[0] - a[0]) * k) / steps, a[1] + ((b[1] - a[1]) * k) / steps]);
  }
  return out;
}

// ---------- envelope ----------

// The outline of the filled parts of a drawing, one row at a time.
export function envelope(shapes) {
  const polys = [];
  for (const s of shapes) {
    if (!s.fill && s.type !== 'ink' && s.type !== 'fill') continue;
    for (const l of flatten(s)) if (l.points.length > 2) polys.push(l.points);
  }
  let top = Infinity;
  let bottom = -Infinity;
  for (const p of polys) for (const [, y] of p) {
    top = Math.min(top, y);
    bottom = Math.max(bottom, y);
  }
  const cache = new Map();
  const extent = (y) => {
    const key = Math.round(y * 2) / 2;
    if (cache.has(key)) return cache.get(key);
    let l = Infinity;
    let r = -Infinity;
    for (const p of polys) {
      for (let i = 0; i < p.length; i++) {
        const [x1, y1] = p[i];
        const [x2, y2] = p[(i + 1) % p.length];
        if ((y1 <= key && y2 > key) || (y2 <= key && y1 > key)) {
          const x = x1 + ((key - y1) / (y2 - y1)) * (x2 - x1);
          l = Math.min(l, x);
          r = Math.max(r, x);
        }
      }
    }
    const result = l < r ? [l, r] : null;
    cache.set(key, result);
    return result;
  };
  return { top, bottom, extent };
}

// ---------- warping ----------

function pathD(lines) {
  const n = (v) => Math.round(v * 10) / 10;
  return lines.map((l) => `M${l.points.map(([x, y]) => `${n(x)} ${n(y)}`).join(' L')}${l.closed ? ' Z' : ''}`).join(' ');
}

export function warpShape(s, map) {
  if (s.type === 'ink' || s.type === 'fill') {
    return { ...s, tx: undefined, ty: undefined, points: s.points.map((p) => [...map(p[0] + (s.tx ?? 0), p[1] + (s.ty ?? 0)), ...p.slice(2)]) };
  }
  const lines = flatten(s).map((l) => ({ closed: l.closed, points: subdivide(l.points, l.closed).map(([x, y]) => map(x, y)) }));
  const { x, y, w, h, r, cx, cy, rx, ry, rotation, d, tx, ty, ...rest } = s;
  return { ...rest, type: 'path', d: pathD(lines) };
}

// A map from a 0–100 box onto a region whose sides follow an envelope:
// u (0–100) runs from the outline's left edge to its right edge at that height,
// v (0–100) runs down the region box. Rows outside the outline fall back to the
// plain box. Above or below the outline the nearest row of it is used, so
// edges don't jump out to the box. `pad` leaves room for the cloth's thickness.
export function fitMap(box, env, { pad = 1.5 } = {}) {
  return (u, v) => {
    const y = box.y + (v * box.h) / 100;
    const ext = env.extent(y) ?? env.extent(Math.min(Math.max(y, env.top + 0.5), env.bottom - 0.5));
    if (!ext) return [box.x + (u * box.w) / 100, y];
    const l = ext[0] - pad;
    const r = ext[1] + pad;
    return [l + (u / 100) * (r - l), y];
  };
}

// Like fitMap, but each row takes the widest outline above it, so a cover hangs
// straight down from the widest point (a tablecloth over the table top).
export function drapeMap(box, env, { pad = 3 } = {}) {
  let widest = null;
  let lastY = -Infinity;
  const rows = [];
  for (let y = box.y; y <= box.y + box.h + 1; y += 1) {
    const ext = env.extent(y);
    if (ext) widest = widest ? [Math.min(widest[0], ext[0]), Math.max(widest[1], ext[1])] : ext;
    rows.push(widest);
    lastY = y;
  }
  return (u, v) => {
    const y = box.y + (v * box.h) / 100;
    const ext = rows[Math.max(0, Math.min(rows.length - 1, Math.round(y - box.y)))] ?? null;
    if (!ext || y > lastY + 1) return [box.x + (u * box.w) / 100, y];
    const l = ext[0] - pad;
    const r = ext[1] + pad;
    return [l + (u / 100) * (r - l), y];
  };
}
