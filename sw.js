const CACHE = 'travel-world-offline-v104-wherenow-photos';
const ASSETS = ['/modules/vendor/supabase.js?v=1', '/oauth-callback.html', '/modules/chat/chat-web.js?v=14', '/modules/theme/ukiyoe.js?v=15-journal-only', '/modules/theme/ukiyoe.css?v=12', '/modules/theme/journal-preview.js?v=17-photo-cards', '/modules/theme/journal-preview.css?v=16-photo-cards', '/assets/workbuddy-globe.html', '/', '/index.html', '/modules/data/landmarks.json?v=3', '/modules/data/routes.json?v=5', '/modules/data/seasonal-destinations.json?v=2', '/modules/data/place-backgrounds.json', '/modules/services/image-service.js?v=14', '/modules/auth/auth-web.js?v=14', '/modules/community/post-ui.js?v=14', '/modules/community/home-api.js?v=14', '/modules/routes/route-web.js?v=14', '/modules/routes/route-studio.js?v=15-publish-entry', '/modules/ai/ai-voice.js?v=1', '/modules/ai/ai-chat.js?v=17-travel-desk', '/modules/map/landmark-gallery.js?v=14', '/modules/map/map-loader.js?v=28-westlake-interactive-v2', '/modules/map/map-provider.js?v=7', '/modules/map/map-web.js?v=28-westlake-interactive-v2', '/modules/map/west-lake-interactive-guide.js?v=3-westlake-interactive', '/modules/map/selected-city-guide.js?v=11-westlake-interactive-v1', '/modules/map/photo-places.css?v=19-westlake-interactive-v2', '/assets/route-photos/west-lake-gathered-background.png', '/modules/map/map-actions.js?v=16', '/modules/discover/discover-web.js?v=17-photo-cards', '/modules/community/floating-ai.js?v=14', '/modules/buddies/buddy-web.js?v=14', '/modules/profile/profile-web.js?v=14', '/modules/i18n/i18n.js?v=15-noop-lang-guard', '/modules/navigation/global-back.js?v=14'];
const EXTRA_ASSETS = ['/modules/map/map-loader.js?v=28-westlake-interactive-v2', '/modules/map/map-web.js?v=28-westlake-interactive-v2', '/modules/map/west-lake-interactive-guide.js?v=3-westlake-interactive', '/modules/map/selected-city-guide.js?v=11-westlake-interactive-v1', '/modules/map/photo-places.css?v=19-westlake-interactive-v2', '/assets/route-photos/west-lake-gathered-background.png', '/assets/route-photos/west-lake-gathered-background-portrait.png', '/assets/route-photos/page-bg-west-lake-mobile.png'];
EXTRA_ASSETS.push('/modules/map/west-lake-interactive-guide.js?v=4-westlake-interactive');
EXTRA_ASSETS.push('/modules/map/map-loader.js?v=32-global-category-icons', '/modules/map/map-web.js?v=32-global-category-icons', '/modules/map/west-lake-interactive-guide.js?v=8-shared-guide-icons', '/modules/map/selected-city-guide.js?v=11-westlake-interactive-v1', '/modules/map/global-landmark-guide.js?v=20261018-global-21-ai-images', '/modules/map/photo-places.css?v=30-global-category-icons', '/modules/data/global-landmark-guide-catalog.json?v=20261018-verified-2', '/modules/data/global-landmark-guide-assets.json?v=20261018-local-2', '/modules/data/global-landmark-guide-images.json?v=20261018-expanded-2', '/modules/data/global-guide-section-images.json?v=20261018-sections-1', '/assets/route-photos/coma-pedrosa-ai-guide.png');
EXTRA_ASSETS.push('/modules/data/global-guide-generated-images.json?v=20261019-category-slots-24');
EXTRA_ASSETS.push('/modules/data/global-guide-section-images.json?v=20261019-sections-6');
self.addEventListener('install', event => event.waitUntil(caches.open(CACHE).then(cache => cache.addAll([...ASSETS, ...EXTRA_ASSETS])).then(() => self.skipWaiting())));
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
  const isGuideData = url.origin === self.location.origin && url.pathname.startsWith('/modules/data/global-') && url.pathname.endsWith('.json');
  if (isNavigation || isAppCode || isGuideData) {
    event.respondWith(fetch(event.request).then(response => { if (response.ok) { const copy = response.clone(); caches.open(CACHE).then(cache => cache.put(event.request, copy)); } return response; }).catch(() => caches.match(event.request).then(cached => cached || (isNavigation ? caches.match('/index.html') : Promise.reject(new Error('offline'))))));
    return;
  }
  event.respondWith(caches.match(event.request).then(cached => cached?.ok ? cached : fetch(event.request).then(response => { if (response.ok) { const copy = response.clone(); caches.open(CACHE).then(cache => cache.put(event.request, copy)); } return response; })));
});
