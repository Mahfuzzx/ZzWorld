// Tiny synthesized sound effects (Web Audio). A placeholder until the full
// sound generator (roadmap step 4); presets are referenced by name in definitions.

const MAX_VOICES = 8;

function tone(ctx, out, t, { type = 'sine', from, to = from, duration, volume }) {
  const osc = ctx.createOscillator();
  const gain = ctx.createGain();
  osc.type = type;
  osc.frequency.setValueAtTime(from, t);
  osc.frequency.exponentialRampToValueAtTime(to, t + duration);
  gain.gain.setValueAtTime(0.0001, t);
  gain.gain.exponentialRampToValueAtTime(Math.max(volume, 0.0001), t + 0.005);
  gain.gain.exponentialRampToValueAtTime(0.0001, t + duration);
  osc.connect(gain).connect(out);
  osc.start(t);
  osc.stop(t + duration + 0.02);
  return duration;
}

// Each preset returns its length in seconds.
const PRESETS = {
  pop: (ctx, out, t, v, p) => tone(ctx, out, t, { from: 300 * p, to: 900 * p, duration: 0.09, volume: 0.5 * v }),
  click: (ctx, out, t, v, p) => tone(ctx, out, t, { type: 'square', from: 1200 * p, to: 800 * p, duration: 0.03, volume: 0.12 * v }),
  boing: (ctx, out, t, v, p) => tone(ctx, out, t, { type: 'triangle', from: 180 * p, to: 520 * p, duration: 0.25, volume: 0.5 * v }),
  thud: (ctx, out, t, v, p) => tone(ctx, out, t, { from: 140 * p, to: 50 * p, duration: 0.15, volume: 0.7 * v }),
  ding: (ctx, out, t, v, p) => Math.max(
    tone(ctx, out, t, { type: 'triangle', from: 1320 * p, duration: 0.6, volume: 0.3 * v }),
    tone(ctx, out, t, { from: 2640 * p, duration: 0.3, volume: 0.08 * v }),
  ),
  creak: (ctx, out, t, v, p) => tone(ctx, out, t, { type: 'sawtooth', from: 90 * p, to: 140 * p, duration: 0.3, volume: 0.06 * v }),
};

export const SOUND_NAMES = Object.keys(PRESETS);

export class Sfx {
  #ctx = null;
  #master = null;
  #voices = 0;
  #warned = new Set();

  // Browsers only allow audio after a user gesture; call this from one.
  unlock() {
    if (!this.#ctx) {
      const AudioContextClass = window.AudioContext ?? window.webkitAudioContext;
      if (!AudioContextClass) return;
      this.#ctx = new AudioContextClass();
      this.#master = this.#ctx.createGain();
      this.#master.gain.value = 0.6;
      this.#master.connect(this.#ctx.destination);
    }
    if (this.#ctx.state === 'suspended') this.#ctx.resume();
  }

  play(name, { volume = 1, pitch = 1 } = {}) {
    const ctx = this.#ctx;
    if (!ctx || ctx.state !== 'running' || this.#voices >= MAX_VOICES) return;
    const preset = PRESETS[name];
    if (!preset) {
      if (!this.#warned.has(name)) console.warn(`Unknown sound: ${name}`);
      this.#warned.add(name);
      return;
    }
    this.#voices++;
    const length = preset(ctx, this.#master, ctx.currentTime, volume, pitch);
    setTimeout(() => this.#voices--, length * 1000 + 50);
  }
}
