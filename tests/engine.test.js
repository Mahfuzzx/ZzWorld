import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { DefStore, Scene, Animator, DayNight, Backdrop } from '../src/engine/index.js';

const core = new URL('../content/core/', import.meta.url);
const readJson = (path) => JSON.parse(readFileSync(new URL(path, core), 'utf8'));

function coreDefs() {
  const defs = new DefStore();
  for (const file of readJson('manifest.json').defs) {
    for (const def of [].concat(readJson(`defs/${file}`))) defs.add(def);
  }
  return defs;
}

function fakeServices() {
  const sounds = [];
  return { sounds, audio: { play: (name) => sounds.push(name) }, animator: new Animator() };
}

const flush = () => new Promise((resolve) => setImmediate(resolve));

function emptyScene(services = fakeServices()) {
  return new Scene(coreDefs(), { id: 'test', width: 2000, height: 1000, floorY: 740 }, services);
}

function settle(scene, seconds = 2) {
  for (let t = 0; t < seconds; t += 1 / 60) scene.tick(1 / 60);
}

test('extends merges objects deeply and replaces arrays', () => {
  const fridge = coreDefs().get('core.fridge');
  assert.equal(fridge.class, 'Furniture');
  assert.equal(fridge.abstract, false);
  assert.ok(fridge.reactions.pickUp, 'pickUp inherited from core.base');
  assert.equal(fridge.reactions.land[0].amp, 0.08, 'land overridden by core.furniture.base');
  assert.ok(fridge.reactions['stateEnter:open'], 'own reactions kept');
  assert.equal(coreDefs().get('core.item.base').abstract, true);
});

test('circular extends is reported', () => {
  const defs = new DefStore();
  defs.add({ id: 'a', extends: 'b' });
  defs.add({ id: 'b', extends: 'a' });
  assert.throws(() => defs.get('a'), /Circular extends/);
});

test('abstract definitions cannot be placed', () => {
  assert.throws(() => emptyScene().spawn('core.item.base'), /abstract/);
});

test('tap on a Toggle switches state and runs stateEnter reactions', async () => {
  const services = fakeServices();
  const scene = emptyScene(services);
  const lamp = scene.spawn('core.lamp', { x: 500, y: 800 });
  assert.equal(lamp.state, 'off');
  lamp.emit('tap');
  await flush();
  assert.equal(lamp.state, 'on');
  assert.deepEqual(services.sounds, ['click']);
});

test('a closed fridge refuses items and hides its contents', () => {
  const scene = emptyScene();
  const fridge = scene.spawn('core.fridge', { x: 300, y: 800 });
  const apple = scene.spawn('core.apple', { x: 300, y: 600 });
  assert.equal(fridge.accepts(apple), false);

  fridge.emit('tap');
  assert.equal(fridge.state, 'open');
  assert.equal(scene.dropTargetFor(apple), fridge);
  scene.putInto(fridge, apple);
  assert.equal(apple.parent, fridge);
  assert.ok(apple.visible);

  fridge.emit('tap');
  assert.equal(apple.visible, false);
  assert.ok(!scene.renderList().includes(apple));
  assert.notEqual(scene.hitTest(apple.x, apple.y - 10), apple);
});

test('dropped items fall onto a surface and move with it', () => {
  const scene = emptyScene();
  const table = scene.spawn('core.table', { x: 800, y: 820 });
  const apple = scene.spawn('core.apple', { x: 760, y: 300 });
  scene.drop(apple);
  settle(scene);
  assert.equal(apple.y, 820 - 150 + 4);
  assert.equal(apple.restingOn, table.id);

  scene.pickUp(table);
  scene.moveTo(table, 1200, 820);
  assert.equal(apple.x, 1160, 'apple travels with the table');
});

test('furniture never lands on other furniture', () => {
  const scene = emptyScene();
  scene.spawn('core.table', { x: 800, y: 820 });
  const lamp = scene.spawn('core.lamp', { x: 800, y: 300 });
  scene.drop(lamp);
  settle(scene);
  assert.equal(lamp.y, 740);
  assert.equal(lamp.restingOn, null);
});

test('an item dropped on the floor band keeps its depth', () => {
  const scene = emptyScene();
  const ball = scene.spawn('core.ball', { x: 1400, y: 900 });
  scene.drop(ball);
  assert.equal(ball.y, 900);
  assert.equal(ball.fall, null);
});

test('a basket cannot be put into itself or its contents', () => {
  const scene = emptyScene();
  const basket = scene.spawn('core.basket', { x: 500, y: 800 });
  const inner = scene.spawn('core.basket', { x: 500, y: 600 });
  assert.equal(basket.accepts(basket), false);
  assert.ok(basket.accepts(scene.spawn('core.apple')));
  // a basket (130 wide) does not fit into another basket's area (114 wide)
  assert.equal(basket.accepts(inner), false);
});

test('room template settles and survives a save/load round trip', () => {
  const defs = coreDefs();
  const scene = Scene.fromTemplate(defs, readJson('scenes/room.json'), fakeServices());
  const fridge = [...scene.entities.values()].find((e) => e.def.id === 'core.fridge');
  assert.equal(scene.childrenOf(fridge).length, 2);
  const onTable = [...scene.entities.values()].filter((e) => e.restingOn && scene.get(e.restingOn).def.id === 'core.table');
  assert.equal(onTable.length, 2, 'apple and basket rest on the table');

  const data = JSON.parse(JSON.stringify(scene.serialize()));
  const restored = Scene.deserialize(defs, data, fakeServices());
  assert.deepEqual(restored.serialize(), scene.serialize());
  const before = new Set(restored.entities.keys());
  assert.ok(!before.has(restored.spawn('core.apple').id), 'new ids never collide with restored ones');
});

test('unknown actions are reported without breaking the reaction list', async () => {
  const services = fakeServices();
  const defs = coreDefs();
  defs.add({ id: 'x.thing', extends: 'core.item.base', reactions: { tap: [{ do: 'Nope' }, { do: 'PlaySound', sound: 'pop' }] } });
  const scene = new Scene(defs, { id: 't' }, services);
  const warn = console.warn;
  console.warn = () => {};
  try {
    scene.spawn('x.thing').emit('tap');
    await flush();
  } finally {
    console.warn = warn;
  }
  assert.deepEqual(services.sounds, ['pop']);
});

test('mobility: small things always move, big ones only in edit mode', () => {
  const scene = emptyScene();
  const apple = scene.spawn('core.apple');
  const fridge = scene.spawn('core.fridge');
  const window_ = scene.spawn('core.window');
  for (const mode of ['play', 'edit']) assert.ok(apple.canDrag(mode));
  assert.equal(fridge.canDrag('play'), false);
  assert.ok(fridge.canDrag('edit'));
  assert.equal(window_.canDrag('play'), false);
  assert.ok(window_.canDrag('edit'));
});

test('windows stay on the wall while dragged', () => {
  const scene = emptyScene();
  const window_ = scene.spawn('core.window', { x: 800, y: 500 });
  assert.deepEqual(window_.constrainDrag(800, 950), { x: 800, y: 730 }, 'not below the floor line');
  assert.deepEqual(window_.constrainDrag(-50, 100), { x: 130, y: 230 }, 'not off the wall');
});

test('containers only take free items', () => {
  const defs = coreDefs();
  defs.add({ id: 'x.stool', extends: 'core.furniture.base', size: [50, 50] });
  const scene = new Scene(defs, { id: 't' }, fakeServices());
  const fridge = scene.spawn('core.fridge', { state: 'open' });
  assert.equal(fridge.accepts(scene.spawn('x.stool')), false);
  assert.ok(fridge.accepts(scene.spawn('core.apple')));
});

test('day/night fades and lamps react to world events', async () => {
  const dayNight = new DayNight();
  const heard = [];
  dayNight.onChange((night) => heard.push(night));
  dayNight.toggle();
  assert.deepEqual(heard, [true]);
  dayNight.update(0.75);
  assert.ok(dayNight.amount > 0.4 && dayNight.amount < 0.6);
  dayNight.update(5);
  assert.equal(dayNight.amount, 1);

  const scene = emptyScene();
  const lamp = scene.spawn('core.lamp');
  lamp.emit('world:night');
  await flush();
  assert.equal(lamp.state, 'on');
});

test('backdrops resolve into registered layer classes', () => {
  const backdrop = new Backdrop(coreDefs().get('core.backdrop.city'));
  assert.deepEqual(backdrop.layers.map((l) => l.constructor.type), ['Sky', 'Stars', 'SunMoon', 'Clouds', 'Art', 'Art']);
  assert.ok(backdrop.layers.at(-1).parallax > backdrop.layers[3].parallax, 'nearer layers move more');
});

test('scenes saved before layers keep their wall colours', () => {
  const scene = Scene.deserialize(coreDefs(), { id: 'old', background: { wall: '#123456' }, entities: [] }, fakeServices());
  assert.equal(scene.interior.wall, '#123456');
  assert.equal(scene.serialize().interior.wall, '#123456');
});

test('contents never stick out of their container', () => {
  const scene = emptyScene();
  const basket = scene.spawn('core.basket', { x: 500, y: 800 });
  for (const def of ['core.ball', 'core.apple', 'core.apple']) scene.putInto(basket, scene.spawn(def));
  const inside = (item, box) => item.x - item.width / 2 >= box.x - box.width / 2 - 0.01
    && item.x + item.width / 2 <= box.x + box.width / 2 + 0.01
    && item.y - item.height >= box.y - box.height - 0.01
    && item.y <= box.y + 0.01;
  const contents = scene.childrenOf(basket);
  assert.equal(contents.length, 3);
  for (const item of contents) assert.ok(inside(item, basket), `${item.def.id} at ${item.x} sticks out`);
});

test('removing a container drops its contents instead of deleting them', () => {
  const scene = emptyScene();
  const basket = scene.spawn('core.basket', { x: 500, y: 600 });
  const apple = scene.spawn('core.apple');
  scene.putInto(basket, apple);
  scene.remove(basket);
  assert.equal(scene.get(basket.id), null);
  assert.equal(scene.get(apple.id), apple);
  assert.equal(apple.parentId, null);
  settle(scene);
  assert.equal(apple.y, 740, 'the apple fell to the floor');
});

test('structures cannot be thrown away', () => {
  const scene = emptyScene();
  assert.equal(scene.spawn('core.window').canDelete(), false);
  assert.ok(scene.spawn('core.fridge').canDelete());
});

test('saves with objects that no longer exist still load', () => {
  const defs = coreDefs();
  defs.add({ id: 'my.box', extends: 'core.item.base', size: [80, 80], behaviors: [{ type: 'Container', slots: 2 }] });
  const scene = new Scene(defs, { id: 's' }, fakeServices());
  const box = scene.spawn('my.box', { x: 300, y: 800 });
  const apple = scene.spawn('core.apple');
  scene.putInto(box, apple);
  const data = scene.serialize();

  const warn = console.warn;
  console.warn = () => {};
  let restored;
  try {
    restored = Scene.deserialize(coreDefs(), data, fakeServices()); // my.box is gone
  } finally {
    console.warn = warn;
  }
  assert.equal(restored.entities.size, 1);
  const lone = restored.get(apple.id);
  assert.equal(lone.parentId, null);
  assert.ok(restored.renderList().includes(lone), 'the apple is still visible');
});
