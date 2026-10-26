// Small preview image of a definition's first state (catalog, ZzStudio library).
import { drawArt, seedFor } from '../engine/art.js';

export function firstState(def) {
  const toggle = def.behaviors?.find((b) => b.type === 'Toggle');
  return def.initialState ?? toggle?.states?.[0] ?? Object.keys(def.art ?? {})[0] ?? 'default';
}

export function drawThumbnail(canvas, def, size = 90) {
  const dpr = Math.min(window.devicePixelRatio || 1, 2);
  canvas.width = canvas.height = Math.round(size * dpr);
  const ctx = canvas.getContext('2d');
  const [w, h] = def.size ?? [100, 100];
  const pad = 6;
  const s = ((size - pad * 2) / Math.max(w, h)) * dpr;
  ctx.setTransform(s, 0, 0, s, (canvas.width - w * s) / 2, (canvas.height - h * s) / 2);
  const state = firstState(def);
  const color = (slot) => def.colorSlots?.[slot] ?? '#999999';
  for (const field of ['art', 'artFront']) {
    const art = def[field]?.[state] ?? def[field]?.default;
    if (art) drawArt(ctx, art, color, { seed: seedFor(def.id) });
  }
  return canvas;
}
