import { lookup } from './registry.js';

const GRAVITY = 3200; // scene units / s²
const SNAP = 30;      // an item dropped this far below a surface still lands on it
export const MIN_TOUCH = 90;

// A scene is one place (a room, a street). It owns its entities and the simple
// physics that makes dropped things fall onto the floor or onto surfaces.
export class Scene {
  constructor(defs, data, services = {}) {
    this.defs = defs;
    this.services = services;
    this.id = data.id;
    this.width = data.width ?? 2000;
    this.height = data.height ?? 1000;
    this.floorY = data.floorY ?? 760;
    // Indoor scenes have a wall and floor; `background` is the pre-layers name.
    this.interior = data.interior ?? data.background ?? null;
    this.backdrop = data.backdrop ?? null;
    this.mode = 'play'; // 'play' | 'edit' — UI state, not saved
    this.camera = { x: data.camera?.x ?? 0 };
    this.nextId = data.nextId ?? 1;
    this.orderCounter = 0;
    this.entities = new Map();
    this.listeners = new Set();
  }

  // Builds a fresh scene from a template (content/…/scenes/*.json).
  static fromTemplate(defs, template, services) {
    const scene = new Scene(defs, template, services);
    scene.#place(template.entities ?? [], null);
    scene.#settleAll();
    return scene;
  }

  // Restores a scene saved with serialize().
  static deserialize(defs, data, services) {
    const scene = new Scene(defs, data, services);
    for (const entity of data.entities ?? []) {
      try {
        scene.spawn(entity.def, entity);
      } catch (err) {
        // e.g. an object made in ZzStudio that was deleted since
        console.warn(`Skipping ${entity.def}:`, err.message);
      }
    }
    for (const e of scene.entities.values()) {
      if (e.parentId && !scene.get(e.parentId)) e.parentId = null;
      if (e.restingOn && !scene.get(e.restingOn)) e.restingOn = null;
    }
    // Re-apply container layouts so saves follow layout rule changes.
    for (const entity of scene.entities.values()) {
      for (const b of entity.behaviors) b.layout?.();
    }
    return scene;
  }

  #place(list, parent) {
    for (const { contains, ...props } of list) {
      const entity = this.spawn(props.def, props);
      if (parent && !parent.receive(entity, { force: true })) {
        console.warn(`${entity.def.id} does not fit into ${parent.def.id}`);
      }
      if (contains) this.#place(contains, entity);
    }
  }

  // Template positions are approximate: let everything drop onto its support.
  #settleAll() {
    const topLevel = this.topLevel().filter((e) => e.prop('gravity'));
    for (const e of topLevel.sort((a, b) => a.layer - b.layer)) {
      const support = this.findSupport(e);
      this.moveTo(e, e.x, support.y);
      e.restingOn = support.id;
    }
  }

  spawn(defId, props = {}) {
    const def = this.defs.get(defId);
    if (def.abstract) throw new Error(`Cannot place abstract definition ${defId}`);
    const EntityClass = lookup('entity', def.class ?? 'Item');
    const id = props.id ?? `e${this.nextId++}`;
    const order = props.order ?? this.orderCounter + 1;
    this.orderCounter = Math.max(this.orderCounter, order);
    const entity = new EntityClass(this, def, { ...props, id, order });
    this.entities.set(id, entity);
    return entity;
  }

  get(id) {
    return this.entities.get(id) ?? null;
  }

  // Removes an entity. Its contents and whatever rests on it stay in the scene
  // and fall down instead of disappearing with it.
  remove(entity) {
    entity.parent?.release(entity);
    for (const d of this.dependantsOf(entity)) {
      if (d.parentId === entity.id) entity.release(d);
      d.restingOn = null;
      this.drop(d);
    }
    this.entities.delete(entity.id);
    this.changed();
  }

  childrenOf(entity) {
    return [...this.entities.values()].filter((e) => e.parentId === entity.id);
  }

  // Everything that moves along with `entity`: its contents and what rests on it.
  dependantsOf(entity) {
    return [...this.entities.values()].filter((e) => e.parentId === entity.id || e.restingOn === entity.id);
  }

  topLevel() {
    return [...this.entities.values()].filter((e) => !e.parentId);
  }

  // Back-to-front drawing passes. Contents are drawn right after their container,
  // followed by the container's front art (e.g. the front of a basket).
  drawPasses() {
    const byLayerThenOrder = (a, b) => a.layer - b.layer || a.order - b.order;
    const passes = [];
    const visit = (e) => {
      passes.push({ entity: e, front: false });
      for (const child of this.childrenOf(e).sort((a, b) => a.order - b.order)) {
        if (child.visible) visit(child);
      }
      if (e.def.artFront) passes.push({ entity: e, front: true });
    };
    for (const e of this.topLevel().sort(byLayerThenOrder)) visit(e);
    return passes;
  }

  renderList() {
    return this.drawPasses().filter((p) => !p.front).map((p) => p.entity);
  }

  hitTest(x, y) {
    const list = this.renderList();
    for (let i = list.length - 1; i >= 0; i--) {
      if (list[i].containsPoint(x, y, MIN_TOUCH)) return list[i];
    }
    return null;
  }

  bringToFront(entity) {
    entity.order = ++this.orderCounter;
  }

  moveBy(entity, dx, dy) {
    if (!dx && !dy) return;
    entity.x += dx;
    entity.y += dy;
    for (const d of this.dependantsOf(entity)) this.moveBy(d, dx, dy);
  }

  moveTo(entity, x, y) {
    this.moveBy(entity, x - entity.x, y - entity.y);
  }

  // Is `entity` (transitively) inside or resting on `other`?
  #dependsOn(entity, other) {
    for (let e = entity; e; e = this.get(e.parentId ?? e.restingOn)) {
      if (e === other) return true;
    }
    return false;
  }

  // Where would `entity` land if released now? The floor is a band: anything
  // released on it keeps its depth. Above it, the highest surface below wins.
  findSupport(entity) {
    let best = { y: Math.min(Math.max(entity.y, this.floorY), this.height - 10), id: null };
    for (const other of this.entities.values()) {
      if (other === entity || other.parentId || !other.def.surfaces) continue;
      if (!entity.canRestOn(other) || this.#dependsOn(other, entity)) continue;
      for (const s of other.def.surfaces) {
        const left = other.x - other.width / 2 + s.x;
        const top = other.y - other.height + s.y;
        if (entity.x < left || entity.x > left + s.w) continue;
        if (top < entity.y - SNAP || top >= best.y) continue;
        best = { y: top, id: other.id };
      }
    }
    return best;
  }

  // The topmost entity under the dragged item's centre that would take it in.
  dropTargetFor(entity) {
    const cx = entity.x;
    const cy = entity.y - entity.height / 2;
    const list = this.renderList();
    for (let i = list.length - 1; i >= 0; i--) {
      const other = list[i];
      if (other === entity || this.#dependsOn(other, entity)) continue;
      if (other.containsPoint(cx, cy) && other.accepts(entity)) return other;
    }
    return null;
  }

  pickUp(entity) {
    entity.parent?.release(entity);
    entity.restingOn = null;
    entity.fall = null;
    entity.vy = 0;
    this.bringToFront(entity);
    entity.emit('pickUp');
  }

  putInto(target, entity) {
    target.receive(entity);
    entity.emit('dropInto', { target });
    target.emit('received', { item: entity });
    this.changed();
  }

  drop(entity) {
    const halfW = entity.width / 2;
    this.moveTo(entity, Math.min(Math.max(entity.x, halfW), this.width - halfW), entity.y);
    entity.emit('drop');
    if (!entity.prop('gravity')) {
      this.changed();
      return;
    }
    const support = this.findSupport(entity);
    entity.fall = { targetY: support.y, supportId: support.id };
    entity.vy = 0;
    if (support.y <= entity.y) this.#land(entity);
  }

  #land(entity) {
    this.moveTo(entity, entity.x, entity.fall.targetY);
    entity.restingOn = entity.fall.supportId;
    entity.fall = null;
    entity.vy = 0;
    entity.emit('land');
    this.changed();
  }

  tick(dt) {
    for (const e of this.entities.values()) {
      if (e.fall) {
        e.vy += GRAVITY * dt;
        this.moveBy(e, 0, Math.min(e.vy * dt, e.fall.targetY - e.y));
        if (e.y >= e.fall.targetY - 0.01) this.#land(e);
      }
      e.tick(dt);
    }
    this.services.animator?.update(dt);
  }

  onChange(fn) {
    this.listeners.add(fn);
    return () => this.listeners.delete(fn);
  }

  changed() {
    for (const fn of this.listeners) fn(this);
  }

  serialize() {
    return {
      id: this.id,
      width: this.width,
      height: this.height,
      floorY: this.floorY,
      interior: this.interior,
      backdrop: this.backdrop,
      camera: { x: Math.round(this.camera.x) },
      nextId: this.nextId,
      entities: [...this.entities.values()].map((e) => e.serialize()),
    };
  }
}
