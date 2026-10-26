import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { DefStore, Scene, Animator, characters } from '../src/engine/index.js';

const { AGES, EXPRESSIONS, SKELETONS, randomLook, composeArt, mapShape } = characters;
const core = new URL('../content/core/', import.meta.url);
const readJson = (path) => JSON.parse(readFileSync(new URL(path, core), 'utf8'));

function coreDefs() {
  const defs = new DefStore();
  for (const file of readJson('manifest.json').defs) for (const def of [].concat(readJson(`defs/${file}`))) defs.add(def);
  return defs;
}
const scene = () => new Scene(coreDefs(), { id: 't', floorY: 740 }, { animator: new Animator(), audio: { play() {} } });
const flush = () => new Promise((resolve) => setImmediate(resolve));

test('every age composes into a moving, parted character', () => {
  const s = scene();
  for (const age of AGES) {
    const c = s.spawn('core.character', { x: 300, y: 800, look: randomLook(s.defs, age, () => 0.4) });
    assert.deepEqual(c.def.size, SKELETONS[age].size);
    assert.deepEqual(Object.keys(c.def.art), EXPRESSIONS);
    const parts = new Set(c.def.art.happy.map((sh) => sh.part ?? ''));
    for (const p of ['head', 'armL', 'armR', 'legL', 'legR', '']) assert.ok(parts.has(p), `${age}: ${p}`);
    for (const sh of c.def.art.happy) {
      for (const k of ['fill', 'stroke', 'color']) assert.ok(!String(sh[k] ?? '').startsWith('$'), `${age}: unresolved colour ${sh[k]}`);
    }
  }
});

test('random looks only use parts that fit the age', () => {
  const defs = coreDefs();
  let seed = 3;
  const random = () => ((seed = (seed * 16807) % 2147483647) / 2147483647);
  for (let i = 0; i < 100; i++) {
    for (const age of AGES) {
      const look = randomLook(defs, age, random);
      for (const slot of ['hair', 'top', 'bottom', 'shoes', 'head', 'face']) {
        if (!look[slot]) continue;
        const part = defs.get(look[slot]);
        assert.ok(!part.ages || part.ages.includes(age), `${age} wears ${look[slot]}`);
      }
    }
  }
});

test('a headscarf hides the hair and a dress covers the bottom', () => {
  const defs = coreDefs();
  const look = { ...characters.DEFAULT_LOOK, age: 'adult', hair: 'core.part.hair.long', head: 'core.part.head.headscarf', top: 'core.part.top.dress', bottom: 'core.part.bottom.pants' };
  const { worn } = characters.wornParts(look, defs);
  assert.equal(worn.hair, undefined);
  assert.equal(worn.bottom, undefined);
  assert.ok(worn.head && worn.top);
  assert.ok(composeArt(look, defs).length > 0);
});

test('part shapes are mapped from 0–100 boxes into body regions', () => {
  const box = { x: 10, y: 20, w: 50, h: 200 };
  assert.deepEqual(mapShape({ type: 'rect', x: 0, y: 50, w: 100, h: 50 }, box, 'legL'), { type: 'rect', x: 10, y: 120, w: 50, h: 100, r: undefined, part: 'legL' });
  const c = mapShape({ type: 'circle', cx: 50, cy: 50, r: 10 }, box);
  assert.equal(c.type, 'ellipse');
  assert.equal(c.rx, 5);
  assert.equal(c.ry, 20);
  assert.equal(mapShape({ type: 'path', d: 'M0 0 L100 100 H50 V0 Z' }, box).d, 'M 10 20 L 60 220 H 35 V 20 Z');
});

test('dressing swaps clothes and drops the old ones', async () => {
  const s = scene();
  const kid = s.spawn('core.character', { x: 500, y: 900, look: { ...characters.DEFAULT_LOOK, top: 'core.part.top.tshirt', colors: { top: '#123456' } } });
  const dress = s.spawn('core.wear.dress', { colors: { main: '#ff00ff' } });
  assert.ok(kid.accepts(dress));
  s.putInto(kid, dress);
  await flush();
  assert.equal(kid.look.top, 'core.part.top.dress');
  assert.equal(kid.look.colors.top, '#ff00ff');
  assert.equal(s.get(dress.id), null, 'the dress is worn, not lying around');
  const shirt = [...s.entities.values()].find((e) => e.def.id === 'core.wear.tshirt');
  assert.ok(shirt, 'the old T-shirt dropped out');
  assert.equal(shirt.colors.main, '#123456');
  assert.equal(kid.state, 'laugh', 'happy to be dressed');
});

test('babies cannot wear grown-up clothes but can hold small things', () => {
  const s = scene();
  const baby = s.spawn('core.character', { x: 500, y: 900, look: { ...characters.DEFAULT_LOOK, age: 'baby', top: 'core.part.top.onesie' } });
  assert.equal(baby.accepts(s.spawn('core.wear.dress')), true, 'it fits in the hand instead');
  s.putInto(baby, s.spawn('core.wear.dress'));
  assert.equal(baby.look.top, 'core.part.top.onesie');
  assert.equal(s.childrenOf(baby).length, 1);
});

test('characters sit on chairs and keep their look through a save', () => {
  const s = scene();
  const chair = s.spawn('core.chair', { x: 400, y: 800 });
  const kid = s.spawn('core.character', { x: 600, y: 900, look: randomLook(s.defs, 'child', () => 0.7) });
  assert.ok(chair.accepts(kid));
  assert.equal(chair.accepts(s.spawn('core.apple')), false, 'chairs are for sitting');
  s.putInto(chair, kid);
  assert.equal(kid.wantedIdle(), 'sit');
  const surface = chair.y - chair.height + 70 + 20;
  assert.equal(kid.y, surface + kid.legHeight);

  const restored = Scene.deserialize(s.defs, JSON.parse(JSON.stringify(s.serialize())), { animator: new Animator() });
  const back = restored.get(kid.id);
  assert.deepEqual(back.look, kid.look);
  assert.equal(back.parent.def.id, 'core.chair');
  assert.equal(back.def.id, kid.def.id);
});

test('tapping the head changes the face, tapping the body waves', async () => {
  const s = scene();
  const kid = s.spawn('core.character', { x: 500, y: 900 });
  const { head } = SKELETONS.child;
  kid.emit('tap', { local: { x: head.cx, y: head.cy } });
  await flush();
  assert.equal(kid.state, 'laugh');
  kid.emit('tap', { local: { x: head.cx, y: 200 } });
  await flush();
  s.tick(0.3);
  assert.ok(kid.partFx?.armR?.rot < 0, 'the right arm goes up');
});
