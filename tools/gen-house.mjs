// Generates content/core/defs/house.json: doors, room signs and the furniture
// and toys of the bedroom and bathroom. Run: node tools/gen-house.mjs
import { writeFileSync } from 'node:fs';

const path = (d, fill, extra = {}) => ({ type: 'path', d, fill, ...extra });
const rect = (x, y, w, h, fill, extra = {}) => ({ type: 'rect', x, y, w, h, fill, ...extra });
const circle = (cx, cy, r, fill, extra = {}) => ({ type: 'circle', cx, cy, r, fill, ...extra });
const ellipse = (cx, cy, rx, ry, fill, extra = {}) => ({ type: 'ellipse', cx, cy, rx, ry, fill, ...extra });

// ---------- door ----------
const door = {
  id: 'core.door',
  extends: 'core.decor.base',
  class: 'Portal',
  // doors come with the house (they connect rooms), not from the catalog
  catalog: false,
  name: { tr: 'Kapı', en: 'Door' },
  size: [150, 270],
  colorSlots: { door: '#c98a4b', frame: '#ffffff' },
  behaviors: [{ type: 'Doorway' }, { type: 'Toggle', states: ['closed', 'open'] }],
  art: {
    closed: [
      rect(0, 0, 150, 270, '$frame', { r: 6 }),
      rect(14, 14, 122, 256, '$door', { r: 4 }),
      rect(30, 34, 90, 80, null, { r: 6, alpha: 0.5 }), rect(30, 134, 90, 110, null, { r: 6, alpha: 0.5 }),
      circle(118, 150, 7, '#ffd166'),
    ],
    open: [
      rect(0, 0, 150, 270, '$frame', { r: 6 }),
      rect(14, 14, 122, 256, '#5a4a42', { r: 4 }),
      path('M14 270 L14 14 L52 30 L52 262 Z', '$door'),
      circle(44, 150, 5, '#ffd166'),
      // a little welcome light from the other room
      ellipse(94, 250, 34, 10, '#fff3c4', { alpha: 0.35, stroke: null }),
    ],
  },
  reactions: {
    'stateEnter:open': [{ do: 'PlaySound', sound: 'creak', pitch: [1.1, 1.3] }],
    'stateEnter:closed': [{ do: 'PlaySound', sound: 'thud', volume: 0.5, pitch: 1.5 }],
  },
};

// ---------- room signs above doors (kids can't read: pictures) ----------
const sign = (id, name, icon) => ({
  id: `core.sign.${id}`, extends: 'core.decor.base', name, size: [90, 90],
  art: { default: [circle(45, 45, 42, '#fff8e6'), ...icon] },
  reactions: { tap: [{ do: 'PlayAnim', clip: 'wobble', amp: 0.12 }] },
});
const signs = [
  sign('bed', { tr: 'Yatak odası levhası', en: 'Bedroom sign' }, [
    rect(16, 42, 58, 18, '#8fc7a4', { r: 4 }), rect(14, 30, 10, 36, '#c98a4b', { r: 3 }), circle(32, 40, 7, '#ffffff'),
    path('M16 60 V68 M74 60 V68', null, { lw: 4 }),
  ]),
  sign('bath', { tr: 'Banyo levhası', en: 'Bathroom sign' }, [
    path('M16 44 H74 V54 C74 66 66 70 56 70 H34 C24 70 16 66 16 54 Z', '#9fd3f2'),
    path('M22 44 V24 C22 18 32 18 32 24', null, { lw: 3 }), circle(46, 34, 4, '#ffffff'), circle(58, 28, 3, '#ffffff'),
  ]),
  sign('street', { tr: 'Sokak levhası', en: 'Street sign' }, [
    rect(14, 60, 62, 10, '#8f959b', { stroke: null }), circle(30, 40, 14, '#8fc7a4'), rect(27, 50, 6, 12, '#8a5a2b'),
    path('M46 58 L60 42 L74 58 Z', '#e8735a'), rect(50, 56, 20, 14, '#f2c4a8'),
  ]),
  sign('sofa', { tr: 'Salon levhası', en: 'Living room sign' }, [
    rect(18, 34, 54, 22, '#e8735a', { r: 8 }), rect(12, 44, 66, 20, '#e8735a', { r: 8 }), path('M20 64 V70 M70 64 V70', null, { lw: 4 }),
  ]),
];

// ---------- bedroom ----------
const bed = {
  id: 'core.bed', extends: 'core.furniture.base',
  name: { tr: 'Yatak', en: 'Bed' },
  size: [340, 190],
  colorSlots: { wood: '#a8743e', sheet: '#9fd3f2', blanket: '#f28dbb' },
  behaviors: [{ type: 'Seat', slots: 2, area: [70, 40, 240, 70], pose: 'sleep', expression: 'sleepy' }],
  art: { default: [
    rect(0, 0, 40, 190, '$wood', { r: 10 }), rect(300, 60, 40, 130, '$wood', { r: 10 }),
    rect(26, 100, 300, 50, '#ffffff', { r: 14 }), ellipse(80, 100, 44, 22, '#ffffff'),
  ] },
  artFront: { default: [
    path('M120 106 C160 96 280 96 322 104 L326 150 L118 150 Z', '$blanket'),
    path('M140 116 C180 110 260 110 300 116', null, { lw: 3, alpha: 0.35 }),
    rect(24, 146, 306, 20, '$wood', { r: 6 }), rect(30, 164, 14, 26, '$wood'), rect(298, 164, 14, 26, '$wood'),
  ] },
  reactions: { tap: [{ do: 'PlayAnim', clip: 'squash', amp: 0.06 }, { do: 'PlaySound', sound: 'boing', volume: 0.3, pitch: 0.7 }] },
};

const toybox = {
  id: 'core.toybox', extends: 'core.furniture.base',
  name: { tr: 'Oyuncak sandığı', en: 'Toy box' },
  size: [170, 120],
  colorSlots: { box: '#e8735a' },
  behaviors: [{ type: 'Container', slots: 4, area: [10, 0, 150, 104] }],
  art: { default: [rect(4, 30, 162, 20, '#7a4a2a', { r: 4 })] },
  artFront: { default: [
    rect(0, 40, 170, 80, '$box', { r: 10 }), path('M0 64 H170', null, { lw: 3, alpha: 0.35 }),
    circle(40, 92, 9, '#ffd166', { stroke: null }), path('M80 84 L88 100 L72 100 Z', '#9fd3f2', { stroke: null }), rect(116, 84, 18, 18, '#9bcf53', { stroke: null }),
  ] },
  reactions: { received: [{ do: 'PlayAnim', clip: 'pulse', amp: 0.05 }] },
};

const teddy = {
  id: 'core.teddy', extends: 'core.item.base',
  name: { tr: 'Ayıcık', en: 'Teddy bear' },
  size: [84, 100],
  colorSlots: { fur: '#c98a4b' },
  art: { default: [
    circle(20, 18, 12, '$fur'), circle(64, 18, 12, '$fur'),
    ellipse(42, 74, 30, 26, '$fur'), circle(42, 36, 28, '$fur'),
    ellipse(42, 44, 12, 9, '#f3d6b5'), circle(42, 40, 4, '#3b2f2a', { stroke: null }),
    circle(32, 30, 3.5, '#3b2f2a', { stroke: null }), circle(52, 30, 3.5, '#3b2f2a', { stroke: null }),
    ellipse(16, 86, 11, 9, '$fur'), ellipse(68, 86, 11, 9, '$fur'), ellipse(42, 78, 14, 12, '#f3d6b5'),
  ] },
  reactions: { tap: [{ do: 'PlayAnim', clip: 'squash', amp: 0.25 }, { do: 'PlaySound', sound: 'squeak', pitch: 0.7 }] },
};

const picture = {
  id: 'core.picture', extends: 'core.decor.base',
  name: { tr: 'Resim', en: 'Picture' },
  size: [150, 110],
  colorSlots: { frame: '#c98a4b' },
  art: { default: [
    rect(0, 0, 150, 110, '$frame', { r: 6 }), rect(12, 12, 126, 86, '#d8f1ff'),
    path('M12 98 L52 46 L80 78 L100 58 L138 98 Z', '#8fc7a4'), circle(110, 34, 10, '#ffd166'),
  ] },
  reactions: { tap: [{ do: 'PlayAnim', clip: 'wobble', amp: 0.08 }] },
};

// ---------- bathroom ----------
const bathtub = {
  id: 'core.bathtub', extends: 'core.furniture.base',
  name: { tr: 'Küvet', en: 'Bathtub' },
  size: [320, 170],
  colorSlots: { tub: '#ffffff', water: '#9fd3f2' },
  // characters sit in the water; ducks and toys float in it
  behaviors: [
    { type: 'Seat', slots: 2, area: [50, 60, 220, 50], pose: 'sit', expression: 'laugh' },
    { type: 'Container', slots: 3, area: [40, 36, 240, 64] },
  ],
  art: { default: [
    path('M286 70 V30 C286 14 266 14 262 26', null, { lw: 6, stroke: '#9aa7ae' }),
    rect(10, 60, 300, 40, '$water', { r: 16 }),
  ] },
  artFront: { default: [
    path('M0 70 H320 V104 C320 140 290 156 250 156 H70 C30 156 0 140 0 104 Z', '$tub'),
    ...[[40, 70, 16], [70, 62, 20], [104, 70, 14], [210, 66, 18], [244, 60, 14], [276, 70, 16]].map(([x, y, r]) => circle(x, y, r, '#ffffff', { alpha: 0.9, lw: 2.5 })),
    ellipse(60, 162, 16, 7, '#9aa7ae'), ellipse(260, 162, 16, 7, '#9aa7ae'),
  ] },
  reactions: {
    tap: [{ do: 'PlayAnim', clip: 'wobble', amp: 0.04 }, { do: 'PlaySound', sound: 'splash' }],
    received: [{ do: 'PlaySound', sound: 'splash', pitch: [0.9, 1.2] }],
  },
};

const stream = (dx) => [path(`M${66 + dx} 46 C${70 + dx} 70 ${62 - dx} 90 ${66 + dx} 112`, null, { lw: 7, stroke: '#9fd3f2', rough: false })];
const sink = {
  id: 'core.sink', extends: 'core.furniture.base',
  name: { tr: 'Lavabo', en: 'Sink' },
  size: [140, 210],
  colorSlots: { sink: '#ffffff' },
  behaviors: [{ type: 'Toggle', states: ['off', 'on'] }],
  parts: [{ id: 'water', pivot: [66, 46] }],
  art: {
    off: [
      rect(56, 110, 28, 100, '$sink', { r: 6 }),
      path('M8 104 H132 C132 140 110 150 70 150 C30 150 8 140 8 104 Z', '$sink'),
      path('M60 104 V40 C60 28 90 28 90 40 V48', null, { lw: 8, stroke: '#9aa7ae' }),
      rect(98, 70, 16, 34, '#9aa7ae', { r: 6 }),
    ],
    on: [
      rect(56, 110, 28, 100, '$sink', { r: 6 }),
      { ...stream(0)[0], part: 'water' },
      path('M8 104 H132 C132 140 110 150 70 150 C30 150 8 140 8 104 Z', '$sink'),
      ellipse(70, 108, 50, 6, '#9fd3f2', { stroke: null }),
      path('M60 104 V40 C60 28 90 28 90 40 V48', null, { lw: 8, stroke: '#9aa7ae' }),
      rect(98, 70, 16, 34, '#9aa7ae', { r: 6 }),
    ],
  },
  clips: {
    flow: { type: 'frames', fps: 8, loop: true, part: 'water', frames: [
      stream(0).map((s) => ({ ...s, part: 'water' })), stream(3).map((s) => ({ ...s, part: 'water' })), stream(-3).map((s) => ({ ...s, part: 'water' })),
    ] },
  },
  idle: { on: 'flow' },
  reactions: {
    'stateEnter:on': [{ do: 'PlaySound', sound: 'splash', volume: 0.6 }],
    'stateEnter:off': [{ do: 'PlaySound', sound: 'click' }],
  },
};

const mirror = {
  id: 'core.mirror', extends: 'core.decor.base',
  name: { tr: 'Ayna', en: 'Mirror' },
  size: [120, 150],
  art: { default: [
    ellipse(60, 75, 58, 73, '#c98a4b'), ellipse(60, 75, 48, 63, '#d8f1ff'),
    path('M36 50 L56 30 M40 70 L70 40', null, { lw: 6, stroke: '#ffffff', alpha: 0.8, rough: false }),
  ] },
  reactions: { tap: [{ do: 'PlayAnim', clip: 'pulse', amp: 0.05 }, { do: 'PlaySound', sound: 'sparkle', volume: 0.4 }] },
};

const duck = {
  id: 'core.duck', extends: 'core.item.base',
  name: { tr: 'Lastik ördek', en: 'Rubber duck' },
  size: [70, 60],
  colorSlots: { body: '#ffd166' },
  art: { default: [
    path('M6 34 C6 56 62 60 64 36 C56 40 46 40 42 34 C52 24 46 4 30 6 C16 8 12 24 20 32 C14 30 8 30 6 34 Z', '$body'),
    path('M46 16 L60 20 L46 24 Z', '#f28c38'), circle(36, 14, 3, '#3b2f2a', { stroke: null }),
  ] },
  reactions: {
    tap: [{ do: 'PlayAnim', clip: 'squash', amp: 0.3 }, { do: 'PlaySound', sound: 'squeak' }],
    land: [{ do: 'PlayAnim', clip: 'squash', amp: 0.2 }, { do: 'PlaySound', sound: 'squeak', volume: 0.6 }],
  },
};

// ---------- covers ----------
// Lies flat when on its own; dropped on a table it bends over the table top and hangs down.
const checks = [];
for (let y = 0; y < 100; y += 20) for (let x = (y / 20) % 2 ? 20 : 0; x < 220; x += 40) checks.push(rect(x, y, 20, 20, '#ffffff', { alpha: 0.55, stroke: null }));
const tablecloth = {
  id: 'core.tablecloth', extends: 'core.item.base',
  name: { tr: 'Masa örtüsü', en: 'Tablecloth' },
  size: [220, 110],
  colorSlots: { cloth: '#e04f3a' },
  behaviors: [{ type: 'Wrap', depth: 0.42, drape: true }],
  art: { default: [
    path('M0 0 H220 V100 Q211 110 202 100 Q193 110 184 100 Q175 110 166 100 Q157 110 148 100 Q139 110 130 100 Q121 110 112 100 Q103 110 94 100 Q85 110 76 100 Q67 110 58 100 Q49 110 40 100 Q31 110 22 100 Q13 110 4 100 L0 100 Z', '$cloth'),
    ...checks,
  ] },
  reactions: { dropInto: [{ do: 'PlaySound', sound: 'whoosh', volume: 0.5 }] },
};

const all = [door, ...signs, bed, toybox, teddy, picture, bathtub, sink, mirror, duck, tablecloth];
writeFileSync(new URL('../content/core/defs/house.json', import.meta.url), `${JSON.stringify(all, null, 1)}\n`);
console.log(`${all.length} definitions written`);
