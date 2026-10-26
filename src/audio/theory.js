// Music theory for the loop maker and in-game instruments. Pure functions only.
//
// A song: {
//   kind: "song", bpm, swing (0–1), steps (8/16/32), scale, root (MIDI note),
//   tracks: [
//     { instrument: "marimba", volume, mute?, notes: [[step, degree, length], …] },
//     { instrument: "drums", volume, hits: [[step, "kick"], …] }
//   ],
//   night?: { bpm?, instruments?: { [index]: instrument }, mute?: [index…] }
// }
// Degrees are scale steps from the root (0 = root, scale length = one octave up),
// so any note in the grid always fits the scale — "no wrong notes".

export const SCALES = {
  pentatonic: [0, 2, 4, 7, 9],
  major: [0, 2, 4, 5, 7, 9, 11],
  minor: [0, 2, 3, 5, 7, 8, 10],
  hicaz: [0, 1, 4, 5, 7, 8, 10],
  ussak: [0, 1, 3, 5, 7, 8, 10], // simplified (no quarter tones)
};

export const DRUMS = ['kick', 'snare', 'hat', 'clap'];

export function degreeToMidi(degree, scale = 'pentatonic', root = 60) {
  const steps = SCALES[scale] ?? SCALES.pentatonic;
  const octave = Math.floor(degree / steps.length);
  const index = ((degree % steps.length) + steps.length) % steps.length;
  return root + octave * 12 + steps[index];
}

export const midiToFreq = (midi) => 440 * 2 ** ((midi - 69) / 12);

// Rows shown in the grid for melodic tracks: two octaves of the scale.
export function gridDegrees(scale) {
  const n = (SCALES[scale] ?? SCALES.pentatonic).length;
  return Array.from({ length: n * 2 }, (_, i) => n * 2 - 1 - i); // top row = highest
}

// The song as heard at night: slower, some tracks muted or swapped.
export function variantOf(song, night) {
  if (!night || !song.night) return song;
  const n = song.night;
  return {
    ...song,
    bpm: n.bpm ?? song.bpm,
    tracks: song.tracks.map((track, i) => ({
      ...track,
      instrument: n.instruments?.[i] ?? track.instrument,
      mute: track.mute || (n.mute ?? []).includes(i),
    })),
  };
}

export const stepSeconds = (song) => 60 / (song.bpm ?? 100) / 4; // sixteenth notes

// Everything that sounds on one step: [{ track, instrument, midi?, drum?, length, volume }]
export function stepEvents(song, step) {
  const events = [];
  song.tracks.forEach((track, index) => {
    if (track.mute) return;
    const volume = track.volume ?? 0.8;
    if (track.instrument === 'drums') {
      for (const [s, drum] of track.hits ?? []) {
        if (s === step) events.push({ track: index, instrument: 'drums', drum, length: 1, volume });
      }
    } else {
      for (const [s, degree, length = 1] of track.notes ?? []) {
        if (s === step) {
          events.push({ track: index, instrument: track.instrument, midi: degreeToMidi(degree, song.scale, song.root), length, volume });
        }
      }
    }
  });
  return events;
}

// A pleasant random melody: mostly small steps, landing on the root.
export function randomMelody(steps, scale, random = Math.random) {
  const n = (SCALES[scale] ?? SCALES.pentatonic).length;
  const notes = [];
  let degree = n; // middle of the grid
  for (let s = 0; s < steps; s += random() < 0.3 ? 1 : 2) {
    if (random() < 0.2) continue; // rests
    degree = Math.max(0, Math.min(n * 2 - 1, degree + Math.round((random() - 0.5) * 4)));
    notes.push([s, degree, 1]);
  }
  if (notes.length) notes[notes.length - 1][1] = n; // end on the root
  return notes;
}
