import { Behavior } from './behavior.js';
import { degreeToMidi } from '../audio/theory.js';
import { partGroups } from './compose.js';
import { envelope, warpShape, fitMap, drapeMap } from './warp.js';

// A piece of clothing (or glasses…) lying in the world: { "part": "core.part.top.tshirt" }.
// Its colour slot "main" becomes the garment's colour when worn.
export class Wearable extends Behavior {
  static type = 'Wearable';

  get partId() {
    return this.config.part;
  }
}

// Something you can play: tapping one of its keys plays a note. Notes come
// from a scale, so whatever a child plays sounds fine.
//   { "type": "Instrument", "instrument": "xylophone", "scale": "pentatonic",
//     "root": 72, "keys": [{ "x": 10, "w": 20, "degree": 0 }, …] }
export class Instrument extends Behavior {
  static type = 'Instrument';

  handle(event, data) {
    if (event !== 'tap' || !data?.local) return;
    const key = (this.config.keys ?? []).find((k) => data.local.x >= k.x && data.local.x <= k.x + k.w);
    if (!key) return;
    const { audio } = this.entity.scene.services;
    audio?.note(this.config.instrument ?? 'xylophone', degreeToMidi(key.degree, this.config.scale, this.config.root ?? 72), {
      volume: this.config.volume ?? 0.9,
      length: 0.4,
      out: audio.channels?.sfx,
    });
    this.entity.emit('note', { key });
  }
}

// Cycles through states when an event (default: tap) happens.
export class Toggle extends Behavior {
  static type = 'Toggle';

  constructor(entity, config, saved) {
    super(entity, config, saved);
    if (!this.states.includes(entity.state)) entity.state = this.states[0];
  }

  get states() {
    return this.config.states ?? ['off', 'on'];
  }

  handle(event) {
    if (event !== (this.config.on ?? 'tap')) return;
    const i = this.states.indexOf(this.entity.state);
    this.entity.setState(this.states[(i + 1) % this.states.length]);
  }
}

// Holds other entities (fridge shelves, basket, toy box). Contents are laid out
// in a grid inside `area` ([x, y, w, h] in the entity's local box).
export class Container extends Behavior {
  static type = 'Container';

  get open() {
    const visibleIn = this.config.visibleIn;
    return !visibleIn || [].concat(visibleIn).includes(this.entity.state);
  }

  get slots() {
    return this.config.slots ?? 4;
  }

  get area() {
    return this.config.area ?? [0, 0, this.entity.width, this.entity.height];
  }

  // covers (Wrap) are children too, but not contents
  contents() {
    return this.entity.scene.childrenOf(this.entity).filter((c) => !c.wrapping);
  }

  showsContents() {
    return this.open;
  }

  accepts(item, { force = false } = {}) {
    if (item === this.entity || item.mobility !== 'free' || item.isAncestorOf(this.entity)) return false;
    if (!force && !this.open) return false;
    const [, , w, h] = this.area;
    return item.width <= w && item.height <= h && this.contents().length < this.slots;
  }

  receive(item) {
    item.parentId = this.entity.id;
    item.restingOn = null;
    item.fall = null;
    this.layout();
  }

  release(item) {
    if (item.parentId !== this.entity.id) return;
    item.parentId = null;
    this.layout();
  }

  layout() {
    const e = this.entity;
    const [ax, ay, aw, ah] = this.area;
    const rows = this.config.rows ?? 1;
    const cols = Math.ceil(this.slots / rows);
    const cellW = aw / cols;
    const cellH = ah / rows;
    const left = e.x - e.width / 2 + ax;
    const top = e.y - e.height + ay;
    const clamp = (v, min, max) => Math.min(Math.max(v, min), max);
    this.contents()
      .sort((a, b) => a.order - b.order)
      .forEach((item, i) => {
        const col = i % cols;
        const row = Math.floor(i / cols);
        // Items wider than their cell may overlap their neighbours, but never
        // stick out of the container's area.
        const x = clamp(left + cellW * (col + 0.5), left + item.width / 2, left + aw - item.width / 2);
        const y = clamp(top + cellH * (row + 1), top + item.height, top + ah);
        e.scene.moveTo(item, x, y);
      });
  }
}

// A chair, bed or bathtub: characters dropped on it sit (or lie) there.
//   { "type": "Seat", "area": [x, y, w, h], "pose": "sit" | "sleep", "expression": "happy" }
// y + h is the seat surface (or the mattress).
export class Seat extends Container {
  static type = 'Seat';

  accepts(item) {
    if (!item.isCharacter || item.isAncestorOf(this.entity)) return false;
    return this.contents().length < this.slots;
  }

  receive(item) {
    super.receive(item);
    item.setState(this.config.expression ?? 'happy');
  }

  layout() {
    const e = this.entity;
    const [ax, ay, aw, ah] = this.area;
    const left = e.x - e.width / 2 + ax;
    const surface = e.y - e.height + ay + ah;
    const people = this.contents().sort((a, b) => a.order - b.order);
    people.forEach((c, i) => {
      const x = left + (aw * (i + 0.5)) / people.length;
      if (this.config.pose === 'sleep') {
        // lying on the side: the sleep pose turns the character around its centre,
        // so its width becomes its height; it sinks a little into the bed so the
        // blanket (the bed's front art) covers it
        e.scene.moveTo(c, x, surface + c.height / 2 - c.width / 2 + c.width * 0.4);
      } else {
        // hips on the seat surface; the sit pose folds the legs
        e.scene.moveTo(c, x, surface + c.legHeight);
      }
    });
  }
}

// Makes a Portal usable: tapping the open door goes through it, and things
// dropped on the open door travel to the other side. The game provides
// services.travel(entity | null, portal).
export class Doorway extends Behavior {
  static type = 'Doorway';

  get open() {
    return this.entity.state === (this.config.openState ?? 'open');
  }

  handle(event, data) {
    if (event !== 'tap' || !this.open || !this.entity.target) return;
    data.handled = true; // don't close the door, go through it
    this.entity.scene.services.travel?.(null, this.entity);
  }

  accepts(item) {
    return this.open && !!this.entity.target && item.mobility === 'free' && !!this.entity.scene.services.travel;
  }

  receive(item) {
    this.entity.scene.services.travel(item, this.entity);
  }
}

// A cover that bends to whatever it is dropped on: a tablecloth drapes over a
// table, a blanket over a box. The cover's own drawing is bent to the outline
// of the thing below; pulling it off makes it flat again.
//   { "type": "Wrap", "depth": 0.5, "drape": true }
//   depth: how far down it reaches (part of the covered thing's height)
//   drape: hang straight down from the widest point (cloth) instead of hugging
export class Wrap extends Behavior {
  static type = 'Wrap';

  constructor(entity, config, saved) {
    super(entity, config, saved);
    this.on = saved?.on ?? null;
    this.baseDef = entity.def;
    this.applied = null;
  }

  get target() {
    const p = this.entity.parent;
    return p && p.id === this.on ? p : null;
  }

  wrap(target) {
    const e = this.entity;
    e.parentId = target.id;
    e.restingOn = null;
    e.fall = null;
    this.on = target.id;
    this.apply();
  }

  unwrap() {
    this.on = null;
    this.applied = null;
    this.entity.def = this.baseDef;
  }

  // Bends the cover's drawing to the target's current outline.
  apply() {
    const target = this.target;
    if (!target) return;
    const e = this.entity;
    const shapes = partGroups(target.def, target.state, 'art').flatMap((g) => g.shapes);
    const env = envelope(shapes);
    if (!Number.isFinite(env.top)) return;
    const [w, h] = this.baseDef.size ?? [100, 100];
    const box = { x: 0, y: env.top - 2, w: target.width, h: target.height * (this.config.depth ?? 0.5) };
    const fit = this.config.drape === false ? fitMap(box, env, { pad: 2 }) : drapeMap(box, env);
    const map = (x, y) => fit((x / w) * 100, (y / h) * 100);
    const bend = (list) => (list ? Object.fromEntries(Object.entries(list).map(([state, art]) => [state, art.map((s) => warpShape(s, map))])) : undefined);
    e.def = {
      ...this.baseDef,
      id: `${this.baseDef.id}@${target.def.id}:${target.state}`,
      size: [target.width, target.height],
      art: bend(this.baseDef.art),
      artFront: bend(this.baseDef.artFront),
    };
    e.scene.moveTo(e, target.x, target.y);
    this.applied = `${target.def.id}:${target.state}`;
  }

  layout() {
    if (this.on && this.target) this.apply();
    else if (this.on) this.unwrap();
  }

  tick() {
    // the covered thing changed (a box opened): follow its new shape
    const target = this.target;
    if (target && this.applied !== `${target.def.id}:${target.state}`) this.apply();
  }

  serialize() {
    return this.on ? { on: this.on } : undefined;
  }
}
