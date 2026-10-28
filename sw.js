// ZzWorld service worker.
// Strategy: network-first for same-origin GET requests, falling back to the cache.
// Every request asks the server whether the file changed ("no-cache"), so an
// installed app never runs old code because of the browser's HTTP cache (some
// hosts send week-long max-age headers). Unchanged files cost a short 304.
// Offline the last cached copy is served. Bump VERSION on every release.

const VERSION = 'v0.7.3';
const CACHE = `zzworld-${VERSION}`;

const PRECACHE = [
  './',
  './index.html',
  './manifest.webmanifest',
  './src/game/catalog.js',
  './src/game/creator.js',
  './src/game/feedback-kid.js',
  './src/game/parent.js',
  './src/shared/pack.js',
  './src/shared/thumb.js',
  './src/shared/zip.js',
  './src/studio/doc.js',
  './src/studio/editor.js',
  './src/studio/library.js',
  './src/studio/main.js',
  './src/studio/music-main.js',
  './src/studio/music.css',
  './src/studio/recorder.js',
  './src/studio/panels.js',
  './src/studio/preview.js',
  './src/studio/studio.css',
  './src/studio/tools.js',
  './vendor/perfect-freehand/index.js',
  './vendor/roughjs/rough.esm.js',
  './content/core/defs/backdrops.json',
  './content/core/defs/animated.json',
  './content/core/defs/base.json',
  './content/core/defs/characters.json',
  './content/core/defs/music.json',
  './content/core/defs/songs.json',
  './content/core/defs/food.json',
  './content/core/defs/furniture.json',
  './content/core/defs/house.json',
  './content/core/defs/toys.json',
  './content/core/manifest.json',
  './content/core/scenes/room.json',
  './content/core/scenes/bedroom.json',
  './content/core/scenes/bathroom.json',
  './icons/apple-touch-icon.png',
  './icons/icon-192.png',
  './icons/icon-512.png',
  './icons/icon-maskable-512.png',
  './icons/icon.svg',
  './locales/en.json',
  './locales/tr.json',
  './src/audio/engine.js',
  './src/audio/instruments.js',
  './src/audio/music.js',
  './src/audio/synth.js',
  './src/audio/theory.js',
  './src/audio/wav.js',
  './src/engine/actions.js',
  './src/engine/animator.js',
  './src/engine/art.js',
  './src/engine/backdrop.js',
  './src/engine/behavior.js',
  './src/engine/behaviors.js',
  './src/engine/character.js',
  './src/engine/compose.js',
  './src/engine/daynight.js',
  './src/engine/defs.js',
  './src/engine/entity.js',
  './src/engine/index.js',
  './src/engine/input.js',
  './src/engine/registry.js',
  './src/engine/renderer.js',
  './src/engine/scene.js',
  './src/engine/warp.js',
  './src/game/game.css',
  './src/game/game.js',
  './src/game/hud.js',
  './src/main.js',
  './src/shared/feedback.js',
  './src/shared/i18n.js',
  './src/shared/storage.js',
  './src/shared/version.js',
  './studio/',
  './studio/music/',
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE)
      .then((cache) => cache.addAll(PRECACHE.map((url) => new Request(url, { cache: 'reload' }))))
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
  const url = new URL(request.url);
  if (request.method !== 'GET' || url.origin !== self.location.origin) return;
  // the server parts (feedback, its admin page) are never cached
  if (url.pathname.includes('/api/')) return;

  event.respondWith((async () => {
    const cache = await caches.open(CACHE);
    try {
      const response = await fetch(request, { cache: 'no-cache' });
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
