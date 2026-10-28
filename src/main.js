import { initI18n, t } from './shared/i18n.js';
import { startGame } from './game/game.js';

async function registerServiceWorker() {
  if (!('serviceWorker' in navigator)) return 'unsupported';
  if (!window.isSecureContext) return 'insecure';
  try {
    // updateViaCache 'none': looking for a new version always asks the server
    const registration = await navigator.serviceWorker.register('./sw.js', { scope: './', updateViaCache: 'none' });
    // An installed app may stay open (or asleep) for days: look for a new
    // version whenever it comes back to the screen.
    document.addEventListener('visibilitychange', () => {
      if (document.visibilityState === 'visible') registration.update().catch(() => {});
    });
    return 'ok';
  } catch (err) {
    console.error('Service worker registration failed:', err);
    return 'failed';
  }
}

// When a new version takes over, reload once so the new code runs. Not on the
// very first install (nothing old is running then). The world is saved first.
function reloadOnUpdate() {
  if (!('serviceWorker' in navigator) || !navigator.serviceWorker.controller) return;
  let reloading = false;
  navigator.serviceWorker.addEventListener('controllerchange', async () => {
    if (reloading) return;
    reloading = true;
    try {
      await window.zz?.save?.();
    } finally {
      location.reload();
    }
  });
}

async function main() {
  await initI18n();

  const status = document.getElementById('status');
  reloadOnUpdate();
  registerServiceWorker().then((sw) => {
    if (sw !== 'ok') console.warn(t(`boot.sw.${sw}`));
  });

  try {
    // Exposed for debugging from the browser console.
    window.zz = await startGame(document.getElementById('app'));
  } catch (err) {
    console.error('Game failed to start:', err);
    status.textContent = t('boot.error');
  }
}

main();
