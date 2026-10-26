// ZzStudio: draw objects, give them states, behaviours and reactions, try them
// in a test room and share them as .zzpack files. Everything is saved on the
// device (IndexedDB) and shows up in the game's catalog.
import { initI18n, t, translatePage } from '../shared/i18n.js';
import { DefStore, fetchJson, Animator, clipDuration } from '../engine/index.js';
import { INK } from '../engine/art.js';
import { Sfx } from '../audio/sfx.js';
import * as storage from '../shared/storage.js';
import { addUserDefs, slugify, PACK_ID_PATTERN } from '../shared/pack.js';
import { ObjectDoc, CLASS_BASES } from './doc.js';
import { Editor } from './editor.js';
import { DRAW_TOOLS, AREA_TOOLS } from './tools.js';
import { renderPanel, TABS, h } from './panels.js';
import { openLibrary } from './library.js';
import { openPreview } from './preview.js';

const PALETTE = [INK, '#ffffff', '#e04f3a', '#f28c38', '#ffd166', '#9bcf53', '#3aa76d', '#9fd3f2', '#4f8fe0',
  '#8a6fd8', '#f28dbb', '#c98a4b', '#8a5a2b', '#9aa7ae', '#dfe9ef', null];
const SAVE_DELAY_MS = 600;
const PACK_KEY = 'zz.studio.pack';
const LAST_KEY = 'zz.studio.last';

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
      // private mode: settings just aren't remembered
    }
  },
};

class Studio {
  constructor() {
    this.tools = Object.fromEntries([...DRAW_TOOLS, ...AREA_TOOLS].map((T) => [T.id, new T(this)]));
    this.tool = this.tools.pen;
    this.paint = INK;
    this.brush = 6;
    this.selection = -1;
    this.tab = 'general';
    this.showAreas = true;
    this.audio = new Sfx();
    this.packId = settings.get(PACK_KEY, 'benim');
    if (!PACK_ID_PATTERN.test(this.packId)) this.packId = 'benim';
    this.saveTimer = null;
    this.savedId = null;
    this.part = '';          // part new shapes belong to ('' = body)
    this.onion = true;       // show the previous flipbook frame
    this.previewEntity = null;
    this.t = t;
  }

  // ---------- parts ----------

  // New shapes go to the part being drawn (or the flipbook's part).
  tagPart(shape) {
    const clip = this.doc.frame ? this.doc.def.clips[this.doc.frame.clip] : null;
    const part = clip ? clip.part : this.part;
    return part ? { ...shape, part } : shape;
  }

  setPart(part) {
    this.part = part;
    this.#renderPanel();
    this.editor.requestRender();
  }

  addPart() {
    const parts = this.doc.def.parts ?? [];
    let n = parts.length + 1;
    while (parts.some((p) => p.id === `${t('studio.animation.partPrefix')}${n}`)) n++;
    const id = `${t('studio.animation.partPrefix')}${n}`;
    const [w, h] = this.doc.def.size ?? [100, 100];
    this.part = id;
    this.doc.change((d) => {
      d.parts = [...(d.parts ?? []), { id, pivot: [Math.round(w / 2), Math.round(h / 2)] }];
    });
    // the selected shape (if any) moves into the new part
    if (this.selection >= 0) this.doc.updateShape(this.selection, (s) => { s.part = id; });
  }

  #renameEverywhere(d, from, to) {
    for (const field of ['art', 'artFront']) {
      for (const shapes of Object.values(d[field] ?? {})) {
        for (const s of shapes) if (s.part === from) s.part = to;
      }
    }
    for (const clip of Object.values(d.clips ?? {})) {
      if (clip.part === from) clip.part = to;
      if (clip.tracks?.[from]) {
        if (to) clip.tracks[to] = clip.tracks[from];
        delete clip.tracks[from];
      }
      for (const frame of clip.frames ?? []) {
        for (const s of frame) if (s.part === from) s.part = to;
      }
    }
  }

  renamePart(from, to) {
    to = slugify(to);
    if (!to || to === from || this.doc.def.parts.some((p) => p.id === to)) {
      this.#renderPanel();
      return;
    }
    this.doc.change((d) => {
      d.parts.find((p) => p.id === from).id = to;
      this.#renameEverywhere(d, from, to);
    });
    this.part = to;
    this.#renderPanel();
  }

  // Removing a part keeps its drawing: the shapes go back to the body.
  removePart(id) {
    this.doc.change((d) => {
      d.parts = d.parts.filter((p) => p.id !== id);
      if (!d.parts.length) delete d.parts;
      this.#renameEverywhere(d, id, undefined);
      for (const field of ['art', 'artFront']) {
        for (const shapes of Object.values(d[field] ?? {})) for (const s of shapes) if (s.part === undefined) delete s.part;
      }
    });
    this.part = '';
    this.#renderPanel();
  }

  // ---------- clips ----------

  addClip(type) {
    const clips = this.doc.def.clips ?? {};
    let n = Object.keys(clips).length + 1;
    while (clips[`${t('studio.animation.clipPrefix')}${n}`]) n++;
    const name = `${t('studio.animation.clipPrefix')}${n}`;
    const part = this.part;
    const clip = type === 'frames'
      ? {
        type: 'frames',
        fps: 8,
        loop: true,
        ...(part ? { part } : {}),
        // start from the current drawing (of the chosen part)
        frames: [JSON.parse(JSON.stringify((this.doc.def.art[this.doc.state] ?? []).filter((s) => !part || s.part === part)))],
      }
      : { type: 'keyframe', duration: 0.6, loop: false, tracks: { [part]: [{ t: 0, rot: 0 }, { t: 0.3, rot: 12 }, { t: 0.6, rot: 0 }] } };
    this.doc.change((d) => {
      d.clips = { ...d.clips, [name]: clip };
    });
    if (type === 'frames') this.doc.setFrame({ clip: name, index: 0 });
  }

  renameClip(from, to) {
    to = slugify(to);
    const clips = this.doc.def.clips;
    if (!to || to === from || clips[to]) {
      this.#renderPanel();
      return;
    }
    this.doc.change((d) => {
      d.clips = Object.fromEntries(Object.entries(d.clips).map(([k, v]) => [k === from ? to : k, v]));
      if (d.idle === from) d.idle = to;
      else if (d.idle && typeof d.idle === 'object') for (const s of Object.keys(d.idle)) if (d.idle[s] === from) d.idle[s] = to;
      for (const list of Object.values(d.reactions ?? {})) for (const a of list) if (a.clip === from) a.clip = to;
    });
    if (this.doc.frame?.clip === from) this.doc.setFrame({ ...this.doc.frame, clip: to });
  }

  removeClip(name) {
    if (this.doc.frame?.clip === name) this.doc.setFrame(null);
    this.doc.change((d) => {
      delete d.clips[name];
      if (!Object.keys(d.clips).length) delete d.clips;
      if (d.idle === name) delete d.idle;
      else if (d.idle && typeof d.idle === 'object') {
        for (const s of Object.keys(d.idle)) if (d.idle[s] === name) delete d.idle[s];
        if (!Object.keys(d.idle).length) delete d.idle;
      }
    });
  }

  // Plays a clip once in the editor, the same way the game would.
  play(name) {
    const animator = new Animator();
    const entity = { def: this.doc.def, state: this.doc.state, fx: null, partFx: null, frames: null };
    const clip = this.doc.def.clips?.[name];
    if (!clip) return;
    // looping clips play twice so the loop can be seen
    const total = clipDuration(clip) * (clip.loop ? 2 : 1);
    animator.play(entity, name, { loop: true });
    this.previewEntity = entity;
    let elapsed = 0;
    let last = performance.now();
    const frame = (now) => {
      const dt = Math.min(Math.max(0, (now - last) / 1000), 0.05);
      last = now;
      elapsed += dt;
      animator.update(dt);
      this.editor.render();
      if (elapsed >= total) {
        this.previewEntity = null;
        this.editor.render();
      } else {
        requestAnimationFrame(frame);
      }
    };
    requestAnimationFrame(frame);
  }

  #frameBar() {
    const doc = this.doc;
    const clip = doc.def.clips[doc.frame.clip];
    const { index } = doc.frame;
    const go = (i) => doc.setFrame({ clip: doc.frame.clip, index: i });
    return [
      h('button', { type: 'button', class: 'st-btn st-small', text: '◀', disabled: index === 0, onclick: () => go(index - 1) }),
      h('span', { class: 'st-frame-no', text: t('studio.animation.frameNo', { i: index + 1, n: clip.frames.length }) }),
      h('button', { type: 'button', class: 'st-btn st-small', text: '▶', disabled: index >= clip.frames.length - 1, onclick: () => go(index + 1) }),
      h('button', { type: 'button', class: 'st-btn st-small', text: `+ ${t('studio.animation.addFrame')}`, onclick: () => {
        doc.change((d) => {
          const frames = d.clips[doc.frame.clip].frames;
          frames.splice(index + 1, 0, JSON.parse(JSON.stringify(frames[index])));
        });
        go(index + 1);
      } }),
      h('button', { type: 'button', class: 'st-btn st-small st-danger', text: t('studio.animation.removeFrame'), disabled: clip.frames.length < 2, onclick: () => {
        doc.change((d) => d.clips[doc.frame.clip].frames.splice(index, 1));
        go(Math.max(0, index - 1));
      } }),
      h('label', { class: 'st-check' },
        h('input', { type: 'checkbox', checked: this.onion, onchange: (e) => {
          this.onion = e.target.checked;
          this.editor.requestRender();
        } }), t('studio.animation.onion')),
      h('button', { type: 'button', class: 'st-btn st-small st-primary', text: '▶▶', title: t('studio.animation.play'), onclick: () => this.play(doc.frame.clip) }),
      h('button', { type: 'button', class: 'st-btn st-small', text: t('studio.animation.doneFrames'), onclick: () => doc.setFrame(null) }),
    ];
  }

  async init() {
    await initI18n();
    translatePage();

    // Core definitions: for "copy a ready-made object", `extends` and the test room.
    const coreUrl = new URL('../../content/core/', import.meta.url);
    const manifest = await fetchJson(new URL('manifest.json', coreUrl));
    this.coreRaw = (await Promise.all(manifest.defs.map((f) => fetchJson(new URL(`defs/${f}`, coreUrl))))).flat();
    this.defs = new DefStore();
    for (const def of this.coreRaw) this.defs.add(def);
    this.coreIds = this.coreRaw
      .filter((d) => !d.abstract && d.kind !== 'backdrop')
      .map((d) => d.id);

    this.editor = new Editor(document.getElementById('editor'), this);
    this.#buildTools();
    this.#buildTabs();
    this.#wireTopBar();

    const mine = await storage.listDefs();
    const last = mine.find((d) => d.id === settings.get(LAST_KEY, ''));
    if (last) this.open(last);
    else this.createNew();
    if (!mine.length) openLibrary(this);
  }

  // ---------- documents ----------

  open(def) {
    this.doc = new ObjectDoc(def);
    this.savedId = def.id;
    this.selection = -1;
    settings.set(LAST_KEY, def.id);
    this.doc.onChange((kind) => this.#changed(kind));
    this.#refreshAll();
  }

  #uniqueId(base) {
    let id = base;
    for (let i = 2; this.#knownIds.has(id); i++) id = `${base}-${i}`;
    return id;
  }

  get #knownIds() {
    return new Set([...this.defs.ids(), ...(this.mineIds ?? [])]);
  }

  async #refreshMineIds() {
    this.mineIds = (await storage.listDefs()).map((d) => d.id);
  }

  async createNew() {
    await this.#refreshMineIds();
    const name = t('studio.library.newName');
    const def = {
      id: this.#uniqueId(`${this.packId}.${slugify(name)}`),
      name: { tr: name, en: name },
      extends: CLASS_BASES.Item,
      class: 'Item',
      size: [120, 120],
      art: { default: [] },
    };
    this.open(def);
    this.#save();
  }

  async copyFrom(coreId) {
    await this.#refreshMineIds();
    const source = this.defs.get(coreId);
    const { abstract, ...def } = JSON.parse(JSON.stringify(source));
    const suffix = t('studio.library.copySuffix');
    def.name = { tr: `${source.name?.tr ?? ''} ${suffix}`.trim(), en: `${source.name?.en ?? ''} ${suffix}`.trim() };
    def.id = this.#uniqueId(`${this.packId}.${slugify(source.name?.en ?? coreId.split('.').pop())}`);
    def.extends = CLASS_BASES[def.class] ?? CLASS_BASES.Item;
    this.open(def);
    this.#save();
  }

  async deleteCurrent() {
    await storage.deleteDef(this.doc.def.id);
    this.savedId = null;
    const mine = await storage.listDefs();
    if (mine.length) this.open(mine[0]);
    else this.createNew();
  }

  setPackId(packId) {
    this.packId = packId;
    settings.set(PACK_KEY, packId);
  }

  async setId(value) {
    const slug = slugify(value.includes('.') ? value.split('.').slice(1).join('-') : value);
    await this.#refreshMineIds();
    const id = `${this.packId}.${slug}`;
    if (id === this.doc.def.id || this.#knownIds.has(id)) {
      this.#renderPanel();
      return;
    }
    this.doc.change((def) => { def.id = id; });
  }

  rename(lang, value) {
    const def = this.doc.def;
    const oldName = def.name?.[lang] ?? '';
    // Keep following the name while the id was still generated from it.
    const followsName = lang === 'tr' && def.id === `${this.packId}.${slugify(oldName)}`;
    this.doc.change((d) => {
      d.name = { ...d.name, [lang]: value };
    });
    if (followsName && value.trim()) this.setId(value);
    this.#renderName();
  }

  // ---------- colour slots ----------

  slotColor(slot) {
    return this.doc.def.colorSlots?.[slot] ?? '#999999';
  }

  addSlot() {
    const slots = this.doc.def.colorSlots ?? {};
    let n = 1;
    while (slots[`${t('studio.colors.slotName')}${n}`]) n++;
    const name = `${t('studio.colors.slotName')}${n}`;
    const color = this.paint && !this.paint.startsWith('$') ? this.paint : '#e04f3a';
    this.doc.change((d) => {
      d.colorSlots = { ...d.colorSlots, [name]: color };
    });
    this.setPaint(`$${name}`);
  }

  // Replaces a colour reference everywhere in the art.
  #replaceColor(def, from, to) {
    for (const field of ['art', 'artFront']) {
      for (const shapes of Object.values(def[field] ?? {})) {
        for (const s of shapes) {
          for (const key of ['fill', 'stroke', 'color']) if (s[key] === from) s[key] = to;
        }
      }
    }
  }

  renameSlot(from, to) {
    to = slugify(to).replace(/-/g, '');
    const slots = this.doc.def.colorSlots ?? {};
    if (!to || to === from || slots[to]) {
      this.#renderPanel();
      return;
    }
    this.doc.change((d) => {
      d.colorSlots = Object.fromEntries(Object.entries(d.colorSlots).map(([k, v]) => [k === from ? to : k, v]));
      this.#replaceColor(d, `$${from}`, `$${to}`);
    });
    if (this.paint === `$${from}`) this.setPaint(`$${to}`);
  }

  removeSlot(name) {
    this.doc.change((d) => {
      this.#replaceColor(d, `$${name}`, d.colorSlots[name]);
      delete d.colorSlots[name];
      if (!Object.keys(d.colorSlots).length) delete d.colorSlots;
    });
    if (this.paint === `$${name}`) this.setPaint(INK);
  }

  // Picking a colour while a shape is selected repaints that shape.
  setPaint(color) {
    this.paint = color;
    const shape = this.tool === this.tools.move ? this.doc.shapes[this.selection] : null;
    if (shape) {
      this.doc.updateShape(this.selection, (s) => {
        if (s.type === 'ink') s.color = color ?? INK;
        else s.fill = color;
      });
    }
    this.#renderPalette();
  }

  // ---------- selection ----------

  select(index) {
    this.selection = index;
    this.#renderCanvasBar();
    this.editor.requestRender();
  }

  #reorderSelected(toFront) {
    const i = this.selection;
    const shapes = [...this.doc.shapes];
    const [s] = shapes.splice(i, 1);
    if (toFront) shapes.push(s);
    else shapes.unshift(s);
    this.doc.replaceShapes(shapes);
    this.select(toFront ? shapes.length - 1 : 0);
  }

  // ---------- change handling ----------

  #changed(kind) {
    this.editor.requestRender();
    if (kind === 'view') {
      this.#renderStates();
      this.#renderCanvasBar();
      if (this.tab === 'animation') this.#renderPanel();
      return;
    }
    if (this.selection >= this.doc.shapes.length) this.selection = -1;
    if (kind !== 'art') {
      this.#renderPanel();
      this.#renderStates();
      this.#renderName();
      this.#renderPalette();
    }
    this.#renderCanvasBar();
    clearTimeout(this.saveTimer);
    this.saveTimer = setTimeout(() => this.#save(), SAVE_DELAY_MS);
  }

  async #save() {
    clearTimeout(this.saveTimer);
    const def = this.doc.def;
    await storage.saveDef(JSON.parse(JSON.stringify(def)));
    if (this.savedId && this.savedId !== def.id) await storage.deleteDef(this.savedId);
    this.savedId = def.id;
    settings.set(LAST_KEY, def.id);
  }

  requestRender() {
    this.editor.requestRender();
  }

  toast(text) {
    const el = h('div', { class: 'st-toast', text });
    document.body.append(el);
    setTimeout(() => el.remove(), 3500);
  }

  // ---------- UI ----------

  #buildTools() {
    const nav = document.getElementById('tools');
    const button = (T) => {
      const b = h('button', { type: 'button', class: 'st-tool', title: t(`studio.tools.${T.id}`), 'aria-label': t(`studio.tools.${T.id}`), 'data-tool': T.id,
        onclick: () => this.setTool(T.id) });
      b.innerHTML = `<svg viewBox="0 0 48 48">${T.icon}</svg>`;
      return b;
    };
    nav.replaceChildren(...DRAW_TOOLS.map(button), h('hr'), ...AREA_TOOLS.map(button));
    this.setTool(this.tool.constructor.id);
  }

  setTool(id) {
    this.tool.cancel();
    this.tool = this.tools[id];
    if (id !== 'move') this.selection = -1;
    for (const b of document.querySelectorAll('.st-tool')) b.classList.toggle('active', b.dataset.tool === id);
    this.#renderCanvasBar();
    this.editor.requestRender();
  }

  #buildTabs() {
    const tabs = document.getElementById('tabs');
    tabs.replaceChildren(...TABS.map((tab) => h('button', { type: 'button', class: 'st-tab', 'data-tab': tab, text: t(`studio.tabs.${tab}`),
      onclick: () => {
        this.tab = tab;
        this.#renderPanel();
      } })));
  }

  #wireTopBar() {
    document.getElementById('btn-library').addEventListener('click', () => openLibrary(this));
    document.getElementById('btn-undo').addEventListener('click', () => this.doc.undo());
    document.getElementById('btn-redo').addEventListener('click', () => this.doc.redo());
    document.getElementById('btn-test').addEventListener('click', async () => {
      this.audio.unlock();
      await this.#save();
      openPreview(this);
    });
    document.getElementById('obj-name').addEventListener('change', (e) => this.rename('tr', e.target.value));
    document.addEventListener('keydown', (e) => {
      if (e.target.matches?.('input, select, textarea')) return;
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'z') {
        e.preventDefault();
        if (e.shiftKey) this.doc.redo();
        else this.doc.undo();
      }
    });
  }

  #refreshAll() {
    this.#renderName();
    this.#renderStates();
    this.#renderPanel();
    this.#renderPalette();
    this.#renderCanvasBar();
    this.editor.requestRender();
  }

  #renderName() {
    const input = document.getElementById('obj-name');
    if (document.activeElement !== input) input.value = this.doc.def.name?.tr ?? '';
  }

  #renderPanel() {
    for (const b of document.querySelectorAll('.st-tab')) b.classList.toggle('active', b.dataset.tab === this.tab);
    renderPanel(this, document.getElementById('panel'));
  }

  #renderStates() {
    const doc = this.doc;
    const tabs = doc.states.map((state) => h('button', {
      type: 'button',
      class: `st-state${state === doc.state ? ' active' : ''}`,
      text: state,
      onclick: () => doc.setState(state),
      ondblclick: () => doc.renameState(state, slugify(prompt(t('studio.states.rename'), state) ?? '').replace(/-/g, '')),
    }));
    const add = h('button', { type: 'button', class: 'st-btn st-small', text: '+', title: t('studio.states.add'), onclick: () => {
      let n = doc.states.length + 1;
      while (doc.def.art[`${t('studio.states.newName')}${n}`]) n++;
      doc.addState(`${t('studio.states.newName')}${n}`);
    } });
    const remove = doc.states.length > 1
      ? h('button', { type: 'button', class: 'st-btn st-small', text: '−', title: t('studio.states.remove'), onclick: () => doc.removeState(doc.state) })
      : null;
    document.getElementById('states').replaceChildren(...tabs, add, remove ?? '');
  }

  #renderPalette() {
    const swatch = (color, extraClass = '') => {
      const el = h('button', {
        type: 'button',
        class: `st-swatch ${extraClass}${color === this.paint ? ' active' : ''}${color === null ? ' none' : ''}`,
        title: color === null ? t('studio.colors.none') : color.startsWith('$') ? color.slice(1) : color,
        onclick: () => this.setPaint(color),
      });
      if (color) el.style.background = color.startsWith('$') ? this.slotColor(color.slice(1)) : color;
      return el;
    };
    const slots = Object.keys(this.doc.def.colorSlots ?? {}).map((name) => swatch(`$${name}`, 'slot'));
    const brush = h('label', { class: 'st-brush' }, t('studio.colors.brush'),
      h('input', { type: 'range', min: 2, max: 40, value: this.brush, oninput: (e) => { this.brush = Number(e.target.value); } }));
    document.getElementById('palette').replaceChildren(
      ...PALETTE.map((c) => swatch(c)),
      slots.length ? h('span', { class: 'st-sep' }) : '',
      ...slots,
      brush,
    );
  }

  #renderCanvasBar() {
    const doc = this.doc;
    if (!doc) return;
    if (doc.frame) {
      document.getElementById('canvas-bar').replaceChildren(...this.#frameBar());
      return;
    }
    const hasContainer = !!doc.behavior('Container');
    const items = [];
    if (hasContainer || doc.def.artFront) {
      for (const layer of ['art', 'artFront']) {
        items.push(h('button', { type: 'button', class: `st-btn st-small${doc.layer === layer ? ' st-primary' : ''}`,
          text: t(`studio.canvas.${layer === 'art' ? 'back' : 'front'}`), onclick: () => doc.setLayer(layer) }));
      }
    }
    items.push(h('label', { class: 'st-check' },
      h('input', { type: 'checkbox', checked: this.showAreas, onchange: (e) => {
        this.showAreas = e.target.checked;
        this.editor.requestRender();
      } }), t('studio.canvas.areas')));
    if (this.tool === this.tools.move && this.selection >= 0) {
      const i = this.selection;
      const parts = doc.def.parts ?? [];
      if (parts.length) {
        const current = doc.shapes[i]?.part ?? '';
        items.push(h('select', { class: 'st-input', title: t('studio.animation.part'), onchange: (e) => doc.updateShape(i, (s) => {
          if (e.target.value) s.part = e.target.value;
          else delete s.part;
        }) }, [['', t('studio.animation.body')], ...parts.map((p) => [p.id, p.id])]
          .map(([v, l]) => h('option', { value: v, text: l, selected: v === current }))));
      }
      items.push(
        h('button', { type: 'button', class: 'st-btn st-small', text: t('studio.canvas.toFront'), onclick: () => this.#reorderSelected(true) }),
        h('button', { type: 'button', class: 'st-btn st-small', text: t('studio.canvas.toBack'), onclick: () => this.#reorderSelected(false) }),
        h('button', { type: 'button', class: 'st-btn st-small', text: t('studio.canvas.duplicate'), onclick: () => {
          const copy = JSON.parse(JSON.stringify(doc.shapes[i]));
          copy.tx = (copy.tx ?? 0) + 10;
          copy.ty = (copy.ty ?? 0) + 10;
          doc.addShape(copy);
          this.select(doc.shapes.length - 1);
        } }),
        h('button', { type: 'button', class: 'st-btn st-small st-danger', text: t('studio.canvas.delete'), onclick: () => {
          doc.replaceShapes(doc.shapes.filter((_, j) => j !== i));
          this.select(-1);
        } }),
      );
    }
    document.getElementById('canvas-bar').replaceChildren(...items);
  }
}

const studio = new Studio();
window.zzStudio = studio; // for debugging from the console
studio.init().catch((err) => {
  console.error('ZzStudio failed to start:', err);
  document.body.textContent = String(err);
});
