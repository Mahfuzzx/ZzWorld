// Anonymous feedback. Only what the player chose to send goes out — plus the
// game version, the language and nothing else: no ids, no cookies, no device
// details. Feedback that can't be sent (offline) waits on the device and is
// tried again next time.
import { APP_VERSION } from './version.js';
import { getLanguage } from './i18n.js';

const ENDPOINT = new URL('../../api/feedback.php', import.meta.url);
const PENDING_KEY = 'zz.feedback.pending';
const MAX_PENDING = 10;

function pending() {
  try {
    return JSON.parse(localStorage.getItem(PENDING_KEY) ?? '[]');
  } catch {
    return [];
  }
}

function setPending(list) {
  try {
    localStorage.setItem(PENDING_KEY, JSON.stringify(list.slice(-MAX_PENDING)));
  } catch {
    // storage blocked: the feedback is simply lost
  }
}

async function post(payload) {
  const response = await fetch(ENDPOINT, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
    credentials: 'omit',
    cache: 'no-store',
    referrerPolicy: 'no-referrer',
  });
  if (!response.ok) throw new Error(`${response.status}`);
}

// payload: { kind: 'kid', mood: 1–5, tags: [...] } or { kind: 'parent', category, text }
export async function sendFeedback(payload) {
  const full = { ...payload, lang: getLanguage(), version: APP_VERSION };
  try {
    await post(full);
    return 'sent';
  } catch {
    setPending([...pending(), full]);
    return 'queued';
  }
}

// Sends what is waiting from earlier (called once at start).
export async function flushFeedback() {
  const list = pending();
  if (!list.length || !navigator.onLine) return;
  const left = [];
  for (const item of list) {
    try {
      await post(item);
    } catch {
      left.push(item);
    }
  }
  setPending(left);
}
