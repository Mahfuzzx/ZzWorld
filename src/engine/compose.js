// Splits an entity's art into parts so each part can move on its own.
//
//   "parts": [{ "id": "blade", "pivot": [60, 50] }]   — parts and their pivots
//   shapes carry "part": "blade"; shapes without one belong to the body ("")
//
// Flipbook clips can replace a part's shapes (or the whole art) frame by frame.
// The result is a list of groups — runs of consecutive shapes of one part, so the
// drawing order never changes — each with a cache key.

export const BODY = '';

export function artFor(def, state, field = 'art') {
  return def[field]?.[state] ?? def[field]?.default ?? null;
}

// frames: { [part]: { shapes, key } } from running flipbook clips ("" = whole art)
export function partGroups(def, state, field = 'art', frames = null) {
  let shapes = artFor(def, state, field);
  let stateKey = state;
  const whole = field === 'art' ? frames?.[BODY] : null;
  if (whole) {
    shapes = whole.shapes;
    stateKey = `${state}~${whole.key}`;
  }
  if (!shapes) return [];

  const parts = def.parts ?? [];
  if (!parts.length) return [{ part: BODY, pivot: null, shapes, key: `${field}|${stateKey}` }];

  const known = new Set(parts.map((p) => p.id));
  const runs = [];
  for (const s of shapes) {
    const part = known.has(s.part) ? s.part : BODY;
    const last = runs.at(-1);
    if (last?.part === part) last.shapes.push(s);
    else runs.push({ part, shapes: [s] });
  }

  // A part's flipbook frame replaces its first run; its other runs are dropped.
  const partFrames = field === 'art' ? Object.entries(frames ?? {}).filter(([p]) => p !== BODY && known.has(p)) : [];
  for (const [part, frame] of partFrames) {
    const first = runs.findIndex((r) => r.part === part);
    const replacement = { part, shapes: frame.shapes, frameKey: frame.key };
    if (first < 0) runs.push(replacement);
    else runs.splice(first, 1, replacement);
    for (let i = runs.length - 1; i >= 0; i--) {
      if (runs[i].part === part && runs[i] !== replacement) runs.splice(i, 1);
    }
  }

  return runs.map((run, i) => ({
    part: run.part,
    pivot: parts.find((p) => p.id === run.part)?.pivot ?? null,
    shapes: run.shapes,
    key: `${field}|${stateKey}|${i}:${run.part}${run.frameKey ? `~${run.frameKey}` : ''}`,
  }));
}

// Applies a part's animation offsets around its pivot (local coordinates).
export function applyPartFx(ctx, pivot, fx) {
  if (!fx) return;
  const [px, py] = pivot ?? [0, 0];
  ctx.translate(px + (fx.dx ?? 0), py + (fx.dy ?? 0));
  ctx.rotate(fx.rot ?? 0);
  ctx.scale(fx.sx ?? 1, fx.sy ?? 1);
  ctx.translate(-px, -py);
}
