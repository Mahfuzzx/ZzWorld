// Preset motions (animation level 1). Each preset maps progress p ∈ [0, 1] and an
// amplitude to transform offsets; offsets from clips running together are combined.

const presets = {
  bounce: { amp: 28, duration: 0.6, fn: (p, a) => ({ dy: -a * Math.abs(Math.sin(p * Math.PI * 2)) * (1 - p) }) },
  squash: {
    amp: 0.18,
    duration: 0.3,
    fn: (p, a) => {
      const k = Math.sin(p * Math.PI) * (1 - p) * a;
      return { sx: 1 + k, sy: 1 - k };
    },
  },
  wobble: { amp: 0.15, duration: 0.6, fn: (p, a) => ({ rot: a * Math.sin(p * Math.PI * 4) * (1 - p) }) },
  shake: { amp: 8, duration: 0.4, fn: (p, a) => ({ dx: a * Math.sin(p * Math.PI * 10) * (1 - p) }) },
  pulse: {
    amp: 0.12,
    duration: 0.35,
    fn: (p, a) => {
      const k = 1 + a * Math.sin(p * Math.PI);
      return { sx: k, sy: k };
    },
  },
  spin: { amp: 1, duration: 0.6, fn: (p, a) => ({ rot: a * Math.PI * 2 * (p < 0.5 ? 2 * p * p : 1 - (-2 * p + 2) ** 2 / 2) }) },
};

export const CLIPS = Object.keys(presets);

export class Animator {
  #active = [];
  #touched = new Set();

  play(entity, clip, { amp, duration } = {}) {
    const preset = presets[clip];
    if (!preset) {
      console.warn(`Unknown animation clip: ${clip}`);
      return Promise.resolve();
    }
    // Restarting a clip on the same entity replaces it instead of stacking.
    for (const a of this.#active) {
      if (a.entity === entity && a.preset === preset) a.resolve();
    }
    this.#active = this.#active.filter((a) => !(a.entity === entity && a.preset === preset));
    return new Promise((resolve) => {
      this.#active.push({
        entity,
        preset,
        amp: amp ?? preset.amp,
        duration: duration ?? preset.duration,
        t: 0,
        resolve,
      });
    });
  }

  update(dt) {
    const frame = new Map();
    for (const a of this.#active) {
      a.t += dt;
      const p = Math.min(1, a.t / a.duration);
      const r = a.preset.fn(p, a.amp);
      const fx = frame.get(a.entity) ?? { dx: 0, dy: 0, rot: 0, sx: 1, sy: 1 };
      fx.dx += r.dx ?? 0;
      fx.dy += r.dy ?? 0;
      fx.rot += r.rot ?? 0;
      fx.sx *= r.sx ?? 1;
      fx.sy *= r.sy ?? 1;
      frame.set(a.entity, fx);
      if (p >= 1) a.resolve();
    }
    this.#active = this.#active.filter((a) => a.t < a.duration);

    for (const entity of this.#touched) {
      if (!frame.has(entity)) entity.fx = null;
    }
    for (const [entity, fx] of frame) entity.fx = fx;
    this.#touched = new Set(frame.keys());
  }
}
