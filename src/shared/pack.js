// .zzpack content packs: a zip with manifest.json and defs/*.json.
// Packs are data only; validation makes sure a pack cannot overwrite core
// content or another pack's definitions.
import { createZip, readZip, textOf } from './zip.js';

export const PACK_ID_PATTERN = /^[a-z][a-z0-9-]{1,31}$/;
const MAX_PACK_BYTES = 10 * 1024 * 1024;

export function slugify(text) {
  const map = { ç: 'c', ğ: 'g', ı: 'i', ö: 'o', ş: 's', ü: 'u' };
  return String(text)
    .toLowerCase()
    .replace(/[çğıöşü]/g, (c) => map[c])
    .normalize('NFKD')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 40) || 'item';
}

// Returns a list of problems; empty means the definitions are acceptable.
export function validateDefs(defs, packId) {
  const errors = [];
  if (!PACK_ID_PATTERN.test(packId ?? '')) errors.push(`Invalid pack id: ${packId}`);
  if (packId === 'core') errors.push('The core pack cannot be replaced');
  const ids = new Set();
  for (const def of defs) {
    if (!def || typeof def !== 'object' || typeof def.id !== 'string') {
      errors.push('Definition without id');
      continue;
    }
    if (!def.id.startsWith(`${packId}.`)) errors.push(`${def.id} must start with "${packId}."`);
    if (ids.has(def.id)) errors.push(`Duplicate id ${def.id}`);
    ids.add(def.id);
    if (def.extends && typeof def.extends !== 'string') errors.push(`${def.id}: extends must be an id`);
  }
  return errors;
}

export function exportPack(manifest, defs) {
  const errors = validateDefs(defs, manifest.id);
  if (errors.length) throw new Error(errors.join('\n'));
  const files = [
    { name: 'manifest.json', data: JSON.stringify({ ...manifest, defs: ['objects.json'] }, null, 2) },
    { name: 'defs/objects.json', data: JSON.stringify(defs, null, 2) },
  ];
  return createZip(files);
}

export async function importPack(bytes) {
  if (bytes.length > MAX_PACK_BYTES) throw new Error('Pack is too large');
  const files = await readZip(bytes);
  const manifestFile = files.get('manifest.json');
  if (!manifestFile) throw new Error('manifest.json is missing');
  const manifest = JSON.parse(textOf(manifestFile));
  const defs = [];
  for (const name of manifest.defs ?? []) {
    const file = files.get(`defs/${name}`);
    if (!file) throw new Error(`defs/${name} is missing`);
    defs.push(...[].concat(JSON.parse(textOf(file))));
  }
  const errors = validateDefs(defs, manifest.id);
  if (errors.length) throw new Error(errors.join('\n'));
  return { manifest, defs };
}

// Adds user definitions (from IndexedDB) to a DefStore, skipping anything that
// would shadow core content. Returns the ids that were added.
export function addUserDefs(store, defs) {
  const added = [];
  for (const def of defs) {
    if (typeof def?.id !== 'string' || def.id.startsWith('core.')) continue;
    store.add(def);
    added.push(def.id);
  }
  return added;
}
