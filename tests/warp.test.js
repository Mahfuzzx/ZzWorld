import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { envelope, warpShape, fitMap, drapeMap, flatten } from '../src/engine/warp.js';
import { DefStore, Scene, Animator, characters } from '../src/engine/index.js';

const core = new URL('../content/core/', import.meta.url);
const readJson = (path) => JSON.parse(readFileSync(new URL(path, core), 'utf8'));
function coreDefs() {
  const defs = new DefStore();
  for (const file of readJson('manifest.json').defs) for (const def of [].concat(readJson(`defs/${file}`))) defs.add(def);
  return defs;
}
const near = (a, b, eps = 1) => Math.abs(a - b) <= eps;
const pointsOf = (shape) => flatten(shape).flatMap((l) => l.points);

test('the envelope of a circle narrows towards its top', () => {
  const env = envelope([{ type: 'circle', cx: 50, cy: 50, r: 50, fill: '#000' }]);
  assert.ok(near(env.top, 0) && near(env.bottom, 100));
  const [l, r] = env.extent(50);
  assert.ok(near(l, 0) && near(r, 100));
  const [l10, r10] = env.extent(10);
  assert.ok(near(l10, 20, 1.5) && near(r10, 80, 1.5));
  assert.equal(env.extent(130), null);
});

test('a square bent into a circle hugs the circle', () => {
  const env = envelope([{ type: 'circle', cx: 50, cy: 50, r: 50, fill: '#000' }]);
  const bent = warpShape({ type: 'rect', x: 0, y: 0, w: 100, h: 100, fill: 'red' }, fitMap({ x: 0, y: 0, w: 100, h: 100 }, env, { pad: 0 }));
  assert.equal(bent.type, 'path');
  for (const [x, y] of pointsOf(bent)) {
    assert.ok(Math.hypot(x - 50, y - 50) <= 51.5, `(${x}, ${y}) is outside the circle`);
  }
});

test('draping hangs straight down from the widest point', () => {
  // a T shape: wide top, narrow stem (a table)
  const env = envelope([{ type: 'rect', x: 0, y: 0, w: 100, h: 10, fill: '#000' }, { type: 'rect', x: 45, y: 10, w: 10, h: 90, fill: '#000' }]);
  const box = { x: 0, y: 0, w: 100, h: 60 };
  const [xHug] = fitMap(box, env, { pad: 0 })(0, 50); // halfway down: follows the stem
  const [xDrape] = drapeMap(box, env, { pad: 0 })(0, 50); // keeps the width of the top
  assert.ok(near(xHug, 45, 1.5));
  assert.ok(near(xDrape, 0, 1.5));
});

test('clothes follow the rounded body instead of its box', () => {
  const defs = coreDefs();
  const look = { ...characters.DEFAULT_LOOK, top: 'core.part.top.tshirt', hair: null };
  const art = characters.composeArt(look, defs);
  const sk = characters.SKELETONS.child;
  // the T-shirt's body: the first warped torso shape (a path) of the top colour
  const colour = defs.get('core.part.top.tshirt').color;
  const shirt = art.find((s) => s.type === 'path' && s.fill === colour && !s.part);
  assert.ok(shirt, 'shirt found');
  const pts = pointsOf(shirt);
  const topRow = pts.filter(([, y]) => near(y, sk.torso.y, 0.6));
  const minX = Math.min(...topRow.map(([x]) => x));
  assert.ok(minX > sk.torso.x + 3, `the top corner is rounded off (${minX} vs box ${sk.torso.x})`);
  const midRow = pts.filter(([, y]) => near(y, sk.torso.y + sk.torso.h / 2, 2));
  assert.ok(midRow.some(([x]) => near(x, sk.torso.x - 1.5, 1)), 'at mid height it reaches the body edge plus cloth');
});

test('a tablecloth covers the table and comes off flat again', () => {
  const defs = coreDefs();
  const scene = new Scene(defs, { id: 's' }, { animator: new Animator() });
  const table = scene.spawn('core.table', { x: 500, y: 800 });
  const cloth = scene.spawn('core.tablecloth', { x: 200, y: 900 });
  assert.ok(table.accepts(cloth));
  assert.equal(scene.spawn('core.window').accepts(cloth), false, 'no covers on wall things');
  scene.putInto(table, cloth);
  assert.ok(cloth.wrapping);
  assert.deepEqual(cloth.def.size, table.def.size);
  assert.equal(cloth.x, table.x);
  assert.ok(cloth.visible);
  assert.equal(table.accepts(scene.spawn('core.tablecloth')), false, 'one cover at a time');

  // it travels with the table
  scene.pickUp(table);
  scene.moveTo(table, 900, 800);
  assert.equal(cloth.x, 900);

  // saved and loaded, it is still on the table
  const restored = Scene.deserialize(defs, JSON.parse(JSON.stringify(scene.serialize())), { animator: new Animator() });
  const again = restored.get(cloth.id);
  assert.equal(again.serialize().def, 'core.tablecloth');
  assert.ok(again.wrapping);
  assert.equal(again.def.id, cloth.def.id);

  // pulled off: flat and its own size again
  scene.pickUp(cloth);
  assert.equal(cloth.wrapping, false);
  assert.equal(cloth.def.id, 'core.tablecloth');
  assert.deepEqual(cloth.def.size, [220, 110]);
});

test('a covered box keeps its contents, and the cover follows when it opens', () => {
  const defs = coreDefs();
  const scene = new Scene(defs, { id: 's' }, { animator: new Animator() });
  const fridge = scene.spawn('core.fridge', { x: 500, y: 800, state: 'open' });
  const apple = scene.spawn('core.apple');
  scene.putInto(fridge, apple);
  const cloth = scene.spawn('core.tablecloth');
  scene.putInto(fridge, cloth);
  assert.deepEqual(fridge.behaviors.find((b) => b.constructor.type === 'Container').contents(), [apple], 'the cover is not content');
  fridge.setState('closed');
  scene.tick(0.016);
  assert.ok(cloth.def.id.endsWith(':closed'));
  assert.ok(cloth.visible, 'the cover stays visible on the closed fridge');
});
