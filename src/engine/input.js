// Pointer input: tap, drag-and-drop and camera panning. Every finger is tracked
// separately, so several things can be dragged at once.

const TAP_MS = 350;
const DRAG_PX = 10;
const EDGE_PX = 70;
const EDGE_SPEED = 900; // scene units / s while dragging near a screen edge

export class Input {
  // isOverBin(clientX, clientY): optional; dropping there removes the entity.
  // onTap(entity): optional; return true to handle a tap instead of the entity.
  constructor(canvas, renderer, { onFirstGesture, isOverBin, onTap } = {}) {
    this.canvas = canvas;
    this.renderer = renderer;
    this.onFirstGesture = onFirstGesture;
    this.isOverBin = isOverBin;
    this.onTap = onTap;
    this.pointers = new Map();

    canvas.addEventListener('pointerdown', (ev) => this.#down(ev));
    canvas.addEventListener('pointermove', (ev) => this.#move(ev));
    canvas.addEventListener('pointerup', (ev) => this.#up(ev, false));
    canvas.addEventListener('pointercancel', (ev) => this.#up(ev, true));
    canvas.addEventListener('contextmenu', (ev) => ev.preventDefault());
  }

  get scene() {
    return this.renderer.scene;
  }

  #down(ev) {
    this.onFirstGesture?.();
    this.canvas.setPointerCapture(ev.pointerId);
    const p = this.renderer.toScene(ev.clientX, ev.clientY);
    let hit = this.scene.hitTest(p.x, p.y);
    if (hit && [...this.pointers.values()].some((ptr) => ptr.entity === hit)) hit = null; // held by another finger

    const base = { startX: ev.clientX, startY: ev.clientY, clientX: ev.clientX, clientY: ev.clientY, time: performance.now() };
    this.pointers.set(ev.pointerId, hit
      ? { ...base, mode: 'press', entity: hit, grabX: hit.x - p.x, grabY: hit.y - p.y }
      : { ...base, mode: 'pan', lastX: ev.clientX });
  }

  // Continues a drag that started elsewhere (e.g. pulling a new thing out of the
  // catalog): the entity follows this pointer from now on.
  adopt(ev, entity) {
    this.canvas.setPointerCapture(ev.pointerId);
    const p = this.renderer.toScene(ev.clientX, ev.clientY);
    this.pointers.set(ev.pointerId, {
      mode: 'drag',
      entity,
      startX: ev.clientX,
      startY: ev.clientY,
      clientX: ev.clientX,
      clientY: ev.clientY,
      time: performance.now(),
      grabX: 0,
      grabY: entity.height / 2,
    });
    this.scene.moveTo(entity, p.x, p.y + entity.height / 2);
    this.scene.pickUp(entity);
  }

  #move(ev) {
    const ptr = this.pointers.get(ev.pointerId);
    if (!ptr) return;
    ptr.clientX = ev.clientX;
    ptr.clientY = ev.clientY;

    if (ptr.mode === 'press' && Math.hypot(ev.clientX - ptr.startX, ev.clientY - ptr.startY) > DRAG_PX) {
      if (ptr.entity.canDrag(this.scene.mode)) {
        ptr.origin = { x: ptr.entity.x, y: ptr.entity.y };
        this.scene.pickUp(ptr.entity);
        ptr.mode = 'drag';
      } else {
        // Things that can't move right now let the finger scroll the room instead.
        ptr.mode = 'pan';
        ptr.lastX = ptr.startX;
      }
    }

    if (ptr.mode === 'drag') {
      this.#dragTo(ptr);
    } else if (ptr.mode === 'pan') {
      this.scene.camera.x -= (ev.clientX - ptr.lastX) / this.renderer.scale;
      this.renderer.clampCamera();
      ptr.lastX = ev.clientX;
    }
  }

  #up(ev, cancelled) {
    const ptr = this.pointers.get(ev.pointerId);
    if (!ptr) return;
    this.pointers.delete(ev.pointerId);

    if (ptr.mode === 'press' && !cancelled && performance.now() - ptr.time < TAP_MS) {
      // where on the entity it was tapped (local box), e.g. which xylophone key
      const e = ptr.entity;
      const p = this.renderer.toScene(ev.clientX, ev.clientY);
      if (!this.onTap?.(e)) e.emit('tap', { local: { x: p.x - (e.x - e.width / 2), y: p.y - (e.y - e.height) } });
    } else if (ptr.mode === 'drag') {
      const e = ptr.entity;
      const target = this.scene.dropTargetFor(e);
      if (this.isOverBin?.(ev.clientX, ev.clientY)) {
        if (e.canDelete()) {
          this.scene.remove(e);
        } else {
          // Not allowed in the bin (windows, doors): go back and shake "no".
          if (ptr.origin) this.scene.moveTo(e, ptr.origin.x, ptr.origin.y);
          this.scene.drop(e);
          this.scene.services.animator?.play(e, 'shake');
        }
      } else if (target) {
        this.scene.putInto(target, e);
      } else {
        this.scene.drop(e);
      }
    } else if (ptr.mode === 'pan') {
      this.scene.changed();
    }
    this.#updateHighlights();
  }

  #dragTo(ptr) {
    const { scene } = this;
    const e = ptr.entity;
    const p = this.renderer.toScene(ptr.clientX, ptr.clientY);
    const { x, y } = e.constrainDrag(p.x + ptr.grabX, p.y + ptr.grabY);
    scene.moveTo(e, x, y);
    this.#updateHighlights();
  }

  #updateHighlights() {
    const highlights = this.renderer.highlights;
    highlights.clear();
    for (const ptr of this.pointers.values()) {
      if (ptr.mode !== 'drag') continue;
      const target = this.scene.dropTargetFor(ptr.entity);
      if (target) highlights.add(target);
    }
  }

  // Scrolls the camera while something is dragged near the left/right edge.
  update(dt) {
    const rect = this.canvas.getBoundingClientRect();
    for (const ptr of this.pointers.values()) {
      if (ptr.mode !== 'drag') continue;
      const x = ptr.clientX - rect.left;
      const dir = x < EDGE_PX ? -1 : x > rect.width - EDGE_PX ? 1 : 0;
      if (!dir) continue;
      this.scene.camera.x += dir * EDGE_SPEED * dt;
      this.renderer.clampCamera();
      this.#dragTo(ptr);
    }
  }
}
