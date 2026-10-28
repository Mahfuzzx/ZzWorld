// On-screen buttons. Icons only; the labels are for screen readers.
import { t } from '../shared/i18n.js';

const ICONS = {
  // edit mode: hammer
  edit: '<svg viewBox="0 0 48 48"><path d="M10 38 L28 20" stroke-width="7"/><path d="M22 10 h14 a4 4 0 0 1 4 4 v6 l-8 -2 l-8 8 l-8 -8 z" fill="#f2c14e"/></svg>',
  // play mode: hand
  play: '<svg viewBox="0 0 48 48"><path d="M16 26 V12 a3 3 0 0 1 6 0 V22 V9 a3 3 0 0 1 6 0 V22 V11 a3 3 0 0 1 6 0 V24 V16 a3 3 0 0 1 6 0 V30 c0 8 -6 12 -13 12 c-6 0 -9 -3 -12 -8 l-6 -9 a3 3 0 0 1 5 -3 z" fill="#ffd9b8"/></svg>',
  sun: '<svg viewBox="0 0 48 48"><g stroke-width="4"><path d="M24 4v6M24 38v6M4 24h6M38 24h6M10 10l4 4M34 34l4 4M38 10l-4 4M14 34l-4 4"/></g><circle cx="24" cy="24" r="9" fill="#ffd166"/></svg>',
  heart: '<svg viewBox="0 0 48 48"><path d="M24 40 C6 28 8 12 18 12 C22 12 24 16 24 16 C24 16 26 12 30 12 C40 12 42 28 24 40 Z" fill="#e8735a"/></svg>',
  // grown-ups: a small key
  parent: '<svg viewBox="0 0 48 48"><circle cx="16" cy="24" r="9" fill="#ffd166"/><path d="M25 24 H42 M36 24 V31 M41 24 V29"/></svg>',
  moon: '<svg viewBox="0 0 48 48"><path d="M30 6 a18 18 0 1 0 12 28 a15 15 0 0 1 -12 -28 z" fill="#fff3c4"/><circle cx="14" cy="10" r="2" fill="#fff3c4" stroke="none"/><circle cx="40" cy="12" r="1.5" fill="#fff3c4" stroke="none"/></svg>',
};

function button(className) {
  const el = document.createElement('button');
  el.type = 'button';
  el.className = `hud-btn ${className}`;
  return el;
}

// getScene() returns the scene being shown (it changes when going to another room).
// onFeedback / onParent are optional (the Studio test room has neither).
export function createHud(root, { getScene, dayNight, onGesture, onModeChange, onFeedback, onParent }) {
  const hud = document.createElement('div');
  hud.className = 'hud';

  const mode = button('hud-mode');
  const renderMode = () => {
    const editing = getScene().mode === 'edit';
    mode.innerHTML = editing ? ICONS.play : ICONS.edit;
    mode.setAttribute('aria-label', t(editing ? 'hud.play' : 'hud.edit'));
    mode.classList.toggle('active', editing);
    if (heart) heart.hidden = editing; // the bin takes its corner in edit mode
  };
  mode.addEventListener('click', () => {
    onGesture?.();
    const scene = getScene();
    scene.mode = scene.mode === 'edit' ? 'play' : 'edit';
    renderMode();
    onModeChange?.(scene.mode);
  });

  const sky = button('hud-sky');
  const renderSky = () => {
    sky.innerHTML = dayNight.night ? ICONS.moon : ICONS.sun;
    sky.setAttribute('aria-label', t(dayNight.night ? 'hud.day' : 'hud.night'));
    sky.classList.toggle('night', dayNight.night);
  };
  sky.addEventListener('click', () => {
    onGesture?.();
    dayNight.toggle();
  });
  dayNight.onChange(renderSky);

  let heart = null;
  if (onFeedback) {
    heart = button('hud-heart');
    heart.innerHTML = ICONS.heart;
    heart.setAttribute('aria-label', t('kidFeedback.open'));
    heart.addEventListener('click', () => {
      onGesture?.();
      onFeedback();
    });
    root.append(heart);
  }
  if (onParent) {
    const parent = button('hud-parent');
    parent.innerHTML = ICONS.parent;
    parent.setAttribute('aria-label', t('parent.open'));
    parent.addEventListener('click', () => onParent());
    root.append(parent);
  }

  renderMode();
  renderSky();
  hud.append(sky, mode);
  root.append(hud);
  return hud;
}
