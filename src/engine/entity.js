import { lookup } from './registry.js';
import { runActions } from './actions.js';

// Everything in a scene is an Entity. Subclasses only change defaults and
// override the few rules that differ; the rest comes from the definition.
// Position (x, y) is the bottom-centre of the entity, in scene units.
export class Entity {
  static type = 'Entity';
  static defaults = { size: [100, 100], draggable: false, gravity: true, layer: 1 };

  constructor(scene, def, data = {}) {
    this.scene = scene;
    this.def = def;
    this.id = data.id;
    this.x = data.x ?? 0;
    this.y = data.y ?? 0;
    this.state = data.state ?? def.initialState ?? 'default';
    this.colors = { ...data.colors };
    this.parentId = data.parent ?? null;
    this.restingOn = data.restingOn ?? null;
    this.order = data.order ?? 0;
    this.fx = null; // transient animation offsets, set by the Animator
    this.fall = null;
    this.vy = 0;
    this.behaviors = (def.behaviors ?? []).map((config, i) => {
      const BehaviorClass = lookup('behavior', config.type);
      return new BehaviorClass(this, config, data.behaviors?.[i]);
    });
  }

  prop(name) {
    return this.def[name] ?? this.constructor.defaults[name];
  }

  get width() {
    return this.prop('size')[0];
  }

  get height() {
    return this.prop('size')[1];
  }

  get draggable() {
    return this.prop('draggable');
  }

  get layer() {
    return this.prop('layer');
  }

  get parent() {
    return this.parentId ? this.scene.get(this.parentId) : null;
  }

  get visible() {
    const parent = this.parent;
    return !parent || (parent.visible && parent.behaviors.some((b) => b.showsContents()));
  }

  color(slot) {
    return this.colors[slot] ?? this.def.colorSlots?.[slot] ?? '#999999';
  }

  // Small things get a larger touch area so little fingers can grab them.
  containsPoint(x, y, minSize = 0) {
    const padX = Math.max(0, (minSize - this.width) / 2);
    const padY = Math.max(0, (minSize - this.height) / 2);
    return x >= this.x - this.width / 2 - padX && x <= this.x + this.width / 2 + padX
      && y >= this.y - this.height - padY && y <= this.y + padY;
  }

  isAncestorOf(other) {
    for (let p = other.parent; p; p = p.parent) {
      if (p === this) return true;
    }
    return false;
  }

  // Which surfaces may this entity land on? Items can sit on any surface.
  canRestOn(other) {
    return true;
  }

  setState(next) {
    if (next === this.state) return;
    const prev = this.state;
    this.state = next;
    this.emit(`stateExit:${prev}`);
    this.emit(`stateEnter:${next}`);
    this.scene.changed();
  }

  emit(event, data = {}) {
    for (const b of this.behaviors) b.handle(event, data);
    const reactions = this.def.reactions?.[event];
    if (reactions?.length) runActions(reactions, { entity: this, scene: this.scene, event, data });
  }

  accepts(item, options) {
    return this.behaviors.some((b) => b.accepts(item, options));
  }

  receive(item, options) {
    const b = this.behaviors.find((b) => b.accepts(item, options));
    if (!b) return false;
    b.receive(item);
    return true;
  }

  release(item) {
    for (const b of this.behaviors) b.release(item);
  }

  tick(dt) {
    for (const b of this.behaviors) b.tick(dt);
  }

  serialize() {
    const round = (v) => Math.round(v * 10) / 10;
    const out = { id: this.id, def: this.def.id, x: round(this.x), y: round(this.y), state: this.state, order: this.order };
    if (Object.keys(this.colors).length) out.colors = { ...this.colors };
    if (this.parentId) out.parent = this.parentId;
    if (this.restingOn) out.restingOn = this.restingOn;
    const behaviors = this.behaviors.map((b) => b.serialize());
    if (behaviors.some((b) => b !== undefined)) out.behaviors = behaviors;
    return out;
  }
}

// Small things you carry around: food, toys.
export class Item extends Entity {
  static type = 'Item';
  static defaults = { ...Entity.defaults, draggable: true, layer: 2 };
}

// Bigger things that stand on the floor: tables, beds, fridges.
export class Furniture extends Entity {
  static type = 'Furniture';
  static defaults = { ...Entity.defaults, draggable: true, layer: 1 };

  // Furniture stands on the floor, never on another piece of furniture.
  canRestOn(other) {
    return false;
  }
}

// Wall things: windows, pictures, shelves. They stay where they are put.
export class Decor extends Entity {
  static type = 'Decor';
  static defaults = { ...Entity.defaults, draggable: true, gravity: false, layer: 0 };
}
