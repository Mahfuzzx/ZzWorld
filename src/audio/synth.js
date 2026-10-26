// Synthesized sound effects (sfxr-style). A sound is a small set of parameters:
//   { type: "synth", wave, from, to, dur, attack, volume, vibrato, arp, bell }
//   wave: sine | triangle | square | sawtooth | noise
//   from/to: start and end frequency (Hz) — for noise, the filter frequency
//   vibrato: { rate, depth } (depth as a fraction of the frequency)
//   arp: { steps, ratio } — a quick run of rising notes
// Only parameters are stored, so sounds cost a few bytes and have no licence issues.

export const WAVES = ['sine', 'triangle', 'square', 'sawtooth', 'noise'];

export const PRESETS = {
  pop: { type: 'synth', wave: 'sine', from: 300, to: 900, dur: 0.09, volume: 0.5 },
  click: { type: 'synth', wave: 'square', from: 1200, to: 800, dur: 0.03, volume: 0.12 },
  boing: { type: 'synth', wave: 'triangle', from: 180, to: 520, dur: 0.25, volume: 0.5, vibrato: { rate: 18, depth: 0.06 } },
  thud: { type: 'synth', wave: 'sine', from: 140, to: 50, dur: 0.15, volume: 0.7 },
  ding: { type: 'synth', wave: 'triangle', from: 1320, to: 1320, dur: 0.6, volume: 0.3, bell: true },
  creak: { type: 'synth', wave: 'sawtooth', from: 90, to: 140, dur: 0.3, volume: 0.06 },
  bip: { type: 'synth', wave: 'square', from: 880, to: 880, dur: 0.08, volume: 0.12 },
  whoosh: { type: 'synth', wave: 'noise', from: 300, to: 2400, dur: 0.35, attack: 0.12, volume: 0.35 },
  splash: { type: 'synth', wave: 'noise', from: 2000, to: 300, dur: 0.45, volume: 0.4 },
  sparkle: { type: 'synth', wave: 'triangle', from: 1100, to: 1100, dur: 0.45, volume: 0.25, arp: { steps: 4, ratio: 1.26 }, bell: true },
  slide: { type: 'synth', wave: 'sine', from: 900, to: 250, dur: 0.35, volume: 0.35, vibrato: { rate: 9, depth: 0.03 } },
  zap: { type: 'synth', wave: 'sawtooth', from: 1600, to: 120, dur: 0.18, volume: 0.15 },
};

export const PRESET_NAMES = Object.keys(PRESETS);

const noiseBuffers = new WeakMap();
function noise(ctx) {
  let buffer = noiseBuffers.get(ctx);
  if (!buffer) {
    buffer = ctx.createBuffer(1, ctx.sampleRate, ctx.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < data.length; i++) data[i] = Math.random() * 2 - 1;
    noiseBuffers.set(ctx, buffer);
  }
  return buffer;
}

function envelope(ctx, t, attack, dur, volume) {
  const gain = ctx.createGain();
  const peak = Math.max(volume, 0.0001);
  gain.gain.setValueAtTime(0.0001, t);
  gain.gain.exponentialRampToValueAtTime(peak, t + Math.max(0.004, attack));
  gain.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  return gain;
}

function tone(ctx, out, t, p, from, to, dur, volume) {
  const gain = envelope(ctx, t, p.attack ?? 0.005, dur, volume);
  gain.connect(out);
  if (p.wave === 'noise') {
    const src = ctx.createBufferSource();
    src.buffer = noise(ctx);
    src.loop = true;
    const filter = ctx.createBiquadFilter();
    filter.type = 'bandpass';
    filter.Q.value = 1.2;
    filter.frequency.setValueAtTime(from, t);
    filter.frequency.exponentialRampToValueAtTime(Math.max(20, to), t + dur);
    src.connect(filter).connect(gain);
    src.start(t);
    src.stop(t + dur + 0.02);
    return;
  }
  const osc = ctx.createOscillator();
  osc.type = p.wave ?? 'sine';
  osc.frequency.setValueAtTime(from, t);
  osc.frequency.exponentialRampToValueAtTime(Math.max(20, to), t + dur);
  if (p.vibrato?.depth) {
    const lfo = ctx.createOscillator();
    const depth = ctx.createGain();
    lfo.frequency.value = p.vibrato.rate ?? 8;
    depth.gain.value = from * p.vibrato.depth;
    lfo.connect(depth).connect(osc.frequency);
    lfo.start(t);
    lfo.stop(t + dur + 0.02);
  }
  osc.connect(gain);
  osc.start(t);
  osc.stop(t + dur + 0.02);
  if (p.bell) {
    // a soft partial an octave up gives a bell-like ring
    const bell = ctx.createOscillator();
    const g = envelope(ctx, t, 0.004, dur * 0.6, volume * 0.25);
    bell.frequency.setValueAtTime(from * 2.01, t);
    bell.connect(g).connect(out);
    bell.start(t);
    bell.stop(t + dur);
  }
}

// Plays the sound into `out` at time t; returns its length in seconds.
export function renderSynth(ctx, out, t, p, { pitch = 1, volume = 1 } = {}) {
  const dur = Math.max(0.02, p.dur ?? 0.2);
  const vol = (p.volume ?? 0.4) * volume;
  const from = (p.from ?? 440) * pitch;
  const to = (p.to ?? p.from ?? 440) * pitch;
  const steps = p.arp?.steps ?? 1;
  if (steps > 1) {
    const each = dur / steps;
    for (let i = 0; i < steps; i++) {
      const k = (p.arp.ratio ?? 1.25) ** i;
      tone(ctx, out, t + i * each, p, from * k, to * k, each * 1.6, vol);
    }
    return dur + each;
  }
  tone(ctx, out, t, p, from, to, dur, vol);
  return dur;
}

// A random but usually pleasant sound for the "surprise me" button.
export function randomSynth(random = Math.random) {
  const pick = (list) => list[Math.floor(random() * list.length)];
  const wave = pick(WAVES);
  const from = Math.round(120 * 2 ** (random() * 4));
  const p = {
    type: 'synth',
    wave,
    from,
    to: Math.round(Math.min(5000, Math.max(40, from * 2 ** ((random() - 0.5) * 4)))),
    dur: Math.round((0.06 + random() * 0.5) * 100) / 100,
    volume: wave === 'square' || wave === 'sawtooth' ? 0.15 : 0.4,
  };
  if (random() < 0.3) p.vibrato = { rate: Math.round(4 + random() * 16), depth: Math.round(random() * 8) / 100 };
  if (random() < 0.2) p.arp = { steps: 3 + Math.floor(random() * 3), ratio: pick([1.12, 1.19, 1.26, 1.33, 1.5]) };
  if (random() < 0.2 && wave !== 'noise') p.bell = true;
  return p;
}
