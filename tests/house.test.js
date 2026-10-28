import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { DefStore, Scene, Animator, characters } from '../src/engine/index.js';

const core = new URL('../content/core/', import.meta.url);
const readJson = (path) => JSON.parse(readFileSync(new URL(path, core), 'utf8'));

function coreDefs() {
  const defs = new DefStore();
  for (const file of readJson('manifest.json').defs) for (const def of [].concat(readJson(`defs/${file}`))) defs.add(def);
  return defs;
}
const templates = () => readJson('manifest.json').scenes.map((f) => readJson(`scenes/${f}`));
const services = (extra = {}) => ({ animator: new Animator(), audio: { play() {} }, ...extra });
const flush = () => new Promise((resolve) => setImmediate(resolve));

test('every door leads to a room with a door back', () => {
  const rooms = new Map(templates().map((t) => [t.id, t]));
  assert.ok(rooms.has(readJson('manifest.json').startScene));
  let doors = 0;
  for (const room of rooms.values()) {
    for (const door of room.entities.filter((e) => e.door)) {
      doors++;
      const other = rooms.get(door.target.scene);
      assert.ok(other, `${room.id}/${door.door} → missing ${door.target.scene}`);
      const back = other.entities.find((e) => e.door === door.target.door);
      assert.ok(back, `${other.id} has no door ${door.target.door}`);
      assert.deepEqual(back.target, { scene: room.id, door: door.door }, `${other.id}/${back.door} does not lead back`);
    }
  }
  assert.equal(doors, 4);
});

test('all rooms build from their templates and survive a save', () => {
  const defs = coreDefs();
  for (const template of templates()) {
    const scene = Scene.fromTemplate(defs, template, services());
    const restored = Scene.deserialize(defs, JSON.parse(JSON.stringify(scene.serialize())), services());
    assert.deepEqual(restored.serialize(), scene.serialize(), template.id);
    const doors = [...restored.entities.values()].filter((e) => e.door);
    assert.ok(doors.every((d) => d.target?.scene), 'doors keep their targets');
  }
});

test('a closed door opens; tapping the open door goes through it', async () => {
  const trips = [];
  const scene = Scene.fromTemplate(coreDefs(), templates()[0], services({ travel: (e, portal) => trips.push([e, portal.door]) }));
  const door = [...scene.entities.values()].find((e) => e.door === 'toBedroom');
  assert.equal(door.state, 'closed');
  door.emit('tap');
  await flush();
  assert.equal(door.state, 'open');
  door.emit('tap');
  await flush();
  assert.equal(door.state, 'open', 'it stays open');
  assert.deepEqual(trips, [[null, 'toBedroom']]);
  assert.equal(door.canDelete(), false, 'doors cannot be thrown away');
});

test('things dropped on an open door travel; furniture does not', () => {
  const trips = [];
  const scene = new Scene(coreDefs(), { id: 'x' }, services({ travel: (e) => trips.push(e.def.id) }));
  const door = scene.spawn('core.door', { x: 300, y: 740, door: 'a', target: { scene: 'y', door: 'b' }, state: 'open' });
  const apple = scene.spawn('core.apple');
  assert.ok(door.accepts(apple));
  assert.equal(door.accepts(scene.spawn('core.table')), false);
  scene.putInto(door, apple);
  assert.deepEqual(trips, ['core.apple']);
  door.setState('closed');
  assert.equal(door.accepts(scene.spawn('core.ball')), false, 'closed doors take nothing');
});

test('a character carries what it holds into the next room', () => {
  const defs = coreDefs();
  const a = new Scene(defs, { id: 'a' }, services());
  const b = new Scene(defs, { id: 'b' }, services());
  b.spawn('core.apple'); // ids in b are already taken
  const kid = a.spawn('core.character', { x: 300, y: 900, look: characters.randomLook(defs, 'adult', () => 0.3) });
  const apple = a.spawn('core.apple');
  a.putInto(kid, apple);

  const moving = a.extract(kid);
  assert.equal(a.entities.size, 0, 'both left the first room');
  const arrived = b.insert(moving, 700, 900);
  assert.equal(b.entities.size, 3);
  assert.equal(arrived.x, 700);
  assert.deepEqual(arrived.look, kid.look);
  const held = b.childrenOf(arrived);
  assert.equal(held.length, 1);
  assert.equal(held[0].def.id, 'core.apple');
  assert.notEqual(held[0].id, apple.id === held[0].id ? null : apple.id, 'fresh ids');
  assert.equal(new Set(b.entities.keys()).size, 3, 'no id clashes');
});

test('in bed characters lie down and get sleepy; in the bath they laugh', () => {
  const defs = coreDefs();
  const scene = new Scene(defs, { id: 's' }, services());
  const bed = scene.spawn('core.bed', { x: 600, y: 820 });
  const tub = scene.spawn('core.bathtub', { x: 1200, y: 840 });
  const kid = scene.spawn('core.character', { x: 300, y: 900 });
  const mum = scene.spawn('core.character', { x: 400, y: 900, look: { ...characters.DEFAULT_LOOK, age: 'adult' } });

  scene.putInto(bed, kid);
  assert.equal(kid.state, 'sleepy');
  assert.equal(kid.wantedIdle(), 'sleep');
  const mattress = bed.y - bed.height + 40 + 70;
  assert.equal(kid.y, mattress + kid.height / 2 - kid.width / 2 + kid.width * 0.4, 'tucked in under the blanket');

  scene.putInto(tub, mum);
  assert.equal(mum.state, 'laugh');
  assert.equal(mum.wantedIdle(), 'sit');
});

test('a sleeping character is picked by where it is drawn, not its upright box', () => {
  const defs = coreDefs();
  // fake drawing test: everything in the box is drawing
  const scene = new Scene(defs, { id: 's' }, services({ hitArt: () => true }));
  const kid = scene.spawn('core.character', { x: 600, y: 800 });
  kid.fx = { dx: 0, dy: 0, rot: -Math.PI / 2, sx: 1, sy: 1 }; // lying on its side
  const cy = kid.y - kid.height / 2;
  assert.equal(scene.hitTest(kid.x - kid.height / 2 + 10, cy), kid, 'the head end, far to the left');
  assert.equal(scene.hitTest(kid.x, kid.y - kid.height + 5), null, 'above it there is nothing now');
});

test('doors are not in the catalog; a door leading nowhere can be thrown away', async () => {
  const { placeableIds } = await import('../src/game/catalog.js');
  const defs = coreDefs();
  assert.ok(!placeableIds(defs).includes('core.door'), 'doors come with the house');
  const scene = new Scene(defs, { id: 'x' }, services());
  assert.equal(scene.spawn('core.door', { target: { scene: 'y', door: 'b' } }).canDelete(), false);
  assert.equal(scene.spawn('core.door').canDelete(), true, 'an old catalog door without a target');
});
