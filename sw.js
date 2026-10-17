const CACHE = 'travel-world-offline-v50-westlake-guide';
const RELEASE_ASSETS = ['/modules/map/map-loader.js?v=29-westlake-guide', '/modules/map/map-web.js?v=16-westlake-guide', '/modules/map/west-lake-interactive-guide.js?v=1-westlake-template', '/modules/map/photo-places.css?v=11-westlake-guide', '/assets/route-photos/west-lake-selected-reference.png', '/assets/route-photos/west-lake-map-clean.png', '/assets/route-photos/west-lake-cafe-search-illustration.png'];
const ASSETS = ['/modules/vendor/supabase.js?v=1', '/oauth-callback.html', '/modules/chat/chat-web.js?v=14', '/modules/theme/ukiyoe.js?v=14', '/modules/theme/ukiyoe.css?v=12', '/modules/theme/journal-preview.js?v=14', '/modules/theme/journal-preview.css?v=14', '/modules/theme/real-photo-home.js?v=14', '/modules/theme/real-photo-home.css?v=14', '/assets/workbuddy-globe.html', '/', '/index.html', '/modules/data/landmarks.json?v=3', '/modules/data/routes.json?v=5', '/modules/data/seasonal-destinations.json?v=2', '/modules/data/place-backgrounds.json', '/modules/services/image-service.js?v=14', '/modules/auth/auth-web.js?v=14', '/modules/community/post-ui.js?v=14', '/modules/community/home-api.js?v=14', '/modules/routes/route-web.js?v=14', '/modules/routes/route-studio.js?v=14', '/modules/ai/ai-chat.js?v=14', '/modules/map/landmark-gallery.js?v=14', '/modules/map/map-loader.js?v=14', '/modules/map/map-provider.js?v=6', '/modules/map/map-web.js?v=15', '/modules/map/west-lake-guide.js?v=8', '/modules/map/photo-places.css?v=14', '/assets/route-photos/west-lake-gathered-background-portrait.png', '/modules/map/map-actions.js?v=14', '/modules/discover/discover-web.js?v=15', '/modules/community/floating-ai.js?v=14', '/modules/buddies/buddy-web.js?v=14', '/modules/profile/profile-web.js?v=14', '/modules/i18n/i18n.js?v=14', '/modules/navigation/global-back.js?v=14'];
self.addEventListener('install', event => event.waitUntil(caches.open(CACHE).then(cache => cache.addAll(ASSETS.filter(url => !url.startsWith('/modules/theme/real-photo-home.') && !url.startsWith('/modules/map/west-lake-guide.js')).concat(RELEASE_ASSETS))).then(() => self.skipWaiting())));
self.addEventListener('activate', event => event.waitUntil(Promise.all([caches.keys().then(keys => Promise.all(keys.filter(key => key !== CACHE).map(key => caches.delete(key)))), self.clients.claim()])));
self.addEventListener('fetch', event => {
  if (event.request.method !== 'GET') return;
  const isNavigation = event.request.mode === 'navigate';
  const url = new URL(event.request.url);
  // Map tiles are public, keyless and immutable for 30 days, so they belong in
  // the offline cache even though they live under /api/. Every other /api/
  // response is either authenticated or per-user and must stay out.
  const isMapTile = url.pathname.startsWith('/api/map/tiles/');
  // Authenticated responses must never enter the shared offline cache.
  if (url.pathname.startsWith('/api/') && !isMapTile) return;
  const isAppCode = url.origin === self.location.origin && (url.pathname.endsWith('.js') || url.pathname.endsWith('.css') || url.pathname === '/index.html' || url.pathname === '/');
  if (isNavigation || isAppCode) {
    event.respondWith(fetch(event.request).then(response => { const copy = response.clone(); caches.open(CACHE).then(cache => cache.put(event.request, copy)); return response; }).catch(() => caches.match(event.request).then(cached => cached || (isNavigation ? caches.match('/index.html') : Promise.reject(new Error('offline'))))));
    return;
  }
  event.respondWith(caches.match(event.request).then(cached => cached || fetch(event.request).then(response => { const copy = response.clone(); caches.open(CACHE).then(cache => cache.put(event.request, copy)); return response; })));
});
