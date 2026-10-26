import { DefStore, loadPack, fetchJson, Scene, Animator, DayNight } from '../engine/index.js';
import { Renderer } from '../engine/renderer.js';
import { Input } from '../engine/input.js';
import { AudioEngine } from '../audio/engine.js';
import { MusicPlayer } from '../audio/music.js';
import * as storage from '../shared/storage.js';
import { createHud } from './hud.js';
import { createCatalog } from './catalog.js';
import { addUserDefs } from '../shared/pack.js';

const WORLD_ID = 'world-1'; // single slot until the world picker exists
const START_TEMPLATE = 'scenes/room.json';
// City-wide default; neighbourhoods and streets will override it once the map exists.
const DEFAULT_BACKDROP = 'core.backdrop.city';
const DEFAULT_MUSIC = 'core.song.room';
const SAVE_DELAY_MS = 800;

export async function startGame(root) {
  const coreUrl = new URL('../../content/core/', import.meta.url);
  const defs = new DefStore();
  await loadPack(defs, coreUrl);
  // Objects made in ZzStudio or imported from packs (never replacing core ones).
  let userIds = [];
  try {
    userIds = addUserDefs(defs, await storage.listDefs());
  } catch (err) {
    console.warn('User objects could not be loaded:', err);
  }

  const audio = new AudioEngine();
  const music = new MusicPlayer(audio);
  const dayNight = new DayNight();
  // view.panOf is filled in once the renderer exists (sounds follow positions on screen)
  const view = { panOf: () => 0 };
  const services = { audio, music, view, dayNight, animator: new Animator() };

  let world = null;
  let scene = null;
  try {
    world = await storage.loadWorld(WORLD_ID);
    const saved = world?.scenes?.[world.currentScene];
    if (saved) scene = Scene.deserialize(defs, saved, services);
  } catch (err) {
    console.warn('Saved world could not be restored, starting fresh:', err);
  }
  if (!scene) {
    scene = Scene.fromTemplate(defs, await fetchJson(new URL(START_TEMPLATE, coreUrl)), services);
    world = { id: WORLD_ID, version: 1, createdAt: Date.now(), currentScene: scene.id, night: false, scenes: {} };
  }
  if (world.night) {
    dayNight.night = true;
    dayNight.amount = 1;
  }
  music.setNight(dayNight.night);
  storage.requestPersistence();

  const canvas = document.createElement('canvas');
  canvas.id = 'stage';
  root.replaceChildren(canvas);
  const renderer = new Renderer(canvas);
  renderer.setScene(scene, { backdropId: scene.backdrop ?? world.backdrop ?? DEFAULT_BACKDROP });
  view.panOf = (x) => Math.max(-1, Math.min(1, (x - (renderer.viewLeft + renderer.visibleWidth / 2)) / (renderer.visibleWidth / 2))) * 0.8;
  const unlockAudio = () => audio.unlock();
  // Background music starts with the first touch (browsers block audio before).
  audio.onUnlock(() => {
    const songId = scene.music ?? DEFAULT_MUSIC;
    if (defs.has(songId)) music.playBackground(defs.get(songId));
  });
  let catalog = null;
  const input = new Input(canvas, renderer, {
    onFirstGesture: unlockAudio,
    isOverBin: (x, y) => catalog?.isOverBin(x, y) ?? false,
  });
  const hud = createHud(root, { scene, dayNight, onGesture: unlockAudio, onModeChange: (mode) => catalog.setMode(mode) });
  catalog = createCatalog(root, { defs, userIds, scene, renderer, input, hud, onGesture: unlockAudio });

  // The sun/moon button is world-wide: every entity hears world:day / world:night.
  dayNight.onChange((night) => {
    world.night = night;
    music.setNight(night);
    for (const e of scene.entities.values()) e.emit(night ? 'world:night' : 'world:day');
    scene.changed();
  });

  let saveTimer = null;
  const save = () => {
    clearTimeout(saveTimer);
    saveTimer = null;
    world.scenes[scene.id] = scene.serialize();
    world.currentScene = scene.id;
    world.updatedAt = Date.now();
    return storage.saveWorld(world).catch((err) => console.warn('Save failed:', err));
  };
  scene.onChange(() => {
    clearTimeout(saveTimer);
    saveTimer = setTimeout(save, SAVE_DELAY_MS);
  });
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
    scene.tick(dt);
    renderer.draw(dt);
    requestAnimationFrame(frame);
  };
  requestAnimationFrame(frame);

  return { defs, scene, world, renderer, input, dayNight, audio, music, save };
}
