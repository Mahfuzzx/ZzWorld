// Characters are drawn from a "look" (age, skin, hair, clothes…) instead of
// fixed art. The look is composed into an ordinary definition — art per facial
// expression, parts with pivots — so drawing, animation and hit testing work
// exactly as for every other entity.
//
// Part definitions ("kind": "part") draw into body regions. Their shapes use a
// 0–100 box per region (stretched to the region), so one hat fits every age.
//   { "id": "core.part.top.tshirt", "kind": "part", "slot": "top", "color": "#e04f3a",
//     "ages": ["child", "adult"], "covers": ["bottom"], "hidesHair": true,
//     "art": { "torso": [...], "arm": [...], "leg": [...], "hips": [...],
//              "back": [...], "front": [...], "skin": [...], "face": [...], "hat": [...] } }
// back = behind the head, skin = on the face (freckles), front = hair/beard,
// face = glasses, hat = on top of everything.
// Colours: "$main" (the part's colour in the look), "$skin", "$hair", "$eye".
import { Item } from './entity.js';
import { Behavior } from './behavior.js';
import { envelope, warpShape, fitMap } from './warp.js';

export const AGES = ['baby', 'child', 'adult', 'elder'];
export const EXPRESSIONS = ['happy', 'laugh', 'surprised', 'sleepy', 'sad', 'grumpy'];
export const SLOTS = ['hair', 'top', 'bottom', 'shoes', 'head', 'face'];
export const EYE_STYLES = ['dots', 'round', 'lashes'];
// Hair sits on a head this much bigger than the skin (volume).
const HAIR_VOLUME = 1.07;

export const SKIN_TONES = ['#fde3cf', '#f9d0b0', '#f1c19a', '#e8ad83', '#d39468', '#b97a50', '#9c6340', '#7d4c2f', '#5f3a24', '#43281a'];
export const HAIR_COLORS = ['#2b2220', '#4a2f22', '#7a4a2a', '#a0522d', '#d2691e', '#e8c06a', '#f1e3b5', '#b8b4ad', '#f2f0ea', '#f28dbb', '#4f8fe0', '#3aa76d', '#8a6fd8'];
export const EYE_COLORS = ['#3b2f2a', '#6b4226', '#3a7bd5', '#3aa76d', '#7a7a7a'];
export const CLOTH_COLORS = ['#e04f3a', '#f28c38', '#ffd166', '#9bcf53', '#3aa76d', '#9fd3f2', '#4f8fe0', '#8a6fd8', '#f28dbb', '#ffffff', '#3b2f2a', '#c98a4b'];

// Body layout per age: big heads, short bodies. Rects are { x, y, w, h }.
const rect = (x, y, w, h) => ({ x, y, w, h });
export const SKELETONS = {
  baby: { size: [120, 170], head: { cx: 60, cy: 52, r: 46 }, torso: rect(34, 92, 52, 46),
    arms: [rect(18, 96, 16, 38), rect(86, 96, 16, 38)], legs: [rect(38, 134, 20, 30), rect(62, 134, 20, 30)] },
  child: { size: [140, 256], head: { cx: 70, cy: 60, r: 52 }, torso: rect(40, 108, 60, 72),
    arms: [rect(22, 112, 18, 64), rect(100, 112, 18, 64)], legs: [rect(46, 176, 22, 72), rect(72, 176, 22, 72)] },
  adult: { size: [150, 326], head: { cx: 75, cy: 56, r: 50 }, torso: rect(40, 102, 70, 106),
    arms: [rect(20, 106, 20, 98), rect(110, 106, 20, 98)], legs: [rect(46, 204, 26, 112), rect(78, 204, 26, 112)] },
  elder: { size: [150, 314], head: { cx: 75, cy: 58, r: 50 }, torso: rect(38, 104, 74, 100),
    arms: [rect(18, 108, 20, 92), rect(112, 108, 20, 92)], legs: [rect(46, 200, 26, 104), rect(78, 200, 26, 104)] },
};

export const DEFAULT_LOOK = {
  age: 'child',
  skin: SKIN_TONES[3],
  hair: 'core.part.hair.short',
  hairColor: HAIR_COLORS[1],
  eyes: 'dots',
  eyeColor: EYE_COLORS[0],
  top: 'core.part.top.tshirt',
  bottom: 'core.part.bottom.pants',
  shoes: 'core.part.shoes.sneakers',
  head: null,
  face: null,
  extras: [],
  colors: {},
};

// ---------- geometry: 0–100 region boxes → entity coordinates ----------

function mapPath(d, sx, sy, ox, oy) {
  // absolute M L H V C Q Z only (what part art uses)
  const tokens = d.match(/[MLHVCQZ]|-?\d*\.?\d+(?:e-?\d+)?/gi) ?? [];
  const out = [];
  let cmd = 'M';
  let axis = 0;
  for (const tok of tokens) {
    if (/^[A-Za-z]$/.test(tok)) {
      cmd = tok.toUpperCase();
      axis = 0;
      out.push(cmd);
      continue;
    }
    const n = Number(tok);
    let v;
    if (cmd === 'H') v = ox + n * sx;
    else if (cmd === 'V') v = oy + n * sy;
    else {
      v = axis % 2 === 0 ? ox + n * sx : oy + n * sy;
      axis++;
    }
    out.push(Math.round(v * 10) / 10);
  }
  return out.join(' ');
}

export function mapShape(s, box, part) {
  const sx = box.w / 100;
  const sy = box.h / 100;
  const X = (x) => box.x + x * sx;
  const Y = (y) => box.y + y * sy;
  let m;
  switch (s.type) {
    case 'rect': m = { ...s, x: X(s.x), y: Y(s.y), w: s.w * sx, h: s.h * sy, r: s.r ? s.r * Math.min(sx, sy) : undefined }; break;
    case 'ellipse': m = { ...s, cx: X(s.cx), cy: Y(s.cy), rx: s.rx * sx, ry: s.ry * sy }; break;
    case 'circle': m = { ...s, type: 'ellipse', cx: X(s.cx), cy: Y(s.cy), rx: s.r * sx, ry: s.r * sy, r: undefined }; break;
    case 'path': m = { ...s, d: mapPath(s.d, sx, sy, box.x, box.y) }; break;
    case 'ink':
    case 'fill': m = { ...s, points: s.points.map((p) => [X(p[0]), Y(p[1]), ...p.slice(2)]) }; break;
    default: m = { ...s };
  }
  if (part) m.part = part;
  return m;
}

// ---------- faces ----------

const INK = '#3b2f2a';
function eyes(style, expression) {
  const dot = (cx) => ({ type: 'circle', cx, cy: 50, r: 5.5, fill: '$eye', stroke: null });
  const closed = (cx) => ({ type: 'path', d: `M${cx - 7} 51 Q${cx} 55 ${cx + 7} 51`, lw: 3 });
  const arc = (cx) => ({ type: 'path', d: `M${cx - 7} 53 Q${cx} 43 ${cx + 7} 53`, lw: 3 });
  const big = (cx) => [{ type: 'circle', cx, cy: 49, r: 9, fill: '#ffffff', lw: 2 }, { type: 'circle', cx, cy: 50, r: 4.5, fill: '$eye', stroke: null }];
  const round = (cx) => [{ type: 'circle', cx, cy: 50, r: 7.5, fill: '#ffffff', lw: 2 }, { type: 'circle', cx: cx + 1, cy: 51, r: 4, fill: '$eye', stroke: null }];
  const lashes = (cx) => [dot(cx), { type: 'path', d: `M${cx - 4} 44 L${cx - 6} 39 M${cx} 43 L${cx} 38 M${cx + 4} 44 L${cx + 6} 39`, lw: 2, rough: false }];
  if (expression === 'sleepy') return [closed(34), closed(66)];
  if (expression === 'laugh') return [arc(34), arc(66)];
  if (expression === 'surprised') return [...big(34), ...big(66)];
  if (style === 'round') return [...round(34), ...round(66)];
  if (style === 'lashes') return [...lashes(34), ...lashes(66)];
  return [dot(34), dot(66)];
}

const MOUTHS = {
  happy: [{ type: 'path', d: 'M38 68 Q50 80 62 68', lw: 3.5 }],
  laugh: [{ type: 'path', d: 'M36 66 Q50 64 64 66 Q62 86 50 86 Q38 86 36 66 Z', fill: '#7a2e2e', lw: 3 },
    { type: 'ellipse', cx: 50, cy: 80, rx: 7, ry: 4, fill: '#e8735a', stroke: null }],
  surprised: [{ type: 'ellipse', cx: 50, cy: 74, rx: 6, ry: 8, fill: '#7a2e2e', lw: 3 }],
  sleepy: [{ type: 'path', d: 'M44 72 Q50 75 56 72', lw: 3 }],
  sad: [{ type: 'path', d: 'M39 77 Q50 67 61 77', lw: 3.5 }],
  grumpy: [{ type: 'path', d: 'M40 73 L60 73', lw: 3.5 }],
};

const BROWS = {
  surprised: [{ type: 'path', d: 'M26 34 Q34 29 42 34 M58 34 Q66 29 74 34', lw: 3, stroke: '$hair' }],
  sad: [{ type: 'path', d: 'M27 38 L41 34 M59 34 L73 38', lw: 3, stroke: '$hair' }],
  grumpy: [{ type: 'path', d: 'M27 35 L41 40 M59 40 L73 35', lw: 3.5, stroke: '$hair' }],
};

function face(style, expression) {
  const cheeks = expression === 'happy' || expression === 'laugh'
    ? [{ type: 'ellipse', cx: 24, cy: 64, rx: 7, ry: 5, fill: '#e8735a', alpha: 0.35, stroke: null },
      { type: 'ellipse', cx: 76, cy: 64, rx: 7, ry: 5, fill: '#e8735a', alpha: 0.35, stroke: null }]
    : [];
  return [...cheeks, ...(BROWS[expression] ?? []), ...eyes(style, expression), ...(MOUTHS[expression] ?? MOUTHS.happy)];
}

// ---------- composition ----------

function partDef(defs, id) {
  if (!id || !defs?.has(id)) return null;
  try {
    const def = defs.get(id);
    return def.kind === 'part' ? def : null;
  } catch {
    return null;
  }
}

function fits(part, age) {
  return !part?.ages || part.ages.includes(age);
}

// The parts a look actually wears (unknown or age-mismatched ones dropped).
export function wornParts(look, defs) {
  const worn = {};
  for (const slot of SLOTS) {
    const part = partDef(defs, look[slot]);
    if (part && fits(part, look.age)) worn[slot] = part;
  }
  if (worn.head?.hidesHair) delete worn.hair;
  for (const covered of worn.top?.covers ?? []) delete worn[covered];
  const extras = (look.extras ?? []).map((id) => partDef(defs, id)).filter((p) => p && fits(p, look.age));
  return { worn, extras };
}

function colorize(shapes, colors) {
  const swap = (c) => (typeof c === 'string' && c.startsWith('$') && colors[c.slice(1)] ? colors[c.slice(1)] : c);
  return shapes.map((s) => ({ ...s, fill: swap(s.fill), stroke: s.stroke === undefined ? undefined : swap(s.stroke), color: swap(s.color) }));
}

// Shapes for one expression, in entity coordinates, tagged with body parts.
export function composeArt(look, defs, expression = 'happy') {
  const sk = SKELETONS[look.age] ?? SKELETONS.child;
  const { worn, extras } = wornParts(look, defs);
  const { head } = sk;
  const headBox = rect(head.cx - head.r, head.cy - head.r, head.r * 2, head.r * 2);
  const [legL, legR] = sk.legs;
  const hips = rect(legL.x, legL.y, legR.x + legR.w - legL.x, legL.h);
  const base = { skin: look.skin, hair: look.hairColor, eye: look.eyeColor };
  const out = [];
  // Skin shapes go straight in; we keep them to know the body's outline.
  const skin = (shapes, box, part) => shapes.map((s) => {
    const m = mapShape(colorize([s], base)[0], box, part);
    out.push(m);
    return m;
  });
  const put = (shapes, box, part, colors = base) => {
    for (const s of colorize(shapes ?? [], colors)) out.push(mapShape(s, box, part));
  };
  // Clothes and hair bend to the outline of the body part they are on, so they
  // follow its rounded corners, tapering legs and round head. Parts that are
  // meant to stick out (shoes) say "fit": false.
  const wear = (shapes, box, part, colors, env, p, pad = 1.5) => {
    if (p?.fit === false) return put(shapes, box, part, colors);
    const map = fitMap(box, env, { pad });
    for (const s of colorize(shapes ?? [], colors)) out.push({ ...warpShape(s, map), ...(part ? { part } : {}) });
  };
  const partColors = (slot, p) => ({ ...base, main: look.colors?.[slot] ?? p.color ?? '#999999' });
  const each = (key, fn) => {
    for (const [slot, p] of Object.entries(worn)) if (p.art?.[key]) fn(p.art[key], partColors(slot, p), p);
    for (const p of extras) if (p.art?.[key]) fn(p.art[key], partColors(p.id, p), p);
  };
  const replaced = new Set(extras.flatMap((p) => p.replaces ?? []));

  // behind the head (long hair, headscarf): free, it may fall over the shoulders
  each('back', (shapes, colors) => put(shapes, headBox, 'head', colors));

  // legs, then what is worn on them
  const legSkins = [];
  sk.legs.forEach((leg, i) => {
    const part = i ? 'legR' : 'legL';
    const legSkin = replaced.has(part) ? [] : skin([{ type: 'rect', x: 4, y: 0, w: 92, h: 100, r: 30, fill: '$skin' }], leg, part);
    legSkins.push(...legSkin);
    for (const p of extras) if (p.replaces?.includes(part)) put(p.art[part], leg, part, partColors(p.id, p));
    const env = envelope(legSkin.length ? legSkin : [mapShape({ type: 'rect', x: 4, y: 0, w: 92, h: 100, fill: '#000' }, leg)]);
    each('leg', (shapes, colors, p) => wear(shapes, leg, part, colors, env, p));
  });
  // skirts span both legs: their outline is the outside of the two legs
  const hipsEnv = envelope(legSkins.length ? legSkins : sk.legs.map((l) => mapShape({ type: 'rect', x: 0, y: 0, w: 100, h: 100, fill: '#000' }, l)));
  each('hips', (shapes, colors, p) => wear(shapes, hips, '', colors, hipsEnv, p));

  // neck and torso
  skin([{ type: 'rect', x: 0, y: 0, w: 100, h: 100, r: 30, fill: '$skin' }],
    rect(head.cx - head.r * 0.22, head.cy + head.r * 0.6, head.r * 0.44, sk.torso.y - head.cy - head.r * 0.4), '');
  const torsoEnv = envelope(skin([{ type: 'rect', x: 0, y: 0, w: 100, h: 100, r: 22, fill: '$skin' }], sk.torso, ''));
  each('torso', (shapes, colors, p) => wear(shapes, sk.torso, '', colors, torsoEnv, p));

  // arms with hands (sleeves follow the arm, not the hand)
  sk.arms.forEach((arm, i) => {
    const part = i ? 'armR' : 'armL';
    const [armSkin] = skin([{ type: 'rect', x: 0, y: 0, w: 100, h: 92, r: 45, fill: '$skin' },
      { type: 'circle', cx: 50, cy: 94, r: 62, fill: '$skin' }], arm, part);
    const env = envelope([armSkin]);
    each('arm', (shapes, colors, p) => wear(shapes, arm, part, colors, env, p));
  });

  // head: ears, face, features, hair, glasses, hats
  skin([{ type: 'circle', cx: 2, cy: 54, r: 11, fill: '$skin' }, { type: 'circle', cx: 98, cy: 54, r: 11, fill: '$skin' },
    { type: 'circle', cx: 50, cy: 50, r: 50, fill: '$skin' }], headBox, 'head');
  each('skin', (shapes, colors) => put(shapes, headBox, 'head', colors));
  put(face(look.eyes, expression), headBox, 'head');
  // Hair (and beards) wrap a slightly bigger head, so they have some volume:
  // their 0–100 box is the box of that bigger circle, and every row of the
  // drawing is bent to its width. A hair cap drawn across the whole top of the
  // box therefore covers the crown completely and follows the round head.
  const hairR = head.r * HAIR_VOLUME;
  const hairBox = rect(head.cx - hairR, head.cy - hairR, hairR * 2, hairR * 2);
  const hairEnv = envelope([{ type: 'circle', cx: head.cx, cy: head.cy, r: hairR, fill: '#000' }]);
  each('front', (shapes, colors, p) => wear(shapes, hairBox, 'head', colors, hairEnv, p, 0));
  each('face', (shapes, colors) => put(shapes, headBox, 'head', colors));
  each('hat', (shapes, colors) => put(shapes, headBox, 'head', colors));
  return out;
}

export function composeDef(baseDef, look, defs) {
  const sk = SKELETONS[look.age] ?? SKELETONS.child;
  const { head, arms, legs } = sk;
  const art = Object.fromEntries(EXPRESSIONS.map((ex) => [ex, composeArt(look, defs, ex)]));
  return {
    ...baseDef,
    id: `${baseDef.id}#${lookKey(look)}`,
    size: sk.size,
    parts: [
      { id: 'head', pivot: [head.cx, head.cy + head.r * 0.85] },
      { id: 'armL', pivot: [arms[0].x + arms[0].w / 2, arms[0].y + 6] },
      { id: 'armR', pivot: [arms[1].x + arms[1].w / 2, arms[1].y + 6] },
      { id: 'legL', pivot: [legs[0].x + legs[0].w / 2, legs[0].y + 4] },
      { id: 'legR', pivot: [legs[1].x + legs[1].w / 2, legs[1].y + 4] },
    ],
    art,
    // the right hand holds things
    behaviors: (baseDef.behaviors ?? []).map((b) => (b.type === 'Container'
      ? { ...b, area: [arms[1].x - 30, arms[1].y + arms[1].h - 70, 84, 96] }
      : b)),
  };
}

// Short stable key for a look (cache keys, rough seeds).
export function lookKey(look) {
  const text = JSON.stringify(look);
  let h = 2166136261;
  for (let i = 0; i < text.length; i++) h = Math.imul(h ^ text.charCodeAt(i), 16777619);
  return (h >>> 0).toString(36);
}

export function randomLook(defs, age = 'child', random = Math.random) {
  const pick = (list) => list[Math.floor(random() * list.length)];
  const parts = (slot) => defs.ids().map((id) => partDef(defs, id)).filter((p) => p?.slot === slot && fits(p, age)).map((p) => p.id);
  const maybe = (slot, chance) => (random() < chance ? pick(parts(slot)) ?? null : null);
  return {
    ...DEFAULT_LOOK,
    age,
    skin: pick(SKIN_TONES),
    hair: pick(parts('hair')) ?? null,
    hairColor: age === 'elder' ? pick(['#b8b4ad', '#f2f0ea', '#7a7a7a']) : pick(HAIR_COLORS.slice(0, 9)),
    eyes: pick(EYE_STYLES),
    eyeColor: pick(EYE_COLORS),
    top: pick(parts('top')) ?? null,
    bottom: pick(parts('bottom')) ?? null,
    shoes: pick(parts('shoes')) ?? null,
    head: maybe('head', 0.25),
    face: maybe('face', 0.2),
    extras: [],
    colors: { top: pick(CLOTH_COLORS), bottom: pick(CLOTH_COLORS), shoes: pick(CLOTH_COLORS), head: pick(CLOTH_COLORS), face: pick(CLOTH_COLORS) },
  };
}

export class Character extends Item {
  static type = 'Character';
  static defaults = { ...Item.defaults, layer: 2 };

  constructor(scene, def, data = {}) {
    const look = { ...DEFAULT_LOOK, ...data.look, colors: { ...data.look?.colors } };
    super(scene, composeDef(def, look, scene.defs), { ...data, state: EXPRESSIONS.includes(data.state) ? data.state : 'happy' });
    this.baseDef = def;
    this.look = look;
  }

  get isCharacter() {
    return true;
  }

  get legHeight() {
    return (SKELETONS[this.look.age] ?? SKELETONS.child).legs[0].h;
  }

  setLook(look) {
    const bottom = this.y;
    this.look = { ...DEFAULT_LOOK, ...look, colors: { ...look.colors } };
    this.def = composeDef(this.baseDef, this.look, this.scene.defs);
    this.y = bottom;
    // behaviours keep their state but take the new config (e.g. where the hand is)
    this.behaviors.forEach((b, i) => {
      b.config = this.def.behaviors?.[i] ?? b.config;
      b.layout?.();
    });
    this.scene.changed();
  }

  // Sitting on a seat uses the seat's pose instead of the idle loop.
  wantedIdle() {
    const seat = this.parent?.behaviors.find((b) => b.constructor.type === 'Seat');
    return seat ? seat.config.pose ?? 'sit' : super.wantedIdle();
  }

  serialize() {
    return { ...super.serialize(), def: this.baseDef.id, look: JSON.parse(JSON.stringify(this.look)) };
  }
}

// Tapping the head changes the face; tapping the body is something else.
// Emits "tapHead" or "tapBody" so reactions decide what happens.
export class Face extends Behavior {
  static type = 'Face';

  handle(event, data) {
    if (event !== 'tap' || !data?.local || !this.entity.look) return;
    const { head } = SKELETONS[this.entity.look.age] ?? SKELETONS.child;
    const onHead = Math.hypot(data.local.x - head.cx, data.local.y - head.cy) <= head.r * 1.1;
    this.entity.emit(onHead ? 'tapHead' : 'tapBody', data);
  }
}

// Dropping clothes on a character dresses it. What it wore before comes off
// and falls to the floor, so nothing is ever lost.
export class Wearer extends Behavior {
  static type = 'Wearer';

  #part(item) {
    const id = item.behaviors.find((b) => b.constructor.type === 'Wearable')?.partId;
    if (!id || !this.entity.scene.defs.has(id)) return null;
    const part = this.entity.scene.defs.get(id);
    return part.kind === 'part' && (!part.ages || part.ages.includes(this.entity.look.age)) ? part : null;
  }

  accepts(item) {
    return !!this.#part(item);
  }

  receive(item) {
    const c = this.entity;
    const { scene } = c;
    const part = this.#part(item);
    const oldId = c.look[part.slot];
    const oldColor = c.look.colors?.[part.slot];
    c.setLook({ ...c.look, [part.slot]: part.id, colors: { ...c.look.colors, [part.slot]: item.color('main') } });
    scene.remove(item);

    const oldPart = oldId && scene.defs.has(oldId) ? scene.defs.get(oldId) : null;
    if (oldPart?.item && scene.defs.has(oldPart.item)) {
      const dropped = scene.spawn(oldPart.item, { x: c.x + c.width * 0.6, y: c.y - c.height / 2, colors: oldColor ? { main: oldColor } : {} });
      scene.drop(dropped);
    }
    c.emit('dressed', { part: part.id });
  }
}
