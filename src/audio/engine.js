// The game's audio: mixer channels (effects, ambience, music), sound effects
// (synth presets, an object's own synth or recorded sounds), playback effects,
// stereo position and musical notes.
import { PRESETS, renderSynth } from './synth.js';
import { playNote, playDrum } from './instruments.js';
import { decodeWav, fromBase64 } from './wav.js';
import { midiToFreq } from './theory.js';

const MAX_VOICES = 10;
export const CHANNELS = { sfx: 0.9, ambient: 0.6, music: 0.4 };

export class AudioEngine {
  constructor() {
    this.ctx = null;
    this.channels = {};
    this.voices = 0;
    this.warned = new Set();
    this.unlockListeners = new Set();
    this.buffers = new WeakMap(); // sample sound → AudioBuffer
    this.noise = null;
  }

  get ready() {
    return this.ctx?.state === 'running';
  }

  // Browsers only allow audio after a user gesture; call this from one.
  unlock() {
    if (!this.ctx) {
      const AudioContextClass = window.AudioContext ?? window.webkitAudioContext;
      if (!AudioContextClass) return;
      this.ctx = new AudioContextClass();
      const master = this.ctx.createGain();
      master.gain.value = 0.9;
      master.connect(this.ctx.destination);
      for (const [name, volume] of Object.entries(CHANNELS)) {
        const gain = this.ctx.createGain();
        gain.gain.value = volume;
        gain.connect(master);
        this.channels[name] = gain;
      }
      this.noise = this.ctx.createBuffer(1, this.ctx.sampleRate, this.ctx.sampleRate);
      const data = this.noise.getChannelData(0);
      for (let i = 0; i < data.length; i++) data[i] = Math.random() * 2 - 1;
    }
    const resumed = this.ctx.state === 'suspended' ? this.ctx.resume() : Promise.resolve();
    resumed.then(() => {
      for (const fn of this.unlockListeners) fn();
      this.unlockListeners.clear();
    });
  }

  // Runs fn once audio is allowed (immediately if it already is).
  onUnlock(fn) {
    if (this.ready) fn();
    else this.unlockListeners.add(fn);
  }

  setVolume(channel, value) {
    if (this.channels[channel]) this.channels[channel].gain.value = value;
  }

  // name: one of the object's own sounds (sounds[name]) or a built-in preset.
  play(name, { volume = 1, pitch = 1, pan = 0, sounds = null, channel = 'sfx' } = {}) {
    const sound = sounds?.[name] ?? PRESETS[name];
    if (!sound) {
      if (!this.warned.has(name)) console.warn(`Unknown sound: ${name}`);
      this.warned.add(name);
      return;
    }
    this.playSound(sound, { volume, pitch, pan, channel });
  }

  playSound(sound, { volume = 1, pitch = 1, pan = 0, channel = 'sfx' } = {}) {
    if (!this.ready || this.voices >= MAX_VOICES) return;
    const { ctx } = this;
    const t = ctx.currentTime;
    const input = this.#chain(sound, pan, this.channels[channel] ?? this.channels.sfx, t);
    pitch *= sound.pitch ?? 1;
    let length;
    if (sound.type === 'sample') {
      const source = ctx.createBufferSource();
      source.buffer = this.#buffer(sound);
      source.playbackRate.value = pitch;
      const gain = ctx.createGain();
      gain.gain.value = volume * (sound.volume ?? 1);
      source.connect(gain).connect(input);
      source.start(t);
      length = source.buffer.duration / pitch;
    } else {
      length = renderSynth(ctx, input, t, sound, { pitch, volume });
    }
    length += sound.echo ? 1.2 : 0;
    this.voices++;
    setTimeout(() => this.voices--, length * 1000 + 50);
  }

  #buffer(sound) {
    let buffer = this.buffers.get(sound);
    if (!buffer) {
      const { sampleRate, samples } = decodeWav(fromBase64(sound.wav));
      buffer = this.ctx.createBuffer(1, Math.max(1, samples.length), sampleRate);
      buffer.copyToChannel(samples, 0);
      this.buffers.set(sound, buffer);
    }
    return buffer;
  }

  // Effects and stereo position between a sound and its channel.
  #chain(sound, pan, out, t) {
    const { ctx } = this;
    let input = out;
    if (pan && ctx.createStereoPanner) {
      const panner = ctx.createStereoPanner();
      panner.pan.value = Math.max(-1, Math.min(1, pan));
      panner.connect(input);
      input = panner;
    }
    if (sound.echo) {
      const dry = ctx.createGain();
      const delay = ctx.createDelay(1);
      const feedback = ctx.createGain();
      const wet = ctx.createGain();
      delay.delayTime.value = 0.18;
      feedback.gain.value = 0.38;
      wet.gain.value = 0.5;
      dry.connect(input);
      dry.connect(delay);
      delay.connect(feedback).connect(delay);
      delay.connect(wet).connect(input);
      input = dry;
    }
    if (sound.robot) {
      // ring modulation: the voice is multiplied by a low hum
      const ring = ctx.createGain();
      ring.gain.value = 0;
      const lfo = ctx.createOscillator();
      lfo.frequency.value = 55;
      lfo.connect(ring.gain);
      lfo.start(t);
      lfo.stop(t + 12);
      ring.connect(input);
      input = ring;
    }
    return input;
  }

  // A musical note (instrument voice) or drum hit at time `when`.
  note(instrument, midi, { when = 0, length = 0.25, volume = 0.8, out = null } = {}) {
    if (!this.ready) return;
    const t = Math.max(when, this.ctx.currentTime);
    playNote(this.ctx, out ?? this.channels.music, instrument, midiToFreq(midi), t, length, volume);
  }

  drum(name, { when = 0, volume = 0.8, out = null } = {}) {
    if (!this.ready) return;
    playDrum(this.ctx, out ?? this.channels.music, name, Math.max(when, this.ctx.currentTime), volume, this.noise);
  }
}
