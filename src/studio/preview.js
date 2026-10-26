// "Try it": puts the object being edited into a small room that runs on the
// real game engine (drag, tap, edit mode, day/night).
import { t } from '../shared/i18n.js';
import { DefStore, Scene, Animator, DayNight } from '../engine/index.js';
import { Renderer } from '../engine/renderer.js';
import { Input } from '../engine/input.js';
import { createHud } from '../game/hud.js';
import { addUserDefs } from '../shared/pack.js';
import * as storage from '../shared/storage.js';
import { h } from './panels.js';

export async function openPreview(app) {
  const dialog = document.getElementById('preview');
  const defs = new DefStore();
  for (const def of app.coreRaw) defs.add(def);
  addUserDefs(defs, await storage.listDefs());
  const def = JSON.parse(JSON.stringify(app.doc.def));
  defs.add(def);

  let resolved;
  try {
    resolved = defs.get(def.id);
  } catch (err) {
    app.toast(err.message);
    return;
  }
  const onWall = ['Decor', 'Structure'].includes(resolved.class);
  const template = {
    id: 'studio.preview',
    width: 1600,
    height: 1000,
    floorY: 740,
    interior: { wall: '#f3dcb4', floor: '#d9a66b' },
    entities: [
      { def: 'core.table', x: 420, y: 820 },
      { def: 'core.apple', x: 380, y: 600 },
      { def: 'core.basket', x: 480, y: 600 },
      { def: 'core.ball', x: 1350, y: 900 },
      { def: def.id, x: 900, y: onWall ? 500 : 860 },
    ],
  };

  const stage = h('div', { class: 'st-preview-stage' });
  dialog.replaceChildren(
    h('div', { class: 'st-dialog-head' },
      h('h2', { text: t('studio.preview.title') }),
      h('button', { type: 'button', class: 'st-btn', text: t('studio.preview.close'), onclick: () => dialog.close() })),
    stage);
  dialog.showModal();

  const dayNight = new DayNight();
  const services = { audio: app.audio, animator: new Animator(), dayNight };
  let scene;
  try {
    scene = Scene.fromTemplate(defs, template, services);
  } catch (err) {
    dialog.close();
    app.toast(err.message);
    return;
  }
  dayNight.onChange((night) => {
    for (const e of scene.entities.values()) e.emit(night ? 'world:night' : 'world:day');
  });

  const canvas = h('canvas');
  stage.append(canvas);
  const renderer = new Renderer(canvas);
  renderer.setScene(scene, { backdropId: 'core.backdrop.city' });
  const unlock = () => app.audio.unlock();
  const input = new Input(canvas, renderer, { onFirstGesture: unlock });
  createHud(stage, { scene, dayNight, onGesture: unlock });

  let last = performance.now();
  const frame = (now) => {
    if (!dialog.open) return;
    const dt = Math.min((now - last) / 1000, 0.05);
    last = now;
    input.update(dt);
    dayNight.update(dt);
    scene.tick(dt);
    renderer.draw(dt);
    requestAnimationFrame(frame);
  };
  requestAnimationFrame(frame);
}
