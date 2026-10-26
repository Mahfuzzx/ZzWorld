// Synthesized instruments for music and in-game instruments. No sample files.
// Each voice: (ctx, out, t, freq, length, volume) — length in seconds.

export const INSTRUMENTS = ['marimba', 'xylophone', 'musicbox', 'pluck', 'flute', 'bass', 'pad'];

function env(ctx, out, t, attack, decay, volume) {
  const g = ctx.createGain();
  g.gain.setValueAtTime(0.0001, t);
  g.gain.exponentialRampToValueAtTime(Math.max(volume, 0.0001), t + attack);
  g.gain.exponentialRampToValueAtTime(0.0001, t + attack + decay);
  g.connect(out);
  return g;
}

function osc(ctx, type, freq, t, end, into) {
  const o = ctx.createOscillator();
  o.type = type;
  o.frequency.setValueAtTime(freq, t);
  o.connect(into);
  o.start(t);
  o.stop(end);
  return o;
}

const VOICES = {
  marimba(ctx, out, t, f, len, v) {
    const g = env(ctx, out, t, 0.005, 0.45, v * 0.5);
    osc(ctx, 'sine', f, t, t + 0.5, g);
    osc(ctx, 'sine', f * 4, t, t + 0.08, env(ctx, out, t, 0.002, 0.06, v * 0.08));
  },
  xylophone(ctx, out, t, f, len, v) {
    osc(ctx, 'sine', f * 2, t, t + 0.4, env(ctx, out, t, 0.002, 0.35, v * 0.45));
    osc(ctx, 'triangle', f * 6, t, t + 0.06, env(ctx, out, t, 0.001, 0.05, v * 0.08));
  },
  musicbox(ctx, out, t, f, len, v) {
    osc(ctx, 'sine', f * 2, t, t + 1.3, env(ctx, out, t, 0.003, 1.2, v * 0.35));
    osc(ctx, 'sine', f * 5.04, t, t + 0.5, env(ctx, out, t, 0.002, 0.45, v * 0.06));
  },
  pluck(ctx, out, t, f, len, v) {
    const filter = ctx.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.setValueAtTime(f * 8, t);
    filter.frequency.exponentialRampToValueAtTime(f * 1.2, t + 0.4);
    filter.connect(env(ctx, out, t, 0.003, 0.6, v * 0.4));
    osc(ctx, 'sawtooth', f, t, t + 0.65, filter);
  },
  flute(ctx, out, t, f, len, v) {
    const g = ctx.createGain();
    const end = t + Math.max(0.15, len);
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(v * 0.3, t + 0.06);
    g.gain.setValueAtTime(v * 0.3, end - 0.05);
    g.gain.exponentialRampToValueAtTime(0.0001, end + 0.08);
    g.connect(out);
    const o = osc(ctx, 'sine', f * 2, t, end + 0.1, g);
    const lfo = ctx.createOscillator();
    const depth = ctx.createGain();
    lfo.frequency.value = 5.5;
    depth.gain.value = f * 0.012;
    lfo.connect(depth).connect(o.frequency);
    lfo.start(t);
    lfo.stop(end + 0.1);
  },
  bass(ctx, out, t, f, len, v) {
    const filter = ctx.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.value = 600;
    const g = env(ctx, out, t, 0.01, Math.max(0.2, len) + 0.1, v * 0.55);
    filter.connect(g);
    osc(ctx, 'triangle', f / 2, t, t + len + 0.4, filter);
  },
  pad(ctx, out, t, f, len, v) {
    const filter = ctx.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.value = 1100;
    const g = ctx.createGain();
    const end = t + Math.max(0.3, len);
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(v * 0.12, t + 0.2);
    g.gain.setValueAtTime(v * 0.12, end);
    g.gain.exponentialRampToValueAtTime(0.0001, end + 0.4);
    filter.connect(g).connect(out);
    osc(ctx, 'sawtooth', f, t, end + 0.45, filter);
    osc(ctx, 'sawtooth', f * 1.005, t, end + 0.45, filter);
  },
};

export function playNote(ctx, out, instrument, freq, t, length, volume) {
  (VOICES[instrument] ?? VOICES.marimba)(ctx, out, t, freq, length, volume);
}

export function playDrum(ctx, out, drum, t, volume, noiseBuffer) {
  const noiseHit = (type, freq, decay, vol) => {
    const src = ctx.createBufferSource();
    src.buffer = noiseBuffer;
    const filter = ctx.createBiquadFilter();
    filter.type = type;
    filter.frequency.value = freq;
    src.connect(filter).connect(env(ctx, out, t, 0.001, decay, vol));
    src.start(t);
    src.stop(t + decay + 0.02);
  };
  switch (drum) {
    case 'kick': {
      const o = ctx.createOscillator();
      o.frequency.setValueAtTime(150, t);
      o.frequency.exponentialRampToValueAtTime(45, t + 0.15);
      o.connect(env(ctx, out, t, 0.002, 0.2, volume * 0.8));
      o.start(t);
      o.stop(t + 0.25);
      break;
    }
    case 'snare':
      noiseHit('bandpass', 1800, 0.14, volume * 0.35);
      osc(ctx, 'triangle', 190, t, t + 0.08, env(ctx, out, t, 0.001, 0.07, volume * 0.25));
      break;
    case 'hat':
      noiseHit('highpass', 7000, 0.04, volume * 0.18);
      break;
    case 'clap':
      for (const d of [0, 0.012, 0.024]) {
        const src = ctx.createBufferSource();
        src.buffer = noiseBuffer;
        const filter = ctx.createBiquadFilter();
        filter.type = 'bandpass';
        filter.frequency.value = 1200;
        src.connect(filter).connect(env(ctx, out, t + d, 0.001, 0.06, volume * 0.25));
        src.start(t + d);
        src.stop(t + d + 0.08);
      }
      break;
    default:
  }
}
