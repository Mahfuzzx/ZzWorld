// Side panel tabs of ZzStudio: general settings, colour slots, behaviours and
// reactions. Each tab is rebuilt from the definition whenever it changes.
import { t } from '../shared/i18n.js';
import { CLIPS } from '../engine/animator.js';
import { SOUND_NAMES } from '../audio/sfx.js';
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

export const TABS = ['general', 'colors', 'behavior', 'reactions'];

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

const ACTION_TYPES = ['PlaySound', 'PlayAnim', 'SetState', 'Wait'];

function defaultAction(type, app) {
  switch (type) {
    case 'PlaySound': return { do: type, sound: 'pop' };
    case 'PlayAnim': return { do: type, clip: 'bounce' };
    case 'SetState': return { do: type, toggle: app.doc.states };
    case 'Wait': return { do: type, ms: 500 };
    default: return { do: type };
  }
}

function actionRow(app, action, onchange) {
  const typeSelect = select(ACTION_TYPES.map((a) => [a, t(`studio.reactions.actions.${a}`)]), action.do,
    (v) => onchange(defaultAction(v, app)));
  let param;
  switch (action.do) {
    case 'PlaySound':
      param = select(SOUND_NAMES.map((s) => [s, s]), action.sound, (v) => {
        onchange({ ...action, sound: v });
        app.audio.unlock();
        app.audio.play(v);
      });
      break;
    case 'PlayAnim':
      param = select(CLIPS.map((c) => [c, c]), action.clip, (v) => onchange({ ...action, clip: v }));
      break;
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
    default:
      param = h('span', { text: action.do });
  }
  return h('div', { class: 'st-action' }, typeSelect, param,
    h('button', { type: 'button', class: 'st-btn st-small', text: '×', onclick: () => onchange(null) }));
}
