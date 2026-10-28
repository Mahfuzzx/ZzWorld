// "Where should this door lead?" — pictures only: a new room in one of a few
// colours, or one of the rooms that already exist (drawn as its wall and floor
// colours, with its name small underneath for grown-ups).
import { t, pick } from '../shared/i18n.js';
import { NEW_ROOM_COLORS } from './house.js';

function roomTile(wall, floor, label, extraClass = '') {
  const b = document.createElement('button');
  b.type = 'button';
  b.className = `doorpick-room ${extraClass}`;
  b.title = label;
  b.setAttribute('aria-label', label);
  const pic = document.createElement('span');
  pic.className = 'doorpick-pic';
  pic.style.setProperty('--wall', wall);
  pic.style.setProperty('--floor', floor);
  const name = document.createElement('span');
  name.className = 'doorpick-name';
  name.textContent = label;
  b.append(pic, name);
  return b;
}

// rooms: [{ id, wall, floor, name }]
export function openDoorPicker({ root, rooms, onPick, onCancel, onGesture }) {
  const overlay = document.createElement('div');
  overlay.className = 'doorpick';
  const box = document.createElement('div');
  box.className = 'doorpick-box';
  const choose = (choice) => {
    onGesture?.();
    overlay.remove();
    onPick(choice);
  };

  const fresh = document.createElement('div');
  fresh.className = 'doorpick-row';
  for (const colors of NEW_ROOM_COLORS) {
    const tile = roomTile(colors[0], colors[1], t('house.newRoom'), 'new');
    tile.addEventListener('click', () => choose({ newRoom: colors }));
    fresh.append(tile);
  }
  const existing = document.createElement('div');
  existing.className = 'doorpick-row';
  for (const room of rooms) {
    const tile = roomTile(room.wall, room.floor, pick(room.name) || t('house.room'));
    tile.addEventListener('click', () => choose({ room: room.id }));
    existing.append(tile);
  }

  const close = document.createElement('button');
  close.type = 'button';
  close.className = 'hud-btn doorpick-close';
  close.innerHTML = '<svg viewBox="0 0 48 48"><path d="M12 12 L36 36 M36 12 L12 36" stroke-width="6"/></svg>';
  close.setAttribute('aria-label', t('parent.close'));
  close.addEventListener('click', () => {
    overlay.remove();
    onCancel?.();
  });

  box.append(fresh);
  if (rooms.length) box.append(existing);
  overlay.append(box, close);
  root.append(overlay);
}
