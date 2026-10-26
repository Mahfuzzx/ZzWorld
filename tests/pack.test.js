import { test } from 'node:test';
import assert from 'node:assert/strict';
import { deflateRawSync } from 'node:zlib';
import { createZip, readZip, textOf, crc32 } from '../src/shared/zip.js';
import { exportPack, importPack, validateDefs, slugify, addUserDefs } from '../src/shared/pack.js';
import { DefStore } from '../src/engine/index.js';

test('crc32 matches the reference value', () => {
  assert.equal(crc32(new TextEncoder().encode('123456789')), 0xcbf43926);
});

test('zip round trip keeps names and contents', async () => {
  const zip = createZip([{ name: 'a.txt', data: 'merhaba' }, { name: 'klasör/ç.json', data: '{"x":1}' }]);
  const files = await readZip(zip);
  assert.equal(textOf(files.get('a.txt')), 'merhaba');
  assert.equal(textOf(files.get('klasör/ç.json')), '{"x":1}');
});

test('deflated zip entries are read too', async () => {
  const text = 'ZzWorld '.repeat(50);
  const zip = createZip([{ name: 'big.txt', data: deflateRawSync(Buffer.from(text)) }]);
  const view = new DataView(zip.buffer);
  view.setUint16(8, 8, true); // local header: method = deflate
  const central = view.getUint32(zip.length - 6, true);
  view.setUint16(central + 10, 8, true); // central directory: method = deflate
  assert.equal(textOf((await readZip(zip)).get('big.txt')), text);
});

test('packs export and import', async () => {
  const defs = [{ id: 'ayse.cat-toy', extends: 'core.item.base', size: [40, 40] }];
  const manifest = { id: 'ayse', name: { tr: 'Ayşe' }, license: 'CC-BY-4.0' };
  const result = await importPack(exportPack(manifest, defs));
  assert.equal(result.manifest.id, 'ayse');
  assert.deepEqual(result.defs, defs);
});

test('packs may not touch core or other packs', () => {
  assert.ok(validateDefs([{ id: 'core.apple' }], 'core').length > 0);
  assert.ok(validateDefs([{ id: 'core.apple' }], 'ayse').length > 0);
  assert.ok(validateDefs([{ id: 'ali.x' }], 'ayse').length > 0);
  assert.ok(validateDefs([{ id: 'ayse.x' }, { id: 'ayse.x' }], 'ayse').length > 0);
  assert.deepEqual(validateDefs([{ id: 'ayse.x' }], 'ayse'), []);
});

test('user definitions never shadow core ones', () => {
  const store = new DefStore();
  store.add({ id: 'core.apple', size: [1, 1] });
  const added = addUserDefs(store, [{ id: 'core.apple', size: [999, 999] }, { id: 'my.thing' }]);
  assert.deepEqual(added, ['my.thing']);
  assert.deepEqual(store.get('core.apple').size, [1, 1]);
});

test('slugify handles Turkish letters', () => {
  assert.equal(slugify('Çiçekli Şemsiye Ağacı'), 'cicekli-semsiye-agaci');
  assert.equal(slugify('  '), 'item');
});
