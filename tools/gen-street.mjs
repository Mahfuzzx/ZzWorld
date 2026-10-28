// Generates content/core/defs/street.json: house fronts, the front door, signposts
// (to the park, back to the street, to the city map), street lamps, trees, a
// bench, a swing, a pond and flowers. Run: node tools/gen-street.mjs
import { writeFileSync } from 'node:fs';

const path = (d, fill, extra = {}) => ({ type: 'path', d, fill, ...extra });
const rect = (x, y, w, h, fill, extra = {}) => ({ type: 'rect', x, y, w, h, fill, ...extra });
const circle = (cx, cy, r, fill, extra = {}) => ({ type: 'circle', cx, cy, r, fill, ...extra });
const ellipse = (cx, cy, rx, ry, fill, extra = {}) => ({ type: 'ellipse', cx, cy, rx, ry, fill, ...extra });

// ---------- house fronts (part of the street: not movable, not in the catalog) ----------
const windowAt = (x, y, lit) => [
  rect(x, y, 70, 80, lit ? '#ffe08a' : '#bfe3f5', { r: 4 }),
  path(`M${x + 35} ${y} V${y + 80} M${x} ${y + 40} H${x + 70}`, null, { lw: 4, stroke: '#ffffff' }),
  rect(x - 6, y + 80, 82, 10, '#ffffff', { r: 3 }),
];
const facade = (id, name, { w, h, wall, roof, floors = 1, door = true }) => {
  const body = (lit) => {
    const shapes = [
      path(`M-10 ${h * 0.32} L${w / 2} 0 L${w + 10} ${h * 0.32} Z`, '$roof'),
      rect(20, h * 0.3, w - 40, h * 0.7, '$wall'),
    ];
    for (let f = 0; f < floors; f++) {
      const y = h * 0.38 + f * 150;
      shapes.push(...windowAt(60, y, lit), ...windowAt(w - 130, y, lit));
    }
    if (!door) return shapes;
    // a painted door (the real one is a separate Portal standing in front)
    return [...shapes, rect(w / 2 - 55, h - 190, 110, 190, '#8a5a2b', { r: 10 }), circle(w / 2 + 34, h - 95, 6, '#ffd166')];
  };
  return {
    id: `core.facade.${id}`, extends: 'core.decor.base', class: 'Structure', catalog: false, mobility: 'locked',
    name, size: [w, h], colorSlots: { wall, roof },
    initialState: 'day',
    art: { day: body(false), night: body(true) },
    reactions: {
      'world:night': [{ do: 'SetState', to: 'night' }],
      'world:day': [{ do: 'SetState', to: 'day' }],
    },
  };
};
const facades = [
  facade('home', { tr: 'Bizim ev', en: 'Our house' }, { w: 520, h: 540, wall: '#f2c4a8', roof: '#c8643b', floors: 2, door: false }),
  facade('blue', { tr: 'Mavi ev', en: 'Blue house' }, { w: 440, h: 440, wall: '#bcd9ef', roof: '#4f6f9e' }),
  facade('yellow', { tr: 'Sarı ev', en: 'Yellow house' }, { w: 480, h: 600, wall: '#f6dc8a', roof: '#8a5a2b', floors: 2 }),
];

// The front door of our house: a Portal like the room doors, in house colours.
const frontDoor = {
  id: 'core.door.front', extends: 'core.door', catalog: false,
  name: { tr: 'Ön kapı', en: 'Front door' },
  size: [140, 230],
  colorSlots: { door: '#3aa76d', frame: '#ffffff' },
  art: {
    closed: [rect(0, 0, 140, 230, '$frame', { r: 8 }), rect(12, 12, 116, 218, '$door', { r: 6 }),
      rect(36, 30, 68, 50, '#bfe3f5', { r: 30 }), circle(108, 130, 7, '#ffd166')],
    open: [rect(0, 0, 140, 230, '$frame', { r: 8 }), rect(12, 12, 116, 218, '#5a4a42', { r: 6 }),
      path('M12 230 L12 12 L48 26 L48 222 Z', '$door'), ellipse(84, 214, 32, 9, '#fff3c4', { alpha: 0.4, stroke: null })],
  },
};

// ---------- signposts: tap to go somewhere ----------
const ICONS = {
  park: [circle(60, 50, 26, '#8fc7a4'), rect(55, 70, 10, 26, '#8a5a2b')],
  house: [path('M30 60 L60 30 L90 60 Z', '#e8735a'), rect(38, 58, 44, 36, '#f2c4a8'), rect(54, 70, 12, 24, '#8a5a2b')],
  map: [path('M26 34 L48 26 L72 34 L94 26 V86 L72 94 L48 86 L26 94 Z', '#d8f1ff'), path('M48 26 V86 M72 34 V94', null, { lw: 3 }), circle(60, 58, 6, '#e04f3a')],
};
const signpost = (id, name, icon) => ({
  id: `core.signpost.${id}`, extends: 'core.decor.base', class: 'Portal', catalog: false,
  name, size: [120, 280],
  initialState: 'open',
  behaviors: [{ type: 'Doorway' }],
  art: { default: [
    rect(54, 110, 12, 170, '#8a5a2b', { r: 4 }),
    rect(4, 4, 112, 112, '#fff8e6', { r: 18 }),
    ...ICONS[icon],
    path('M86 100 L104 108 L86 116 Z', '#3b2f2a'),
  ] },
  reactions: { tap: [{ do: 'PlayAnim', clip: 'wobble', amp: 0.1 }] },
});
const signposts = [
  signpost('park', { tr: 'Park tabelası', en: 'Park sign' }, 'park'),
  signpost('street', { tr: 'Sokak tabelası', en: 'Street sign' }, 'house'),
  signpost('map', { tr: 'Harita tabelası', en: 'Map sign' }, 'map'),
];

// ---------- street furniture ----------
const streetlamp = {
  id: 'core.streetlamp', extends: 'core.furniture.base',
  name: { tr: 'Sokak lambası', en: 'Street lamp' },
  size: [110, 400],
  behaviors: [{ type: 'Toggle', states: ['off', 'on'] }],
  light: { x: 55, y: 40, r: 380, when: 'on' },
  art: {
    off: [rect(48, 60, 14, 330, '#4f5b66', { r: 5 }), ellipse(55, 392, 34, 8, '#4f5b66'),
      path('M20 60 L90 60 L76 20 L34 20 Z', '#6b7780'), rect(36, 60, 38, 18, '#d8e2e8', { r: 4 })],
    on: [ellipse(55, 90, 60, 70, '#fff3b0', { alpha: 0.5, stroke: null }),
      rect(48, 60, 14, 330, '#4f5b66', { r: 5 }), ellipse(55, 392, 34, 8, '#4f5b66'),
      path('M20 60 L90 60 L76 20 L34 20 Z', '#6b7780'), rect(36, 60, 38, 18, '#ffe08a', { r: 4 })],
  },
  reactions: {
    'stateEnter:on': [{ do: 'PlaySound', sound: 'click' }],
    'world:night': [{ do: 'SetState', to: 'on' }],
    'world:day': [{ do: 'SetState', to: 'off' }],
  },
};

const tree = {
  id: 'core.tree', extends: 'core.furniture.base',
  name: { tr: 'Ağaç', en: 'Tree' },
  size: [280, 400],
  boil: true,
  colorSlots: { leaves: '#7cbf7a' },
  art: { default: [
    path('M120 400 L128 230 C110 210 90 214 80 220 C96 200 120 200 130 214 L134 180 L146 180 L150 212 C162 196 186 198 198 214 C186 210 166 212 152 232 L160 400 Z', '#8a5a2b'),
    circle(90, 150, 80, '$leaves'), circle(190, 150, 80, '$leaves'), circle(140, 90, 90, '$leaves'),
    circle(110, 80, 8, '#e04f3a', { stroke: null }), circle(190, 130, 8, '#e04f3a', { stroke: null }), circle(80, 170, 8, '#e04f3a', { stroke: null }),
  ] },
  reactions: { tap: [{ do: 'PlayAnim', clip: 'wobble', amp: 0.05 }, { do: 'PlaySound', sound: 'whoosh', volume: 0.4 }] },
};

const bush = {
  id: 'core.bush', extends: 'core.furniture.base',
  name: { tr: 'Çalı', en: 'Bush' },
  size: [180, 100],
  colorSlots: { leaves: '#6aa84f' },
  art: { default: [circle(50, 62, 40, '$leaves'), circle(130, 62, 40, '$leaves'), circle(90, 46, 46, '$leaves'), rect(10, 66, 160, 34, '$leaves', { r: 16 })] },
  reactions: { tap: [{ do: 'PlayAnim', clip: 'shake', amp: 4 }, { do: 'PlaySound', sound: 'whoosh', volume: 0.3, pitch: 1.4 }] },
};

const bench = {
  id: 'core.bench', extends: 'core.furniture.base',
  name: { tr: 'Bank', en: 'Bench' },
  size: [320, 150],
  colorSlots: { wood: '#c98a4b' },
  behaviors: [{ type: 'Seat', slots: 3, area: [20, 70, 280, 22], pose: 'sit' }],
  art: { default: [
    rect(10, 6, 300, 22, '$wood', { r: 6 }), rect(10, 36, 300, 22, '$wood', { r: 6 }),
    rect(24, 0, 12, 100, '#4f5b66', { r: 4 }), rect(284, 0, 12, 100, '#4f5b66', { r: 4 }),
    rect(0, 84, 320, 22, '$wood', { r: 6 }),
    rect(24, 100, 12, 50, '#4f5b66', { r: 4 }), rect(284, 100, 12, 50, '#4f5b66', { r: 4 }),
  ] },
};

const swing = {
  id: 'core.swing', extends: 'core.furniture.base',
  name: { tr: 'Salıncak', en: 'Swing' },
  size: [300, 360],
  colorSlots: { frame: '#e04f3a', seat: '#ffd166' },
  behaviors: [{ type: 'Seat', slots: 1, area: [100, 230, 100, 24], pose: 'swing', expression: 'laugh' }],
  art: { default: [
    path('M20 360 L70 10 M280 360 L230 10', null, { lw: 14, stroke: '$frame' }),
    rect(40, 0, 220, 20, '$frame', { r: 8 }),
    path('M110 20 V250 M190 20 V250', null, { lw: 4, stroke: '#6b5b53' }),
    rect(96, 246, 108, 16, '$seat', { r: 6 }),
  ] },
  reactions: { received: [{ do: 'PlaySound', sound: 'slide', volume: 0.5 }] },
};

const pond = {
  id: 'core.pond', extends: 'core.furniture.base',
  name: { tr: 'Gölet', en: 'Pond' },
  size: [440, 130],
  behaviors: [{ type: 'Container', slots: 4, area: [60, 0, 320, 80] }],
  art: { default: [ellipse(220, 70, 216, 56, '#7cc6f2'), path('M120 60 Q150 52 180 60 M260 80 Q290 72 320 80', null, { lw: 3, stroke: '#ffffff', alpha: 0.7 })] },
  artFront: { default: [
    path('M8 80 C40 132 400 132 432 80 C420 100 380 116 220 118 C60 116 20 100 8 80 Z', '#7cc6f2', { stroke: null }),
    ...[[20, 92], [70, 112], [140, 122], [220, 126], [300, 122], [370, 112], [420, 92]].map(([x, y]) => ellipse(x, y, 26, 14, '#b8b4ad')),
  ] },
  reactions: { received: [{ do: 'PlaySound', sound: 'splash', pitch: [1.1, 1.4] }] },
};

const flowers = {
  id: 'core.flowers', extends: 'core.item.base',
  name: { tr: 'Çiçekler', en: 'Flowers' },
  size: [90, 80],
  boil: true,
  colorSlots: { petals: '#f28dbb' },
  art: { default: [
    path('M25 80 V40 M45 80 V30 M65 80 V44', null, { lw: 4, stroke: '#4e8a3a' }),
    circle(25, 38, 11, '$petals'), circle(45, 26, 12, '#ffd166'), circle(65, 42, 11, '$petals'),
    circle(25, 38, 4, '#ffd166', { stroke: null }), circle(45, 26, 4, '#e8735a', { stroke: null }), circle(65, 42, 4, '#ffd166', { stroke: null }),
  ] },
  reactions: { tap: [{ do: 'PlayAnim', clip: 'wobble', amp: 0.2 }, { do: 'PlaySound', sound: 'sparkle', volume: 0.3 }] },
};

const mailbox = {
  id: 'core.mailbox', extends: 'core.furniture.base',
  name: { tr: 'Posta kutusu', en: 'Mailbox' },
  size: [100, 180],
  colorSlots: { box: '#e04f3a' },
  behaviors: [{ type: 'Container', slots: 2, area: [10, 10, 80, 60] }],
  art: { default: [rect(44, 80, 12, 100, '#6b5b53'), path('M8 80 V40 C8 10 92 10 92 40 V80 Z', '$box'), rect(30, 40, 40, 8, '#3b2f2a', { r: 3 }), path('M92 36 L110 36 L110 54 L92 54', '#ffd166')] },
  reactions: { tap: [{ do: 'PlayAnim', clip: 'bounce', amp: 14 }, { do: 'PlaySound', sound: 'ding', volume: 0.5 }] },
};

const all = [...facades, frontDoor, ...signposts, streetlamp, tree, bush, bench, swing, pond, flowers, mailbox];
writeFileSync(new URL('../content/core/defs/street.json', import.meta.url), `${JSON.stringify(all, null, 1)}\n`);
console.log(`${all.length} definitions written`);
