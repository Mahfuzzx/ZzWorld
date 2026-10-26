// Name → class tables. Definitions (JSON) refer to classes by name, so content
// packs can only use what the engine has registered here — they never run code.

const tables = {
  entity: new Map(),
  behavior: new Map(),
  action: new Map(),
};

export function register(kind, cls) {
  const table = tables[kind];
  if (!table) throw new Error(`Unknown registry kind: ${kind}`);
  if (!Object.hasOwn(cls, 'type')) throw new Error(`${cls.name} has no static type`);
  table.set(cls.type, cls);
  return cls;
}

export function lookup(kind, type) {
  const cls = tables[kind]?.get(type);
  if (!cls) throw new Error(`Unknown ${kind} type: ${type}`);
  return cls;
}

export function types(kind) {
  return [...tables[kind].keys()];
}
