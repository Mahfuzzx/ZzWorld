// Object definitions: plain JSON, with `extends` for data-level inheritance.
// Plain objects are merged deeply; arrays and values are replaced by the child.

const isPlainObject = (v) => v !== null && typeof v === 'object' && !Array.isArray(v);

export function mergeDefs(base, over) {
  const out = { ...base };
  for (const [key, value] of Object.entries(over)) {
    out[key] = isPlainObject(value) && isPlainObject(base[key]) ? mergeDefs(base[key], value) : value;
  }
  return out;
}

export class DefStore {
  #raw = new Map();
  #resolved = new Map();

  add(def) {
    if (!def?.id) throw new Error('Definition without id');
    this.#raw.set(def.id, def);
    this.#resolved.clear();
  }

  has(id) {
    return this.#raw.has(id);
  }

  ids() {
    return [...this.#raw.keys()];
  }

  get(id) {
    return this.#resolve(id, []);
  }

  #resolve(id, chain) {
    const cached = this.#resolved.get(id);
    if (cached) return cached;
    if (chain.includes(id)) throw new Error(`Circular extends: ${[...chain, id].join(' → ')}`);
    const raw = this.#raw.get(id);
    if (!raw) throw new Error(`Unknown definition: ${id}`);

    const merged = raw.extends ? mergeDefs(this.#resolve(raw.extends, [...chain, id]), raw) : raw;
    // `extends` and `abstract` describe the raw entry only; they are not inherited.
    const { extends: _parent, ...resolved } = merged;
    resolved.abstract = raw.abstract === true;
    this.#resolved.set(id, resolved);
    return resolved;
  }
}

export async function fetchJson(url) {
  const response = await fetch(url);
  if (!response.ok) throw new Error(`${response.status} ${response.statusText}: ${url}`);
  return response.json();
}

// A pack folder holds manifest.json and defs/*.json; each def file may contain
// a single definition or an array of them.
export async function loadPack(store, baseUrl) {
  const manifest = await fetchJson(new URL('manifest.json', baseUrl));
  const files = await Promise.all(manifest.defs.map((file) => fetchJson(new URL(`defs/${file}`, baseUrl))));
  for (const file of files) {
    for (const def of [].concat(file)) store.add(def);
  }
  return manifest;
}
