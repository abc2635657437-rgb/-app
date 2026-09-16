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
  const status = text => { const el = document.getElementById('mapStatus'); if (el) el.textContent = text; };
  async function loadData() {
    const key = 'tw-map-cache-v2';
    try {
      const cached = localStorage.getItem(key);
      if (cached) return JSON.parse(cached);
      const response = await fetch('modules/data/landmarks.json', { cache: 'no-cache' });
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
    data.landmarks.forEach((item) => {
      const pin = document.createElement('button');
      pin.className = 'map-pin';
      // Equirectangular projection keeps the offline pins geographically meaningful.
      const left = Math.max(3, Math.min(94, ((Number(item.longitude) + 180) / 360) * 100));
      const top = Math.max(6, Math.min(88, ((90 - Number(item.latitude)) / 180) * 100));
      pin.style.left = left + '%';
      pin.style.top = top + '%';
      pin.innerHTML = item.icon + '<small>' + item.name + '</small>';
      pin.onclick = () => openLandmark(item.id);
      canvas.appendChild(pin);
    });
  }
  function renderMarkers() {
    if (!map || !data) return;
    clearMarkers();
    data.landmarks.forEach(item => {
      const icon = L.divIcon({ className: 'tw-q-pin', html: '<div class="tw-q-pin__body"><span class="tw-q-pin__icon">' + item.icon + '</span><span class="tw-q-pin__label">' + item.name + '</span></div>', iconSize: [36, 36], iconAnchor: [18, 18] });
      const marker = L.marker([item.latitude, item.longitude], { icon, title: item.name }).addTo(map).bindPopup('<strong>' + item.icon + ' ' + item.name + '</strong><br>' + item.country + ' · ' + item.city + '<br><button onclick="window.openMapLandmark(\'' + item.id + '\')">查看详情</button>');
      markers.push(marker);
    });
  }
  async function initMap() {
    const canvas = document.getElementById('mapCanvas');
    if (!canvas) return;
    try {
      data = await loadData();
      if (!window.L) { renderFallback(); status('离线地图 · 使用已缓存地标数据；联网后可启用拖动、缩放和搜索。'); return; }
      if (!map) map = L.map(canvas, { zoomControl: true, worldCopyJump: true }).setView([25, 105], 2);
      if (!map._twTileLayer) { map._twTileLayer = L.tileLayer(TravelMapProviders.get().tile, { attribution: TravelMapProviders.get().attribution, maxZoom: 19 }).addTo(map); }
      renderMarkers();
      setTimeout(() => map.invalidateSize(), 0);
      loadOnlineUsers();
      clearInterval(onlineRefreshTimer);
      onlineRefreshTimer = setInterval(loadOnlineUsers, 30_000);
      status('在线地图 · 已加载 ' + data.landmarks.length + ' 个地标；地图数据支持本地缓存。');
      const savedRoute = JSON.parse(localStorage.getItem('tw-map-route') || '[]');
      if (savedRoute.length > 1) setTimeout(() => window.showTravelRoute(savedRoute), 80);
    } catch (error) { status('地图数据加载失败：' + error.message); }
  }
  function openLandmark(id) {
    const item = (data && data.landmarks || []).find(entry => entry.id === id);
    if (!item) return;
    if (map) map.setView([item.latitude, item.longitude], 11);
    if (window.showLandmark) window.showLandmark(item);
    status('已定位：' + item.name + ' · ' + item.city + '，可点击地标查看详情。');
  }
  async function searchPlace(providedQuery) {
    const input = document.getElementById('mapSearch');
    const raw = String(providedQuery || (input && input.value) || '').trim();
    const query = raw.toLowerCase();
    if (!query) return status('请输入城市或景点名称。');
    if (input && providedQuery) input.value = raw;
    const item = (data && data.landmarks || []).find(entry => [entry.name, entry.city, entry.country].some(value => value.toLowerCase().includes(query)));
    if (item) return openLandmark(item.id);
    try {
      status('正在在线搜索“' + raw + '”…');
      const response = await fetch('/api/map/search?q=' + encodeURIComponent(raw));
      if (!response.ok) throw new Error('search ' + response.status);
      const payload = await response.json(); const results = payload.results || [];
      if (!results.length) return status('没有找到“' + raw + '”。');
      const result = results[0], lat = Number(result.latitude), lon = Number(result.longitude);
      map.setView([lat, lon], 13);
      const icon = L.divIcon({ className: 'tw-q-pin', html: '<div class="tw-q-pin__body"><span class="tw-q-pin__icon">📍</span><span class="tw-q-pin__label">' + raw.replace(/[<>]/g, '') + '</span></div>', iconSize: [36, 36], iconAnchor: [18, 18] });
      const marker = L.marker([lat, lon], { icon }).addTo(map).bindPopup(result.displayName).openPopup(); markers.push(marker);
      status('在线地图已定位：' + result.displayName);
    } catch (_) { status('在线搜索暂时不可用；仍可浏览已缓存的 ' + (data?.landmarks?.length || 0) + ' 个地标。'); }
  }
  function locateUser() { if (!navigator.geolocation) return status('当前设备不支持定位，仍可搜索和浏览地图。'); status('正在获取当前位置…'); navigator.geolocation.getCurrentPosition(position => { const point = [position.coords.latitude, position.coords.longitude]; lastPosition = position; if (map) { map.setView(point, 14); if (userMarker) userMarker.remove(); const icon = L.divIcon({ className: 'tw-user-pin', html: '<div class="tw-user-pin__arrow">➤</div><div class="tw-user-pin__pulse"></div>', iconSize: [34, 34], iconAnchor: [17, 17] }); userMarker = L.marker(point, { icon, title: '我的位置', zIndexOffset: 1000 }).addTo(map).bindPopup('<strong>我的位置</strong><br>定位精度约 ' + Math.round(position.coords.accuracy || 0) + ' 米').openPopup(); } if (document.getElementById('mapShareLocation')?.checked) publishPresence(); status('已定位到当前位置；位置仅在本次页面使用。'); }, error => { const reason = error.code === 1 ? '未获得定位权限' : '暂时无法获取位置'; status(reason + '，仍可搜索地点和浏览地图。'); }, { enableHighAccuracy: true, timeout: 12000, maximumAge: 60000 }); }
  async function publishPresence(force = false) { const auth = window.TravelWorldAuth; if (!auth?.requireLogin()) return; if (!lastPosition) return locateUser(); if (!force && Date.now() - lastPresenceAt < 80_000) return; try { const latitude = lastPosition.coords.latitude, longitude = lastPosition.coords.longitude; const place = await fetch('/api/map/reverse?latitude=' + encodeURIComponent(latitude) + '&longitude=' + encodeURIComponent(longitude)).then(response => response.ok ? response.json() : ({})).catch(() => ({})); await auth.request('/api/map/presence', { method: 'POST', body: JSON.stringify({ latitude, longitude, country: place.country || '', city: place.city || '', sharing_enabled: true }) }); lastPresenceAt = Date.now(); status('位置共享已开启' + (place.country ? ' · ' + place.country : '') + '，其他在线用户可看到你的 Q 版标识。'); } catch (error) { document.getElementById('mapShareLocation').checked = false; status('位置共享未开启：' + error.message); } }
  async function toggleSharing(enabled) { const auth = window.TravelWorldAuth; if (!enabled) { if (presenceWatchId !== null) navigator.geolocation.clearWatch(presenceWatchId); clearInterval(presenceTimer); presenceWatchId = null; presenceTimer = null; try { if (auth?.session()) await auth.request('/api/map/presence', { method: 'DELETE' }); clearOnlineMarkers(); status('位置共享已关闭，其他用户将立即看不到你。'); } catch (error) { status('关闭共享失败：' + error.message); } return; } if (!navigator.geolocation) return status('当前设备不支持定位。'); locateUser(); presenceWatchId = navigator.geolocation.watchPosition(position => { lastPosition = position; publishPresence(); }, () => {}, { enableHighAccuracy: true, maximumAge: 60_000, timeout: 15_000 }); clearInterval(presenceTimer); presenceTimer = setInterval(() => publishPresence(true), 120_000); }
  async function openOnlineUser(userId) { const auth = window.TravelWorldAuth; if (!auth?.requireLogin()) return; try { const result = await auth.request('/api/direct-chats/' + encodeURIComponent(userId), { method: 'POST' }); const text = prompt('给 ' + (result.user?.display_name || result.user?.username || '旅行者') + ' 发送私聊消息（取消可稍后发送）'); if (!text?.trim()) return status('私聊已建立，可在旅友页面继续聊天。'); await auth.request('/api/chats/' + result.chatId + '/messages', { method: 'POST', body: JSON.stringify({ content: text.trim() }) }); status('私聊消息已发送，可在旅友页面继续聊天。'); if (window.go) window.go('friends'); } catch (error) { status('无法发起私聊：' + error.message); } }
  async function followOnlineUser(userId) { const auth = window.TravelWorldAuth; if (!auth?.requireLogin()) return; try { const result = await auth.request('/api/community/users/' + encodeURIComponent(userId) + '/follow', { method: 'POST' }); status(result.following ? '已关注该旅行者。' : '已取消关注。'); } catch (error) { status('关注操作失败：' + error.message); } }
  async function loadOnlineUsers() { try { const country = document.getElementById('mapOnlineCountry')?.value.trim() || ''; const response = await fetch('/api/map/online-users' + (country ? '?country=' + encodeURIComponent(country) : '')); const payload = await response.json(); if (!response.ok) throw new Error(payload.error || '无法读取在线用户'); if (!map || !window.L) return; clearOnlineMarkers(); payload.users.forEach(entry => { const profile = entry.profiles || {}; const name = String(profile.display_name || profile.username || '旅行者').replace(/[<>'"]/g, ''); const place = String(entry.city || entry.country || '公开位置').replace(/[<>'"]/g, ''); const bio = String(profile.bio || '这位旅行者还没有填写简介').replace(/[<>'"]/g, ''); const avatar = String(profile.avatar_url || '').replace(/[<>'"]/g, ''); const id = String(profile.id || '').replace(/[^a-zA-Z0-9-]/g, ''); const icon = L.divIcon({ className: 'tw-q-pin', html: '<div class="tw-q-pin__body"><span class="tw-q-pin__icon">🧭</span><span class="tw-q-pin__label">' + name + '</span></div>', iconSize: [36, 36], iconAnchor: [18, 18] }); const card = (avatar ? '<img src="' + avatar + '" alt="" style="width:42px;height:42px;border-radius:50%;object-fit:cover">' : '') + '<strong>' + name + '</strong><br><small>' + place + '</small><p style="margin:6px 0">' + bio + '</p><button onclick="window.followMapUser(\'' + id + '\')">关注/取消关注</button> <button onclick="window.openMapDirectChat(\'' + id + '\')">私聊</button>'; onlineMarkers.push(L.marker([entry.latitude, entry.longitude], { icon, title: name }).addTo(map).bindPopup(card)); }); status((country ? country + ' · ' : '') + '已显示 ' + payload.users.length + ' 位主动共享位置的在线用户；点击 Q 版标识可互动。'); } catch (error) { status('在线用户暂时不可用：' + error.message); } }
  window.initTravelMap = initMap;
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
    if (coords.length < 2) return status('路线至少需要两个有效地点。');
    if (routeLayer) routeLayer.remove();
    routeMarkers.forEach(marker => marker.remove()); routeMarkers = [];
    let routeCoords = coords, routeDetail = '';
    try {
      const response = await fetch('/api/map/route', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ points }) });
      if (!response.ok) throw new Error('route ' + response.status);
      const result = await response.json();
      routeCoords = (result.geometry?.coordinates || []).map(coord => [Number(coord[1]), Number(coord[0])]).filter(coord => coord.every(Number.isFinite));
      routeDetail = ' · 约 ' + (result.distanceMeters / 1000).toFixed(1) + ' km / ' + Math.max(1, Math.round(result.durationSeconds / 60)) + ' 分钟';
    } catch (_) { routeDetail = ' · 道路服务不可用，当前显示地点连线'; }
    routeLayer = L.polyline(routeCoords.length > 1 ? routeCoords : coords, { color: '#d17d57', weight: 5, opacity: .85, dashArray: routeDetail.includes('地点连线') ? '9 7' : null }).addTo(map);
    points.forEach((point, index) => {
      const coord = coords[index]; if (!coord) return;
      const label = String(index + 1);
      const icon = L.divIcon({ className: 'tw-route-pin', html: '<div class="tw-route-pin__body">' + label + '</div>', iconSize: [28, 28], iconAnchor: [14, 14] });
      const title = point.name ? '<strong>' + String(point.name).replace(/[<>]/g, '') + '</strong><br>' : '';
      const detail = point.day ? 'Day ' + Number(point.day) + (point.time ? ' · ' + String(point.time).replace(/[<>]/g, '') : '') : '';
      routeMarkers.push(L.marker(coord, { icon }).addTo(map).bindPopup(title + detail));
    });
    map.fitBounds(routeLayer.getBounds(), { padding: [30, 30] });
    status('已在地图显示旅行路线，共 ' + coords.length + ' 个地点' + routeDetail + '。');
  };
}());
