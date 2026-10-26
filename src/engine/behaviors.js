import { Behavior } from './behavior.js';

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

  contents() {
    return this.entity.scene.childrenOf(this.entity);
  }

  showsContents() {
    return this.open;
  }

  accepts(item, { force = false } = {}) {
    if (item === this.entity || item.isAncestorOf(this.entity)) return false;
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
    this.contents()
      .sort((a, b) => a.order - b.order)
      .forEach((item, i) => {
        const col = i % cols;
        const row = Math.floor(i / cols);
        e.scene.moveTo(item, left + cellW * (col + 0.5), top + cellH * (row + 1));
      });
  }
}
