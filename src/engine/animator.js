// Runs animation clips. Three kinds share one interface (play / stop):
//   presets   — built-in motions (bounce, wobble, …) for the whole entity
//   keyframe  — def.clips[name] = { type: "keyframe", duration, loop, tracks }
//               tracks: { [part]: [{ t, rot (degrees), x, y, s }] }, "" = whole entity
//   frames    — def.clips[name] = { type: "frames", fps, loop, part?, frames: [shapes…] }
// Results are written to the entity each frame: fx (whole), partFx, frames.

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

const DEG = Math.PI / 180;
const smooth = (p) => p * p * (3 - 2 * p);

// Samples one track at time t. Keys are sorted by t.
export function sampleTrack(keys, t, ease = 'smooth') {
  const value = (k) => ({ rot: (k.rot ?? 0) * DEG, dx: k.x ?? 0, dy: k.y ?? 0, sx: k.sx ?? k.s ?? 1, sy: k.sy ?? k.s ?? 1 });
  if (!keys.length) return null;
  if (t <= keys[0].t) return value(keys[0]);
  for (let i = 1; i < keys.length; i++) {
    const a = keys[i - 1];
    const b = keys[i];
    if (t <= b.t) {
      const raw = b.t > a.t ? (t - a.t) / (b.t - a.t) : 1;
      const p = ease === 'linear' ? raw : smooth(raw);
      const va = value(a);
      const vb = value(b);
      return Object.fromEntries(Object.keys(va).map((k) => [k, va[k] + (vb[k] - va[k]) * p]));
    }
  }
  return value(keys.at(-1));
}

export function clipDuration(clip) {
  if (clip.type === 'frames') return (clip.frames?.length ?? 0) / (clip.fps ?? 10);
  if (clip.duration) return clip.duration;
  const last = Object.values(clip.tracks ?? {}).flat().reduce((m, k) => Math.max(m, k.t), 0);
  return last || 1;
}

const identity = () => ({ dx: 0, dy: 0, rot: 0, sx: 1, sy: 1 });

function combine(into, r) {
  into.dx += r.dx ?? 0;
  into.dy += r.dy ?? 0;
  into.rot += r.rot ?? 0;
  into.sx *= r.sx ?? 1;
  into.sy *= r.sy ?? 1;
}

export class Animator {
  #active = [];
  #touched = new Set();

  // Plays a preset or one of the entity's own clips. Resolves when it ends
  // (looping clips resolve when stopped).
  play(entity, name, { amp, duration, loop } = {}) {
    const clip = entity.def.clips?.[name];
    const preset = clip ? null : presets[name];
    if (!clip && !preset) {
      console.warn(`Unknown animation clip: ${name}`);
      return Promise.resolve();
    }
    this.stop(entity, name); // restarting replaces instead of stacking
    return new Promise((resolve) => {
      this.#active.push({
        entity,
        name,
        clip,
        preset,
        amp: amp ?? preset?.amp,
        duration: duration ?? (clip ? clipDuration(clip) : preset.duration),
        loop: loop ?? clip?.loop ?? false,
        t: 0,
        resolve,
      });
    });
  }

  stop(entity, name) {
    this.#active = this.#active.filter((a) => {
      const match = a.entity === entity && (name === undefined || a.name === name);
      if (match) a.resolve();
      return !match;
    });
  }

  isPlaying(entity, name) {
    return this.#active.some((a) => a.entity === entity && a.name === name);
  }

  // Keeps the loop the entity wants right now (entity.wantedIdle()) running.
  syncIdle(entity) {
    const want = entity.wantedIdle();
    if (want === entity.idleClip && (!want || this.isPlaying(entity, want))) return;
    if (entity.idleClip && entity.idleClip !== want) this.stop(entity, entity.idleClip);
    entity.idleClip = want;
    if (want) this.play(entity, want, { loop: true });
  }

  update(dt) {
    const frame = new Map();
    const state = (e) => {
      if (!frame.has(e)) frame.set(e, { fx: null, partFx: null, frames: null });
      return frame.get(e);
    };

    for (const a of this.#active) {
      a.t += Math.max(0, dt);
      const finished = !a.loop && a.t >= a.duration;
      const t = a.loop ? a.t % a.duration : Math.min(a.t, a.duration);
      const out = state(a.entity);

      if (a.preset) {
        out.fx ??= identity();
        combine(out.fx, a.preset.fn(Math.min(1, t / a.duration), a.amp));
      } else if (a.clip.type === 'frames') {
        const count = a.clip.frames?.length ?? 0;
        if (count) {
          const index = Math.min(count - 1, Math.floor(t * (a.clip.fps ?? 10)) % count);
          out.frames ??= {};
          out.frames[a.clip.part ?? ''] = { shapes: a.clip.frames[index], key: `${a.name}:${index}` };
        }
      } else {
        for (const [part, keys] of Object.entries(a.clip.tracks ?? {})) {
          const r = sampleTrack(keys, t, a.clip.ease);
          if (!r) continue;
          if (part === '') {
            out.fx ??= identity();
            combine(out.fx, r);
          } else {
            out.partFx ??= {};
            out.partFx[part] ??= identity();
            combine(out.partFx[part], r);
          }
        }
      }
      if (finished) a.resolve();
    }
    this.#active = this.#active.filter((a) => a.loop || a.t < a.duration);

    for (const entity of this.#touched) {
      if (!frame.has(entity)) {
        entity.fx = null;
        entity.partFx = null;
        entity.frames = null;
      }
    }
    for (const [entity, out] of frame) {
      entity.fx = out.fx;
      entity.partFx = out.partFx;
      entity.frames = out.frames;
    }
    this.#touched = new Set(frame.keys());
  }
}
