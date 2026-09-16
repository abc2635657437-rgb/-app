const CACHE = 'travel-world-offline-v4';
const ASSETS = ['/', '/index.html', '/modules/data/landmarks.json', '/modules/data/routes.json', '/modules/auth/auth-web.js', '/modules/community/home-api.js', '/modules/ai/ai-planner.js', '/modules/map/map-web.js', '/modules/map/map-actions.js', '/modules/buddies/buddy-web.js', '/modules/profile/profile-web.js'];
self.addEventListener('install', event => event.waitUntil(caches.open(CACHE).then(cache => cache.addAll(ASSETS)).then(() => self.skipWaiting())));
self.addEventListener('activate', event => event.waitUntil(Promise.all([caches.keys().then(keys => Promise.all(keys.filter(key => key !== CACHE).map(key => caches.delete(key)))), self.clients.claim()])));
self.addEventListener('fetch', event => {
  if (event.request.method !== 'GET') return;
  const isNavigation = event.request.mode === 'navigate';
  const url = new URL(event.request.url);
  const isAppCode = url.origin === self.location.origin && (url.pathname.endsWith('.js') || url.pathname.endsWith('.css') || url.pathname === '/index.html' || url.pathname === '/');
  if (isNavigation || isAppCode) {
    event.respondWith(fetch(event.request).then(response => { const copy = response.clone(); caches.open(CACHE).then(cache => cache.put(event.request, copy)); return response; }).catch(() => caches.match(event.request).then(cached => cached || (isNavigation ? caches.match('/index.html') : Promise.reject(new Error('offline'))))));
    return;
  }
  event.respondWith(caches.match(event.request).then(cached => cached || fetch(event.request).then(response => { const copy = response.clone(); caches.open(CACHE).then(cache => cache.put(event.request, copy)); return response; })));
});
