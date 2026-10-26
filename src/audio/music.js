// Plays songs (see theory.js) with a look-ahead scheduler, so timing stays tight
// even when the page is busy. Background music changes with a crossfade; the
// night version switches in at the start of the next bar. Music played by an
// object (a radio) gently ducks the background music.
import { stepEvents, stepSeconds, variantOf } from './theory.js';

const LOOKAHEAD = 0.15; // seconds scheduled ahead
const TICK_MS = 25;
const FADE = 1.2;
const DUCKED = 0.15;

export class MusicPlayer {
  constructor(engine) {
    this.engine = engine;
    this.background = null;
    this.sources = new Map(); // entity id → playback (radios and the like)
    this.night = false;
    this.timer = null;
  }

  get ctx() {
    return this.engine.ctx;
  }

  #start(song) {
    const gain = this.ctx.createGain();
    gain.gain.setValueAtTime(0.0001, this.ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(1, this.ctx.currentTime + FADE);
    gain.connect(this.engine.channels.music);
    this.timer ??= setInterval(() => this.#tick(), TICK_MS);
    return { song, gain, step: 0, next: this.ctx.currentTime + 0.05, night: this.night };
  }

  #fadeOut(playback) {
    if (!playback) return;
    const now = this.ctx.currentTime;
    playback.gain.gain.cancelScheduledValues(now);
    playback.gain.gain.setValueAtTime(playback.gain.gain.value, now);
    playback.gain.gain.exponentialRampToValueAtTime(0.0001, now + FADE);
    playback.stopping = true;
    setTimeout(() => playback.gain.disconnect(), FADE * 1000 + 300);
  }

  // Background music for the current scene (null = silence).
  playBackground(song) {
    if (!this.engine.ready) return;
    if (this.background?.song === song) return;
    this.#fadeOut(this.background);
    this.background = song ? this.#start(song) : null;
    this.#applyDuck();
  }

  playSource(id, song) {
    if (!this.engine.ready || !song) return;
    this.#fadeOut(this.sources.get(id));
    this.sources.set(id, this.#start(song));
    this.#applyDuck();
  }

  stopSource(id) {
    this.#fadeOut(this.sources.get(id));
    this.sources.delete(id);
    this.#applyDuck();
  }

  isPlaying(id) {
    return this.sources.has(id);
  }

  setNight(night) {
    this.night = night; // each playback picks it up at its next bar
  }

  stopAll() {
    this.#fadeOut(this.background);
    this.background = null;
    for (const id of [...this.sources.keys()]) this.stopSource(id);
  }

  #applyDuck() {
    const b = this.background;
    if (!b || !this.ctx) return;
    const target = this.sources.size ? DUCKED : 1;
    const now = this.ctx.currentTime;
    b.gain.gain.cancelScheduledValues(now);
    b.gain.gain.setValueAtTime(Math.max(b.gain.gain.value, 0.0001), now);
    b.gain.gain.exponentialRampToValueAtTime(target, now + 0.6);
  }

  #tick() {
    const playbacks = [this.background, ...this.sources.values()].filter((p) => p && !p.stopping);
    if (!playbacks.length || !this.engine.ready) return;
    const horizon = this.ctx.currentTime + LOOKAHEAD;
    for (const p of playbacks) {
      while (p.next < horizon) this.#scheduleStep(p);
    }
  }

  #scheduleStep(p) {
    const song = variantOf(p.song, p.night);
    const step = p.step % (song.steps ?? 16);
    const dur = stepSeconds(song);
    // swing delays every second sixteenth a little
    const when = p.next + (step % 2 ? (song.swing ?? 0) * dur * 0.5 : 0);
    for (const e of stepEvents(song, step)) {
      if (e.drum) this.engine.drum(e.drum, { when, volume: e.volume, out: p.gain });
      else this.engine.note(e.instrument, e.midi, { when, length: e.length * dur * 0.95, volume: e.volume, out: p.gain });
    }
    p.step = step + 1;
    if (p.step >= (song.steps ?? 16)) {
      p.step = 0;
      p.night = this.night; // day/night version changes on the bar
    }
    p.next += dur;
  }

  // The step being heard right now (for the editor's playhead).
  currentStep(song) {
    const p = [this.background, ...this.sources.values()].find((x) => x?.song === song && !x.stopping);
    if (!p) return -1;
    const dur = stepSeconds(variantOf(p.song, p.night));
    const steps = p.song.steps ?? 16;
    const behind = Math.round((p.next - this.ctx.currentTime) / dur);
    return (((p.step - behind) % steps) + steps) % steps;
  }
}
