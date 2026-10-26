import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { degreeToMidi, midiToFreq, gridDegrees, variantOf, stepEvents, randomMelody, SCALES } from '../src/audio/theory.js';
import { encodeWav, decodeWav, cleanUp, toBase64, fromBase64 } from '../src/audio/wav.js';
import { randomSynth, PRESETS, WAVES } from '../src/audio/synth.js';
import { DefStore, Scene, Animator } from '../src/engine/index.js';

const core = new URL('../content/core/', import.meta.url);
const readJson = (path) => JSON.parse(readFileSync(new URL(path, core), 'utf8'));

test('scale degrees map to notes and wrap into octaves', () => {
  assert.equal(degreeToMidi(0, 'pentatonic', 60), 60);
  assert.equal(degreeToMidi(4, 'pentatonic', 60), 69);
  assert.equal(degreeToMidi(5, 'pentatonic', 60), 72, 'one scale length up = one octave up');
  assert.equal(degreeToMidi(-1, 'pentatonic', 60), 57);
  assert.equal(degreeToMidi(1, 'hicaz', 60), 61);
  assert.equal(Math.round(midiToFreq(69)), 440);
  assert.equal(gridDegrees('pentatonic').length, 10);
  assert.equal(gridDegrees('major')[0], 13, 'highest row first');
});

test('every note a melody can use is in the scale', () => {
  for (const scale of Object.keys(SCALES)) {
    const notes = randomMelody(16, scale, () => 0.37);
    for (const [step, degree] of notes) {
      assert.ok(step >= 0 && step < 16);
      const pitchClass = ((degreeToMidi(degree, scale, 60) - 60) % 12 + 12) % 12;
      assert.ok(SCALES[scale].includes(pitchClass), `${scale}: ${pitchClass}`);
    }
  }
});

test('the night version of a song is slower and quieter', () => {
  const song = readJson('defs/songs.json').find((s) => s.id === 'core.song.room');
  const night = variantOf(song, true);
  assert.equal(night.bpm, 72);
  assert.equal(night.tracks[0].instrument, 'musicbox');
  assert.equal(night.tracks[2].mute, true, 'drums rest at night');
  assert.equal(variantOf(song, false), song);
  assert.ok(stepEvents(song, 0).some((e) => e.drum === 'kick'));
  assert.ok(!stepEvents(night, 0).some((e) => e.drum), 'no drums at night');
  assert.ok(stepEvents(song, 0).some((e) => e.instrument === 'marimba' && e.midi === 72));
});

test('WAV encoding round-trips and recordings get cleaned up', () => {
  const samples = new Float32Array(2000);
  for (let i = 500; i < 1500; i++) samples[i] = Math.sin(i / 5) * 0.3;
  const cleaned = cleanUp(samples, 22050);
  assert.ok(cleaned.length < samples.length, 'silence trimmed');
  assert.ok(Math.max(...cleaned.map(Math.abs)) > 0.85, 'normalised');
  const bytes = encodeWav(cleaned);
  const back = decodeWav(fromBase64(toBase64(bytes)));
  assert.equal(back.sampleRate, 22050);
  assert.equal(back.samples.length, cleaned.length);
  assert.ok(Math.abs(back.samples[100] - cleaned[100]) < 1e-3);
});

test('random synth sounds stay in sensible ranges', () => {
  let seed = 1;
  const random = () => ((seed = (seed * 16807) % 2147483647) / 2147483647);
  for (let i = 0; i < 200; i++) {
    const p = randomSynth(random);
    assert.ok(WAVES.includes(p.wave));
    assert.ok(p.from >= 40 && p.from <= 5000 && p.to >= 40 && p.to <= 5000);
    assert.ok(p.dur > 0 && p.dur < 1);
  }
  for (const p of Object.values(PRESETS)) assert.equal(p.type, 'synth');
});

test('tapping a xylophone key plays that key\'s note', () => {
  const defs = new DefStore();
  for (const file of readJson('manifest.json').defs) for (const def of [].concat(readJson(`defs/${file}`))) defs.add(def);
  const notes = [];
  const audio = { note: (instrument, midi) => notes.push([instrument, midi]), play() {}, channels: {} };
  const scene = new Scene(defs, { id: 't' }, { audio, animator: new Animator() });
  const xylophone = scene.spawn('core.xylophone', { x: 500, y: 900 });
  const key = xylophone.def.behaviors[0].keys[2];
  xylophone.emit('tap', { local: { x: key.x + 5, y: 40 } });
  xylophone.emit('tap', { local: { x: 1, y: 40 } }); // the frame, not a key
  assert.deepEqual(notes, [['xylophone', degreeToMidi(2, 'pentatonic', 72)]]);
});

test('a radio plays and stops its song', async () => {
  const defs = new DefStore();
  for (const file of readJson('manifest.json').defs) for (const def of [].concat(readJson(`defs/${file}`))) defs.add(def);
  const log = [];
  const music = { playSource: (id, song) => log.push(['play', id, song.id]), stopSource: (id) => log.push(['stop', id]) };
  const scene = new Scene(defs, { id: 't' }, { music, audio: { play() {} }, animator: new Animator() });
  const radio = scene.spawn('core.radio');
  radio.emit('tap');
  await new Promise((r) => setImmediate(r));
  radio.emit('tap');
  await new Promise((r) => setImmediate(r));
  scene.remove(radio);
  assert.deepEqual(log, [['play', radio.id, 'core.song.radio'], ['stop', radio.id], ['stop', radio.id]]);
});
