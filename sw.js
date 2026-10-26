// ZzWorld service worker.
// Strategy: network-first for same-origin GET requests, falling back to the cache.
// During development changes show up on a normal reload; offline the last cached
// copy is served. Bump VERSION when the precache list changes.

const VERSION = 'v3';
const CACHE = `zzworld-${VERSION}`;

const PRECACHE = [
  './',
  './index.html',
  './manifest.webmanifest',
  './src/main.js',
  './src/shared/i18n.js',
  './src/shared/storage.js',
  './src/game/game.css',
  './src/game/game.js',
  './src/engine/index.js',
  './src/engine/registry.js',
  './src/engine/defs.js',
  './src/engine/entity.js',
  './src/engine/behavior.js',
  './src/engine/behaviors.js',
  './src/engine/actions.js',
  './src/engine/scene.js',
  './src/engine/animator.js',
  './src/engine/art.js',
  './src/engine/renderer.js',
  './src/engine/input.js',
  './src/engine/backdrop.js',
  './src/engine/daynight.js',
  './src/game/hud.js',
  './src/audio/sfx.js',
  './content/core/manifest.json',
  './content/core/defs/base.json',
  './content/core/defs/food.json',
  './content/core/defs/toys.json',
  './content/core/defs/furniture.json',
  './content/core/defs/backdrops.json',
  './content/core/scenes/room.json',
  './locales/tr.json',
  './locales/en.json',
  './icons/icon.svg',
  './icons/icon-192.png',
  './icons/icon-512.png',
  './icons/apple-touch-icon.png',
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
