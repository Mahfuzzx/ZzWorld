// Microphone recording for ZzStudio. The microphone is only open while
// recording; the result never leaves the device (it becomes a WAV in the object).
import { toWav, toBase64, MAX_SECONDS } from '../audio/wav.js';

export class Recorder {
  constructor() {
    this.recorder = null;
    this.stream = null;
    this.timer = null;
  }

  get recording() {
    return !!this.recorder;
  }

  // Resolves once recording has begun, with { done }: a promise for the sound
  // ({ type: 'sample', wav }) that settles when stop() is called or time runs out.
  async start() {
    this.stream = await navigator.mediaDevices.getUserMedia({ audio: { echoCancellation: true, noiseSuppression: true } });
    const chunks = [];
    this.recorder = new MediaRecorder(this.stream);
    this.recorder.addEventListener('dataavailable', (e) => chunks.push(e.data));
    const done = new Promise((resolve, reject) => {
      this.recorder.addEventListener('stop', async () => {
        this.#release();
        try {
          const blob = new Blob(chunks, { type: chunks[0]?.type });
          resolve({ type: 'sample', wav: toBase64(await toWav(await blob.arrayBuffer())) });
        } catch (err) {
          reject(err);
        }
      });
    });
    this.recorder.start();
    this.timer = setTimeout(() => this.stop(), MAX_SECONDS * 1000);
    return { done };
  }

  stop() {
    if (this.recorder?.state === 'recording') this.recorder.stop();
  }

  #release() {
    clearTimeout(this.timer);
    for (const track of this.stream?.getTracks() ?? []) track.stop(); // microphone off
    this.stream = null;
    this.recorder = null;
  }
}

export async function importAudioFile(file) {
  return { type: 'sample', wav: toBase64(await toWav(await file.arrayBuffer())) };
}
