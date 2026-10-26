import { initI18n, t } from './shared/i18n.js';

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
  const sw = await registerServiceWorker();
  status.textContent = t(`boot.sw.${sw}`);
}

main();
