/* Ilm Ki Dunya PWA. Bump VERSION whenever the app shell changes. */
const VERSION = 'v2-20261125';
const PREFIX = 'ilm-ki-dunya-';
const CACHE = PREFIX + VERSION;
const PDF_CACHE = PREFIX + 'pdf-' + VERSION;
const BASE = new URL('./', self.location.href);
const local = path => new URL(path, BASE).href;
const SHELL = ['./', 'index.html', 'offline.html', 'style.css', 'site.js', 'homepage.js', 'manifest.webmanifest', 'icon-192.png', 'icon-512.png', 'icon-maskable-512.png'];
self.addEventListener('install', event => {
  event.waitUntil(caches.open(CACHE).then(cache => cache.addAll(SHELL.map(path => new Request(local(path), {cache:'reload'})))).then(() => self.skipWaiting()));
});
self.addEventListener('activate', event => {
  event.waitUntil(caches.keys().then(keys => Promise.all(keys.filter(key =>
    (key.startsWith(PREFIX) && key !== CACHE && key !== PDF_CACHE) || key === 'ilm-offline-v1'
  ).map(key => caches.delete(key)))).then(() => self.clients.claim()));
});
async function store(name, request, response, limit) {
  if (!response || response.status !== 200 || response.type === 'opaque') return;
  const cache = await caches.open(name);
  await cache.put(request, response.clone());
  if (limit) { const keys = await cache.keys(); while (keys.length > limit) await cache.delete(keys.shift()); }
}
async function page(request) {
  const cache = await caches.open(CACHE);
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 5000);
  try {
    const response = await fetch(request, {signal:controller.signal});
    if (response.status >= 500) throw new Error('Server unavailable');
    try { await store(CACHE, request, response); } catch (_) {}
    return response;
  } catch (_) {
    return await cache.match(request, {ignoreSearch:true}) || await cache.match(local('offline.html'));
  } finally { clearTimeout(timer); }
}
async function asset(request) {
  const cache = await caches.open(CACHE);
  const saved = await cache.match(request);
  if (saved) return saved;
  try {
    const response = await fetch(request);
    try { await store(CACHE, request, response); } catch (_) {}
    return response;
  } catch (error) {
    const fallback = await cache.match(request, {ignoreSearch:true});
    if (fallback) return fallback;
    throw error;
  }
}
async function pdf(request) {
  // Never prefetch PDFs. Only complete, user-requested files up to 8 MB;
  // keep at most five. Partial/range responses pass through unchanged.
  if (request.headers.has('range')) return fetch(request);
  try {
    const response = await fetch(request);
    if (response.status >= 500) throw new Error('Server unavailable');
    const size = Number(response.headers.get('content-length'));
    if (size > 0 && size <= 8 * 1024 * 1024) {
      try { await store(PDF_CACHE, request, response, 5); } catch (_) {}
    }
    return response;
  } catch (_) {
    return await caches.match(request) || new Response('Yeh PDF offline save nahin hui. Internet se jud kar dobara kholein.', {status:503,headers:{'Content-Type':'text/plain; charset=utf-8'}});
  }
}
self.addEventListener('fetch', event => {
  const request = event.request;
  const url = new URL(request.url);
  if (request.method !== 'GET' || url.origin !== BASE.origin || !url.pathname.startsWith(BASE.pathname)) return;
  if (/\.pdf$/i.test(url.pathname)) { event.respondWith(pdf(request)); return; }
  if (request.mode === 'navigate' || /\.html$/i.test(url.pathname)) { event.respondWith(page(request)); return; }
  if (/\.(?:css|js|png|jpe?g|svg|webp|gif|ico|webmanifest)$/i.test(url.pathname)) event.respondWith(asset(request));
});
