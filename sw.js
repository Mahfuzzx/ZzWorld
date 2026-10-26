// ZzWorld service worker.
// Strategy: network-first for same-origin GET requests, falling back to the cache.
// During development changes show up on a normal reload; offline the last cached
// copy is served. Bump VERSION when the precache list changes.

const VERSION = 'v5';
const CACHE = `zzworld-${VERSION}`;

const PRECACHE = [
  './',
  './index.html',
  './manifest.webmanifest',
  './src/game/catalog.js',
  './src/shared/pack.js',
  './src/shared/thumb.js',
  './src/shared/zip.js',
  './src/studio/doc.js',
  './src/studio/editor.js',
  './src/studio/library.js',
  './src/studio/main.js',
  './src/studio/panels.js',
  './src/studio/preview.js',
  './src/studio/studio.css',
  './src/studio/tools.js',
  './vendor/perfect-freehand/index.js',
  './vendor/roughjs/rough.esm.js',
  './content/core/defs/backdrops.json',
  './content/core/defs/animated.json',
  './content/core/defs/base.json',
  './content/core/defs/food.json',
  './content/core/defs/furniture.json',
  './content/core/defs/toys.json',
  './content/core/manifest.json',
  './content/core/scenes/room.json',
  './icons/apple-touch-icon.png',
  './icons/icon-192.png',
  './icons/icon-512.png',
  './icons/icon-maskable-512.png',
  './icons/icon.svg',
  './locales/en.json',
  './locales/tr.json',
  './src/audio/sfx.js',
  './src/engine/actions.js',
  './src/engine/animator.js',
  './src/engine/art.js',
  './src/engine/backdrop.js',
  './src/engine/behavior.js',
  './src/engine/behaviors.js',
  './src/engine/compose.js',
  './src/engine/daynight.js',
  './src/engine/defs.js',
  './src/engine/entity.js',
  './src/engine/index.js',
  './src/engine/input.js',
  './src/engine/registry.js',
  './src/engine/renderer.js',
  './src/engine/scene.js',
  './src/game/game.css',
  './src/game/game.js',
  './src/game/hud.js',
  './src/main.js',
  './src/shared/i18n.js',
  './src/shared/storage.js',
  './studio/',
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE)
      .then((cache) => cache.addAll(PRECACHE))
      .then(() => self.skipWaiting()),
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(
        keys.filter((key) => key.startsWith('zzworld-') && key !== CACHE)
          .map((key) => caches.delete(key)),
      ))
      .then(() => self.clients.claim()),
  );
});

self.addEventListener('fetch', (event) => {
  const { request } = event;
  if (request.method !== 'GET' || new URL(request.url).origin !== self.location.origin) return;

  event.respondWith((async () => {
    const cache = await caches.open(CACHE);
    try {
      const response = await fetch(request);
      if (response.ok) cache.put(request, response.clone());
      return response;
    } catch {
      const cached = await cache.match(request, { ignoreSearch: true });
      if (cached) return cached;
      if (request.mode === 'navigate') return cache.match('./index.html');
      throw new Error(`Offline and not cached: ${request.url}`);
    }
  })());
});
