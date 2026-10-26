// Character creator: a full-screen, text-free screen. Category tabs on the
// right, picture tiles for every choice, colour swatches below, a big live
// preview on the left. Tap the preview to make the character jump.
import { t, pick } from '../shared/i18n.js';
import { Animator } from '../engine/animator.js';
import { drawArt, seedFor } from '../engine/art.js';
import { partGroups, applyPartFx } from '../engine/compose.js';
import {
  AGES, SKELETONS, SKIN_TONES, HAIR_COLORS, EYE_COLORS, CLOTH_COLORS, EYE_STYLES,
  composeArt, composeDef, randomLook,
} from '../engine/character.js';

const ICONS = {
  age: '<circle cx="14" cy="14" r="5"/><path d="M8 40 V24 h12 V40"/><circle cx="34" cy="10" r="6"/><path d="M27 42 V20 h14 V42"/>',
  skin: '<path d="M24 6 C34 20 38 26 38 32 a14 14 0 0 1 -28 0 C10 26 14 20 24 6 Z" fill="#e8ad83"/>',
  hair: '<circle cx="24" cy="28" r="13" fill="#f1c19a"/><path d="M10 28 C8 6 40 6 38 28 C32 18 18 18 10 28 Z" fill="#7a4a2a"/>',
  eyes: '<path d="M4 24 Q24 6 44 24 Q24 42 4 24 Z" fill="#fff"/><circle cx="24" cy="24" r="7" fill="#3a7bd5"/>',
  top: '<path d="M14 8 L20 4 Q24 9 28 4 L34 8 L42 18 L35 22 L34 42 H14 L13 22 L6 18 Z" fill="#e04f3a"/>',
  bottom: '<path d="M12 6 H36 L38 42 H27 L24 20 L21 42 H10 Z" fill="#4f8fe0"/>',
  shoes: '<path d="M6 32 V20 h12 v8 l18 4 a6 6 0 0 1 6 6 v2 H6 Z" fill="#ffd166"/>',
  head: '<path d="M8 30 C8 8 40 8 40 30 Z" fill="#e04f3a"/><path d="M30 26 L46 30 L44 34 L28 31 Z" fill="#e04f3a"/>',
  face: '<circle cx="15" cy="24" r="8"/><circle cx="33" cy="24" r="8"/><path d="M23 24 h2"/>',
  extras: '<path d="M24 4 L29 18 L44 18 L32 27 L36 42 L24 33 L12 42 L16 27 L4 18 L19 18 Z" fill="#ffd166"/>',
  done: '<path d="M8 26 L20 38 L40 10" stroke-width="6"/>',
  cancel: '<path d="M12 12 L36 36 M36 12 L12 36" stroke-width="6"/>',
  dice: '<rect x="6" y="6" width="36" height="36" rx="8" fill="#fff"/><circle cx="16" cy="16" r="3.5" fill="#3b2f2a"/><circle cx="32" cy="32" r="3.5" fill="#3b2f2a"/><circle cx="24" cy="24" r="3.5" fill="#3b2f2a"/>',
  none: '<circle cx="24" cy="24" r="16"/><path d="M13 35 L35 13"/>',
};

const svg = (name) => `<svg viewBox="0 0 48 48">${ICONS[name]}</svg>`;
const SLOT_TABS = ['top', 'bottom', 'shoes', 'head', 'face'];
const TABS = ['age', 'skin', 'hair', 'eyes', ...SLOT_TABS, 'extras'];

function el(tag, className, attrs = {}) {
  const e = document.createElement(tag);
  if (className) e.className = className;
  for (const [k, v] of Object.entries(attrs)) {
    if (k === 'html') e.innerHTML = v;
    else if (k.startsWith('on')) e.addEventListener(k.slice(2), v);
    else e.setAttribute(k, v);
  }
  return e;
}

// Draws a look into a canvas; `focus` crops to the head or shows the body.
function drawLook(canvas, look, defs, { size = 84, focus = 'all' } = {}) {
  const dpr = Math.min(window.devicePixelRatio || 1, 2);
  canvas.width = canvas.height = Math.round(size * dpr);
  const ctx = canvas.getContext('2d');
  const sk = SKELETONS[look.age];
  const [w, h] = sk.size;
  const view = focus === 'head'
    ? { x: sk.head.cx - sk.head.r * 1.45, y: sk.head.cy - sk.head.r * 1.5, w: sk.head.r * 2.9, h: sk.head.r * 2.9 }
    : focus === 'legs'
      ? { x: 0, y: sk.legs[0].y - 30, w, h: h - sk.legs[0].y + 40 }
      : { x: -10, y: -14, w: w + 20, h: h + 20 };
  const s = (canvas.width / Math.max(view.w, view.h));
  ctx.setTransform(s, 0, 0, s, -view.x * s + (canvas.width - view.w * s) / 2, -view.y * s + (canvas.height - view.h * s) / 2);
  drawArt(ctx, composeArt(look, defs, 'happy'), () => '#999999', { seed: 7 });
  return canvas;
}

export function openCreator({ root, defs, look: startLook, onDone, onCancel, onGesture }) {
  let look = JSON.parse(JSON.stringify(startLook));
  let tab = 'age';
  const parts = (slot) => defs.ids()
    .map((id) => { try { return defs.get(id); } catch { return null; } })
    .filter((p) => p?.kind === 'part' && p.slot === slot);
  const fits = (p) => !p.ages || p.ages.includes(look.age);

  const screen = el('div', 'creator');
  const stage = el('canvas', 'creator-stage', { 'aria-label': t('creator.preview') });
  const tabs = el('div', 'creator-tabs');
  const options = el('div', 'creator-options');
  const colors = el('div', 'creator-colors');
  const button = (icon, cls, label, onclick) => el('button', `hud-btn ${cls}`, { type: 'button', html: svg(icon), 'aria-label': label, title: label, onclick });

  const close = () => {
    cancelAnimationFrame(frameId);
    screen.remove();
  };
  const bar = el('div', 'creator-bar');
  bar.append(
    button('cancel', 'creator-cancel', t('creator.cancel'), () => { close(); onCancel?.(); }),
    button('dice', 'creator-dice', t('creator.random'), () => {
      onGesture?.();
      look = randomLook(defs, look.age);
      refresh();
      jump();
    }),
    button('done', 'creator-done', t('creator.done'), () => { close(); onDone(look); }),
  );

  const side = el('div', 'creator-side');
  side.append(tabs, options, colors);
  screen.append(stage, side, bar);
  root.append(screen);

  // ---- live preview ----
  const animator = new Animator();
  const preview = { def: null, state: 'happy', fx: null, partFx: null, frames: null, wantedIdle: () => 'idle', idleClip: null };
  const rebuild = () => {
    preview.def = composeDef(defs.get('core.character'), look, defs);
    preview.idleClip = null;
  };
  const jump = () => {
    preview.state = 'laugh';
    animator.play(preview, 'jump').then(() => { preview.state = 'happy'; });
  };
  stage.addEventListener('pointerdown', () => {
    onGesture?.();
    jump();
  });
  let last = performance.now();
  let frameId = 0;
  const draw = (now) => {
    const dt = Math.min(Math.max(0, (now - last) / 1000), 0.05);
    last = now;
    animator.syncIdle(preview);
    animator.update(dt);
    const rect = stage.getBoundingClientRect();
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    if (stage.width !== Math.round(rect.width * dpr)) stage.width = Math.round(rect.width * dpr);
    if (stage.height !== Math.round(rect.height * dpr)) stage.height = Math.round(rect.height * dpr);
    const ctx = stage.getContext('2d');
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.clearRect(0, 0, stage.width, stage.height);
    const [w, h] = preview.def.size;
    const s = Math.min(stage.width / (w * 1.5), (stage.height * 0.86) / 340);
    ctx.setTransform(s, 0, 0, s, stage.width / 2, stage.height * 0.93);
    // floor shadow
    ctx.fillStyle = 'rgba(59, 47, 42, 0.15)';
    ctx.beginPath();
    ctx.ellipse(0, 0, w * 0.55, 12, 0, 0, Math.PI * 2);
    ctx.fill();
    const fx = preview.fx;
    if (fx) {
      ctx.translate(fx.dx, fx.dy);
      ctx.translate(0, -h / 2);
      ctx.rotate(fx.rot);
      ctx.translate(0, h / 2);
      ctx.scale(fx.sx, fx.sy);
    }
    ctx.translate(-w / 2, -h);
    for (const group of partGroups(preview.def, preview.state, 'art', null)) {
      ctx.save();
      applyPartFx(ctx, group.pivot, group.part ? preview.partFx?.[group.part] : null);
      drawArt(ctx, group.shapes, () => '#999999', { seed: seedFor(preview.def.id) });
      ctx.restore();
    }
    frameId = requestAnimationFrame(draw);
  };

  // ---- choices ----
  const tile = (canvasOrIcon, selected, label, onclick) => {
    const b = el('button', `creator-tile${selected ? ' selected' : ''}`, { type: 'button', title: label, 'aria-label': label, onclick: () => {
      onGesture?.();
      onclick();
      refresh();
      jump();
    } });
    if (typeof canvasOrIcon === 'string') b.innerHTML = svg(canvasOrIcon);
    else b.append(canvasOrIcon);
    return b;
  };
  const swatches = (list, current, onpick) => list.map((c) => {
    const b = el('button', `creator-swatch${c === current ? ' selected' : ''}`, { type: 'button', title: c, 'aria-label': c, onclick: () => {
      onGesture?.();
      onpick(c);
      refresh();
    } });
    b.style.background = c;
    return b;
  });
  const focusFor = (slot) => (['hair', 'head', 'face', 'eyes'].includes(slot) ? 'head' : slot === 'bottom' || slot === 'shoes' ? 'legs' : 'all');
  const variant = (patch) => drawLook(document.createElement('canvas'), { ...look, ...patch }, defs, { focus: focusFor(tab) });

  function renderOptions() {
    const list = [];
    let palette = [];
    if (tab === 'age') {
      for (const age of AGES) {
        const grown = { ...look, age };
        // keep only parts that fit the new age
        for (const slot of ['hair', ...SLOT_TABS]) {
          const p = look[slot] && defs.has(look[slot]) ? defs.get(look[slot]) : null;
          if (p?.ages && !p.ages.includes(age)) grown[slot] = parts(slot).find((x) => !x.ages || x.ages.includes(age))?.id ?? null;
        }
        grown.extras = (look.extras ?? []).filter((id) => { const p = defs.get(id); return !p.ages || p.ages.includes(age); });
        list.push(tile(drawLook(document.createElement('canvas'), grown, defs), look.age === age, t(`creator.ages.${age}`), () => { look = grown; }));
      }
    } else if (tab === 'skin') {
      palette = swatches(SKIN_TONES, look.skin, (c) => { look.skin = c; });
      list.push(tile(variant({}), true, t('creator.tabs.skin'), () => {}));
    } else if (tab === 'hair') {
      list.push(tile('none', !look.hair, t('creator.none'), () => { look.hair = null; }));
      for (const p of parts('hair').filter(fits)) list.push(tile(variant({ hair: p.id }), look.hair === p.id, pick(p.name), () => { look.hair = p.id; }));
      palette = swatches(HAIR_COLORS, look.hairColor, (c) => { look.hairColor = c; });
    } else if (tab === 'eyes') {
      for (const style of EYE_STYLES) list.push(tile(variant({ eyes: style }), look.eyes === style, style, () => { look.eyes = style; }));
      palette = swatches(EYE_COLORS, look.eyeColor, (c) => { look.eyeColor = c; });
    } else if (SLOT_TABS.includes(tab)) {
      const slot = tab;
      list.push(tile('none', !look[slot], t('creator.none'), () => { look[slot] = null; }));
      for (const p of parts(slot).filter(fits)) list.push(tile(variant({ [slot]: p.id }), look[slot] === p.id, pick(p.name), () => { look[slot] = p.id; }));
      const current = look[slot] ? defs.get(look[slot]) : null;
      palette = swatches(CLOTH_COLORS, look.colors?.[slot] ?? current?.color, (c) => { look.colors = { ...look.colors, [slot]: c }; });
    } else if (tab === 'extras') {
      for (const p of parts('extra').filter(fits)) {
        const on = (look.extras ?? []).includes(p.id);
        list.push(tile(variant({ extras: on ? look.extras : [...(look.extras ?? []), p.id] }), on, pick(p.name), () => {
          look.extras = on ? look.extras.filter((x) => x !== p.id) : [...(look.extras ?? []), p.id];
        }));
      }
    }
    options.replaceChildren(...list);
    colors.replaceChildren(...palette);
  }

  function renderTabs() {
    tabs.replaceChildren(...TABS.map((name) => el('button', `creator-tab${name === tab ? ' selected' : ''}`, {
      type: 'button', html: svg(name), title: t(`creator.tabs.${name}`), 'aria-label': t(`creator.tabs.${name}`),
      onclick: () => {
        onGesture?.();
        tab = name;
        renderTabs();
        renderOptions();
      },
    })));
  }

  function refresh() {
    rebuild();
    renderTabs();
    renderOptions();
  }

  refresh();
  frameId = requestAnimationFrame(draw);
  return { close };
}
