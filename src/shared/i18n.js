// Minimal i18n: loads locales/<lang>.json and resolves dotted keys.
// The language will later come from the parent settings; for now the device language.

export const SUPPORTED = ['tr', 'en'];
const FALLBACK = 'en';

let current = FALLBACK;
let strings = {};

// The language chosen in the parent section wins over the device language.
export function detectLanguage() {
  try {
    const chosen = localStorage.getItem('zz.lang');
    if (SUPPORTED.includes(chosen)) return chosen;
  } catch {
    // storage blocked: fall back to the device language
  }
  for (const tag of navigator.languages ?? [navigator.language]) {
    const base = tag.toLowerCase().split('-')[0];
    if (SUPPORTED.includes(base)) return base;
  }
  return FALLBACK;
}

export async function initI18n(lang = detectLanguage()) {
  current = SUPPORTED.includes(lang) ? lang : FALLBACK;
  const url = new URL(`../../locales/${current}.json`, import.meta.url);
  strings = await (await fetch(url)).json();
  document.documentElement.lang = current;
  return current;
}

export function getLanguage() {
  return current;
}

// t('studio.library.imported', { n: 3 }) fills "{n}" placeholders.
export function t(key, vars) {
  const value = key.split('.').reduce((node, part) => node?.[part], strings);
  if (typeof value !== 'string') return key;
  return vars ? value.replace(/\{(\w+)\}/g, (m, name) => vars[name] ?? m) : value;
}

// Fills elements marked with data-i18n (text) and data-i18n-title (tooltip).
export function translatePage(root = document) {
  for (const el of root.querySelectorAll('[data-i18n]')) el.textContent = t(el.dataset.i18n);
  for (const el of root.querySelectorAll('[data-i18n-title]')) {
    el.title = t(el.dataset.i18nTitle);
    el.setAttribute('aria-label', el.title);
  }
}

// Picks the right language from an object definition field like { tr: "…", en: "…" }.
export function pick(localized) {
  if (typeof localized === 'string') return localized;
  return localized?.[current] ?? localized?.[FALLBACK] ?? '';
}
