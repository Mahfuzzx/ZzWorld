// ZzStudio music maker: a step grid per track, notes locked to a scale, a night
// version, and songs saved like any other definition (kind: "song").
import { initI18n, t, pick, translatePage } from '../shared/i18n.js';
import { fetchJson } from '../engine/index.js';
import { AudioEngine } from '../audio/engine.js';
import { MusicPlayer } from '../audio/music.js';
import { INSTRUMENTS } from '../audio/instruments.js';
import { SCALES, DRUMS, gridDegrees, degreeToMidi, randomMelody } from '../audio/theory.js';
import * as storage from '../shared/storage.js';
import { slugify, PACK_ID_PATTERN } from '../shared/pack.js';
import { h } from './panels.js';

const PACK_KEY = 'zz.studio.pack';
const LAST_KEY = 'zz.music.last';
const ROW_COLORS = ['#e04f3a', '#f28c38', '#ffd166', '#9bcf53', '#3aa76d', '#4f8fe0', '#8a6fd8', '#f28dbb'];
const MAX_UNDO = 60;

const settings = {
  get(key, fallback) {
    try {
      return localStorage.getItem(key) ?? fallback;
    } catch {
      return fallback;
    }
  },
  set(key, value) {
    try {
      localStorage.setItem(key, value);
    } catch {
      // not remembered in private mode
    }
  },
};

class MusicMaker {
  constructor() {
    this.audio = new AudioEngine();
    this.music = new MusicPlayer(this.audio);
    this.track = 0;
    this.nightEdit = false;
    this.undoStack = [];
    this.redoStack = [];
    this.playing = false;
    this.packId = settings.get(PACK_KEY, 'benim');
    if (!PACK_ID_PATTERN.test(this.packId)) this.packId = 'benim';
  }

  async init() {
    await initI18n();
    translatePage();
    const coreUrl = new URL('../../content/core/', import.meta.url);
    const manifest = await fetchJson(new URL('manifest.json', coreUrl));
    const core = (await Promise.all(manifest.defs.map((f) => fetchJson(new URL(`defs/${f}`, coreUrl))))).flat();
    this.coreSongs = core.filter((d) => d.kind === 'song');

    this.#wire();
    const mine = (await storage.listDefs()).filter((d) => d.kind === 'song');
    const last = mine.find((d) => d.id === settings.get(LAST_KEY, ''));
    if (last) this.open(last);
    else await this.createNew();
    this.#playheadLoop();
  }

  // ---------- documents ----------

  open(song) {
    this.stop();
    this.song = JSON.parse(JSON.stringify(song));
    this.savedId = song.id;
    this.track = 0;
    this.undoStack = [];
    this.redoStack = [];
    settings.set(LAST_KEY, song.id);
    this.render();
  }

  async #uniqueId(base) {
    const ids = new Set([...(await storage.listDefs()).map((d) => d.id), ...this.coreSongs.map((d) => d.id)]);
    let id = base;
    for (let i = 2; ids.has(id); i++) id = `${base}-${i}`;
    return id;
  }

  async createNew() {
    const name = t('music.newSong');
    this.open({
      id: await this.#uniqueId(`${this.packId}.${slugify(name)}`),
      kind: 'song',
      name: { tr: name, en: name },
      bpm: 100,
      swing: 0,
      steps: 16,
      scale: 'pentatonic',
      root: 60,
      tracks: [
        { instrument: 'marimba', volume: 0.7, notes: [] },
        { instrument: 'drums', volume: 0.6, hits: [] },
      ],
    });
    await this.save();
  }

  async copyFrom(song) {
    const copy = JSON.parse(JSON.stringify(song));
    copy.id = await this.#uniqueId(`${this.packId}.${slugify(song.name?.en ?? song.id.split('.').pop())}`);
    copy.name = { tr: `${song.name?.tr ?? ''} ${t('studio.library.copySuffix')}`.trim(), en: `${song.name?.en ?? ''} ${t('studio.library.copySuffix')}`.trim() };
    this.open(copy);
    await this.save();
  }

  change(fn) {
    this.undoStack.push(JSON.stringify(this.song));
    if (this.undoStack.length > MAX_UNDO) this.undoStack.shift();
    this.redoStack = [];
    // mutate in place: a song that is playing picks the change up immediately
    fn(this.song);
    this.render();
    clearTimeout(this.saveTimer);
    this.saveTimer = setTimeout(() => this.save(), 600);
  }

  #restore(json) {
    const playing = this.playing;
    this.stop();
    this.song = JSON.parse(json);
    this.track = Math.min(this.track, this.song.tracks.length - 1);
    this.render();
    if (playing) this.play();
    this.save();
  }

  undo() {
    if (!this.undoStack.length) return;
    this.redoStack.push(JSON.stringify(this.song));
    this.#restore(this.undoStack.pop());
  }

  redo() {
    if (!this.redoStack.length) return;
    this.undoStack.push(JSON.stringify(this.song));
    this.#restore(this.redoStack.pop());
  }

  async save() {
    clearTimeout(this.saveTimer);
    await storage.saveDef(JSON.parse(JSON.stringify(this.song)));
    if (this.savedId && this.savedId !== this.song.id) await storage.deleteDef(this.savedId);
    this.savedId = this.song.id;
    settings.set(LAST_KEY, this.song.id);
  }

  // ---------- playback ----------

  play() {
    this.audio.unlock();
    this.audio.onUnlock(() => {
      this.music.setNight(this.nightEdit);
      this.music.playBackground(this.song);
      this.playing = true;
      this.#renderPlay();
    });
  }

  stop() {
    this.music.stopAll();
    this.playing = false;
    this.#renderPlay();
  }

  #preview(midiOrDrum, instrument) {
    this.audio.unlock();
    this.audio.onUnlock(() => {
      if (instrument === 'drums') this.audio.drum(midiOrDrum, { volume: 0.8 });
      else this.audio.note(instrument, midiOrDrum, { length: 0.3, volume: 0.8 });
    });
  }

  #playheadLoop() {
    const loop = () => {
      const step = this.playing ? this.music.currentStep(this.song) : -1;
      if (step !== this.lastStep) {
        for (const cell of document.querySelectorAll('.mu-cell.head')) cell.classList.remove('head');
        if (step >= 0) for (const cell of document.querySelectorAll(`.mu-cell[data-step="${step}"]`)) cell.classList.add('head');
        this.lastStep = step;
      }
      requestAnimationFrame(loop);
    };
    requestAnimationFrame(loop);
  }

  // ---------- UI ----------

  #wire() {
    const $ = (id) => document.getElementById(id);
    $('btn-play').addEventListener('click', () => (this.playing ? this.stop() : this.play()));
    $('btn-undo').addEventListener('click', () => this.undo());
    $('btn-redo').addEventListener('click', () => this.redo());
    $('btn-songs').addEventListener('click', () => this.openSongs());
    $('song-name').addEventListener('change', (e) => this.rename(e.target.value));
    $('bpm').addEventListener('change', (e) => {
      const v = Math.min(200, Math.max(40, Number(e.target.value) || 100));
      this.change((s) => {
        if (this.nightEdit) s.night = { ...s.night, bpm: v };
        else s.bpm = v;
      });
    });
    $('scale').replaceChildren(...Object.keys(SCALES).map((k) => h('option', { value: k, text: t(`music.scales.${k}`) })));
    $('scale').addEventListener('change', (e) => this.change((s) => { s.scale = e.target.value; }));
    const names = t('music.noteNames').split(',');
    $('root').replaceChildren(...Array.from({ length: 12 }, (_, i) => h('option', { value: 55 + i, text: names[(55 + i) % 12] })));
    $('root').addEventListener('change', (e) => this.change((s) => { s.root = Number(e.target.value); }));
    $('steps').replaceChildren(...[8, 16, 32].map((n) => h('option', { value: n, text: n })));
    $('steps').addEventListener('change', (e) => this.change((s) => {
      s.steps = Number(e.target.value);
      for (const tr of s.tracks) {
        if (tr.notes) tr.notes = tr.notes.filter((n) => n[0] < s.steps);
        if (tr.hits) tr.hits = tr.hits.filter((n) => n[0] < s.steps);
      }
    }));
    $('swing').addEventListener('change', (e) => this.change((s) => { s.swing = Number(e.target.value); }));
    $('night').addEventListener('change', (e) => {
      this.nightEdit = e.target.checked;
      this.music.setNight(this.nightEdit);
      this.render();
    });
    document.addEventListener('keydown', (e) => {
      if (e.target.matches?.('input, select')) return;
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'z') {
        e.preventDefault();
        if (e.shiftKey) this.redo();
        else this.undo();
      } else if (e.key === ' ') {
        e.preventDefault();
        if (this.playing) this.stop();
        else this.play();
      }
    });
  }

  rename(value) {
    const followsName = this.song.id === `${this.packId}.${slugify(this.song.name?.tr ?? '')}`;
    this.change((s) => {
      s.name = { ...s.name, tr: value, en: s.name?.en && s.name.en !== s.name.tr ? s.name.en : value };
    });
    if (followsName && value.trim()) {
      this.#uniqueId(`${this.packId}.${slugify(value)}`).then((id) => this.change((s) => { s.id = id; }));
    }
  }

  #renderPlay() {
    const b = document.getElementById('btn-play');
    b.textContent = this.playing ? '■' : '▶';
    b.title = t(this.playing ? 'music.stop' : 'music.play');
  }

  render() {
    const s = this.song;
    const $ = (id) => document.getElementById(id);
    document.body.classList.toggle('night-edit', this.nightEdit);
    if (document.activeElement !== $('song-name')) $('song-name').value = pick(s.name) ?? '';
    $('bpm').value = this.nightEdit ? s.night?.bpm ?? s.bpm : s.bpm;
    $('scale').value = s.scale;
    $('root').value = s.root;
    $('steps').value = s.steps;
    $('swing').value = s.swing ?? 0;
    $('night').checked = this.nightEdit;
    this.#renderPlay();
    this.#renderTracks();
    this.#renderGrid();
  }

  #renderTracks() {
    const s = this.song;
    const instrumentOptions = (value) => ['drums', ...INSTRUMENTS].map((i) => h('option', { value: i, text: t(`music.instruments.${i}`), selected: i === value }));
    const cards = s.tracks.map((track, i) => {
      const nightInstrument = s.night?.instruments?.[i];
      const nightMuted = (s.night?.mute ?? []).includes(i);
      const card = h('div', {
        class: `mu-track${i === this.track ? ' active' : ''}${track.mute || (this.nightEdit && nightMuted) ? ' muted' : ''}`,
        onclick: (e) => {
          if (e.target.closest('select, input, button')) return;
          this.track = i;
          this.render();
        },
      },
      h('div', { class: 'st-row' },
        this.nightEdit && track.instrument !== 'drums'
          ? h('select', { class: 'st-input', title: t('music.nightInstrument'), onchange: (e) => this.change((x) => {
            x.night = { ...x.night, instruments: { ...x.night?.instruments, [i]: e.target.value } };
            if (e.target.value === track.instrument) delete x.night.instruments[i];
          }) }, instrumentOptions(nightInstrument ?? track.instrument).filter((o) => o.value !== 'drums'))
          : h('select', { class: 'st-input', disabled: this.nightEdit, onchange: (e) => this.#setInstrument(i, e.target.value) }, instrumentOptions(track.instrument)),
        h('button', { type: 'button', class: 'st-btn st-small', text: '×', title: t('music.removeTrack'), disabled: s.tracks.length < 2,
          onclick: () => this.change((x) => {
            x.tracks.splice(i, 1);
            if (x.night) delete x.night.instruments; // indexes changed
            if (x.night) x.night.mute = [];
            this.track = Math.min(this.track, x.tracks.length - 1);
          }) })),
      h('label', { class: 'st-slider' }, h('span', { text: t('music.volume') }),
        h('input', { type: 'range', min: 0, max: 1, step: 0.05, value: track.volume ?? 0.8,
          onchange: (e) => this.change((x) => { x.tracks[i].volume = Number(e.target.value); }) })),
      this.nightEdit
        ? h('label', { class: 'st-check' }, h('input', { type: 'checkbox', checked: nightMuted, onchange: (e) => this.change((x) => {
          const mute = new Set(x.night?.mute ?? []);
          if (e.target.checked) mute.add(i);
          else mute.delete(i);
          x.night = { ...x.night, mute: [...mute] };
        }) }), t('music.nightMute'))
        : h('label', { class: 'st-check' }, h('input', { type: 'checkbox', checked: !!track.mute, onchange: (e) => this.change((x) => {
          if (e.target.checked) x.tracks[i].mute = true;
          else delete x.tracks[i].mute;
        }) }), t('music.mute')));
      return card;
    });
    const current = s.tracks[this.track];
    document.getElementById('tracks').replaceChildren(
      ...cards,
      h('div', { class: 'st-row st-wrap' },
        h('button', { type: 'button', class: 'st-btn st-small', text: `+ ${t('music.addTrack')}`,
          onclick: () => this.change((x) => {
            x.tracks.push({ instrument: 'xylophone', volume: 0.7, notes: [] });
            this.track = x.tracks.length - 1;
          }) }),
        h('button', { type: 'button', class: 'st-btn st-small', text: `+ ${t('music.addDrums')}`,
          onclick: () => this.change((x) => {
            x.tracks.push({ instrument: 'drums', volume: 0.6, hits: [] });
            this.track = x.tracks.length - 1;
          }) })),
      current?.instrument !== 'drums'
        ? h('button', { type: 'button', class: 'st-btn', text: t('music.random'),
          onclick: () => this.change((x) => { x.tracks[this.track].notes = randomMelody(x.steps, x.scale); }) })
        : null,
      h('button', { type: 'button', class: 'st-btn st-small', text: t('music.clear'),
        onclick: () => this.change((x) => {
          const tr = x.tracks[this.track];
          if (tr.notes) tr.notes = [];
          if (tr.hits) tr.hits = [];
        }) }),
      h('p', { class: 'st-hint', text: t(this.nightEdit ? 'music.nightHint' : 'music.hint') }),
    );
  }

  #setInstrument(i, instrument) {
    this.change((x) => {
      const tr = x.tracks[i];
      if ((instrument === 'drums') !== (tr.instrument === 'drums')) {
        // switching between melody and drums starts the grid fresh
        delete tr.notes;
        delete tr.hits;
        if (instrument === 'drums') tr.hits = [];
        else tr.notes = [];
      }
      tr.instrument = instrument;
    });
  }

  #renderGrid() {
    const s = this.song;
    const track = s.tracks[this.track];
    const drums = track.instrument === 'drums';
    const rows = drums ? DRUMS : gridDegrees(s.scale);
    const names = t('music.noteNames').split(',');
    const grid = document.getElementById('grid');
    grid.style.gridTemplateColumns = `64px repeat(${s.steps}, 38px)`;
    const cells = [];
    rows.forEach((row, r) => {
      const midi = drums ? null : degreeToMidi(row, s.scale, s.root);
      cells.push(h('div', { class: 'mu-label', text: drums ? t(`music.drums.${row}`) : names[midi % 12] + Math.floor(midi / 12 - 1) }));
      for (let step = 0; step < s.steps; step++) {
        const on = drums
          ? track.hits.some(([st, d]) => st === step && d === row)
          : track.notes.some(([st, d]) => st === step && d === row);
        const cell = h('button', {
          type: 'button',
          class: `mu-cell${step % 4 === 0 ? ' beat' : ''}${on ? ' on' : ''}`,
          'data-step': step,
          onclick: () => this.#toggle(step, row),
        });
        if (on) cell.style.setProperty('--note', ROW_COLORS[r % ROW_COLORS.length]);
        cells.push(cell);
      }
    });
    grid.replaceChildren(...cells);
  }

  #toggle(step, row) {
    const track = this.song.tracks[this.track];
    const drums = track.instrument === 'drums';
    const list = drums ? track.hits : track.notes;
    const i = list.findIndex(([st, d]) => st === step && d === row);
    if (i < 0) this.#preview(drums ? row : degreeToMidi(row, this.song.scale, this.song.root), track.instrument);
    this.change((x) => {
      const target = drums ? x.tracks[this.track].hits : x.tracks[this.track].notes;
      if (i >= 0) target.splice(i, 1);
      else target.push(drums ? [step, row] : [step, row, 1]);
    });
  }

  // ---------- songs dialog ----------

  async openSongs() {
    const dialog = document.getElementById('songs');
    const mine = (await storage.listDefs()).filter((d) => d.kind === 'song');
    const item = (song, onclick, extra) => h('div', { class: 'st-row' },
      h('button', { type: 'button', class: `st-item${song.id === this.song.id ? ' current' : ''}`, onclick }, h('span', { text: `♪ ${pick(song.name) || song.id}` })),
      extra);
    dialog.replaceChildren(
      h('div', { class: 'st-dialog-head' },
        h('h2', { text: t('music.songs') }),
        h('button', { type: 'button', class: 'st-btn st-primary', text: `+ ${t('music.newSong')}`, onclick: async () => {
          dialog.close();
          await this.createNew();
        } }),
        h('button', { type: 'button', class: 'st-btn', text: t('studio.library.close'), onclick: () => dialog.close() })),
      h('div', { class: 'st-dialog-body' },
        h('div', { class: 'st-section', text: t('music.mine') }),
        mine.length ? h('div', { class: 'st-grid' }, mine.map((song) => item(song, () => {
          this.open(song);
          dialog.close();
        }, h('button', { type: 'button', class: 'st-btn st-small st-danger', text: '×', title: t('studio.library.delete'), onclick: async () => {
          if (!confirm(t('studio.library.confirmDelete', { name: pick(song.name) || song.id }))) return;
          await storage.deleteDef(song.id);
          if (song.id === this.song.id) await this.createNew();
          dialog.close();
          this.openSongs();
        } })))) : h('p', { class: 'st-hint', text: t('music.empty') }),
        h('div', { class: 'st-section', text: t('music.core') }),
        h('div', { class: 'st-grid' }, this.coreSongs.map((song) => item(song, async () => {
          dialog.close();
          await this.copyFrom(song);
        }))),
        h('p', { class: 'st-hint', text: t('music.shareHint') })),
    );
    if (!dialog.open) dialog.showModal();
  }
}

const maker = new MusicMaker();
window.zzMusic = maker; // for debugging from the console
maker.init().catch((err) => {
  console.error('Music maker failed to start:', err);
  document.body.textContent = String(err);
});
