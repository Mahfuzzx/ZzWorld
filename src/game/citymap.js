// The city map: neighbourhoods as round islands on a hand-drawn town. Tap one
// to go there. Neighbourhoods that are not built yet are shown with a padlock.
// Map coordinates are 0–1000 × 0–800.
import { t, pick } from '../shared/i18n.js';
import { drawArt } from '../engine/art.js';

const W = 1000;
const H = 800;

const ICONS = {
  house: [{ type: 'path', d: 'M-30 4 L0 -26 L30 4 Z', fill: '#e8735a' }, { type: 'rect', x: -22, y: 2, w: 44, h: 32, fill: '#f2c4a8' }, { type: 'rect', x: -6, y: 14, w: 12, h: 20, fill: '#8a5a2b' }],
  boat: [{ type: 'path', d: 'M-34 6 H34 L22 26 H-22 Z', fill: '#e8735a' }, { type: 'path', d: 'M0 4 V-34 L26 0 Z', fill: '#ffffff' }],
  tower: [{ type: 'rect', x: -26, y: -20, w: 22, h: 54, fill: '#9fd3f2' }, { type: 'rect', x: 2, y: -36, w: 24, h: 70, fill: '#b7c6e0' }],
};

// The land, roads between neighbourhoods and some decoration.
function mapArt(hoods) {
  const shapes = [
    { type: 'path', d: 'M120 170 C220 60 520 70 640 120 C780 70 930 140 930 330 C960 520 900 700 700 740 C520 780 300 760 180 680 C70 600 50 420 90 300 C100 240 100 200 120 170 Z', fill: '#cfe8b8', lw: 5 },
    { type: 'path', d: 'M600 160 C640 220 700 200 720 260', stroke: '#7cc6f2', lw: 14, fill: null },
  ];
  for (let i = 0; i < hoods.length; i++) {
    for (let j = i + 1; j < hoods.length; j++) {
      const a = hoods[i];
      const b = hoods[j];
      shapes.push({ type: 'path', d: `M${a.x} ${a.y} Q${(a.x + b.x) / 2} ${(a.y + b.y) / 2 - 60} ${b.x} ${b.y}`, stroke: '#c9b48f', lw: 10, fill: null, rough: false });
    }
  }
  for (const [x, y] of [[200, 250], [240, 600], [860, 460], [560, 700], [880, 220]]) {
    shapes.push({ type: 'circle', cx: x, cy: y, r: 22, fill: '#8fc7a4' }, { type: 'circle', cx: x + 26, cy: y + 8, r: 18, fill: '#7cbf7a' });
  }
  return shapes;
}

export function openCityMap({ root, city, current, onPick, onGesture }) {
  const overlay = document.createElement('div');
  overlay.className = 'citymap';
  const stage = document.createElement('div');
  stage.className = 'citymap-stage';
  const canvas = document.createElement('canvas');
  stage.append(canvas);
  overlay.append(stage);

  const close = document.createElement('button');
  close.type = 'button';
  close.className = 'hud-btn citymap-close';
  close.innerHTML = '<svg viewBox="0 0 48 48"><path d="M12 12 L36 36 M36 12 L12 36" stroke-width="6"/></svg>';
  close.setAttribute('aria-label', t('parent.close'));
  close.addEventListener('click', () => overlay.remove());
  overlay.append(close);

  const hoods = city.neighborhoods ?? [];
  const draw = () => {
    const rect = stage.getBoundingClientRect();
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    canvas.width = Math.round(rect.width * dpr);
    canvas.height = Math.round(rect.height * dpr);
    const ctx = canvas.getContext('2d');
    const s = canvas.width / W;
    ctx.setTransform(s, 0, 0, s, 0, 0);
    ctx.fillStyle = '#9fd3f2';
    ctx.fillRect(0, 0, W, H);
    drawArt(ctx, mapArt(hoods), () => '#999', { seed: 3 });
    for (const hood of hoods) {
      drawArt(ctx, [{ type: 'circle', cx: hood.x, cy: hood.y, r: hood.r, fill: hood.locked ? '#d9d4cb' : hood.color, lw: 5 }], () => '#999', { seed: 5 });
      ctx.save();
      ctx.translate(hood.x, hood.y - 10);
      ctx.scale(1.6, 1.6);
      if (hood.locked) ctx.globalAlpha = 0.45;
      drawArt(ctx, ICONS[hood.icon] ?? ICONS.house, () => '#999', { seed: 7 });
      ctx.restore();
      ctx.fillStyle = '#3b2f2a';
      ctx.font = '700 30px system-ui, sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText(pick(hood.name), hood.x, hood.y + hood.r * 0.62);
      if (hood.id === current) {
        // "you are here": a big pin at the edge of the neighbourhood
        ctx.save();
        ctx.translate(hood.x + hood.r * 0.62, hood.y - hood.r * 0.5);
        ctx.scale(2.2, 2.2);
        drawArt(ctx, [{ type: 'path', d: 'M0 0 C-22 -28 -16 -46 0 -46 C16 -46 22 -28 0 0 Z', fill: '#e04f3a', lw: 3 },
          { type: 'circle', cx: 0, cy: -31, r: 7, fill: '#ffffff', stroke: null }], () => '#999', { seed: 9 });
        ctx.restore();
      }
      if (hood.locked) {
        drawArt(ctx, [{ type: 'rect', x: hood.x - 22, y: hood.y + 18, w: 44, h: 34, r: 6, fill: '#ffd166' },
          { type: 'path', d: `M${hood.x - 13} ${hood.y + 18} V${hood.y + 8} C${hood.x - 13} ${hood.y - 8} ${hood.x + 13} ${hood.y - 8} ${hood.x + 13} ${hood.y + 8} V${hood.y + 18}`, lw: 5, fill: null }], () => '#999', { seed: 11 });
      }
    }
  };

  // one round button per neighbourhood on top of the drawing
  for (const hood of hoods) {
    const b = document.createElement('button');
    b.type = 'button';
    b.className = 'citymap-hood';
    b.style.left = `${((hood.x - hood.r) / W) * 100}%`;
    b.style.top = `${((hood.y - hood.r) / H) * 100}%`;
    b.style.width = `${((hood.r * 2) / W) * 100}%`;
    b.style.height = `${((hood.r * 2) / H) * 100}%`;
    b.setAttribute('aria-label', `${pick(hood.name)}${hood.locked ? ` (${t('citymap.soon')})` : ''}`);
    b.title = b.getAttribute('aria-label');
    b.addEventListener('click', () => {
      onGesture?.();
      if (hood.locked) {
        b.classList.remove('nope');
        void b.offsetWidth; // restart the shake
        b.classList.add('nope');
        return;
      }
      overlay.remove();
      onPick(hood);
    });
    stage.append(b);
  }

  root.append(overlay);
  draw();
  new ResizeObserver(draw).observe(stage);
  return overlay;
}
