// Recorded and imported sounds are stored as small mono 16-bit WAV files
// (base64 in the definition), the one format every browser can decode.

export const SAMPLE_RATE = 22050;
export const MAX_SECONDS = 10;

export function encodeWav(samples, sampleRate = SAMPLE_RATE) {
  const bytes = new Uint8Array(44 + samples.length * 2);
  const view = new DataView(bytes.buffer);
  const text = (offset, s) => [...s].forEach((c, i) => view.setUint8(offset + i, c.charCodeAt(0)));
  text(0, 'RIFF');
  view.setUint32(4, 36 + samples.length * 2, true);
  text(8, 'WAVE');
  text(12, 'fmt ');
  view.setUint32(16, 16, true);
  view.setUint16(20, 1, true);            // PCM
  view.setUint16(22, 1, true);            // mono
  view.setUint32(24, sampleRate, true);
  view.setUint32(28, sampleRate * 2, true);
  view.setUint16(32, 2, true);
  view.setUint16(34, 16, true);
  text(36, 'data');
  view.setUint32(40, samples.length * 2, true);
  for (let i = 0; i < samples.length; i++) {
    const v = Math.max(-1, Math.min(1, samples[i]));
    view.setInt16(44 + i * 2, v < 0 ? v * 0x8000 : v * 0x7fff, true);
  }
  return bytes;
}

// Reads our own WAV files back (mono 16-bit PCM).
export function decodeWav(bytes) {
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  const sampleRate = view.getUint32(24, true);
  const length = view.getUint32(40, true) / 2;
  const samples = new Float32Array(length);
  for (let i = 0; i < length; i++) samples[i] = view.getInt16(44 + i * 2, true) / 0x8000;
  return { sampleRate, samples };
}

export function toBase64(bytes) {
  let s = '';
  for (let i = 0; i < bytes.length; i += 0x8000) s += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
  return btoa(s);
}

export function fromBase64(text) {
  const s = atob(text);
  const bytes = new Uint8Array(s.length);
  for (let i = 0; i < s.length; i++) bytes[i] = s.charCodeAt(i);
  return bytes;
}

// Cuts quiet parts at both ends, limits the length and evens out the volume.
export function cleanUp(samples, sampleRate = SAMPLE_RATE, threshold = 0.02) {
  let start = 0;
  let end = samples.length;
  while (start < end && Math.abs(samples[start]) < threshold) start++;
  while (end > start && Math.abs(samples[end - 1]) < threshold) end--;
  const pad = Math.round(sampleRate * 0.02);
  start = Math.max(0, start - pad);
  end = Math.min(samples.length, end + pad, start + sampleRate * MAX_SECONDS);
  const out = samples.slice(start, end);
  let peak = 0;
  for (const v of out) peak = Math.max(peak, Math.abs(v));
  if (peak > 0.001) {
    const gain = 0.9 / peak;
    for (let i = 0; i < out.length; i++) out[i] *= gain;
  }
  // short fades so cuts never click
  const fade = Math.min(out.length >> 1, Math.round(sampleRate * 0.01));
  for (let i = 0; i < fade; i++) {
    out[i] *= i / fade;
    out[out.length - 1 - i] *= i / fade;
  }
  return out;
}

// Browser only: any decodable audio (recording blob, mp3, m4a…) → our WAV bytes.
export async function toWav(arrayBuffer) {
  const decoder = new OfflineAudioContext(1, 1, SAMPLE_RATE);
  const decoded = await decoder.decodeAudioData(arrayBuffer);
  const length = Math.min(Math.ceil(decoded.duration * SAMPLE_RATE), SAMPLE_RATE * (MAX_SECONDS + 5));
  const offline = new OfflineAudioContext(1, Math.max(1, length), SAMPLE_RATE);
  const source = offline.createBufferSource();
  source.buffer = decoded;
  source.connect(offline.destination); // mixes channels down to mono
  source.start();
  const rendered = await offline.startRendering();
  return encodeWav(cleanUp(rendered.getChannelData(0)));
}
