(function () {
  let map;
  let markers = [];
  let routeLayer;
  let routeMarkers = [];
  let userMarker;
  let onlineMarkers = [];
  let lastPosition;
  let presenceWatchId = null;
  let presenceTimer = null;
  let onlineRefreshTimer = null;
  let lastPresenceAt = 0;
  let data;
  const coarse=matchMedia('(pointer:coarse)').matches;
  const langText=(zh,en)=>window.TravelWorldI18n?.language?.()==='en'?en:zh;
  const localized=item=>{if(window.TravelWorldI18n?.language?.()!=='en')return item;const result={...item};['name','description','country','city','bestSeason','duration','nearby','food','stay','transport','tags'].forEach(key=>{if(item[key+'_en'])result[key]=item[key+'_en'];});return result;};
  const status = text => { const el = document.getElementById('mapStatus'); if (el) el.textContent = text; };
  async function loadData() {
    const key = 'tw-map-cache-v5';
    try {
      const cached = localStorage.getItem(key);
      if (cached) return JSON.parse(cached);
      const response = await fetch('modules/data/landmarks.json?v=3', { cache: 'no-cache' });
      if (!response.ok) throw new Error('landmark data ' + response.status);
      const value = await response.json();
      localStorage.setItem(key, JSON.stringify(value));
      return value;
    } catch (error) {
      const cached = localStorage.getItem(key);
      if (cached) return JSON.parse(cached);
      throw error;
    }
  }
  function clearMarkers() { markers.forEach(marker => marker.remove()); markers = []; }
  function clearOnlineMarkers() { onlineMarkers.forEach(marker => marker.remove()); onlineMarkers = []; }
  function renderFallback() {
    const canvas = document.getElementById('mapCanvas');
    if (!canvas || !data) return;
    canvas.classList.add('map-fallback');
    canvas.querySelectorAll('.map-pin').forEach(pin => pin.remove());
    data.landmarks.forEach((source) => {const item=localized(source);
      const pin = document.createElement('button');
      pin.className = 'map-pin';
      // Equirectangular projection keeps the offline pins geographically meaningful.
      const left = Math.max(3, Math.min(94, ((Number(item.longitude) + 180) / 360) * 100));
      const top = Math.max(6, Math.min(88, ((90 - Number(item.latitude)) / 180) * 100));
      pin.style.left = left + '%';
      pin.style.top = top + '%';
      pin.innerHTML = item.icon + '<small>' + item.name + '</small>';
      pin.onclick = () => openLandmark(source.id);
      canvas.appendChild(pin);
    });
  }
  function renderMarkers() {
    if (!map || !data) return;
    clearMarkers();
    data.landmarks.forEach(source => {const item=localized(source);
      const icon = L.divIcon({ className: 'tw-q-pin', html: '<div class="tw-q-pin__body"><span class="tw-q-pin__icon">' + item.icon + '</span><span class="tw-q-pin__label">' + item.name + '</span></div>', iconSize: [30, 30], iconAnchor: [15, 15] });
      const marker = L.marker([source.latitude, source.longitude], { icon, title: item.name, zIndexOffset: 200 }).addTo(map).bindPopup('<strong>' + source.icon + ' ' + item.name + '</strong><br>' + item.country + ' · ' + item.city + '<br><button onclick="window.openMapLandmark(\'' + source.id + '\')">' + langText('查看详情','View details') + '</button>');
      markers.push(marker);
    });
  }
  function updateMarkerDensity() { document.getElementById('mapCanvas')?.classList.toggle('map-compact-labels', Boolean(map && map.getZoom() < 5)); }
  async function initMap() {
    const canvas = document.getElementById('mapCanvas');
    if (!canvas) return;
    if (canvas.offsetParent === null) return;
    try {
      data = await loadData();
      if (!window.L) { renderFallback(); status(langText('离线地图 · 使用已缓存地标数据；联网后可启用拖动、缩放和搜索。','Offline map · Showing cached landmarks. Reconnect to pan, zoom and search.')); return; }
      if (!map) { map = L.map(canvas, { zoomControl: true, worldCopyJump: true,dragging:!coarse,touchZoom:!coarse,scrollWheelZoom:!coarse,doubleClickZoom:!coarse,boxZoom:!coarse }).setView([25, 105], 2); map.on('zoomend', updateMarkerDensity); }
      if (!map._twTileLayer) { map._twTileLayer = L.tileLayer(TravelMapProviders.get().tile, { attribution: TravelMapProviders.get().attribution, maxZoom: 19 }).addTo(map); }
      renderMarkers();
      updateMarkerDensity();
      setTimeout(() => map.invalidateSize(), 0);
      loadOnlineUsers();
      clearInterval(onlineRefreshTimer);
      onlineRefreshTimer = setInterval(loadOnlineUsers, 30_000);
      status(langText('在线地图 · 已加载 ','Online map · Loaded ') + data.landmarks.length + langText(' 个地标；地图数据支持本地缓存。',' landmarks. Map data is cached locally.'));
      const savedRoute = JSON.parse(localStorage.getItem('tw-map-route') || '[]');
      if (savedRoute.length > 1) setTimeout(() => window.showTravelRoute(savedRoute), 80);
    } catch (error) { status(langText('地图数据加载失败：','Failed to load map data: ') + error.message); }
  }
  async function openLandmark(id) {
    const source = (data && data.landmarks || []).find(entry => entry.id === id);
    if (!source) return;const item=localized(source);
    if (map) map.setView([source.latitude, source.longitude], 11);
    if (window.showLandmark) window.showLandmark(source);
    status(langText('正在加载 ','Loading ') + item.name + langText(' 的热门实景图片…',' photos…'));
    try {
      const response = await fetch('/api/map/place-photos?q=' + encodeURIComponent(source.imageQuery || item.name + ' ' + item.city));
      const payload = await response.json();
      if (response.ok && window.showLandmark) window.showLandmark({ ...source, photos: payload.photos || [] });
      status(langText('已打开：','Opened: ') + item.name + ' · ' + item.city + langText('。','.'));
    } catch (_) { status(langText('已打开：','Opened: ') + item.name + langText('。','.')); }
  }
  async function searchPlace(providedQuery) {
    const input = document.getElementById('mapSearch');
    const raw = String(providedQuery || (input && input.value) || '').trim();
    const query = raw.toLowerCase();
    if (!query) return status(langText('请输入城市或景点名称。','Enter a city or landmark name.'));
    if (input && providedQuery) input.value = raw;
    const item = (data && data.landmarks || []).find(entry => [entry.name,entry.name_en,entry.city,entry.city_en,entry.country,entry.country_en].filter(Boolean).some(value => value.toLowerCase().includes(query)));
    if (item) return openLandmark(item.id);
    try {
      status(langText('正在在线搜索“','Searching online for “') + raw + '”…');
      const response = await fetch('/api/map/search?q=' + encodeURIComponent(raw));
      if (!response.ok) throw new Error('search ' + response.status);
      const payload = await response.json(); const results = payload.results || [];
      if (!results.length) return status(langText('没有找到“','No results found for “') + raw + '”.');
      const result = results[0], lat = Number(result.latitude), lon = Number(result.longitude);
      map.setView([lat, lon], 13);
      const icon = L.divIcon({ className: 'tw-q-pin', html: '<div class="tw-q-pin__body"><span class="tw-q-pin__icon">📍</span><span class="tw-q-pin__label">' + raw.replace(/[<>]/g, '') + '</span></div>', iconSize: [36, 36], iconAnchor: [18, 18] });
      const marker = L.marker([lat, lon], { icon }).addTo(map).bindPopup(result.displayName).openPopup(); markers.push(marker);
      status(langText('在线地图已定位：','Located on the map: ') + result.displayName);
    } catch (_) { status(langText('在线搜索暂时不可用；仍可浏览已缓存的 ','Online search is temporarily unavailable. You can still browse ') + (data?.landmarks?.length || 0) + langText(' 个地标。',' cached landmarks.')); }
  }
  function locateUser() { if (!navigator.geolocation) return status(langText('当前设备不支持定位，仍可搜索和浏览地图。','This device does not support location. You can still search and browse the map.')); status(langText('正在获取当前位置…','Getting your location…')); navigator.geolocation.getCurrentPosition(position => { const point = [position.coords.latitude, position.coords.longitude]; lastPosition = position; if (map) { map.setView(point, 14); if (userMarker) userMarker.remove(); const icon = L.divIcon({ className: 'tw-user-pin', html: '<div class="tw-user-pin__arrow">➤</div><div class="tw-user-pin__pulse"></div>', iconSize: [34, 34], iconAnchor: [17, 17] }); const myLocation=langText('我的位置','My location'); userMarker = L.marker(point, { icon, title: myLocation, zIndexOffset: 1000 }).addTo(map).bindPopup('<strong>'+myLocation+'</strong><br>'+langText('定位精度约 ','Accuracy about ')+Math.round(position.coords.accuracy || 0)+langText(' 米',' m')).openPopup(); } if (document.getElementById('mapShareLocation')?.checked) publishPresence(); status(langText('已定位到当前位置；位置仅在本次页面使用。','Location found. It is used only on this page.')); }, error => { const reason = error.code === 1 ? langText('未获得定位权限','Location permission was not granted') : langText('暂时无法获取位置','Location is temporarily unavailable'); status(reason + langText('，仍可搜索地点和浏览地图。','. You can still search and browse the map.')); }, { enableHighAccuracy: true, timeout: 12000, maximumAge: 60000 }); }
  async function publishPresence(force = false) { const auth = window.TravelWorldAuth; if (!auth?.requireLogin()) return; if (!lastPosition) return locateUser(); if (!force && Date.now() - lastPresenceAt < 80_000) return; try { const latitude = lastPosition.coords.latitude, longitude = lastPosition.coords.longitude; const place = await fetch('/api/map/reverse?latitude=' + encodeURIComponent(latitude) + '&longitude=' + encodeURIComponent(longitude)).then(response => response.ok ? response.json() : ({})).catch(() => ({})); await auth.request('/api/map/presence', { method: 'POST', body: JSON.stringify({ latitude, longitude, country: place.country || '', city: place.city || '', sharing_enabled: true }) }); lastPresenceAt = Date.now(); status(langText('位置共享已开启','Location sharing is on') + (place.country ? ' · ' + place.country : '') + langText('，其他在线用户可看到你的 Q 版标识。','. Other online users can see your illustrated marker.')); } catch (error) { document.getElementById('mapShareLocation').checked = false; status(langText('位置共享未开启：','Location sharing could not be enabled: ') + error.message); } }
  async function toggleSharing(enabled) { const auth = window.TravelWorldAuth; if (!enabled) { if (presenceWatchId !== null) navigator.geolocation.clearWatch(presenceWatchId); clearInterval(presenceTimer); presenceWatchId = null; presenceTimer = null; try { if (auth?.session()) await auth.request('/api/map/presence', { method: 'DELETE' }); clearOnlineMarkers(); status(langText('位置共享已关闭，其他用户将立即看不到你。','Location sharing is off. Other users can no longer see you.')); } catch (error) { status(langText('关闭共享失败：','Failed to turn off sharing: ') + error.message); } return; } if (!navigator.geolocation) return status(langText('当前设备不支持定位。','This device does not support location.')); locateUser(); presenceWatchId = navigator.geolocation.watchPosition(position => { lastPosition = position; publishPresence(); }, () => {}, { enableHighAccuracy: true, maximumAge: 60_000, timeout: 15_000 }); clearInterval(presenceTimer); presenceTimer = setInterval(() => publishPresence(true), 120_000); }
  async function openOnlineUser(userId) { return window.openTravelUser(userId); }
  async function followOnlineUser(userId) { const auth = window.TravelWorldAuth; if (!auth?.requireLogin()) return; try { const result = await auth.request('/api/community/users/' + encodeURIComponent(userId) + '/follow', { method: 'POST' }); status(result.following ? langText('已关注该旅行者。','Traveler followed.') : langText('已取消关注。','Traveler unfollowed.')); } catch (error) { status(langText('关注操作失败，请重试','Could not update follow status. Try again.')); } }
  async function loadOnlineUsers() { try { const country = document.getElementById('mapOnlineCountry')?.value.trim() || ''; const response = await fetch('/api/map/online-users' + (country ? '?country=' + encodeURIComponent(country) : '')); const payload = await response.json(); if (!response.ok) throw new Error(payload.error || langText('无法读取在线用户','Unable to load online users')); if (!map || !window.L) return; clearOnlineMarkers(); payload.users.forEach(entry => { const profile = entry.profiles || {}; const name = String(profile.display_name || profile.username || langText('旅行者','Traveler')).replace(/[<>'"]/g, ''); const place = String(entry.city || entry.country || langText('公开位置','Shared location')).replace(/[<>'"]/g, ''); const bio = String(profile.bio || langText('这位旅行者还没有填写简介','This traveler has not added a bio yet.')).replace(/[<>'"]/g, ''); const avatar = String(profile.avatar_url || '').replace(/[<>'"]/g, ''); const id = String(profile.id || '').replace(/[^a-zA-Z0-9-]/g, ''); const icon = L.divIcon({ className: 'tw-q-pin tw-online-pin', html: '<div class="tw-q-pin__body"><span class="tw-q-pin__icon">🧭</span><span class="tw-q-pin__label">' + name + '</span></div>', iconSize: [36, 36], iconAnchor: [18, 18] }); const card = (avatar ? '<img src="' + avatar + '" alt="" style="width:42px;height:42px;border-radius:50%;object-fit:cover">' : '') + '<strong>' + name + '</strong><br><small>' + place + '</small><p style="margin:6px 0">' + bio + '</p><button onclick="window.followMapUser(\'' + id + '\')">'+langText('关注/取消关注','Follow / unfollow')+'</button> <button onclick="window.openMapDirectChat(\'' + id + '\')">'+langText('私聊','Message')+'</button>'; onlineMarkers.push(L.marker([entry.latitude, entry.longitude], { icon, title: name, zIndexOffset: 2000 }).addTo(map).bindPopup(card)); }); status((country ? country + ' · ' : '') + langText('已显示 ','Showing ') + payload.users.length + langText(' 位主动共享位置的在线用户；点击 Q 版标识可互动。',' online users who chose to share their location. Select a marker to connect.')); } catch (error) { status(langText('在线用户暂时不可用：','Online users are temporarily unavailable: ') + error.message); } }
  window.initTravelMap = initMap;
  window.activateTravelMap=()=>{if(!map)return;['dragging','touchZoom','scrollWheelZoom','doubleClickZoom','boxZoom','keyboard'].forEach(name=>map[name]?.enable());status(langText('地图交互已开启；现在可以拖动、缩放和点击地标。','Map interaction is active. You can now pan, zoom and open markers.'));};
  window.refreshTravelMapLocale=()=>{if(!data)return;renderMarkers();if(document.getElementById('landmarkDetailOverlay')&&window.currentMapLandmark)window.showLandmark(window.currentMapLandmark);};
  window.searchTravelMap = searchPlace;
  window.locateTravelMap = locateUser;
  window.toggleMapLocationSharing = toggleSharing;
  window.loadMapOnlineUsers = loadOnlineUsers;
  window.openMapDirectChat = openOnlineUser;
  window.followMapUser = followOnlineUser;
  window.openMapLandmark = openLandmark;
  window.showTravelRoute = async function (points) {
    if (!map || !Array.isArray(points)) return;
    const coords = points.map(point => Array.isArray(point) ? point : [point.latitude, point.longitude]).filter(point => point.length === 2 && point.every(Number.isFinite));
    if (coords.length < 2) return status(langText('路线至少需要两个有效地点。','A route needs at least two valid places.'));
    if (routeLayer) routeLayer.remove();
    routeMarkers.forEach(marker => marker.remove()); routeMarkers = [];
    let routeCoords = coords, routeDetail = '';
    try {
      const response = await fetch('/api/map/route', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ points }) });
      if (!response.ok) throw new Error('route ' + response.status);
      const result = await response.json();
      routeCoords = (result.geometry?.coordinates || []).map(coord => [Number(coord[1]), Number(coord[0])]).filter(coord => coord.every(Number.isFinite));
      routeDetail = langText(' · 约 ',' · About ') + (result.distanceMeters / 1000).toFixed(1) + ' km / ' + Math.max(1, Math.round(result.durationSeconds / 60)) + langText(' 分钟',' min');
    } catch (_) { routeDetail = langText(' · 道路服务不可用，当前显示地点连线',' · Routing is unavailable; showing straight lines between places'); }
    routeLayer = L.polyline(routeCoords.length > 1 ? routeCoords : coords, { color: '#d17d57', weight: 5, opacity: .85, dashArray: routeCoords.length > 1 ? null : '9 7' }).addTo(map);
    points.forEach((point, index) => {
      const coord = coords[index]; if (!coord) return;
      const label = String(index + 1);
      const icon = L.divIcon({ className: 'tw-route-pin', html: '<div class="tw-route-pin__body">' + label + '</div>', iconSize: [28, 28], iconAnchor: [14, 14] });
      const title = point.name ? '<strong>' + String(point.name).replace(/[<>]/g, '') + '</strong><br>' : '';
      const detail = point.day ? 'Day ' + Number(point.day) + (point.time ? ' · ' + String(point.time).replace(/[<>]/g, '') : '') : '';
      routeMarkers.push(L.marker(coord, { icon }).addTo(map).bindPopup(title + detail));
    });
    map.fitBounds(routeLayer.getBounds(), { padding: [30, 30] });
    status(langText('已在地图显示旅行路线，共 ','Route shown on the map with ') + coords.length + langText(' 个地点',' places') + routeDetail + langText('。','.'));
  };
}());
