import { lookup } from './registry.js';
import { runActions } from './actions.js';

const clamp = (v, min, max) => Math.min(Math.max(v, min), max);

// Everything in a scene is an Entity. Subclasses only change defaults and
// override the few rules that differ; the rest comes from the definition.
// Position (x, y) is the bottom-centre of the entity, in scene units.
export class Entity {
  static type = 'Entity';
  // mobility: "free" (always movable), "edit" (only in edit mode), "locked" (never)
  static defaults = { size: [100, 100], mobility: 'locked', gravity: true, layer: 1 };

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
    // Transient animation output, written by the Animator every frame.
    this.fx = null;      // whole entity
    this.partFx = null;  // { [part]: offsets }
    this.frames = null;  // { [part]: flipbook frame }
    this.idleClip = null;
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

  get mobility() {
    return this.prop('mobility');
  }

  canDrag(mode) {
    return this.mobility === 'free' || (this.mobility === 'edit' && mode === 'edit');
  }

  // Where may this entity be dragged to? Returns the allowed position.
  constrainDrag(x, y) {
    const { width, height } = this.scene;
    return { x: clamp(x, 0, width), y: clamp(y, this.height / 2, height) };
  }

  get layer() {
    return this.prop('layer');
  }

  get parent() {
    return this.parentId ? this.scene.get(this.parentId) : null;
  }

  get visible() {
    const parent = this.parent;
    if (!parent) return true;
    // a cover lies over its target, so it shows even on a closed box
    if (this.wrapping) return parent.visible;
    return parent.visible && parent.behaviors.some((b) => b.showsContents());
  }

  // Is this a cover (Wrap) lying over its parent right now?
  get wrapping() {
    return !!this.#wrapBehavior()?.target;
  }

  #wrapBehavior() {
    return this.behaviors.find((b) => b.constructor.type === 'Wrap') ?? null;
  }

  // Can a cover be put over this? Characters and wall things say no.
  canBeWrapped() {
    return !this.isCharacter && !!this.def.art;
  }

  // The Wrap behaviour of `item` if it could cover this entity now.
  #coverFor(item) {
    if (item === this || item.isAncestorOf(this) || !this.canBeWrapped()) return null;
    const wrap = item.#wrapBehavior();
    if (!wrap) return null;
    if (this.scene.childrenOf(this).some((c) => c.wrapping)) return null; // already covered
    return wrap;
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

  get isCharacter() {
    return false;
  }

  // The clip that should loop right now (def.idle: a clip, or { state: clip }).
  wantedIdle() {
    const idle = this.def.idle;
    return typeof idle === 'string' ? idle : idle?.[this.state] ?? null;
  }

  // May the child throw this into the bin (edit mode)?
  canDelete() {
    return this.mobility !== 'locked';
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

  // A behaviour may set data.handled to take over an event completely
  // (e.g. tapping an open door goes through it instead of closing it).
  emit(event, data = {}) {
    for (const b of this.behaviors) {
      b.handle(event, data);
      if (data.handled) return;
    }
    const reactions = this.def.reactions?.[event];
    if (reactions?.length) runActions(reactions, { entity: this, scene: this.scene, event, data });
  }

  accepts(item, options) {
    return !!this.#coverFor(item) || this.behaviors.some((b) => b.accepts(item, options));
  }

  receive(item, options) {
    const cover = this.#coverFor(item);
    if (cover) {
      cover.wrap(this);
      return true;
    }
    const b = this.behaviors.find((b) => b.accepts(item, options));
    if (!b) return false;
    b.receive(item);
    return true;
  }

  release(item) {
    const cover = item.#wrapBehavior();
    if (cover?.target === this) {
      cover.unwrap();
      item.parentId = null;
      return;
    }
    for (const b of this.behaviors) b.release(item);
  }

  tick(dt) {
    for (const b of this.behaviors) b.tick(dt);
  }

  serialize() {
    const round = (v) => Math.round(v * 10) / 10;
    // a cover's bent drawing is made again on load: save its own definition
    const defId = this.#wrapBehavior()?.baseDef.id ?? this.def.id;
    const out = { id: this.id, def: defId, x: round(this.x), y: round(this.y), state: this.state, order: this.order };
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
  static defaults = { ...Entity.defaults, mobility: 'free', layer: 2 };
}

// Bigger things that stand on the floor: tables, beds, fridges.
export class Furniture extends Entity {
  static type = 'Furniture';
  static defaults = { ...Entity.defaults, mobility: 'edit', layer: 1 };

  // Furniture stands on the floor, never on another piece of furniture.
  canRestOn(other) {
    return false;
  }
}

// Wall things: pictures, clocks, shelves. No gravity; they stay on the wall.
export class Decor extends Entity {
  static type = 'Decor';
  static defaults = { ...Entity.defaults, mobility: 'edit', gravity: false, layer: 0 };

  canBeWrapped() {
    return false;
  }

  constrainDrag(x, y) {
    const margin = 10;
    const halfW = this.width / 2;
    return {
      x: clamp(x, halfW, this.scene.width - halfW),
      // "slide": "x" keeps the entity at its height (doors slide along the wall)
      y: this.def.slide === 'x' ? this.y : clamp(y, this.height + margin, this.scene.floorY - margin),
    };
  }
}

// Windows and doors. They cut an opening (def.opening) into the wall, and are
// part of the building: they can be moved in edit mode but never removed.
export class Structure extends Decor {
  static type = 'Structure';

  canDelete() {
    return false;
  }
}

// A door (or stairs) to another scene. Each door has a key, unique in its
// scene, and points to a door in the target scene:
//   { "def": "core.door", "door": "toBedroom", "target": { "scene": "core.scene.bedroom", "door": "toLiving" } }
export class Portal extends Structure {
  static type = 'Portal';

  constructor(scene, def, data = {}) {
    super(scene, def, data);
    this.door = data.door ?? null;
    this.target = data.target ?? null;
  }

  // Doors stand on the floor line and slide along the wall.
  constrainDrag(x) {
    const halfW = this.width / 2;
    return { x: clamp(x, halfW, this.scene.width - halfW), y: this.y };
  }

  serialize() {
    return { ...super.serialize(), door: this.door, target: this.target };
  }
}
