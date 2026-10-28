// Side panel tabs of ZzStudio: general settings, colour slots, behaviours and
// reactions. Each tab is rebuilt from the definition whenever it changes.
import { t, pick } from '../shared/i18n.js';
import { CLIPS } from '../engine/animator.js';
import { PRESET_NAMES, PRESETS, WAVES, randomSynth } from '../audio/synth.js';
import { CLASS_BASES } from './doc.js';

export function h(tag, attrs = {}, ...children) {
  const el = document.createElement(tag);
  for (const [key, value] of Object.entries(attrs)) {
    if (value === undefined || value === null || value === false) continue;
    if (key === 'class') el.className = value;
    else if (key === 'text') el.textContent = value;
    else if (key.startsWith('on')) el.addEventListener(key.slice(2), value);
    else if (key === 'value' || key === 'checked') el[key] = value;
    else el.setAttribute(key, value === true ? '' : value);
  }
  el.append(...children.flat().filter((c) => c !== null && c !== undefined && c !== false));
  return el;
}

const field = (label, input) => h('label', { class: 'st-field' }, h('span', { text: label }), input);
const check = (label, checked, onchange) => h('label', { class: 'st-check' },
  h('input', { type: 'checkbox', checked, onchange: (e) => onchange(e.target.checked) }), label);
const select = (options, value, onchange, attrs = {}) => h('select', { ...attrs, onchange: (e) => onchange(e.target.value) },
  options.map(([v, label]) => h('option', { value: v, text: label, selected: v === value })));
const number = (value, onchange, attrs = {}) => h('input', { type: 'number', value, ...attrs, onchange: (e) => onchange(Number(e.target.value)) });
const hint = (text) => h('p', { class: 'st-hint', text });
const section = (text) => h('div', { class: 'st-section', text });

export const TABS = ['general', 'colors', 'behavior', 'reactions', 'animation', 'sounds'];

export function renderPanel(app, root) {
  root.replaceChildren(...PANELS[app.tab](app));
}

const PANELS = {
  general(app) {
    const { doc } = app;
    const def = doc.def;
    const [w, h_] = def.size ?? [100, 100];
    const classes = Object.keys(CLASS_BASES).map((c) => [c, t(`studio.general.classes.${c}`)]);
    const mobilities = ['default', 'free', 'edit', 'locked'].map((m) => [m, t(`studio.general.mobilities.${m}`)]);
    return [
      field(t('studio.general.nameTr'), h('input', { type: 'text', value: def.name?.tr ?? '', onchange: (e) => app.rename('tr', e.target.value) })),
      field(t('studio.general.nameEn'), h('input', { type: 'text', value: def.name?.en ?? '', onchange: (e) => app.rename('en', e.target.value) })),
      field(t('studio.general.id'), h('input', { type: 'text', value: def.id, onchange: (e) => app.setId(e.target.value) })),
      field(t('studio.general.class'), select(classes, def.class ?? 'Item', (v) => doc.change((d) => {
        d.class = v;
        d.extends = CLASS_BASES[v];
      }))),
      h('div', { class: 'st-row' },
        field(t('studio.general.width'), number(w, (v) => doc.change((d) => { d.size = [Math.max(10, v), h_]; }), { min: 10, max: 2000 })),
        field(t('studio.general.height'), number(h_, (v) => doc.change((d) => { d.size = [w, Math.max(10, v)]; }), { min: 10, max: 2000 }))),
      field(t('studio.general.mobility'), select(mobilities, def.mobility ?? 'default', (v) => doc.change((d) => {
        if (v === 'default') delete d.mobility;
        else d.mobility = v;
      }))),
    ];
  },

  colors(app) {
    const { doc } = app;
    const slots = doc.def.colorSlots ?? {};
    const rows = Object.entries(slots).map(([name, color]) => h('div', { class: 'st-slot' },
      h('input', { type: 'color', value: color, onchange: (e) => doc.change((d) => { d.colorSlots[name] = e.target.value; }) }),
      h('input', { type: 'text', class: 'st-input', value: name, onchange: (e) => app.renameSlot(name, e.target.value) }),
      h('button', { type: 'button', class: 'st-btn st-small', text: t('studio.colors.remove'), onclick: () => app.removeSlot(name) })));
    return [
      section(t('studio.colors.slots')),
      hint(t('studio.colors.hint')),
      ...rows,
      h('button', { type: 'button', class: 'st-btn', text: t('studio.colors.add'), onclick: () => app.addSlot() }),
    ];
  },

  behavior(app) {
    const { doc } = app;
    const def = doc.def;
    const stateOptions = doc.states.map((s) => [s, s]);
    const toggle = doc.behavior('Toggle');
    const container = doc.behavior('Container');
    const out = [
      check(t('studio.behavior.toggle'), !!toggle, (on) => doc.setBehavior('Toggle', on ? { states: doc.states } : null)),
      hint(t('studio.behavior.toggleHint')),
      check(t('studio.behavior.container'), !!container, (on) => doc.setBehavior('Container', on
        ? { slots: 4, rows: 1, area: [0, 0, ...(def.size ?? [100, 100])] }
        : null)),
    ];
    if (container) {
      const { type, ...config } = container;
      const set = (patch) => doc.setBehavior('Container', { ...config, ...patch });
      out.push(
        h('div', { class: 'st-row' },
          field(t('studio.behavior.slots'), number(config.slots ?? 4, (v) => set({ slots: Math.max(1, v) }), { min: 1, max: 24 })),
          field(t('studio.behavior.rows'), number(config.rows ?? 1, (v) => set({ rows: Math.max(1, v) }), { min: 1, max: 6 }))),
        field(t('studio.behavior.visibleIn'), select([['', t('studio.behavior.always')], ...stateOptions], config.visibleIn ?? '', (v) => {
          const next = { ...config };
          if (v) next.visibleIn = v;
          else delete next.visibleIn;
          doc.setBehavior('Container', next);
        })),
        hint(t('studio.behavior.areaHint')),
      );
    }

    const wrap = doc.behavior('Wrap');
    out.push(
      section(t('studio.behavior.wrap')),
      check(t('studio.behavior.wrapOn'), !!wrap, (on) => doc.setBehavior('Wrap', on ? { depth: 0.5, drape: true } : null)),
      hint(t('studio.behavior.wrapHint')),
    );
    if (wrap) {
      const { type, ...config } = wrap;
      out.push(
        field(t('studio.behavior.depth'), number(Math.round((config.depth ?? 0.5) * 100), (v) => doc.setBehavior('Wrap', { ...config, depth: Math.min(100, Math.max(5, v)) / 100 }), { min: 5, max: 100, step: 5 })),
        check(t('studio.behavior.drape'), config.drape !== false, (on) => doc.setBehavior('Wrap', { ...config, drape: on })),
      );
    }

    out.push(section(`${t('studio.behavior.surfaces')} · ${t('studio.behavior.count', { n: def.surfaces?.length ?? 0 })}`),
      hint(t('studio.behavior.surfacesHint')));
    if (def.surfaces?.length) {
      out.push(h('button', { type: 'button', class: 'st-btn st-small', text: t('studio.behavior.clear'), onclick: () => doc.change((d) => { delete d.surfaces; }) }));
    }

    out.push(section(t('studio.behavior.opening')), hint(t('studio.behavior.openingHint')));
    if (def.opening) {
      out.push(h('button', { type: 'button', class: 'st-btn st-small', text: t('studio.behavior.clear'), onclick: () => doc.change((d) => { delete d.opening; }) }));
    }

    out.push(section(t('studio.behavior.light')), hint(t('studio.behavior.lightHint')));
    if (def.light) {
      out.push(
        h('div', { class: 'st-row' },
          field(t('studio.behavior.radius'), number(def.light.r, (v) => doc.change((d) => { d.light.r = Math.max(10, v); }), { min: 10, max: 1500 })),
          field(t('studio.behavior.when'), select([['', t('studio.behavior.always')], ...stateOptions], def.light.when ?? '', (v) => doc.change((d) => {
            if (v) d.light.when = v;
            else delete d.light.when;
          })))),
        h('button', { type: 'button', class: 'st-btn st-small', text: t('studio.behavior.clear'), onclick: () => doc.change((d) => { delete d.light; }) }),
      );
    }
    return out;
  },

  reactions(app) {
    const { doc } = app;
    const reactions = doc.def.reactions ?? {};
    const events = ['tap', 'pickUp', 'drop', 'land', 'received', 'world:night', 'world:day', ...doc.states.map((s) => `stateEnter:${s}`)];
    const label = (key) => (key.startsWith('stateEnter:')
      ? t('studio.reactions.events.stateEnter', { s: key.slice('stateEnter:'.length) })
      : t(`studio.reactions.events.${key}`));
    const update = (fn) => doc.change((d) => {
      d.reactions ??= {};
      fn(d.reactions);
      if (!Object.keys(d.reactions).length) delete d.reactions;
    });

    const cards = Object.entries(reactions).map(([event, actions]) => h('div', { class: 'st-card' },
      h('div', { class: 'st-card-head' },
        h('span', { text: label(event) }),
        h('button', { type: 'button', class: 'st-btn st-small', text: t('studio.reactions.remove'), onclick: () => update((r) => { delete r[event]; }) })),
      actions.map((action, i) => actionRow(app, action, (next) => update((r) => {
        if (next) r[event][i] = next;
        else r[event].splice(i, 1);
      }))),
      h('button', { type: 'button', class: 'st-btn st-small', text: `+ ${t('studio.reactions.addAction')}`,
        onclick: () => update((r) => { r[event].push({ do: 'PlayAnim', clip: 'bounce' }); }) })));

    const free = events.filter((e) => !reactions[e]);
    let chosen = free[0];
    return [
      hint(t('studio.reactions.hint')),
      ...cards,
      free.length ? h('div', { class: 'st-row' },
        select(free.map((e) => [e, label(e)]), chosen, (v) => { chosen = v; }, { class: 'st-input' }),
        h('button', { type: 'button', class: 'st-btn', text: `+ ${t('studio.reactions.add')}`,
          onclick: () => update((r) => { r[chosen] = [{ do: 'PlayAnim', clip: 'bounce' }]; }) })) : null,
    ];
  },
};

PANELS.animation = (app) => {
  const { doc } = app;
  const def = doc.def;
  const parts = def.parts ?? [];
  const clips = def.clips ?? {};
  const partOptions = [['', t('studio.animation.whole')], ...parts.map((p) => [p.id, p.id])];
  const clipOptions = [['', t('studio.animation.none')], ...Object.keys(clips).map((c) => [c, c])];
  const out = [
    check(t('studio.animation.boil'), !!def.boil, (on) => doc.change((d) => {
      if (on) d.boil = true;
      else delete d.boil;
    })),
    hint(t('studio.animation.boilHint')),

    section(t('studio.animation.parts')),
    hint(t('studio.animation.partsHint')),
    h('div', { class: 'st-row' },
      select(partOptions.map(([v, l]) => [v, v ? l : t('studio.animation.body')]), app.part, (v) => app.setPart(v), { class: 'st-input' }),
      h('button', { type: 'button', class: 'st-btn st-small', text: `+ ${t('studio.animation.addPart')}`, onclick: () => app.addPart() })),
  ];
  if (app.part) {
    const part = parts.find((p) => p.id === app.part);
    out.push(
      field(t('studio.animation.partName'), h('input', { type: 'text', value: part.id, onchange: (e) => app.renamePart(part.id, e.target.value) })),
      hint(part.pivot ? t('studio.animation.pivotAt', { x: part.pivot[0], y: part.pivot[1] }) : t('studio.animation.noPivot')),
      h('button', { type: 'button', class: 'st-btn st-small st-danger', text: t('studio.animation.removePart'), onclick: () => app.removePart(part.id) }),
    );
  }

  out.push(section(t('studio.animation.clips')), hint(t('studio.animation.clipsHint')));
  for (const [name, clip] of Object.entries(clips)) out.push(clipCard(app, name, clip, partOptions));
  out.push(h('div', { class: 'st-row' },
    h('button', { type: 'button', class: 'st-btn st-small', text: `+ ${t('studio.animation.newKeyframe')}`, onclick: () => app.addClip('keyframe') }),
    h('button', { type: 'button', class: 'st-btn st-small', text: `+ ${t('studio.animation.newFrames')}`, onclick: () => app.addClip('frames') })));

  out.push(section(t('studio.animation.idle')), hint(t('studio.animation.idleHint')));
  for (const state of doc.states) {
    const current = typeof def.idle === 'string' ? def.idle : def.idle?.[state] ?? '';
    out.push(field(state, select(clipOptions, current, (v) => doc.change((d) => {
      const map = typeof d.idle === 'string' ? Object.fromEntries(doc.states.map((s) => [s, d.idle])) : { ...d.idle };
      if (v) map[state] = v;
      else delete map[state];
      if (Object.keys(map).length) d.idle = map;
      else delete d.idle;
    }))));
  }
  return out;
};

function clipCard(app, name, clip, partOptions) {
  const { doc } = app;
  const update = (fn) => doc.change((d) => fn(d.clips[name]));
  const head = h('div', { class: 'st-card-head' },
    h('input', { type: 'text', class: 'st-input', value: name, onchange: (e) => app.renameClip(name, e.target.value) }),
    h('button', { type: 'button', class: 'st-btn st-small st-primary', text: '▶', title: t('studio.animation.play'), onclick: () => app.play(name) }),
    h('button', { type: 'button', class: 'st-btn st-small', text: '×', title: t('studio.animation.removeClip'), onclick: () => app.removeClip(name) }));
  const loop = check(t('studio.animation.loop'), !!clip.loop, (on) => update((c) => { c.loop = on; }));

  if (clip.type === 'frames') {
    const editing = doc.frame?.clip === name;
    return h('div', { class: 'st-card' }, head,
      hint(`${t('studio.animation.framesOf', { part: clip.part || t('studio.animation.whole') })} · ${t('studio.animation.frameCount', { n: clip.frames.length })}`),
      h('div', { class: 'st-row' },
        field(t('studio.animation.fps'), number(clip.fps ?? 8, (v) => update((c) => { c.fps = Math.min(30, Math.max(1, v)); }), { min: 1, max: 30 })),
        loop),
      h('button', { type: 'button', class: `st-btn st-small${editing ? ' st-primary' : ''}`, text: editing ? t('studio.animation.doneFrames') : t('studio.animation.drawFrames'),
        onclick: () => doc.setFrame(editing ? null : { clip: name, index: 0 }) }));
  }

  const tracks = clip.tracks ?? {};
  const trackEls = Object.entries(tracks).map(([part, keys]) => h('div', { class: 'st-track' },
    h('div', { class: 'st-card-head' },
      h('span', { text: part ? `${t('studio.animation.part')}: ${part}` : t('studio.animation.whole') }),
      h('button', { type: 'button', class: 'st-btn st-small', text: '×', onclick: () => update((c) => { delete c.tracks[part]; }) })),
    h('div', { class: 'st-keys st-keys-head' }, ['keyT', 'keyRot', 'keyX', 'keyY', 'keyScale'].map((k) => h('span', { text: t(`studio.animation.${k}`) })), h('span')),
    keys.map((key, i) => {
      const num = (prop, fallback, attrs) => number(key[prop] ?? fallback, (v) => update((c) => {
        c.tracks[part][i][prop] = v;
        c.tracks[part].sort((a, b) => a.t - b.t);
      }), { step: 'any', ...attrs });
      return h('div', { class: 'st-keys' },
        num('t', 0, { min: 0, step: 0.05 }), num('rot', 0), num('x', 0), num('y', 0), num('s', 1, { step: 0.05 }),
        h('button', { type: 'button', class: 'st-btn st-small', text: '×', onclick: () => update((c) => { c.tracks[part].splice(i, 1); }) }));
    }),
    h('button', { type: 'button', class: 'st-btn st-small', text: `+ ${t('studio.animation.addKey')}`, onclick: () => update((c) => {
      const last = c.tracks[part].at(-1);
      c.tracks[part].push({ ...last, t: Math.round(((last?.t ?? 0) + 0.25) * 100) / 100 });
    }) })));

  const free = partOptions.filter(([p]) => !tracks[p]);
  let chosen = free[0]?.[0];
  return h('div', { class: 'st-card' }, head,
    h('div', { class: 'st-row' },
      field(t('studio.animation.duration'), number(clip.duration ?? 1, (v) => update((c) => { c.duration = Math.max(0.05, v); }), { min: 0.05, step: 0.05 })),
      loop),
    trackEls,
    free.length ? h('div', { class: 'st-row' },
      select(free, chosen, (v) => { chosen = v; }, { class: 'st-input' }),
      h('button', { type: 'button', class: 'st-btn st-small', text: `+ ${t('studio.animation.addTrack')}`, onclick: () => update((c) => {
        c.tracks ??= {};
        c.tracks[chosen] = [{ t: 0, rot: 0 }, { t: (c.duration ?? 1) / 2, rot: 15 }, { t: c.duration ?? 1, rot: 0 }];
      }) })) : null);
}

PANELS.sounds = (app) => {
  const { doc } = app;
  const sounds = doc.def.sounds ?? {};
  const fileInput = h('input', { type: 'file', accept: 'audio/*', hidden: true, onchange: (e) => {
    if (e.target.files[0]) app.importSound(e.target.files[0]);
  } });
  return [
    hint(t('studio.sounds.hint')),
    ...Object.entries(sounds).map(([name, sound]) => soundCard(app, name, sound)),
    h('div', { class: 'st-row st-wrap' },
      h('button', { type: 'button', class: 'st-btn st-small', text: `+ ${t('studio.sounds.synth')}`, onclick: () => app.addSound({ ...PRESETS.pop }) }),
      h('button', { type: 'button', class: `st-btn st-small${app.recorder.recording ? ' st-recording' : ''}`,
        text: app.recorder.recording ? `■ ${t('studio.sounds.stop')}` : `● ${t('studio.sounds.record')}`, onclick: () => app.toggleRecording() }),
      h('button', { type: 'button', class: 'st-btn st-small', text: t('studio.sounds.file'), onclick: () => fileInput.click() }),
      fileInput),
    hint(t('studio.sounds.privacy')),
  ];
};

function slider(label, value, { min, max, step = 'any', log = false }, onchange) {
  // log sliders (frequencies) move evenly through octaves
  const toSlider = (v) => (log ? Math.log2(v) : v);
  const fromSlider = (v) => (log ? Math.round(2 ** v) : Number(v));
  return h('label', { class: 'st-slider' }, h('span', { text: label }),
    h('input', { type: 'range', min: toSlider(min), max: toSlider(max), step, value: toSlider(value),
      onchange: (e) => onchange(fromSlider(e.target.value)) }));
}

function soundCard(app, name, sound) {
  const { doc } = app;
  const set = (patch) => {
    doc.change((d) => {
      const s = d.sounds[name];
      for (const [k, v] of Object.entries(patch)) {
        if (v === undefined || v === false) delete s[k];
        else s[k] = v;
      }
    });
    app.playSound(name);
  };
  const head = h('div', { class: 'st-card-head' },
    h('input', { type: 'text', class: 'st-input', value: name, onchange: (e) => app.renameSound(name, e.target.value) }),
    h('button', { type: 'button', class: 'st-btn st-small st-primary', text: '▶', onclick: () => app.playSound(name) }),
    h('button', { type: 'button', class: 'st-btn st-small', text: '×', onclick: () => app.removeSound(name) }));

  if (sound.type === 'sample') {
    return h('div', { class: 'st-card' }, head,
      hint(t('studio.sounds.recording')),
      slider(t('studio.sounds.pitch'), sound.pitch ?? 1, { min: 0.5, max: 2, step: 0.05 }, (v) => set({ pitch: v === 1 ? undefined : v })),
      slider(t('studio.sounds.volume'), sound.volume ?? 1, { min: 0.1, max: 1.5, step: 0.05 }, (v) => set({ volume: v })),
      check(t('studio.sounds.echo'), !!sound.echo, (on) => set({ echo: on })),
      check(t('studio.sounds.robot'), !!sound.robot, (on) => set({ robot: on })));
  }

  return h('div', { class: 'st-card' }, head,
    h('div', { class: 'st-row' },
      select([['', `${t('studio.sounds.preset')}…`], ...PRESET_NAMES.map((p) => [p, p])], '', (v) => {
        if (!v) return;
        doc.change((d) => { d.sounds[name] = { ...PRESETS[v] }; });
        app.playSound(name);
      }, { class: 'st-input', title: t('studio.sounds.preset') }),
      h('button', { type: 'button', class: 'st-btn st-small', text: t('studio.sounds.random'), onclick: () => {
        doc.change((d) => { d.sounds[name] = randomSynth(); });
        app.playSound(name);
      } })),
    field(t('studio.sounds.wave'), select(WAVES.map((w) => [w, t(`studio.sounds.waves.${w}`)]), sound.wave ?? 'sine', (v) => set({ wave: v }))),
    slider(t('studio.sounds.from'), sound.from ?? 440, { min: 40, max: 5000, step: 0.05, log: true }, (v) => set({ from: v })),
    slider(t('studio.sounds.to'), sound.to ?? sound.from ?? 440, { min: 40, max: 5000, step: 0.05, log: true }, (v) => set({ to: v })),
    slider(t('studio.sounds.length'), sound.dur ?? 0.2, { min: 0.03, max: 1.5, step: 0.01 }, (v) => set({ dur: v })),
    slider(t('studio.sounds.attack'), sound.attack ?? 0.005, { min: 0.002, max: 0.4, step: 0.002 }, (v) => set({ attack: v })),
    slider(t('studio.sounds.volume'), sound.volume ?? 0.4, { min: 0.05, max: 1, step: 0.05 }, (v) => set({ volume: v })),
    slider(t('studio.sounds.vibrato'), sound.vibrato?.depth ?? 0, { min: 0, max: 0.2, step: 0.01 }, (v) => set({ vibrato: v ? { rate: sound.vibrato?.rate ?? 10, depth: v } : undefined })),
    slider(t('studio.sounds.arp'), sound.arp?.steps ?? 1, { min: 1, max: 6, step: 1 }, (v) => set({ arp: v > 1 ? { steps: v, ratio: sound.arp?.ratio ?? 1.26 } : undefined })),
    check(t('studio.sounds.bell'), !!sound.bell, (on) => set({ bell: on })),
    check(t('studio.sounds.echo'), !!sound.echo, (on) => set({ echo: on })));
}

const ACTION_TYPES = ['PlaySound', 'PlayAnim', 'StopAnim', 'SetState', 'PlayMusic', 'StopMusic', 'Wait'];

function defaultAction(type, app) {
  switch (type) {
    case 'PlaySound': return { do: type, sound: 'pop' };
    case 'PlayAnim': return { do: type, clip: 'bounce' };
    case 'StopAnim': return { do: type, clip: Object.keys(app.doc.def.clips ?? {})[0] ?? 'bounce' };
    case 'SetState': return { do: type, toggle: app.doc.states };
    case 'Wait': return { do: type, ms: 500 };
    case 'PlayMusic': return { do: type, song: app.songs[0]?.id };
    default: return { do: type };
  }
}

function actionRow(app, action, onchange) {
  const typeSelect = select(ACTION_TYPES.map((a) => [a, t(`studio.reactions.actions.${a}`)]), action.do,
    (v) => onchange(defaultAction(v, app)));
  let param;
  switch (action.do) {
    case 'PlaySound':
      param = select([...Object.keys(app.doc.def.sounds ?? {}), ...PRESET_NAMES].map((s) => [s, s]), action.sound, (v) => {
        onchange({ ...action, sound: v });
        app.audio.unlock();
        app.audio.play(v, { sounds: app.doc.def.sounds });
      });
      break;
    case 'PlayAnim':
    case 'StopAnim': {
      const own = Object.keys(app.doc.def.clips ?? {});
      const names = action.do === 'PlayAnim' ? [...own, ...CLIPS] : own;
      param = select(names.map((c) => [c, c]), action.clip, (v) => onchange({ ...action, clip: v }));
      break;
    }
    case 'SetState': {
      const options = [['*', t('studio.reactions.toggle')], ...app.doc.states.map((s) => [s, s])];
      param = select(options, action.toggle ? '*' : action.to, (v) => onchange(v === '*'
        ? { do: 'SetState', toggle: app.doc.states }
        : { do: 'SetState', to: v }));
      break;
    }
    case 'Wait':
      param = number(action.ms ?? 500, (v) => onchange({ ...action, ms: Math.max(0, v) }), { min: 0, max: 10000, step: 100 });
      break;
    case 'PlayMusic':
      param = select(app.songs.map((s) => [s.id, pick(s.name) || s.id]), action.song, (v) => onchange({ ...action, song: v }));
      break;
    case 'StopMusic':
      param = h('span');
      break;
    default:
      param = h('span', { text: action.do });
  }
  return h('div', { class: 'st-action' }, typeSelect, param,
    h('button', { type: 'button', class: 'st-btn st-small', text: '×', onclick: () => onchange(null) }));
}
