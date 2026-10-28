// The children's feedback: no reading, no typing. Pick a face, maybe a picture
// (a bug, an idea, a heart, "too hard"), press send. Nothing a child could use
// to say who they are can be sent from here.
import { t } from '../shared/i18n.js';
import { sendFeedback } from '../shared/feedback.js';

const FACES = [
  '<circle cx="24" cy="24" r="20" fill="#9fd3f2"/><circle cx="17" cy="20" r="2.5"/><circle cx="31" cy="20" r="2.5"/><path d="M15 34 Q24 26 33 34"/>',
  '<circle cx="24" cy="24" r="20" fill="#c9e3f2"/><circle cx="17" cy="20" r="2.5"/><circle cx="31" cy="20" r="2.5"/><path d="M16 33 Q24 30 32 33"/>',
  '<circle cx="24" cy="24" r="20" fill="#fff3c4"/><circle cx="17" cy="20" r="2.5"/><circle cx="31" cy="20" r="2.5"/><path d="M16 31 H32"/>',
  '<circle cx="24" cy="24" r="20" fill="#ffe08a"/><circle cx="17" cy="20" r="2.5"/><circle cx="31" cy="20" r="2.5"/><path d="M15 29 Q24 37 33 29"/>',
  '<circle cx="24" cy="24" r="20" fill="#ffd166"/><path d="M12 19 Q17 14 22 19 M26 19 Q31 14 36 19"/><path d="M14 27 Q24 40 34 27 Z" fill="#e8735a"/>',
];
const TAGS = {
  love: '<path d="M24 40 C6 28 8 12 18 12 C22 12 24 16 24 16 C24 16 26 12 30 12 C40 12 42 28 24 40 Z" fill="#e8735a"/>',
  idea: '<path d="M24 6 a12 12 0 0 1 7 22 V33 H17 V28 A12 12 0 0 1 24 6 Z" fill="#ffd166"/><path d="M18 38 H30 M20 42 H28"/>',
  bug: '<ellipse cx="24" cy="27" rx="10" ry="13" fill="#9bcf53"/><path d="M24 14 V40 M14 22 L6 18 M14 30 L6 30 M14 36 L8 40 M34 22 L42 18 M34 30 L42 30 M34 36 L40 40 M20 14 L16 8 M28 14 L32 8"/>',
  hard: '<circle cx="24" cy="24" r="18" fill="#f2a7b5"/><path d="M18 18 Q24 10 30 18 Q30 24 24 26 V30"/><circle cx="24" cy="36" r="2"/>',
};
const SEND = '<path d="M6 24 L42 8 L32 42 L22 28 Z" fill="#9fd3f2"/><path d="M22 28 L42 8"/>';
const svg = (inner) => `<svg viewBox="0 0 48 48">${inner}</svg>`;
const COOLDOWN_MS = 30000;
let lastSent = 0;

export function openKidFeedback({ root, onGesture }) {
  let mood = 0;
  const tags = new Set();
  const overlay = document.createElement('div');
  overlay.className = 'kidfb';
  const box = document.createElement('div');
  box.className = 'kidfb-box';
  overlay.append(box);

  const button = (html, cls, label, onclick) => {
    const b = document.createElement('button');
    b.type = 'button';
    b.className = cls;
    b.innerHTML = html;
    b.title = label;
    b.setAttribute('aria-label', label);
    b.addEventListener('click', () => {
      onGesture?.();
      onclick(b);
    });
    return b;
  };

  const faces = document.createElement('div');
  faces.className = 'kidfb-row';
  FACES.forEach((face, i) => faces.append(button(svg(face), 'kidfb-choice', t(`kidFeedback.moods.${i + 1}`), (b) => {
    mood = i + 1;
    for (const x of faces.children) x.classList.toggle('selected', x === b);
    send.disabled = false;
  })));

  const tagRow = document.createElement('div');
  tagRow.className = 'kidfb-row';
  for (const [name, icon] of Object.entries(TAGS)) {
    tagRow.append(button(svg(icon), 'kidfb-choice small', t(`kidFeedback.tags.${name}`), (b) => {
      if (tags.has(name)) tags.delete(name);
      else tags.add(name);
      b.classList.toggle('selected', tags.has(name));
    }));
  }

  const close = button(svg('<path d="M12 12 L36 36 M36 12 L12 36" stroke-width="6"/>'), 'hud-btn kidfb-close', t('parent.close'), () => overlay.remove());
  const send = button(svg(SEND), 'hud-btn kidfb-send', t('kidFeedback.send'), async () => {
    if (!mood || Date.now() - lastSent < COOLDOWN_MS) {
      overlay.remove();
      return;
    }
    lastSent = Date.now();
    sendFeedback({ kind: 'kid', mood, tags: [...tags] });
    // a big thank-you heart, then back to play
    box.replaceChildren();
    const heart = document.createElement('div');
    heart.className = 'kidfb-thanks';
    heart.innerHTML = svg(TAGS.love);
    box.append(heart);
    setTimeout(() => overlay.remove(), 1400);
  });
  send.disabled = true;

  box.append(faces, tagRow, send);
  overlay.append(close);
  root.append(overlay);
}
