// Backdrops: the world behind a scene (sky, sun and moon, clouds, scenery).
// A backdrop definition is a list of layers; every layer type is a class with the
// same draw() interface, registered by name like entities and behaviors.
//
// draw(ctx, view) is called with the context scaled to scene units and shifted
// for the layer's parallax, so the visible x range is
// [view.left * parallax, view.left * parallax + view.width].
import { lookup } from './registry.js';
import { drawArt } from './art.js';

const lerp = (a, b, t) => a + (b - a) * t;

function mixColor(a, b, t) {
  const pa = parseInt(a.slice(1), 16);
  const pb = parseInt(b.slice(1), 16);
  const ch = (p, shift) => (p >> shift) & 255;
  const mix = (shift) => Math.round(lerp(ch(pa, shift), ch(pb, shift), t));
  return `rgb(${mix(16)}, ${mix(8)}, ${mix(0)})`;
}

// Small deterministic random generator, so stars and clouds stay in place.
function seeded(seed) {
  let s = seed >>> 0;
  return () => {
    s = (s + 0x6d2b79f5) >>> 0;
    let t = s;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export class Layer {
  static type = 'Layer';

  constructor(config = {}) {
    this.config = config;
    this.parallax = config.parallax ?? 0;
  }

  draw(ctx, view) {}

  // Visible x range in this layer's coordinates.
  span(view) {
    const start = view.left * this.parallax;
    return { start, end: start + view.width };
  }
}

export class Sky extends Layer {
  static type = 'Sky';

  draw(ctx, view) {
    const { day = ['#8fd0f5', '#d8f1ff'], night = ['#0f1a3d', '#2b3a6b'] } = this.config;
    const { start } = this.span(view);
    const gradient = ctx.createLinearGradient(0, 0, 0, view.height);
    gradient.addColorStop(0, mixColor(day[0], night[0], view.night));
    gradient.addColorStop(1, mixColor(day[1], night[1], view.night));
    ctx.fillStyle = gradient;
    ctx.fillRect(start, 0, view.width, view.height);
  }
}

export class Stars extends Layer {
  static type = 'Stars';

  constructor(config) {
    super(config);
    const random = seeded(config.seed ?? 7);
    this.tile = config.tile ?? 1600;
    const maxY = config.maxY ?? 700;
    this.stars = Array.from({ length: config.count ?? 80 }, () => ({
      x: random() * this.tile,
      y: random() * maxY,
      r: 1.5 + random() * 2.5,
      phase: random() * Math.PI * 2,
    }));
  }

  draw(ctx, view) {
    if (view.night <= 0) return;
    const { start, end } = this.span(view);
    ctx.fillStyle = '#fff8dc';
    for (let k = Math.floor(start / this.tile); k * this.tile < end; k++) {
      for (const s of this.stars) {
        ctx.globalAlpha = view.night * (0.6 + 0.4 * Math.sin(view.time * 2 + s.phase));
        ctx.beginPath();
        ctx.arc(k * this.tile + s.x, s.y, s.r, 0, Math.PI * 2);
        ctx.fill();
      }
    }
    ctx.globalAlpha = 1;
  }
}

// The sun sets and the moon rises as night fades in.
export class SunMoon extends Layer {
  static type = 'SunMoon';

  draw(ctx, view) {
    const { x = 900, high = 360, low = 1100, size = 1 } = this.config;
    const t = view.night;
    for (const [draw, y] of [[t < 1 && this.#sun, lerp(high, low, t)], [t > 0 && this.#moon, lerp(low, high, t)]]) {
      if (!draw) continue;
      ctx.save();
      ctx.translate(x, y);
      ctx.scale(size, size);
      draw.call(this, ctx, 0, 0);
      ctx.restore();
    }
  }

  #sun(ctx, x, y) {
    ctx.fillStyle = '#ffd166';
    ctx.strokeStyle = '#f4a63a';
    ctx.lineWidth = 6;
    ctx.lineCap = 'round';
    for (let i = 0; i < 10; i++) {
      const a = (i / 10) * Math.PI * 2;
      ctx.beginPath();
      ctx.moveTo(x + Math.cos(a) * 62, y + Math.sin(a) * 62);
      ctx.lineTo(x + Math.cos(a) * 80, y + Math.sin(a) * 80);
      ctx.stroke();
    }
    ctx.beginPath();
    ctx.arc(x, y, 50, 0, Math.PI * 2);
    ctx.fill();
  }

  #moon(ctx, x, y) {
    ctx.fillStyle = '#fff3c4';
    ctx.beginPath();
    ctx.arc(x, y, 44, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = 'rgba(200, 190, 150, 0.6)';
    for (const [dx, dy, r] of [[-14, -10, 9], [12, 8, 7], [-4, 18, 5]]) {
      ctx.beginPath();
      ctx.arc(x + dx, y + dy, r, 0, Math.PI * 2);
      ctx.fill();
    }
  }
}

export class Clouds extends Layer {
  static type = 'Clouds';

  constructor(config) {
    super(config);
    const random = seeded(config.seed ?? 3);
    const [minY, maxY] = config.y ?? [80, 320];
    this.tile = config.tile ?? 2400;
    this.speed = config.speed ?? 12;
    const scale = config.size ?? 1;
    this.clouds = Array.from({ length: config.count ?? 6 }, () => ({
      x: random() * this.tile,
      y: lerp(minY, maxY, random()),
      size: scale * (0.7 + random() * 0.8),
    }));
  }

  draw(ctx, view) {
    const { start, end } = this.span(view);
    ctx.fillStyle = mixColor('#ffffff', '#5a6894', view.night);
    ctx.globalAlpha = 0.95 - 0.4 * view.night;
    for (const c of this.clouds) {
      const x = (((c.x + view.time * this.speed) % this.tile) + this.tile) % this.tile;
      for (let k = Math.floor((start - 300) / this.tile); k * this.tile < end + 300; k++) {
        this.#cloud(ctx, k * this.tile + x, c.y, c.size);
      }
    }
    ctx.globalAlpha = 1;
  }

  #cloud(ctx, x, y, size) {
    ctx.beginPath();
    for (const [dx, dy, r] of [[-60, 10, 38], [-20, -14, 50], [30, -4, 44], [70, 12, 32]]) {
      ctx.moveTo(x + dx * size + r * size, y + dy * size);
      ctx.arc(x + dx * size, y + dy * size, r * size, 0, Math.PI * 2);
    }
    ctx.rect(x - 60 * size, y + 10 * size, 130 * size, 30 * size);
    ctx.fill();
  }
}

// Repeating scenery drawn from shapes (hills, skyline). `art` is the day look;
// at night it is tinted and `nightArt` (e.g. lit windows) is drawn on top.
export class Art extends Layer {
  static type = 'Art';

  draw(ctx, view) {
    const { width = 1200, y = 0, height = 1000 } = this.config;
    const { start, end } = this.span(view);
    const day = this.#bitmap(view, 'day');
    const night = view.night > 0 ? this.#bitmap(view, 'night') : null;
    for (let k = Math.floor(start / width); k * width < end; k++) {
      if (view.night < 1) {
        ctx.globalAlpha = 1;
        ctx.drawImage(day, k * width, y, width, height);
      }
      if (night) {
        ctx.globalAlpha = view.night;
        ctx.drawImage(night, k * width, y, width, height);
      }
    }
    ctx.globalAlpha = 1;
  }

  #bitmap(view, variant) {
    if (this.cacheScale !== view.pixelScale) {
      this.cache = new Map(); // keep only bitmaps for the current scale
      this.cacheScale = view.pixelScale;
    }
    let bitmap = this.cache.get(variant);
    if (bitmap) return bitmap;
    const { width = 1200, height = 1000, art = [], nightArt = [], nightTint = 'rgba(20, 28, 70, 0.6)' } = this.config;
    bitmap = document.createElement('canvas');
    bitmap.width = Math.ceil(width * view.pixelScale);
    bitmap.height = Math.ceil(height * view.pixelScale);
    const ctx = bitmap.getContext('2d');
    ctx.scale(view.pixelScale, view.pixelScale);
    const seed = this.config.seed ?? 1;
    drawArt(ctx, art, () => '#999999', { seed });
    if (variant === 'night') {
      ctx.globalCompositeOperation = 'source-atop';
      ctx.fillStyle = nightTint;
      ctx.fillRect(0, 0, width, height);
      ctx.globalCompositeOperation = 'source-over';
      drawArt(ctx, nightArt, () => '#999999', { seed });
    }
    this.cache.set(variant, bitmap);
    return bitmap;
  }
}

export class Backdrop {
  constructor(def) {
    this.def = def;
    this.layers = (def.layers ?? []).map((config) => new (lookup('layer', config.type))(config));
  }
}
