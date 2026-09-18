const CACHE = 'travel-world-offline-v16-global-atlas-ai';
const ASSETS = ['/modules/chat/chat-web.js?v=3', '/modules/theme/ukiyoe.js?v=9', '/modules/theme/ukiyoe.css?v=9', '/assets/workbuddy-globe.html', '/', '/index.html', '/modules/data/landmarks.json', '/modules/data/routes.json?v=2', '/modules/auth/auth-web.js?v=8', '/modules/community/post-ui.js?v=1', '/modules/community/home-api.js?v=8', '/modules/routes/route-web.js?v=1', '/modules/map/landmark-gallery.js?v=2', '/modules/discover/discover-web.js?v=6', '/modules/ai/ai-planner.js?v=6', '/modules/map/map-web.js?v=6', '/modules/map/map-actions.js?v=5', '/modules/i18n/i18n.js?v=2', '/modules/navigation/global-back.js?v=1', '/modules/buddies/buddy-web.js?v=6', '/modules/profile/profile-web.js?v=8'];
self.addEventListener('install', event => event.waitUntil(caches.open(CACHE).then(cache => cache.addAll(ASSETS)).then(() => self.skipWaiting())));
self.addEventListener('activate', event => event.waitUntil(Promise.all([caches.keys().then(keys => Promise.all(keys.filter(key => key !== CACHE).map(key => caches.delete(key)))), self.clients.claim()])));
self.addEventListener('fetch', event => {
  if (event.request.method !== 'GET') return;
  const isNavigation = event.request.mode === 'navigate';
  const url = new URL(event.request.url);
  // Authenticated responses must never enter the shared offline cache.
  if (url.pathname.startsWith('/api/')) return;
  const isAppCode = url.origin === self.location.origin && (url.pathname.endsWith('.js') || url.pathname.endsWith('.css') || url.pathname === '/index.html' || url.pathname === '/');
  if (isNavigation || isAppCode) {
    event.respondWith(fetch(event.request).then(response => { const copy = response.clone(); caches.open(CACHE).then(cache => cache.put(event.request, copy)); return response; }).catch(() => caches.match(event.request).then(cached => cached || (isNavigation ? caches.match('/index.html') : Promise.reject(new Error('offline'))))));
    return;
  }
  event.respondWith(caches.match(event.request).then(cached => cached || fetch(event.request).then(response => { const copy = response.clone(); caches.open(CACHE).then(cache => cache.put(event.request, copy)); return response; })));
});
