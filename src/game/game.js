import { DefStore, loadPack, fetchJson, Scene, Animator, DayNight, characters } from '../engine/index.js';
import { Renderer } from '../engine/renderer.js';
import { hitArt } from '../engine/art.js';
import { Input } from '../engine/input.js';
import { AudioEngine } from '../audio/engine.js';
import { MusicPlayer } from '../audio/music.js';
import * as storage from '../shared/storage.js';
import { createHud } from './hud.js';
import { createCatalog } from './catalog.js';
import { openCreator } from './creator.js';
import { addUserDefs } from '../shared/pack.js';
import { flushFeedback } from '../shared/feedback.js';
import { openKidFeedback } from './feedback-kid.js';
import { openParentGate, openParentPanel } from './parent.js';

const WORLD_ID = 'world-1'; // single slot until the world picker exists
// City-wide default; neighbourhoods and streets will override it once the map exists.
const DEFAULT_BACKDROP = 'core.backdrop.city';
const DEFAULT_MUSIC = 'core.song.room';
const SAVE_DELAY_MS = 800;
const FADE_MS = 220;

export async function startGame(root) {
  const coreUrl = new URL('../../content/core/', import.meta.url);
  const defs = new DefStore();
  const manifest = await loadPack(defs, coreUrl);
  // Objects made in ZzStudio or imported from packs (never replacing core ones).
  let userIds = [];
  try {
    userIds = addUserDefs(defs, await storage.listDefs());
  } catch (err) {
    console.warn('User objects could not be loaded:', err);
  }
  // Scene templates by id: rooms that have never been visited start from these.
  const templates = new Map();
  for (const file of manifest.scenes ?? []) {
    const template = await fetchJson(new URL(`scenes/${file}`, coreUrl));
    templates.set(template.id, template);
  }

  const audio = new AudioEngine();
  const music = new MusicPlayer(audio);
  const dayNight = new DayNight();
  // view.panOf is filled in once the renderer exists (sounds follow positions on screen);
  // travel moves things between rooms.
  const view = { panOf: () => 0 };
  const services = { audio, music, view, dayNight, hitArt, animator: new Animator(), travel: null };

  // ---------- world and scenes ----------

  let world = null;
  try {
    world = await storage.loadWorld(WORLD_ID);
  } catch (err) {
    console.warn('Saved world could not be read, starting fresh:', err);
  }
  world ??= { id: WORLD_ID, version: 1, createdAt: Date.now(), currentScene: manifest.startScene, night: false, scenes: {} };
  if (world.night) {
    dayNight.night = true;
    dayNight.amount = 1;
  }
  music.setNight(dayNight.night);

  let saveTimer = null;
  const scheduleSave = () => {
    clearTimeout(saveTimer);
    saveTimer = setTimeout(save, SAVE_DELAY_MS);
  };

  // A scene from the save, or fresh from its template. Doors the template has
  // but the save doesn't (older saves) are added, so every room stays reachable.
  const loadScene = (id) => {
    const template = templates.get(id);
    let scene = null;
    if (world.scenes[id]) {
      try {
        scene = Scene.deserialize(defs, world.scenes[id], services);
      } catch (err) {
        console.warn(`Saved room ${id} could not be restored, starting it fresh:`, err);
      }
    }
    if (!scene) {
      if (!template) throw new Error(`Unknown scene: ${id}`);
      return Scene.fromTemplate(defs, template, services);
    }
    for (const spec of template?.entities ?? []) {
      if (!spec.door || [...scene.entities.values()].some((e) => e.door === spec.door)) continue;
      scene.spawn(spec.def, spec);
    }
    return scene;
  };

  const state = { scene: null };
  try {
    state.scene = loadScene(world.currentScene ?? manifest.startScene);
  } catch (err) {
    console.warn('Saved world could not be restored, starting fresh:', err);
    world.scenes = {};
    state.scene = loadScene(manifest.startScene);
  }
  storage.requestPersistence();
  flushFeedback(); // feedback written while offline

  // ---------- screen ----------

  const canvas = document.createElement('canvas');
  canvas.id = 'stage';
  const fade = document.createElement('div');
  fade.className = 'fade';
  root.replaceChildren(canvas, fade);
  const renderer = new Renderer(canvas);
  view.panOf = (x) => Math.max(-1, Math.min(1, (x - (renderer.viewLeft + renderer.visibleWidth / 2)) / (renderer.visibleWidth / 2))) * 0.8;
  const unlockAudio = () => audio.unlock();
  const playSceneMusic = () => {
    const songId = state.scene.music ?? DEFAULT_MUSIC;
    if (defs.has(songId)) music.playBackground(defs.get(songId));
  };
  // Background music starts with the first touch (browsers block audio before).
  audio.onUnlock(playSceneMusic);

  const show = (scene) => {
    state.scene = scene;
    renderer.setScene(scene, { backdropId: scene.backdrop ?? world.backdrop ?? DEFAULT_BACKDROP });
    scene.onChange(scheduleSave);
    // lamps and the like catch up with the time of day of the world
    for (const e of scene.entities.values()) e.emit(dayNight.night ? 'world:night' : 'world:day');
    if (audio.ready) playSceneMusic();
  };
  show(state.scene);

  let catalog = null;
  // Characters are made and changed in the creator.
  const editCharacter = (character) => openCreator({
    root, defs, look: character.look, onGesture: unlockAudio,
    onDone: (look) => {
      character.setLook(look);
      character.emit('dressed');
    },
  });
  const newCharacter = () => openCreator({
    root, defs, look: characters.randomLook(defs, 'child'), onGesture: unlockAudio,
    onDone: (look) => {
      const { scene } = state;
      const c = scene.spawn('core.character', { look });
      scene.moveTo(c, renderer.viewLeft + renderer.visibleWidth / 2, c.height + 40);
      scene.pickUp(c);
      scene.drop(c);
    },
  });
  const input = new Input(canvas, renderer, {
    onFirstGesture: unlockAudio,
    isOverBin: (x, y) => catalog?.isOverBin(x, y) ?? false,
    // in edit mode, tapping a character opens the creator
    onTap: (e) => {
      if (state.scene.mode !== 'edit' || !e.isCharacter) return false;
      editCharacter(e);
      return true;
    },
  });
  const hud = createHud(root, {
    getScene: () => state.scene,
    dayNight,
    onGesture: unlockAudio,
    onModeChange: (mode) => catalog.setMode(mode),
    onFeedback: () => openKidFeedback({ root, onGesture: unlockAudio }),
    onParent: () => openParentGate({ root, onPass: () => openParentPanel({ root }) }),
  });
  catalog = createCatalog(root, { defs, userIds, renderer, input, hud, onGesture: unlockAudio, onNewCharacter: newCharacter });

  // ---------- going through doors ----------

  // `entity` (or nothing: the child taps an open door) goes to the door's
  // target. Characters take the view with them; things just go.
  let travelling = false;
  services.travel = async (entity, portal) => {
    if (travelling || !portal.target) return;
    const from = state.scene;
    const { scene: targetId, door: targetDoor } = portal.target;
    if (!templates.has(targetId) && !world.scenes[targetId]) return;

    const moving = entity ? from.extract(entity) : null;
    world.scenes[from.id] = from.serialize();
    const follow = !entity || entity.isCharacter;

    let to = targetId === from.id ? from : loadScene(targetId);
    const arrival = [...to.entities.values()].find((e) => e.door === targetDoor);
    const x = arrival ? arrival.x : to.width / 2;
    if (moving) {
      const root = to.insert(moving, x, to.floorY + 60);
      to.drop(root);
      root.emit('land');
    }
    if (!follow) {
      // the room we left gets the thing; we stay where we are
      world.scenes[to.id] = to.serialize();
      save();
      return;
    }

    travelling = true;
    fade.classList.add('on');
    await new Promise((r) => setTimeout(r, FADE_MS));
    // the room we leave falls quiet: its loops and radios stop
    for (const e of from.entities.values()) {
      services.animator.stop(e);
      music.stopSource(e.id);
    }
    to.mode = from.mode;
    to.camera.x = x - renderer.visibleWidth / 2;
    show(to);
    renderer.clampCamera();
    if (arrival?.state === 'closed') arrival.setState('open');
    fade.classList.remove('on');
    travelling = false;
    save();
  };

  // The sun/moon button is world-wide: every entity hears world:day / world:night.
  dayNight.onChange((night) => {
    world.night = night;
    music.setNight(night);
    for (const e of state.scene.entities.values()) e.emit(night ? 'world:night' : 'world:day');
    state.scene.changed();
  });

  // ---------- saving ----------

  function save() {
    clearTimeout(saveTimer);
    saveTimer = null;
    const { scene } = state;
    world.scenes[scene.id] = scene.serialize();
    world.currentScene = scene.id;
    world.updatedAt = Date.now();
    return storage.saveWorld(world).catch((err) => console.warn('Save failed:', err));
  }
  addEventListener('pagehide', save);
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'hidden') save();
  });

  let last = performance.now();
  const frame = (now) => {
    const dt = Math.min(Math.max(0, (now - last) / 1000), 0.05);
    last = now;
    input.update(dt);
    dayNight.update(dt);
    state.scene.tick(dt);
    renderer.draw(dt);
    requestAnimationFrame(frame);
  };
  requestAnimationFrame(frame);

  return {
    defs, world, renderer, input, dayNight, audio, music, save,
    get scene() {
      return state.scene;
    },
  };
}
