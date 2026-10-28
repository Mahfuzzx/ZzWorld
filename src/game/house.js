// House design: rooms are connected by pairs of doors that point at each
// other. Adding a door asks where it should lead; the room on the other side
// gets a matching door back automatically. DOM-free (unit tested).

// Pastel rooms a child can pick for a new room: [wall, floor].
export const NEW_ROOM_COLORS = [
  ['#f9d6d0', '#c9a27a'],
  ['#d8e8f5', '#b98d63'],
  ['#e2f1d6', '#d9a66b'],
  ['#efe0f7', '#a8865e'],
  ['#fff1c4', '#c98a4b'],
];

export function newDoorKey(scene) {
  const used = new Set([...scene.entities.values()].map((e) => e.door).filter(Boolean));
  let n = 1;
  while (used.has(`d${n}`)) n++;
  return `d${n}`;
}

// Where along the wall a new door fits best: as far as possible from the
// furniture, doors and wall things already there. `from`/`to` limit the search
// (e.g. to the part of the room on screen).
export function freeSpot(scene, width = 150, from = 0, to = scene.width) {
  const blockers = scene.topLevel(); // loose toys too: one in front of a door hides it from taps
  const margin = width / 2 + 20;
  const lo = Math.max(from, 0) + margin;
  const hi = Math.min(to, scene.width) - margin;
  let best = Math.min(Math.max((from + to) / 2, margin), scene.width - margin);
  let bestScore = -Infinity;
  for (let x = lo; x <= hi; x += 25) {
    let score = Infinity;
    for (const e of blockers) score = Math.min(score, Math.abs(e.x - x) - e.width / 2);
    if (score > bestScore) {
      bestScore = score;
      best = x;
    }
  }
  return best;
}

// Points `door` (in sceneA) at sceneB and puts a door back in sceneB.
export function linkDoors(sceneA, door, sceneB, doorDef = 'core.door') {
  door.door ??= newDoorKey(sceneA);
  const key = newDoorKey(sceneB);
  const back = sceneB.spawn(doorDef, {
    x: freeSpot(sceneB),
    y: sceneB.floorY,
    door: key,
    target: { scene: sceneA.id, door: door.door },
  });
  door.target = { scene: sceneB.id, door: key };
  sceneA.changed();
  sceneB.changed();
  return back;
}

export function newRoomTemplate(id, hood, [wall, floor] = NEW_ROOM_COLORS[0]) {
  return {
    id,
    hood,
    width: 1600,
    height: 1000,
    floorY: 740,
    interior: { wall, floor },
    backdrop: null,
    entities: [{ def: 'core.window', x: 800, y: 500 }],
  };
}
