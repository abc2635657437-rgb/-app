const CACHE = 'travel-world-offline-v3';
const ASSETS = ['/', '/index.html', '/modules/data/landmarks.json', '/modules/data/routes.json', '/modules/auth/auth-web.js', '/modules/community/home-api.js', '/modules/ai/ai-planner.js', '/modules/map/map-web.js', '/modules/map/map-actions.js', '/modules/buddies/buddy-web.js', '/modules/profile/profile-web.js'];
self.addEventListener('install', event => event.waitUntil(caches.open(CACHE).then(cache => cache.addAll(ASSETS)).then(() => self.skipWaiting())));
self.addEventListener('activate', event => event.waitUntil(Promise.all([caches.keys().then(keys => Promise.all(keys.filter(key => key !== CACHE).map(key => caches.delete(key)))), self.clients.claim()])));
self.addEventListener('fetch', event => {
  if (event.request.method !== 'GET') return;
  const isNavigation = event.request.mode === 'navigate';
  if (isNavigation) {
    event.respondWith(fetch(event.request).then(response => { const copy = response.clone(); caches.open(CACHE).then(cache => cache.put('/index.html', copy)); return response; }).catch(() => caches.match('/index.html')));
    return;
  }
  event.respondWith(caches.match(event.request).then(cached => cached || fetch(event.request).then(response => { const copy = response.clone(); caches.open(CACHE).then(cache => cache.put(event.request, copy)); return response; })));
});
