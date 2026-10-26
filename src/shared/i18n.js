// Minimal i18n: loads locales/<lang>.json and resolves dotted keys.
// The language will later come from the parent settings; for now the device language.

export const SUPPORTED = ['tr', 'en'];
const FALLBACK = 'en';

let current = FALLBACK;
let strings = {};

export function detectLanguage() {
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

export function t(key) {
  const value = key.split('.').reduce((node, part) => node?.[part], strings);
  return typeof value === 'string' ? value : key;
}

// Picks the right language from an object definition field like { tr: "…", en: "…" }.
export function pick(localized) {
  if (typeof localized === 'string') return localized;
  return localized?.[current] ?? localized?.[FALLBACK] ?? '';
}
