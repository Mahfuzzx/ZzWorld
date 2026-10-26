import { initI18n, t } from './shared/i18n.js';
import { startGame } from './game/game.js';

async function registerServiceWorker() {
  if (!('serviceWorker' in navigator)) return 'unsupported';
  if (!window.isSecureContext) return 'insecure';
  try {
    await navigator.serviceWorker.register('./sw.js', { scope: './' });
    return 'ok';
  } catch (err) {
    console.error('Service worker registration failed:', err);
    return 'failed';
  }
}

async function main() {
  await initI18n();

  const status = document.getElementById('status');
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
