import { DefStore, loadPack, fetchJson, Scene, Animator, DayNight } from '../engine/index.js';
import { Renderer } from '../engine/renderer.js';
import { Input } from '../engine/input.js';
import { Sfx } from '../audio/sfx.js';
import * as storage from '../shared/storage.js';
import { createHud } from './hud.js';

const WORLD_ID = 'world-1'; // single slot until the world picker exists
const START_TEMPLATE = 'scenes/room.json';
// City-wide default; neighbourhoods and streets will override it once the map exists.
const DEFAULT_BACKDROP = 'core.backdrop.city';
const SAVE_DELAY_MS = 800;

export async function startGame(root) {
  const coreUrl = new URL('../../content/core/', import.meta.url);
  const defs = new DefStore();
  await loadPack(defs, coreUrl);

  const audio = new Sfx();
  const dayNight = new DayNight();
  const services = { audio, dayNight, animator: new Animator() };

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
  storage.requestPersistence();

  const canvas = document.createElement('canvas');
  canvas.id = 'stage';
  root.replaceChildren(canvas);
  const renderer = new Renderer(canvas);
  renderer.setScene(scene, { backdropId: scene.backdrop ?? world.backdrop ?? DEFAULT_BACKDROP });
  const unlockAudio = () => audio.unlock();
  const input = new Input(canvas, renderer, { onFirstGesture: unlockAudio });
  createHud(root, { scene, dayNight, onGesture: unlockAudio });

  // The sun/moon button is world-wide: every entity hears world:day / world:night.
  dayNight.onChange((night) => {
    world.night = night;
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
    const dt = Math.min((now - last) / 1000, 0.05);
    last = now;
    input.update(dt);
    dayNight.update(dt);
    scene.tick(dt);
    renderer.draw(dt);
    requestAnimationFrame(frame);
  };
  requestAnimationFrame(frame);

  return { defs, scene, world, renderer, input, dayNight, save };
}
