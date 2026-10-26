// The definition being edited in ZzStudio, with undo/redo.
// Every change goes through change(fn), which snapshots the previous version.

const MAX_UNDO = 60;

export const CLASS_BASES = {
  Item: 'core.item.base',
  Furniture: 'core.furniture.base',
  Decor: 'core.decor.base',
  Structure: 'core.decor.base',
};

const clone = (v) => JSON.parse(JSON.stringify(v));

export class ObjectDoc {
  constructor(def) {
    this.def = clone(def);
    this.def.art ??= { default: [] };
    this.state = Object.keys(this.def.art)[0];
    this.layer = 'art'; // 'art' or 'artFront'
    this.frame = null;  // { clip, index } while drawing flipbook frames
    this.undoStack = [];
    this.redoStack = [];
    this.listeners = new Set();
  }

  onChange(fn) {
    this.listeners.add(fn);
    return () => this.listeners.delete(fn);
  }

  #emit(kind) {
    for (const fn of this.listeners) fn(kind);
  }

  // kind: 'art' for drawing changes, 'props' for everything else.
  change(fn, kind = 'props') {
    this.undoStack.push(JSON.stringify(this.def));
    if (this.undoStack.length > MAX_UNDO) this.undoStack.shift();
    this.redoStack = [];
    fn(this.def);
    this.#emit(kind);
  }

  undo() {
    if (!this.undoStack.length) return;
    this.redoStack.push(JSON.stringify(this.def));
    this.def = JSON.parse(this.undoStack.pop());
    this.#fixState();
    this.#emit('all');
  }

  redo() {
    if (!this.redoStack.length) return;
    this.undoStack.push(JSON.stringify(this.def));
    this.def = JSON.parse(this.redoStack.pop());
    this.#fixState();
    this.#emit('all');
  }

  #fixState() {
    if (!this.def.art[this.state]) this.state = Object.keys(this.def.art)[0];
    const frames = this.frame && this.def.clips?.[this.frame.clip]?.frames;
    if (this.frame && !frames?.length) this.frame = null;
    else if (this.frame) this.frame.index = Math.min(this.frame.index, frames.length - 1);
  }

  get states() {
    return Object.keys(this.def.art);
  }

  setState(state) {
    this.state = state;
    this.#emit('view');
  }

  setLayer(layer) {
    this.layer = layer;
    this.frame = null;
    this.#emit('view');
  }

  // Draw on a flipbook frame instead of a state (null goes back to states).
  setFrame(frame) {
    this.frame = frame;
    this.#emit('view');
  }

  // The array being drawn on: a frame of a flipbook clip, or a state's art.
  #target(def, create = false) {
    if (this.frame) return def.clips?.[this.frame.clip]?.frames?.[this.frame.index] ?? [];
    if (!create) return def[this.layer]?.[this.state] ?? [];
    def[this.layer] ??= {};
    return (def[this.layer][this.state] ??= []);
  }

  get shapes() {
    return this.#target(this.def);
  }

  addShape(shape) {
    this.change((def) => this.#target(def, true).push(shape), 'art');
  }

  replaceShapes(shapes) {
    this.change((def) => {
      const list = this.#target(def, true);
      list.splice(0, list.length, ...shapes);
    }, 'art');
  }

  updateShape(index, fn) {
    this.change((def) => fn(this.#target(def)[index]), 'art');
  }

  addState(name) {
    this.change((def) => {
      def.art[name] = clone(def.art[this.state] ?? []);
      if (def.artFront?.[this.state]) def.artFront[name] = clone(def.artFront[this.state]);
      for (const b of def.behaviors ?? []) {
        if (b.type === 'Toggle') b.states = [...(b.states ?? []), name];
      }
    });
    this.setState(name);
  }

  renameState(from, to) {
    if (!to || to === from || this.def.art[to]) return;
    this.change((def) => {
      for (const field of ['art', 'artFront']) {
        if (!def[field]?.[from]) continue;
        // keep key order so tabs don't jump around
        def[field] = Object.fromEntries(Object.entries(def[field]).map(([k, v]) => [k === from ? to : k, v]));
      }
      for (const b of def.behaviors ?? []) {
        if (b.states) b.states = b.states.map((s) => (s === from ? to : s));
        if (b.visibleIn === from) b.visibleIn = to;
      }
      if (def.light?.when === from) def.light.when = to;
      if (def.initialState === from) def.initialState = to;
    });
    if (this.state === from) this.setState(to);
  }

  removeState(name) {
    if (this.states.length < 2) return;
    this.change((def) => {
      delete def.art[name];
      if (def.artFront) delete def.artFront[name];
      for (const b of def.behaviors ?? []) {
        if (b.states) b.states = b.states.filter((s) => s !== name);
      }
    });
    if (this.state === name) this.setState(this.states[0]);
  }

  behavior(type) {
    return this.def.behaviors?.find((b) => b.type === type) ?? null;
  }

  setBehavior(type, config) {
    this.change((def) => {
      const list = (def.behaviors ?? []).filter((b) => b.type !== type);
      if (config) list.push({ type, ...config });
      def.behaviors = list;
      if (!list.length) delete def.behaviors;
    });
  }
}

// Geometry helpers for editing shapes. Moving a shape sets tx/ty.
export function shapeBounds(s) {
  const tx = s.tx ?? 0;
  const ty = s.ty ?? 0;
  let b;
  switch (s.type) {
    case 'rect': b = [s.x, s.y, s.x + s.w, s.y + s.h]; break;
    case 'ellipse': b = [s.cx - s.rx, s.cy - s.ry, s.cx + s.rx, s.cy + s.ry]; break;
    case 'circle': b = [s.cx - s.r, s.cy - s.r, s.cx + s.r, s.cy + s.r]; break;
    case 'ink':
    case 'fill': {
      const xs = s.points.map((p) => p[0]);
      const ys = s.points.map((p) => p[1]);
      const pad = s.type === 'ink' ? (s.size ?? 6) / 2 : 0;
      b = [Math.min(...xs) - pad, Math.min(...ys) - pad, Math.max(...xs) + pad, Math.max(...ys) + pad];
      break;
    }
    default: return null; // paths: unknown without parsing
  }
  return { left: b[0] + tx, top: b[1] + ty, right: b[2] + tx, bottom: b[3] + ty };
}
