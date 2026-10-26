// Edit-mode catalog: a drawer of everything that can be placed (the child's own
// ZzStudio objects first, then core ones) and a bin to throw things away.
import { t, pick } from '../shared/i18n.js';
import { lookup } from '../engine/index.js';
import { drawThumbnail } from '../shared/thumb.js';

const DRAG_OUT_PX = 14;

const ICONS = {
  add: '<svg viewBox="0 0 48 48"><path d="M24 10 V38 M10 24 H38" stroke-width="6"/></svg>',
  bin: '<svg viewBox="0 0 48 48"><path d="M12 16 H36 L33 42 H15 Z" fill="#9aa7ae"/><path d="M9 14 H39 M19 10 H29 M20 22 V36 M28 22 V36"/></svg>',
};

// Definitions that can actually be put into a scene.
export function placeableIds(defs, firstIds = []) {
  const ordered = [...firstIds, ...defs.ids().filter((id) => !firstIds.includes(id))];
  return ordered.filter((id) => {
    try {
      const def = defs.get(id);
      if (def.abstract || def.kind === 'backdrop') return false;
      lookup('entity', def.class ?? 'Item');
      return true;
    } catch {
      return false;
    }
  });
}

function hudButton(className, icon, label) {
  const el = document.createElement('button');
  el.type = 'button';
  el.className = `hud-btn ${className}`;
  el.innerHTML = icon;
  el.setAttribute('aria-label', label);
  el.title = label;
  return el;
}

export function createCatalog(root, { defs, userIds, scene, renderer, input, hud, onGesture }) {
  const drawer = document.createElement('div');
  drawer.className = 'catalog';
  drawer.hidden = true;

  const spawn = (id) => scene.spawn(id, { x: 0, y: 0 });

  // First tile: open ZzStudio to draw something new.
  const studio = document.createElement('a');
  studio.className = 'catalog-tile catalog-studio';
  studio.href = 'studio/';
  studio.title = 'ZzStudio';
  studio.innerHTML = '<svg viewBox="0 0 48 48"><path d="M10 38 L14 28 L32 10 L38 16 L20 34 Z" fill="#ffd166"/><path d="M10 38 L14 28 L20 34 Z" fill="#3b2f2a"/><path d="M30 38 H40 M35 33 V43"/></svg>';
  drawer.append(studio);

  for (const id of placeableIds(defs, userIds)) {
    const def = defs.get(id);
    const tile = document.createElement('button');
    tile.type = 'button';
    tile.className = 'catalog-tile';
    tile.title = pick(def.name) || id;
    tile.append(drawThumbnail(document.createElement('canvas'), def, 84));

    let press = null;
    tile.addEventListener('pointerdown', (ev) => {
      onGesture?.();
      press = { x: ev.clientX, y: ev.clientY };
    });
    // Pulling a tile upwards takes a new one out into the room.
    tile.addEventListener('pointermove', (ev) => {
      if (!press) return;
      const dy = press.y - ev.clientY;
      if (dy > DRAG_OUT_PX && dy > Math.abs(ev.clientX - press.x)) {
        press = null;
        input.adopt(ev, spawn(id));
      }
    });
    tile.addEventListener('pointerup', () => {
      if (!press) return;
      press = null;
      // A plain tap drops a new one into the middle of the view.
      const e = spawn(id);
      scene.moveTo(e, renderer.viewLeft + renderer.visibleWidth / 2, e.prop('gravity') ? e.height + 40 : scene.floorY / 2 + e.height / 2);
      scene.pickUp(e);
      scene.drop(e);
    });
    tile.addEventListener('pointercancel', () => {
      press = null;
    });
    drawer.append(tile);
  }

  const add = hudButton('hud-add', ICONS.add, t('catalog.open'));
  add.addEventListener('click', () => {
    onGesture?.();
    drawer.hidden = !drawer.hidden;
    add.classList.toggle('active', !drawer.hidden);
  });
  hud.prepend(add);

  const bin = hudButton('hud-bin', ICONS.bin, t('catalog.trash'));
  root.append(drawer, bin);

  const setMode = (mode) => {
    const editing = mode === 'edit';
    add.hidden = !editing;
    bin.hidden = !editing;
    if (!editing) {
      drawer.hidden = true;
      add.classList.remove('active');
    }
  };
  setMode(scene.mode);

  return {
    setMode,
    isOverBin(x, y) {
      if (bin.hidden) return false;
      const r = bin.getBoundingClientRect();
      return x >= r.left && x <= r.right && y >= r.top && y <= r.bottom;
    },
  };
}
