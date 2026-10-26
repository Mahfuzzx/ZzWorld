// "My objects" dialog: open, create, copy, delete; export and import .zzpack files.
import { t, pick } from '../shared/i18n.js';
import * as storage from '../shared/storage.js';
import { exportPack, importPack, PACK_ID_PATTERN } from '../shared/pack.js';
import { drawThumbnail } from '../shared/thumb.js';
import { h } from './panels.js';

function itemButton(def, { current, onclick, extra } = {}) {
  return h('div', { class: 'st-row' },
    h('button', { type: 'button', class: `st-item${current ? ' current' : ''}`, onclick },
      drawThumbnail(document.createElement('canvas'), def),
      h('span', { text: pick(def.name) || def.id })),
    extra);
}

function download(bytes, name) {
  const url = URL.createObjectURL(new Blob([bytes], { type: 'application/zip' }));
  const a = h('a', { href: url, download: name });
  document.body.append(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

export function openLibrary(app) {
  const dialog = document.getElementById('library');

  const render = async () => {
    const mine = (await storage.listDefs()).filter((d) => !d.kind).sort((a, b) => (pick(a.name) || a.id).localeCompare(pick(b.name) || b.id));
    // packs carry the pack's songs too
    const packDefs = (await storage.listDefs()).filter((d) => d.id.startsWith(`${app.packId}.`));

    const fileInput = h('input', {
      type: 'file',
      accept: '.zzpack,.zip',
      hidden: true,
      onchange: async (e) => {
        const file = e.target.files[0];
        if (!file) return;
        try {
          const { defs } = await importPack(new Uint8Array(await file.arrayBuffer()));
          for (const def of defs) await storage.saveDef(def);
          app.toast(t('studio.library.imported', { n: defs.length }));
        } catch (err) {
          app.toast(t('studio.library.importError', { error: err.message }));
        }
        render();
      },
    });

    const packInput = h('input', {
      type: 'text',
      value: app.packId,
      onchange: (e) => {
        const value = e.target.value.trim();
        if (PACK_ID_PATTERN.test(value) && value !== 'core') app.setPackId(value);
        else e.target.value = app.packId;
        render();
      },
    });

    const mineGrid = mine.length
      ? h('div', { class: 'st-grid' }, mine.map((def) => itemButton(def, {
        current: def.id === app.doc?.def.id,
        onclick: () => {
          app.open(def);
          dialog.close();
        },
      })))
      : h('p', { class: 'st-hint', text: t('studio.library.empty') });

    const coreGrid = h('div', { class: 'st-grid' }, app.coreIds.map((id) => itemButton(app.defs.get(id), {
      onclick: () => {
        app.copyFrom(id);
        dialog.close();
      },
    })));

    const current = app.doc?.def;
    dialog.replaceChildren(
      h('div', { class: 'st-dialog-head' },
        h('h2', { text: t('studio.library.title') }),
        h('button', { type: 'button', class: 'st-btn st-primary', text: `+ ${t('studio.library.new')}`, onclick: () => {
          app.createNew();
          dialog.close();
        } }),
        h('a', { class: 'st-btn', href: 'music/', text: t('studio.library.music') }),
        h('button', { type: 'button', class: 'st-btn', text: t('studio.library.close'), onclick: () => dialog.close() })),
      h('div', { class: 'st-dialog-body' },
        h('div', { class: 'st-row' },
          h('label', { class: 'st-field' }, h('span', { text: t('studio.library.pack') }), packInput),
          h('button', { type: 'button', class: 'st-btn', text: t('studio.library.export'), disabled: !packDefs.length,
            onclick: () => download(exportPack({
              id: app.packId,
              name: { tr: app.packId, en: app.packId },
              version: '1.0.0',
              license: 'CC-BY-4.0',
              createdWith: 'ZzStudio',
            }, packDefs), `${app.packId}.zzpack`) }),
          h('button', { type: 'button', class: 'st-btn', text: t('studio.library.import'), onclick: () => fileInput.click() }),
          fileInput),
        h('p', { class: 'st-hint', text: t('studio.library.packHint') }),
        current && mine.some((d) => d.id === current.id) ? h('div', { class: 'st-row' },
          h('button', { type: 'button', class: 'st-btn st-danger', text: `${t('studio.library.delete')}: ${pick(current.name) || current.id}`,
            onclick: async () => {
              if (!confirm(t('studio.library.confirmDelete', { name: pick(current.name) || current.id }))) return;
              await app.deleteCurrent();
              render();
            } })) : null,
        h('div', { class: 'st-section', text: t('studio.library.mine') }),
        mineGrid,
        h('div', { class: 'st-section', text: t('studio.library.core') }),
        coreGrid),
    );
  };

  render();
  if (!dialog.open) dialog.showModal();
}
