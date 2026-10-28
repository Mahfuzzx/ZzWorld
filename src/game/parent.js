// Parent gate and parent section. The gate asks a sum in words ("seven plus
// five?"), answered with digit keys — easy for a reading adult, not for a small
// child. Behind it: feedback with free text, language, privacy information.
import { t, getLanguage } from '../shared/i18n.js';
import { sendFeedback } from '../shared/feedback.js';
import { APP_VERSION } from '../shared/version.js';

const MAX_TRIES = 3;
const REPO_URL = 'https://github.com/Mahfuzzx/ZzWorld';
export const LANG_KEY = 'zz.lang';

function el(tag, className, props = {}, ...children) {
  const e = document.createElement(tag);
  if (className) e.className = className;
  for (const [k, v] of Object.entries(props)) {
    if (k.startsWith('on')) e.addEventListener(k.slice(2), v);
    else if (k === 'text') e.textContent = v;
    else e.setAttribute(k, v);
  }
  e.append(...children.filter(Boolean));
  return e;
}

export function openParentGate({ root, onPass }) {
  const words = t('parent.numbers').split(',');
  const a = 2 + Math.floor(Math.random() * 8);
  const b = 2 + Math.floor(Math.random() * 8);
  let answer = '';
  let tries = 0;

  const display = el('div', 'gate-answer', { 'aria-live': 'polite' });
  const question = el('p', 'gate-question', { text: t('parent.gate.question', { a: words[a], b: words[b] }) });
  const close = () => overlay.remove();
  const check = () => {
    if (Number(answer) === a + b) {
      close();
      onPass();
      return;
    }
    tries++;
    answer = '';
    display.textContent = '';
    display.classList.add('wrong');
    setTimeout(() => display.classList.remove('wrong'), 400);
    if (tries >= MAX_TRIES) close();
  };
  const key = (label, onclick, cls = '') => el('button', `gate-key ${cls}`, { type: 'button', text: label, onclick });
  const keys = el('div', 'gate-keys', {},
    ...[1, 2, 3, 4, 5, 6, 7, 8, 9].map((n) => key(String(n), () => {
      if (answer.length < 2) answer += n;
      display.textContent = answer;
    })),
    key('⌫', () => {
      answer = answer.slice(0, -1);
      display.textContent = answer;
    }, 'gate-back'),
    key('0', () => {
      if (answer.length < 2) answer += '0';
      display.textContent = answer;
    }),
    key('✓', check, 'gate-ok'));

  const overlay = el('div', 'gate',
    {},
    el('div', 'gate-box', {},
      el('button', 'gate-close', { type: 'button', text: '×', 'aria-label': t('parent.close'), onclick: close }),
      el('h2', '', { text: t('parent.gate.title') }),
      question,
      display,
      keys));
  root.append(overlay);
}

export function openParentPanel({ root }) {
  const status = el('p', 'parent-status', { 'aria-live': 'polite' });
  const category = el('select', 'parent-input', {},
    ...['idea', 'bug', 'other'].map((c) => el('option', '', { value: c, text: t(`parent.feedback.categories.${c}`) })));
  const text = el('textarea', 'parent-input', { maxlength: '1000', rows: '5', placeholder: t('parent.feedback.placeholder') });
  const send = el('button', 'parent-btn primary', {
    type: 'button',
    text: t('parent.feedback.send'),
    onclick: async () => {
      const value = text.value.trim();
      if (!value) {
        status.textContent = t('parent.feedback.empty');
        return;
      }
      send.disabled = true;
      const result = await sendFeedback({ kind: 'parent', category: category.value, text: value });
      status.textContent = t(result === 'sent' ? 'parent.feedback.sent' : 'parent.feedback.queued');
      if (result === 'sent') text.value = '';
      send.disabled = false;
    },
  });

  const language = el('select', 'parent-input', {
    onchange: (e) => {
      try {
        localStorage.setItem(LANG_KEY, e.target.value);
      } catch {
        // not remembered in private mode
      }
      location.reload();
    },
  }, ...[['tr', 'Türkçe'], ['en', 'English']].map(([v, label]) => {
    const o = el('option', '', { value: v, text: label });
    if (v === getLanguage()) o.selected = true;
    return o;
  }));

  const close = () => overlay.remove();
  const overlay = el('div', 'parent',
    {},
    el('div', 'parent-box', {},
      el('div', 'parent-head', {},
        el('h2', '', { text: t('parent.title') }),
        el('button', 'parent-btn', { type: 'button', text: t('parent.close'), onclick: close })),
      el('section', '', {},
        el('h3', '', { text: t('parent.feedback.title') }),
        el('p', 'parent-note', { text: t('parent.feedback.note') }),
        category, text, send, status),
      el('section', '', {},
        el('h3', '', { text: t('parent.language') }),
        language),
      el('section', '', {},
        el('h3', '', { text: t('parent.privacy.title') }),
        ...t('parent.privacy.text').split('\n').map((line) => el('p', 'parent-note', { text: line })),
        el('p', 'parent-note', {},
          el('a', '', { href: REPO_URL, target: '_blank', rel: 'noopener noreferrer', text: t('parent.source') }),
          document.createTextNode(` · ${t('parent.version')} ${APP_VERSION}`)))));
  root.append(overlay);
}
