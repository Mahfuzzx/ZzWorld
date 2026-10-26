// Generates content/core/defs/characters.json: the character definition, the
// part library (hair, clothes, hats, glasses, features), wearable items, a
// wardrobe and a chair. Part art uses 0–100 boxes per body region (see
// src/engine/character.js). Run: node tools/gen-characters.mjs
import { writeFileSync } from 'node:fs';

const path = (d, fill, extra = {}) => ({ type: 'path', d, fill, ...extra });
const rectS = (x, y, w, h, fill, extra = {}) => ({ type: 'rect', x, y, w, h, fill, ...extra });
const circle = (cx, cy, r, fill, extra = {}) => ({ type: 'circle', cx, cy, r, fill, ...extra });
const ellipse = (cx, cy, rx, ry, fill, extra = {}) => ({ type: 'ellipse', cx, cy, rx, ry, fill, ...extra });
const ALL = undefined;
const NOT_BABY = ['child', 'adult', 'elder'];
const GROWN = ['adult', 'elder'];

const part = (id, slot, name, art, extra = {}) => ({ id: `core.part.${id}`, kind: 'part', slot, name, art, ...extra });

// ---------- hair ($hair) ----------
const fringe = path('M4 48 C2 2 98 2 96 48 C88 30 70 26 54 32 C40 24 18 28 4 48 Z', '$hair');
const curls = (from, to, radius, count, r) => Array.from({ length: count }, (_, i) => {
  const a = ((from + ((to - from) * i) / (count - 1)) * Math.PI) / 180;
  return circle(Math.round(50 + radius * Math.cos(a)), Math.round(50 + radius * Math.sin(a)), r, '$hair');
});
const hair = [
  part('hair.short', 'hair', { tr: 'Kısa', en: 'Short' }, { front: [fringe] }),
  part('hair.long', 'hair', { tr: 'Uzun', en: 'Long' }, {
    back: [path('M2 40 C-2 -4 102 -4 98 40 L104 140 C86 152 14 152 -4 140 Z', '$hair')],
    front: [path('M4 52 C2 0 98 0 96 52 C88 30 66 26 50 34 C34 26 12 30 4 52 Z', '$hair')],
  }, { ages: NOT_BABY }),
  part('hair.curly', 'hair', { tr: 'Kıvırcık', en: 'Curly' }, {
    back: curls(140, 400, 48, 12, 17),
    front: curls(195, 345, 46, 7, 16),
  }),
  part('hair.afro', 'hair', { tr: 'Afro', en: 'Afro' }, {
    back: [circle(50, 38, 72, '$hair')],
    front: [path('M8 40 C14 14 86 14 92 40 C80 28 66 30 50 26 C34 30 20 28 8 40 Z', '$hair')],
  }, { ages: NOT_BABY }),
  part('hair.bun', 'hair', { tr: 'Topuz', en: 'Bun' }, {
    back: [circle(50, -6, 18, '$hair')],
    front: [fringe],
  }, { ages: NOT_BABY }),
  part('hair.ponytail', 'hair', { tr: 'At kuyruğu', en: 'Ponytail' }, {
    back: [path('M84 28 C122 36 122 100 100 122 C104 92 100 62 80 44 Z', '$hair')],
    front: [fringe],
  }, { ages: NOT_BABY }),
  part('hair.braids', 'hair', { tr: 'Örgü', en: 'Braids' }, {
    back: [...[70, 86, 102, 118, 134].flatMap((y) => [ellipse(2, y, 9, 9, '$hair'), ellipse(98, y, 9, 9, '$hair')])],
    front: [path('M4 46 C2 4 98 4 96 46 C84 20 58 16 50 30 C42 16 16 20 4 46 Z', '$hair')],
  }, { ages: NOT_BABY }),
  part('hair.tuft', 'hair', { tr: 'Perçem', en: 'Tuft' }, {
    front: [path('M42 4 C44 -12 60 -12 58 2 C54 -4 48 -4 42 4 Z', '$hair')],
  }, { ages: ['baby', 'child'] }),
];

// ---------- tops ($main): torso, arm, hips ----------
const torso = rectS(0, 0, 100, 100, '$main', { r: 22 });
const neckline = path('M34 0 Q50 18 66 0', null, { lw: 3 });
const tops = [
  part('top.tshirt', 'top', { tr: 'Tişört', en: 'T-shirt' }, { torso: [torso, neckline], arm: [rectS(0, 0, 100, 40, '$main', { r: 40 })] },
    { color: '#e04f3a', item: 'core.wear.tshirt', ages: NOT_BABY }),
  part('top.sweater', 'top', { tr: 'Kazak', en: 'Sweater' }, {
    torso: [torso, path('M0 70 H100', null, { lw: 3, alpha: 0.4 }), neckline],
    arm: [rectS(0, 0, 100, 86, '$main', { r: 40 })],
  }, { color: '#4f8fe0', item: 'core.wear.sweater', ages: NOT_BABY }),
  part('top.tank', 'top', { tr: 'Atlet', en: 'Tank top' }, { torso: [rectS(10, 4, 80, 96, '$main', { r: 16 }), path('M30 4 Q50 24 70 4', null, { lw: 3 })] },
    { color: '#ffd166', ages: NOT_BABY }),
  part('top.dress', 'top', { tr: 'Elbise', en: 'Dress' }, {
    torso: [torso, neckline],
    arm: [rectS(0, 0, 100, 30, '$main', { r: 40 })],
    hips: [path('M8 0 L92 0 L106 62 L-6 62 Z', '$main'), path('M-2 50 L102 50', null, { lw: 3, alpha: 0.35 })],
  }, { color: '#f28dbb', covers: ['bottom'], item: 'core.wear.dress', ages: NOT_BABY }),
  part('top.kaftan', 'top', { tr: 'Kaftan', en: 'Kaftan' }, {
    torso: [torso, path('M50 0 V100', null, { lw: 3, alpha: 0.5 }), path('M40 0 Q50 14 60 0', null, { lw: 3 })],
    arm: [rectS(-6, 0, 112, 84, '$main', { r: 40 })],
    hips: [path('M6 0 L94 0 L100 94 L0 94 Z', '$main'), path('M50 0 V94', null, { lw: 3, alpha: 0.5 })],
  }, { color: '#3aa76d', covers: ['bottom'], ages: NOT_BABY }),
  part('top.sari', 'top', { tr: 'Sari', en: 'Sari' }, {
    torso: [torso, path('M0 8 L100 64 L100 100 L72 100 L0 30 Z', '#ffffff', { alpha: 0.35, stroke: null })],
    arm: [rectS(0, 0, 100, 34, '$main', { r: 40 })],
    hips: [path('M6 0 L94 0 L98 92 L2 92 Z', '$main'), path('M60 0 L80 92', null, { lw: 3, alpha: 0.4 })],
  }, { color: '#f28c38', covers: ['bottom'], ages: GROWN }),
  part('top.onesie', 'top', { tr: 'Tulum', en: 'Onesie' }, {
    torso: [torso, path('M40 10 V90', null, { lw: 2, alpha: 0.4 })],
    arm: [rectS(0, 0, 100, 44, '$main', { r: 40 })],
    hips: [path('M2 0 L98 0 L96 44 L4 44 Z', '$main')],
  }, { color: '#9fd3f2', covers: ['bottom'], ages: ['baby'] }),
];

// ---------- bottoms: leg, hips ----------
const band = rectS(0, 0, 100, 14, '$main', { r: 4 });
const bottoms = [
  part('bottom.pants', 'bottom', { tr: 'Pantolon', en: 'Trousers' }, { leg: [rectS(0, 0, 100, 92, '$main', { r: 18 })], hips: [band] },
    { color: '#4f8fe0', item: 'core.wear.pants', ages: NOT_BABY }),
  part('bottom.shorts', 'bottom', { tr: 'Şort', en: 'Shorts' }, { leg: [rectS(0, 0, 100, 42, '$main', { r: 18 })], hips: [band] },
    { color: '#3aa76d', item: 'core.wear.shorts', ages: NOT_BABY }),
  part('bottom.skirt', 'bottom', { tr: 'Etek', en: 'Skirt' }, { hips: [path('M4 0 L96 0 L106 48 L-6 48 Z', '$main')] },
    { color: '#8a6fd8', item: 'core.wear.skirt', ages: NOT_BABY }),
  part('bottom.diaper', 'bottom', { tr: 'Bez', en: 'Nappy' }, { hips: [path('M2 0 L98 0 L84 36 L16 36 Z', '#ffffff')] },
    { color: '#ffffff', ages: ['baby'] }),
];

// ---------- shoes: leg ----------
const shoes = [
  part('shoes.sneakers', 'shoes', { tr: 'Spor ayakkabı', en: 'Trainers' }, {
    leg: [ellipse(54, 95, 60, 10, '$main'), path('M-4 99 H112', null, { lw: 3, stroke: '#ffffff' })],
  }, { color: '#ffffff', ages: NOT_BABY }),
  part('shoes.boots', 'shoes', { tr: 'Bot', en: 'Boots' }, {
    leg: [rectS(-4, 72, 108, 26, '$main', { r: 8 }), ellipse(60, 96, 56, 9, '$main')],
  }, { color: '#8a5a2b', ages: NOT_BABY }),
  part('shoes.sandals', 'shoes', { tr: 'Sandalet', en: 'Sandals' }, {
    leg: [ellipse(54, 99, 58, 5, '#c98a4b'), path('M4 92 L96 92 M50 84 L50 98', null, { lw: 4, stroke: '$main' })],
  }, { color: '#e8735a', ages: NOT_BABY }),
  part('shoes.booties', 'shoes', { tr: 'Patik', en: 'Booties' }, { leg: [ellipse(50, 90, 58, 16, '$main')] },
    { color: '#ffd166', ages: ['baby'] }),
];

// ---------- head: back (behind head), hat (on top) ----------
const heads = [
  part('head.cap', 'head', { tr: 'Şapka', en: 'Cap' }, {
    hat: [path('M6 32 C8 -6 92 -6 94 32 Z', '$main'), path('M56 26 L116 32 L112 41 L54 34 Z', '$main')],
  }, { color: '#e04f3a', item: 'core.wear.cap' }),
  part('head.sunhat', 'head', { tr: 'Hasır şapka', en: 'Sun hat' }, {
    hat: [ellipse(50, 18, 68, 13, '$main'), path('M24 18 C24 -18 76 -18 76 18 Z', '$main'), path('M24 12 H76', null, { lw: 5, stroke: '#e8735a' })],
  }, { color: '#f2d38a', item: 'core.wear.sunhat' }),
  part('head.beanie', 'head', { tr: 'Bere', en: 'Beanie' }, {
    hat: [path('M4 40 C2 -14 98 -14 96 40 Z', '$main'), rectS(2, 30, 96, 14, '$main', { r: 6 }), circle(50, -12, 10, '#ffffff')],
  }, { color: '#8a6fd8', item: 'core.wear.beanie' }),
  part('head.headscarf', 'head', { tr: 'Başörtüsü', en: 'Headscarf' }, {
    back: [path('M-10 52 C-12 -14 112 -14 110 52 L116 130 C86 148 14 148 -16 130 Z', '$main')],
    hat: [path('M2 56 C-4 -4 104 -4 98 56 C96 24 78 8 50 8 C22 8 4 24 2 56 Z', '$main')],
  }, { color: '#9fd3f2', hidesHair: true, item: 'core.wear.headscarf', ages: NOT_BABY }),
  part('head.takke', 'head', { tr: 'Takke', en: 'Kufi' }, {
    hat: [path('M16 18 C20 -6 80 -6 84 18 Z', '$main'), path('M24 10 H76', null, { lw: 2, alpha: 0.5 })],
  }, { color: '#ffffff', item: 'core.wear.takke', ages: NOT_BABY }),
  part('head.crown', 'head', { tr: 'Taç', en: 'Crown' }, {
    hat: [path('M18 18 L22 -14 L36 4 L50 -18 L64 4 L78 -14 L82 18 Z', '#ffd166'), circle(50, 6, 4, '#e04f3a')],
  }, { color: '#ffd166' }),
];

// ---------- face: glasses ----------
const faces = [
  part('face.glasses', 'face', { tr: 'Gözlük', en: 'Glasses' }, {
    face: [circle(34, 50, 13, null, { stroke: '$main', lw: 3 }), circle(66, 50, 13, null, { stroke: '$main', lw: 3 }),
      path('M47 49 Q50 46 53 49 M21 48 L4 44 M79 48 L96 44', null, { lw: 3, stroke: '$main' })],
  }, { color: '#3b2f2a', item: 'core.wear.glasses' }),
  part('face.sunglasses', 'face', { tr: 'Güneş gözlüğü', en: 'Sunglasses' }, {
    face: [ellipse(34, 50, 14, 11, '#3b2f2a'), ellipse(66, 50, 14, 11, '#3b2f2a'),
      path('M48 48 L52 48 M20 47 L4 44 M80 47 L96 44', null, { lw: 3, stroke: '$main' })],
  }, { color: '#e04f3a', ages: NOT_BABY }),
];

// ---------- extras (look.extras): features and aids ----------
const extras = [
  part('extra.freckles', 'extra', { tr: 'Çil', en: 'Freckles' }, {
    skin: [[22, 60], [28, 66], [18, 68], [72, 60], [78, 66], [82, 58]].map(([x, y]) => circle(x, y, 1.8, '#a0603a', { stroke: null, alpha: 0.8 })),
  }),
  part('extra.vitiligo', 'extra', { tr: 'Vitiligo', en: 'Vitiligo' }, {
    skin: [ellipse(70, 30, 14, 10, '#fbefe4', { stroke: null, alpha: 0.9 }), ellipse(28, 72, 10, 8, '#fbefe4', { stroke: null, alpha: 0.9 })],
  }),
  part('extra.beard', 'extra', { tr: 'Sakal', en: 'Beard' }, {
    front: [path('M10 58 C12 106 88 106 90 58 C78 80 64 76 50 84 C36 76 22 80 10 58 Z', '$hair')],
  }, { ages: GROWN }),
  part('extra.mustache', 'extra', { tr: 'Bıyık', en: 'Moustache' }, {
    front: [path('M30 66 C38 58 46 60 50 64 C54 60 62 58 70 66 C62 68 56 66 50 68 C44 66 38 68 30 66 Z', '$hair')],
  }, { ages: GROWN }),
  part('extra.hearingaid', 'extra', { tr: 'İşitme cihazı', en: 'Hearing aid' }, {
    face: [path('M97 40 C110 42 110 64 98 66', null, { lw: 5, stroke: '$main' }), circle(98, 66, 4, '$main')],
  }, { color: '#4f8fe0' }),
  part('extra.prosthesis', 'extra', { tr: 'Protez bacak', en: 'Prosthetic leg' }, {
    legR: [rectS(10, 0, 80, 22, '#c9d3d8', { r: 10 }), rectS(40, 18, 20, 70, '#9aa7ae', { r: 6 }), ellipse(58, 92, 46, 8, '#6b7780')],
  }, { replaces: ['legR'], ages: NOT_BABY }),
];

// ---------- wearable items lying in the world ----------
const shirtArt = (sleeves) => [
  path(`M14 10 L30 2 Q40 10 50 2 L66 10 L78 ${sleeves ? 40 : 24} L64 ${sleeves ? 44 : 28} L62 60 L18 60 L16 ${sleeves ? 44 : 28} L2 ${sleeves ? 40 : 24} Z`, '$main'),
  path('M30 2 Q40 12 50 2', null, { lw: 2.5 }),
];
const wear = (id, name, part, size, art, color) => ({
  id: `core.wear.${id}`, extends: 'core.item.base', name, size, colorSlots: { main: color },
  behaviors: [{ type: 'Wearable', part: `core.part.${part}` }], art: { default: art },
});
const items = [
  wear('tshirt', { tr: 'Tişört', en: 'T-shirt' }, 'top.tshirt', [80, 62], shirtArt(false), '#e04f3a'),
  wear('sweater', { tr: 'Kazak', en: 'Sweater' }, 'top.sweater', [80, 62], shirtArt(true), '#4f8fe0'),
  wear('dress', { tr: 'Elbise', en: 'Dress' }, 'top.dress', [76, 80], [path('M26 2 L50 2 L54 24 L74 76 L2 76 L22 24 Z', '$main'), path('M28 2 Q38 10 48 2', null, { lw: 2.5 })], '#f28dbb'),
  wear('pants', { tr: 'Pantolon', en: 'Trousers' }, 'bottom.pants', [62, 80], [path('M6 2 L56 2 L58 78 L36 78 L31 26 L26 78 L4 78 Z', '$main')], '#4f8fe0'),
  wear('shorts', { tr: 'Şort', en: 'Shorts' }, 'bottom.shorts', [64, 44], [path('M4 2 L60 2 L62 42 L36 42 L32 20 L28 42 L2 42 Z', '$main')], '#3aa76d'),
  wear('skirt', { tr: 'Etek', en: 'Skirt' }, 'bottom.skirt', [70, 48], [path('M14 2 L56 2 L68 46 L2 46 Z', '$main')], '#8a6fd8'),
  wear('cap', { tr: 'Şapka', en: 'Cap' }, 'head.cap', [74, 40], [path('M4 34 C6 0 54 0 56 34 Z', '$main'), path('M50 28 L72 32 L70 38 L48 36 Z', '$main')], '#e04f3a'),
  wear('sunhat', { tr: 'Hasır şapka', en: 'Sun hat' }, 'head.sunhat', [90, 40], [ellipse(45, 30, 43, 8, '$main'), path('M24 30 C24 2 66 2 66 30 Z', '$main')], '#f2d38a'),
  wear('beanie', { tr: 'Bere', en: 'Beanie' }, 'head.beanie', [60, 54], [path('M4 50 C2 8 58 8 56 50 Z', '$main'), circle(30, 9, 8, '#ffffff')], '#8a6fd8'),
  wear('headscarf', { tr: 'Başörtüsü', en: 'Headscarf' }, 'head.headscarf', [74, 56], [path('M4 52 C4 2 70 2 70 52 Q37 40 4 52 Z', '$main')], '#9fd3f2'),
  wear('takke', { tr: 'Takke', en: 'Kufi' }, 'head.takke', [60, 30], [path('M4 28 C8 0 52 0 56 28 Z', '$main')], '#ffffff'),
  wear('glasses', { tr: 'Gözlük', en: 'Glasses' }, 'face.glasses', [70, 28], [circle(18, 16, 11, null, { stroke: '$main', lw: 3 }), circle(52, 16, 11, null, { stroke: '$main', lw: 3 }), path('M29 15 Q35 11 41 15', null, { lw: 3, stroke: '$main' })], '#3b2f2a'),
];

// ---------- the character itself ----------
const character = {
  id: 'core.character',
  extends: 'core.base',
  class: 'Character',
  catalog: false,
  name: { tr: 'Karakter', en: 'Character' },
  behaviors: [{ type: 'Face' }, { type: 'Wearer' }, { type: 'Container', slots: 1 }],
  idle: 'idle',
  clips: {
    idle: { type: 'keyframe', duration: 2.4, loop: true, tracks: {
      '': [{ t: 0, sy: 1 }, { t: 1.2, sy: 1.018 }, { t: 2.4, sy: 1 }],
      head: [{ t: 0, rot: 0 }, { t: 0.6, rot: 3 }, { t: 1.2, rot: 0 }, { t: 1.8, rot: -3 }, { t: 2.4, rot: 0 }],
      armL: [{ t: 0, rot: 0 }, { t: 1.2, rot: 3 }, { t: 2.4, rot: 0 }],
      armR: [{ t: 0, rot: 0 }, { t: 1.2, rot: -3 }, { t: 2.4, rot: 0 }],
    } },
    wave: { type: 'keyframe', duration: 1.3, tracks: {
      armR: [{ t: 0, rot: 0 }, { t: 0.25, rot: -150 }, { t: 0.45, rot: -115 }, { t: 0.65, rot: -150 }, { t: 0.85, rot: -115 }, { t: 1.05, rot: -150 }, { t: 1.3, rot: 0 }],
      head: [{ t: 0, rot: 0 }, { t: 0.4, rot: 6 }, { t: 1.3, rot: 0 }],
    } },
    jump: { type: 'keyframe', duration: 0.55, tracks: {
      '': [{ t: 0, y: 0, sy: 1 }, { t: 0.08, y: 0, sy: 0.92 }, { t: 0.28, y: -50, sy: 1.04 }, { t: 0.5, y: 0, sy: 0.95 }, { t: 0.55, y: 0, sy: 1 }],
      armL: [{ t: 0, rot: 0 }, { t: 0.28, rot: 140 }, { t: 0.55, rot: 0 }],
      armR: [{ t: 0, rot: 0 }, { t: 0.28, rot: -140 }, { t: 0.55, rot: 0 }],
    } },
    sit: { type: 'keyframe', duration: 2.4, loop: true, tracks: {
      legL: [{ t: 0, sy: 0.42 }, { t: 2.4, sy: 0.42 }],
      legR: [{ t: 0, sy: 0.42 }, { t: 2.4, sy: 0.42 }],
      head: [{ t: 0, rot: 0 }, { t: 1.2, rot: 3 }, { t: 2.4, rot: 0 }],
    } },
    // lying in bed: turned on the side, slowly breathing
    sleep: { type: 'keyframe', duration: 3, loop: true, tracks: {
      '': [{ t: 0, rot: -90, sy: 1 }, { t: 1.5, rot: -90, sy: 1.025 }, { t: 3, rot: -90, sy: 1 }],
    } },
    dangle: { type: 'keyframe', duration: 0.6, tracks: {
      legL: [{ t: 0, rot: 0 }, { t: 0.15, rot: 12 }, { t: 0.3, rot: -8 }, { t: 0.45, rot: 5 }, { t: 0.6, rot: 0 }],
      legR: [{ t: 0, rot: 0 }, { t: 0.15, rot: -10 }, { t: 0.3, rot: 9 }, { t: 0.45, rot: -4 }, { t: 0.6, rot: 0 }],
      armL: [{ t: 0, rot: 0 }, { t: 0.2, rot: 40 }, { t: 0.6, rot: 0 }],
      armR: [{ t: 0, rot: 0 }, { t: 0.2, rot: -40 }, { t: 0.6, rot: 0 }],
    } },
  },
  reactions: {
    tapHead: [{ do: 'SetState', toggle: ['happy', 'laugh', 'surprised', 'sleepy', 'sad', 'grumpy'] }, { do: 'PlaySound', sound: 'bip', pitch: [1.1, 1.5] }],
    tapBody: [{ do: 'PlayAnim', clip: 'wave' }, { do: 'PlaySound', sound: 'sparkle', volume: 0.4 }],
    pickUp: [{ do: 'SetState', to: 'surprised' }, { do: 'PlayAnim', clip: 'dangle' }, { do: 'PlaySound', sound: 'pop', pitch: [1.2, 1.4] }],
    land: [{ do: 'SetState', to: 'happy' }, { do: 'PlayAnim', clip: 'squash', amp: 0.1 }, { do: 'PlaySound', sound: 'thud', volume: 0.4 }],
    dressed: [{ do: 'SetState', to: 'laugh' }, { do: 'PlayAnim', clip: 'jump' }, { do: 'PlaySound', sound: 'sparkle' }],
  },
};

// ---------- furniture for them ----------
const wardrobe = {
  id: 'core.wardrobe', extends: 'core.furniture.base',
  name: { tr: 'Gardırop', en: 'Wardrobe' },
  size: [190, 320],
  colorSlots: { wood: '#c98a4b' },
  behaviors: [
    { type: 'Toggle', states: ['closed', 'open'] },
    { type: 'Container', slots: 6, rows: 3, area: [16, 24, 158, 270], visibleIn: 'open' },
  ],
  art: {
    closed: [rectS(0, 0, 190, 310, '$wood', { r: 10 }), path('M95 10 V300', null, { lw: 3 }), circle(84, 160, 5, '#ffd166'), circle(106, 160, 5, '#ffd166'),
      rectS(10, 306, 18, 14, '$wood'), rectS(162, 306, 18, 14, '$wood')],
    open: [rectS(0, 0, 190, 310, '$wood', { r: 10 }), rectS(12, 12, 166, 286, '#f3e2c4', { r: 4 }), path('M12 114 H178 M12 206 H178', null, { lw: 5, stroke: '#a8743e' }),
      path('M30 30 H160', null, { lw: 4, stroke: '#9aa7ae' }), rectS(10, 306, 18, 14, '$wood'), rectS(162, 306, 18, 14, '$wood')],
  },
  reactions: {
    'stateEnter:open': [{ do: 'PlaySound', sound: 'creak', pitch: [1.0, 1.2] }],
    'stateEnter:closed': [{ do: 'PlayAnim', clip: 'shake', amp: 3 }, { do: 'PlaySound', sound: 'thud', volume: 0.5, pitch: 1.3 }],
  },
};

const chair = {
  id: 'core.chair', extends: 'core.furniture.base',
  name: { tr: 'Sandalye', en: 'Chair' },
  size: [100, 170],
  colorSlots: { wood: '#c98a4b', cushion: '#e8735a' },
  behaviors: [{ type: 'Seat', area: [10, 70, 80, 20], pose: 'sit' }],
  art: { default: [
    rectS(12, 0, 76, 70, '$wood', { r: 10 }), rectS(22, 12, 56, 44, '$cushion', { r: 8 }),
    rectS(14, 96, 12, 74, '$wood', { r: 4 }), rectS(74, 96, 12, 74, '$wood', { r: 4 }),
    rectS(4, 82, 92, 18, '$wood', { r: 6 }), rectS(8, 76, 84, 10, '$cushion', { r: 5 }),
  ] },
  reactions: { tap: [{ do: 'PlayAnim', clip: 'wobble', amp: 0.08 }] },
};

const all = [character, ...hair, ...tops, ...bottoms, ...shoes, ...heads, ...faces, ...extras, ...items, wardrobe, chair];
writeFileSync(new URL('../content/core/defs/characters.json', import.meta.url), `${JSON.stringify(all, null, 1)}\n`);
console.log(`${all.length} definitions written`);
