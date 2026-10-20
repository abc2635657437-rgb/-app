(function () {
  const photoStyles=document.createElement('link');photoStyles.rel='stylesheet';photoStyles.href='modules/map/photo-places.css?v=31-map-search-results';document.head.append(photoStyles);
  let map;
  let markers = [];
  let routeLayer;
  let routeMarkers = [];
  let focusedPlaceMarker;
  let userMarker;
  let onlineMarkers = [];
  let onlineUsers = [];
  let nearbyPlaces=[],nearbyMarkers=[],placeTimer,placeRequest=0,placeController=null;
  let searchSequence=0,searchController=null,searchMarkers=[];
  const backgroundData=fetch('/modules/data/place-backgrounds.json?v=4').then(r=>r.ok?r.json():{}).then(d=>d.backgrounds||{}).catch(()=>({}));
  const placePhotos=new Map();
  let photoRequest=0;
  const clusterModule = import('./cluster-points.js');
  let lastPosition;
  let presenceWatchId = null;
  let presenceTimer = null;
  let onlineRefreshTimer = null;
  let lastPresenceAt = 0;
  let data;
  const coarse=matchMedia('(pointer:coarse)').matches;
  const langText=(zh,en)=>window.TravelWorldI18n?.language?.()==='en'?en:zh;
  const localized=item=>{if(window.TravelWorldI18n?.language?.()!=='en')return item;const result={...item};['name','description','country','city','bestSeason','duration','nearby','food','stay','transport','tags'].forEach(key=>{if(item[key+'_en'])result[key]=item[key+'_en'];});return result;};
  const toneOf=place=>{const c=String(place?.category||'').toLowerCase();if(/(hist|fort|monument|archae|ruin|castle|temple|church|mosque|palace|cathedral|memorial)/.test(c))return 'history';if(/(nature|lake|mountain|park|island|waterfall|glacier|reef|valley|cave|desert|forest|river|sea)/.test(c))return 'nature';if(/(city|tower|bridge|building|square|market|stadium|museum)/.test(c))return 'city';return 'other';};
  const status = text => { const el = document.getElementById('mapStatus'); if (el) el.textContent = text; };
  function searchResultsRegion() {
    let region = document.getElementById('mapSearchResults');
    if (region) return region;
    region = document.createElement('section');
    region.id = 'mapSearchResults';
    region.className = 'map-search-results';
    region.setAttribute('aria-live', 'polite');
    region.setAttribute('aria-label', langText('地点搜索结果', 'Place search results'));
    region.hidden = true;
    document.getElementById('mapStatus')?.after(region);
    return region;
  }
  function clearSearchMarkers() { searchMarkers.forEach(marker => marker.remove()); searchMarkers = []; }
  function normalizePlaceName(value) { return String(value || '').normalize('NFKC').toLocaleLowerCase().replace(/[^\p{L}\p{N}]/gu, ''); }
  function distanceKm(a, b) {
    const rad = value => value * Math.PI / 180;
    const dLat = rad(Number(b.latitude) - Number(a.latitude));
    const dLon = rad(Number(b.longitude) - Number(a.longitude));
    const x = Math.sin(dLat / 2) ** 2 + Math.cos(rad(Number(a.latitude))) * Math.cos(rad(Number(b.latitude))) * Math.sin(dLon / 2) ** 2;
    return 6371 * 2 * Math.atan2(Math.sqrt(x), Math.sqrt(1 - x));
  }
  function showSearchResults(query, entries, options = {}) {
    const region = searchResultsRegion();
    region.replaceChildren();
    region.hidden = false;
    const heading = document.createElement('strong');
    heading.textContent = options.title || langText('地点目录结果', 'Place catalogue results');
    const summary = document.createElement('p');
    summary.textContent = options.summary || '';
    region.append(heading, summary);
    const list = document.createElement('div');
    list.className = 'map-search-result-list';
    entries.forEach(entry => {
      const row = document.createElement('article');
      const details = document.createElement('div');
      const name = document.createElement('b');
      const placeName = langText(entry.name, entry.name_en || entry.name);
      name.textContent = placeName;
      const meta = document.createElement('small');
      const distance = options.center ? Math.round(distanceKm(options.center, entry)) + ' km' : '';
      meta.textContent = [langText(entry.city, entry.city_en || entry.city), entry.country || entry.countryCode, entry.category || entry.kind, distance].filter(Boolean).join(' · ');
      details.append(name, meta);
      const placeSource = entry.sourceUrl || entry.source_url;
      if (placeSource) {
        const source = document.createElement('a');
        source.href = placeSource; source.target = '_blank'; source.rel = 'noopener noreferrer';
        source.textContent = langText('地点来源', 'Place source');
        details.append(source);
      }
      const actions = document.createElement('div');
      actions.className = 'map-search-result-actions';
      const locate = document.createElement('button');
      locate.type = 'button';
      locate.textContent = langText('地图定位', 'Locate on map');
      locate.onclick = () => {
        if (!map) return;
        clearSearchMarkers();
        const point = twp(entry);
        const popup = document.createElement('div');
        const popupName = document.createElement('strong');
        popupName.textContent = placeName;
        popup.append(popupName);
        const sourceUrl = entry.sourceUrl || entry.source_url;
        if (sourceUrl) {
          const source = document.createElement('a');
          source.href = sourceUrl; source.target = '_blank'; source.rel = 'noopener noreferrer';
          source.textContent = langText('查看地点来源', 'View place source');
          popup.append(document.createElement('br'), source);
        }
        const marker = L.marker(point, { title: placeName }).addTo(map).bindPopup(popup);
        searchMarkers.push(marker);
        map.setView(point, Math.max(14, map.getZoom()));
        marker.openPopup();
      };
      actions.append(locate);
      const hasInAppDetails = entry.id && (entry.globalCatalog === true || (data?.curated || []).some(item => item.id === entry.id));
      if (hasInAppDetails) {
        const detail = document.createElement('button');
        detail.type = 'button';
        detail.textContent = langText('站内详情', 'Details');
        detail.onclick = () => openLandmark(entry.id);
        actions.append(detail);
      }
      row.append(details, actions);
      list.append(row);
    });
    if (entries.length) region.append(list);
    if (options.action) region.append(options.action);
  }
  function matchingCatalogEntries(raw) {
    if (!data) return [];
    const query = normalizePlaceName(raw);
    const all = [...(data.curated || []), ...(data.landmarks || [])];
    const seen = new Set();
    return all.filter(entry => {
      const key = entry.id || entry.globalId || entry.wikidataId;
      if (!key || seen.has(key)) return false;
      const values = [entry.name, entry.name_en, entry.city, entry.city_en].filter(Boolean).map(normalizePlaceName);
      if (!values.some(value => value.includes(query))) return false;
      seen.add(key);
      return true;
    }).sort((a, b) => Number((data.curated || []).some(item => item.id === b.id)) - Number((data.curated || []).some(item => item.id === a.id))).slice(0, 24);
  }
  async function showDirectoryNear(center, raw, radiusKm, sequence, controller) {
    const latDelta = radiusKm / 111;
    const lonDelta = Math.min(180, radiusKm / (111 * Math.max(.15, Math.cos(Number(center.latitude) * Math.PI / 180))));
    const bounds = [Number(center.latitude) - latDelta, Number(center.longitude) - lonDelta, Number(center.latitude) + latDelta, Number(center.longitude) + lonDelta];
    const response = await fetch('/api/map/places?bbox=' + bounds.map(value => value.toFixed(4)).join(','), { signal: controller.signal });
    if (!response.ok) throw new Error('directory ' + response.status);
    const payload = await response.json();
    if (sequence !== searchSequence) return;
    const sourced = (payload.places || []).filter(place => distanceKm(center, place) <= radiusKm).sort((a, b) => distanceKm(center, a) - distanceKm(center, b));
    const curated = (data?.curated || []).filter(place => distanceKm(center, place) <= radiusKm);
    const byId = new Map();
    [...curated, ...sourced].forEach(place => { if (place.id && !byId.has(place.id)) byId.set(place.id, place); });
    const places = [...byId.values()].slice(0, 30);
    if (places.length) {
      showSearchResults(raw, places, {
        title: langText('景点目录 · ' + places.length + ' 个地点', 'Attraction catalogue · ' + places.length + ' places'),
        summary: langText('地图已定位到“' + raw + '”。目录结果在约 ' + radiusKm + ' 公里范围内；地名定位与景点目录是两项独立数据。', 'Map located “' + raw + '”. Catalogue results are within about ' + radiusKm + ' km; geocoding and attraction listings are separate data sources.'),
        center
      });
      return;
    }
    const summary = document.createElement('p');
    summary.textContent = langText('已定位“' + raw + '”，但当前景点目录在约 ' + radiusKm + ' 公里内没有收录地点。这不代表当地没有景点。', '“' + raw + '” was located, but the current attraction catalogue has no entries within about ' + radiusKm + ' km. This does not mean the area has no attractions.');
    const expand = document.createElement('button');
    expand.type = 'button';
    expand.textContent = langText('扩大到 ' + (radiusKm * 2) + ' 公里重试', 'Expand to ' + (radiusKm * 2) + ' km and retry');
    expand.onclick = () => searchPlace(raw, radiusKm * 2, center);
    showSearchResults(raw, [], { title: langText('已找到地名，目录暂缺', 'Place located; catalogue coverage is limited'), summary, action: expand });
  }
  function showSearchError(raw, sequence, controller, timedOut) {
    return error => {
      if (sequence !== searchSequence || (controller.signal.aborted && !timedOut)) return;
      const retry = document.createElement('button');
      retry.type = 'button'; retry.textContent = langText('重试搜索', 'Retry search');
      retry.onclick = () => searchPlace(raw);
      showSearchResults(raw, [], { title: langText('搜索暂时不可用', 'Search temporarily unavailable'), summary: timedOut ? langText('搜索超时，请重试。', 'Search timed out. Please retry.') : langText('城市或地点搜索请求失败；不会把请求失败显示成“没有景点”。请检查网络后重试。', 'The place or catalogue request failed. This is not being shown as “no attractions.” Check the network and retry.'), action: retry });
    };
  }
  // The catalogue is WGS-84; the active basemap may not be. Re-project here.
  const tw = (pair) => (window.TravelMapProviders ? window.TravelMapProviders.focusLatLng(pair[0], pair[1]) : pair);
  const twp = (point) => (window.TravelMapProviders ? window.TravelMapProviders.focusPoint(point) : [point.latitude, point.longitude]);
  async function loadData() {
    const key = 'tw-map-cache-v8-curated-pool';
    try {
      const cached = localStorage.getItem(key);
      if (cached) return JSON.parse(cached);
      const response = await fetch('modules/data/landmarks.json?v=3', { cache: 'no-cache' });
      if (!response.ok) throw new Error('landmark data ' + response.status);
      const value = await response.json();
      const base = Array.isArray(value.landmarks) ? value.landmarks : [];
      try {
        const catalogResponse = await fetch('/modules/data/global-landmark-guide-catalog.json?v=20261018-verified-2', { cache: 'no-cache' });
        if (catalogResponse.ok) {
          const catalog = await catalogResponse.json();
          const normalize = name => String(name || '').normalize('NFKC').toLocaleLowerCase().replace(/[^\p{L}\p{N}]/gu, '');
          const distance = (a, b) => Math.hypot((Number(a.latitude) - Number(b.latitude)) * 111, (Number(a.longitude) - Number(b.longitude)) * 85);
          const merged = (catalog.places || []).map(place => {
            const match = base.find(item => item.wikidataId === place.id || item.globalId === place.id ||
              (item.countryCode === place.countryCode && normalize(item.name) === normalize(place.name) && distance(item, place) < 8));
            return match
              ? { ...match, ...place, id: match.id, globalId: place.id, wikidataId: place.id, globalRank: Number(place.rank) || 0, globalCatalog: true, icon: match.icon || '📍', image: match.image || '' }
              : { ...place, globalCatalog: true, icon: '📍', image: '' };
          });
          value.globalCatalogCount = (catalog.places || []).length;
          value.landmarks = merged;
        }
      } catch (catalogError) { console.warn('Global landmark catalogue unavailable; keeping the curated map:', catalogError); }
      if (!value.landmarks) value.landmarks = base;
      value.curated = base;
      localStorage.setItem(key, JSON.stringify(value));
      return value;
    } catch (error) {
      const cached = localStorage.getItem(key);
      if (cached) return JSON.parse(cached);
      throw error;
    }
  }
  function clearMarkers() { markers.forEach(marker => marker.remove()); markers = []; }
  // Names the basemap actually in use, so attribution is honest after a
  // provider switch and never claims a service that served nothing.
  function updateProviderBadge() {
    let credit = document.getElementById('mapProviderCredit');
    if (!credit) {
      credit = document.createElement('small');
      credit.id = 'mapProviderCredit';
      credit.className = 'muted';
      credit.style.cssText = 'display:block;font-size:11px;line-height:1.5;margin:2px 0 0';
      document.getElementById('mapStatus')?.after(credit);
    }
    credit.textContent = TravelMapProviders.attributionLabel();
  }
  // /api/map/providers answers after the first paint. When it lands on a
  // different provider the datum can change too (WGS-84 vs GCJ-02), so the
  // basemap and every marker on it have to be rebuilt from the catalogue.
  function watchProvider() {
    if (!map || map._twProviderWatch) return;
    map._twProviderWatch = true;
    map._twProvider = TravelMapProviders.active();
    updateProviderBadge();
    TravelMapProviders.onReady(provider => {
      if (!map || map._twProvider === provider.id) return;
      map._twProvider = provider.id;
      if (map._twTileLayer) { map._twTileLayer.remove(); map._twTileLayer = null; }
      map._twTileLayer = TravelMapProviders.tileLayer(map);
      updateProviderBadge();
      renderMarkers();
      renderNearbyPlaces();
    });
  }
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
      pin.innerHTML = '<span class="tw-marker-dot"></span><small>' + item.name + '</small>';
      pin.onclick = () => openLandmark(source.id);
      canvas.appendChild(pin);
    });
  }
  async function renderMarkers() {
    if (!map || !data) return;
    const {clusterPoints}=await clusterModule;
    clearMarkers();
    const zoom=map.getZoom();
    const countryOf=place=>place.countryCode||place.country_en||place.country||'unknown';
    const curated=Array.isArray(data.curated)?data.curated:[];
    const pool=zoom<4&&curated.length?curated:data.landmarks;
    const rankScore=place=>Number(place.rating)||Number(place.globalRank||place.rank)||0;
    const ranked=[...pool].sort((a,b)=>rankScore(b)-rankScore(a));
    // One champion per country on the world view; more countries and more
    // places per country appear only as the map is zoomed in.
    const champions=new Map();
    ranked.forEach(place=>{const country=countryOf(place);if(!champions.has(country))champions.set(country,place);});
    const countryBudget=pool===curated?(zoom<3?12:24):Infinity;
    const allowedCountries=Number.isFinite(countryBudget)?new Set([...champions.values()].sort((a,b)=>rankScore(b)-rankScore(a)).slice(0,countryBudget).map(countryOf)):null;
    const perCountryLimit=zoom<4?1:zoom<5?2:zoom<6?3:zoom<8?6:zoom<10?12:Infinity;
    const perCountry=new Map();
    const visible=ranked.filter(place=>{
      if(!map.getBounds().contains(twp(place))||nearbyPlaces.some(n=>placePhotos.has(n.id)&&Math.abs(n.latitude-place.latitude)<.01&&Math.abs(n.longitude-place.longitude)<.01))return false;
      const country=countryOf(place);
      if(allowedCountries&&!allowedCountries.has(country))return false;
      if(!Number.isFinite(perCountryLimit))return true;
      const count=perCountry.get(country)||0;
      if(count>=perCountryLimit)return false;perCountry.set(country,count+1);return true;
    });
    const clusterRadius=zoom>=13?0:zoom<4?0:zoom<6?55:zoom<8?40:zoom<10?26:18;
    clusterPoints(visible,p=>map.latLngToLayerPoint(twp(p)),clusterRadius).forEach(group=>{
      if(group.items.length>1){const representative=localized(group.items[0]),pin=document.createElement('div');pin.className='tw-landmark-group';if(representative.image){const image=document.createElement('img');image.src=representative.image;image.alt='';pin.append(image);}else{const symbol=document.createElement('span');symbol.className='tw-marker-dot';pin.append(symbol);}const count=document.createElement('span');count.className='tw-cluster-count';count.textContent=group.items.length;const label=document.createElement('small');label.textContent=representative.name;pin.append(count,label);const marker=L.marker(twp(group),{title:group.items.length+langText(' 个精选地标，点击展开',' curated landmarks; zoom in'),icon:L.divIcon({className:'tw-landmark-cluster tone-'+toneOf(representative),html:pin,iconSize:[46,46],iconAnchor:[23,23]})}).addTo(map);marker.on('click',()=>map.fitBounds(group.items.map(p=>twp(p)),{padding:[30,30],maxZoom:Math.min(16,map.getZoom()+3)}));markers.push(marker);return;}
      const source=group.items[0],item=localized(source);
      const pin=document.createElement('div');pin.className='tw-q-pin__body';if(item.image){const image=document.createElement('img');image.className='tw-landmark-thumb';image.src=item.image;image.alt='';pin.append(image);}else{const symbol=document.createElement('span');symbol.className='tw-q-pin__icon';pin.append(symbol);}const label=document.createElement('span');label.className='tw-q-pin__label';label.textContent=item.name;pin.append(label);
      const icon = L.divIcon({ className: 'tw-q-pin tone-'+toneOf(source), html:pin, iconSize: [30, 30], iconAnchor: [15, 15] });
      const marker = L.marker(twp(source), { icon, title: item.name, zIndexOffset: 200 }).addTo(map);
      marker.on('click', () => openLandmark(source.id, { focus: false }));
      markers.push(marker);
    });
  }
  function renderLegend() {
    const canvas = document.getElementById('mapCanvas');
    if (!canvas || !canvas.parentElement) return;
    let legend = canvas.parentElement.querySelector('.map-legend');
    if (!legend) { legend = document.createElement('div'); legend.className = 'map-legend'; canvas.after(legend); }
    const labels = [['history', '历史遗迹', 'Heritage'], ['nature', '自然风景', 'Nature'], ['city', '城市地标', 'City']];
    legend.replaceChildren(...labels.map(([tone, zh, en]) => {
      const item = document.createElement('span'); item.className = 'tone-' + tone;
      const label = document.createElement('b'); label.textContent = langText(zh, en);
      item.append(document.createElement('i'), label);
      return item;
    }));
  }
  function updateMarkerDensity() { const canvas=document.getElementById('mapCanvas'); if(!canvas||!map)return; const zoom=map.getZoom(); canvas.classList.toggle('map-country-champions',zoom<4); canvas.classList.toggle('map-compact-labels',zoom>=4&&zoom<5); }
  async function renderNearbyPlaces(){
    if(!map||!window.L)return;
    const {clusterPoints}=await clusterModule;
    nearbyMarkers.forEach(m=>m.remove());nearbyMarkers=[];
    if(map.getZoom()<4)return;
    const visible=nearbyPlaces.filter(p=>map.getBounds().contains(twp(p)));
    const groups=clusterPoints(visible,p=>map.latLngToLayerPoint(twp(p)),map.getZoom()>=15?0:64).slice(0,24);
    groups.forEach(group=>{
      const p=group.items.find(p=>placePhotos.get(p.id))||group.items[0],photo=placePhotos.get(p.id);
      if(!photo)return;
      const name=langText(p.name,p.name_en),pin=document.createElement('div');pin.className='tw-photo-place';
      const image=document.createElement('img');image.src=photo.url;image.alt=name;image.width=46;image.height=46;
      image.addEventListener('error',()=>pin.hidden=true,{once:true});
      const label=document.createElement('small');label.textContent=name;pin.append(image,label);
      if(group.items.length>1){const count=document.createElement('span');count.className='tw-cluster-count';count.textContent=group.items.length;pin.append(count);}
      const marker=L.marker(twp(p),{title:name,icon:L.divIcon({className:'tw-photo-place-icon',html:pin,iconSize:[46,46],iconAnchor:[23,23]})}).addTo(map);
      marker.on('click',()=>openPhotoPlace(p,photo,group.items));nearbyMarkers.push(marker);
    });
    const missing=groups.map(g=>g.items[0].id).filter(id=>!placePhotos.has(id));
    if(missing.length){const request=++photoRequest;status(langText('正在载入本范围景点实拍…','Loading attraction photographs…'));
      try{const response=await fetch('/api/map/place-images?ids='+missing.join('|'),{signal:AbortSignal.timeout(30000)}),payload=await response.json();if(!response.ok)throw new Error();Object.entries(payload.photos||{}).forEach(([id,photo])=>placePhotos.set(id,photo));if(request===photoRequest){await renderNearbyPlaces();await renderMarkers();status(langText('照片景点已载入；点击照片查看详情。无可核实照片的地点暂不显示。','Photo places loaded. Tap a photograph for details. Places without sourced photos are not shown.'));}}
      catch(_){if(request===photoRequest)status(langText('景点照片暂未载入，未使用替代照片；移动地图可重试。','Photographs could not load; no substitute images were used. Move the map to retry.'));}
    }
  }
  function openPhotoPlace(place,photo,group){
    if(window.openSelectedCityGuide){window.openSelectedCityGuide(place,photo);return;}
    document.getElementById('photoPlaceDialog')?.remove();
    const dialog=document.createElement('dialog');dialog.id='photoPlaceDialog';dialog.className='tw-photo-detail';dialog.setAttribute('aria-label',langText(place.name,place.name_en));
    backgroundData.then(backgrounds=>{const art=backgrounds[place.id];if(!art||!/^\/assets\/route-photos\/[a-z0-9-]+\.png$/.test(art.image))return;const artImage=matchMedia('(max-width:600px)').matches&&art.mobileImage?art.mobileImage:art.image;dialog.classList.add('place-gathered');dialog.style.setProperty('--place-art','url("'+artImage+'")');if(place.id!=='Q45178'){const note=document.createElement('small');note.className='place-art-credit';note.textContent=langText('Gathered 艺术衍生背景，非现场实拍。源图：','Gathered artistic derivative, not documentary photography. Source: ')+art.sourceAuthor+' · '+art.license;const source=document.createElement('a');source.href=art.sourceUrl;source.target='_blank';source.rel='noopener noreferrer';source.textContent=langText('背景来源与署名','Background source and attribution');note.append(source);dialog.append(note);}});
    const add=(tag,text)=>{const el=document.createElement(tag);if(text)el.textContent=text;dialog.append(el);return el;};
    const close=add('button',langText('返回地图','Back to map'));close.type='button';close.onclick=()=>dialog.close();
    if(place.id==='Q45178'&&!['localhost','127.0.0.1'].includes(location.hostname)){const credit=add('a',langText('Gathered 艺术衍生背景 · W. Bulach · CC BY-SA 4.0','Gathered artistic background · W. Bulach · CC BY-SA 4.0'));credit.href='https://commons.wikimedia.org/wiki/File:00_1375_Sydney_Opera_House_(Australia).jpg';credit.target='_blank';credit.rel='noopener noreferrer';}
    add('h2',langText(place.name,place.name_en));
    const image=add('img');image.src=place.id==='Q45178'?'/assets/route-photos/sydney-opera-source.jpg':photo.url;image.alt=langText(place.name,place.name_en);image.className='place-lead-photo';
    add('p',[langText(place.city,place.city_en||place.city),place.countryCode].filter(Boolean).join(' · ')+' · '+place.latitude.toFixed(4)+', '+place.longitude.toFixed(4));
    const credit=add('a',photo.credit+' · '+photo.license);credit.href=photo.sourceUrl;credit.target='_blank';credit.rel='noopener noreferrer';
    const source=add('a',langText('查看地点资料','Place source'));source.href=place.sourceUrl;source.target='_blank';source.rel='noopener noreferrer';
    add('p',langText('第三方地点资料；入口、开放时间及费用需另行核实。','Third-party place data. Entrances, opening hours and prices need separate verification.'));
    if(group.length>1){const expand=add('button',langText('放大查看周边 ','Zoom to nearby places: ')+group.length);expand.onclick=()=>{map.fitBounds(group.map(p=>twp(p)),{padding:[35,35],maxZoom:Math.min(18,map.getZoom()+3)});dialog.close();};}
    const navigation=add('nav');navigation.className='place-navigation';const coords=place.latitude+','+place.longitude;
    [[langText('查看地点','View place'),'https://www.google.com/maps/search/?api=1&query='+encodeURIComponent(coords)],[langText('导航去这里','Directions here'),'https://www.google.com/maps/dir/?api=1&destination='+encodeURIComponent(coords)]].forEach(([text,url])=>{const link=document.createElement('a');link.textContent=text;link.href=url;link.target='_blank';link.rel='noopener noreferrer';navigation.append(link);});
    add('small',langText('导航由 Google 地图打开，并由你在导航服务中选择当前位置；本站不会自动读取或上传你的位置。','Directions open in Google Maps, where you can choose your current location. This site does not automatically read or upload your location.'));
    const nearby=add('section');nearby.className='place-nearby-photos';const nearbyHeading=document.createElement('h3');nearbyHeading.textContent=langText('周边实拍 · 点照片查看地点','Nearby photographs · tap to explore');const photoGrid=document.createElement('div');photoGrid.className='place-nearby-grid';const photoFeedback=document.createElement('p');photoFeedback.textContent=langText('正在核对周边照片…','Loading sourced nearby photographs…');nearby.append(nearbyHeading,photoFeedback,photoGrid);
    const mapSection=add('section');mapSection.className='place-detail-map-section';const mapHeading=document.createElement('h3');mapHeading.textContent=langText('地点与周边地图','Place and surroundings');const miniMap=document.createElement('div');miniMap.className='place-detail-map';miniMap.setAttribute('aria-label',mapHeading.textContent);mapSection.append(mapHeading,miniMap);
    const notes=add('section');notes.className='place-detail-notes';const notesHeading=document.createElement('h3');notesHeading.textContent=langText('饮食 · 住宿 · 游玩路线','Food · stays · travel routes');const note=document.createElement('p');note.textContent=langText('本地点尚未关联已核实的餐食、床位、价格和完整行程，暂不显示通用推荐或其他地方的照片。','Verified food, beds, prices and full itineraries are not yet linked to this place. Generic suggestions and photographs of other places are not substituted.');notes.append(notesHeading,note);
    const related=(window.travelRoutes||[]).filter(route=>[route.destination,route.destination_en].some(city=>city&&String(city).toLowerCase()===String(place.city).toLowerCase()));related.forEach(route=>{const button=document.createElement('button');button.textContent=langText(route.title,route.title_en||route.title);button.onclick=()=>{dialog.close();window.openTravelRoute?.(route.id);};notes.append(button);});
    if(place.id==='Q45178'&&['localhost','127.0.0.1'].includes(location.hostname)){
      dialog.classList.add('place-sydney-guide');notesHeading.textContent=langText('先吃好，住舒服。','Eat well. Stay comfortably.');
      note.textContent=langText('精选吃住与玩法 · 费用核对：2026-10-13','Selected food, stays and experiences · prices checked 13 Oct 2026');
      const essentials=document.createElement('div');essentials.className='place-essential-grid';notes.append(essentials);
      [[langText('吃 · Bennelong 餐厅','Eat · Bennelong'),langText('官网菜品实拍；三道式套餐 AUD 240 / 人，不是单道菜价格。公共假日加收15%，菜品依季节调整。','Official dish photograph. Three-course menu: AUD 240 per person, not a single-dish price. Public holiday surcharge 15%; dishes change seasonally.'),'https://www.bennelong.com.au/menu/','https://www.bennelong.com.au/wp-content/uploads/2024/08/Home-Menu.png','AUD 240 '+langText('/ 人 · 三道式套餐','/ person · 3 courses')],
      [langText('住 · YHA Sydney Harbour','Stay · YHA Sydney Harbour'),langText('官网四床共住房型实拍；110 Cumberland Street, The Rocks。共住房须年满18岁，房价随日期变化。','Official four-bed co-living room photograph. 110 Cumberland Street, The Rocks. Co-living guests must be 18+; prices vary by date.'),'https://www.yha.com.au/hostels/nsw/sydney-surrounds/sydney-harbour/','https://www.yha.com.au/contentassets/c61f99a236de42328a9b8647fa8e284d/sydh_4-bed_nov2024.jpg',langText('选日期查床位与房价','Check beds and prices by date')],
      [langText('喝 · Bennelong Bar','Drink · Bennelong Bar'),langText('官网 Sip the Canvas 鸡尾酒系列实拍；饮品按当前酒单计价，也可查看无酒精选择。','Official Sip the Canvas cocktail photograph. Check the current beverage list for prices and non-alcoholic options.'),'https://www.bennelong.com.au/sip-the-canvas-new-cocktail-menu/','https://www.bennelong.com.au/wp-content/uploads/2026/05/sipthecanvas-newspost-1024x683.jpg',langText('价格以当前酒单为准','Prices on current drinks menu')],
      [langText('玩 · 官方导览与用餐','Do · Official Tour & Dine'),langText('导览约60分钟；成人预订 AUD 84、当日 AUD 91。用餐含一份主食和指定饮品；提前15分钟到 Welcome Centre。照片为歌剧院外观，不代表室内导览。','Tour approximately 60 minutes. Adult pre-book AUD 84 / on-day AUD 91; includes a meal and selected drink. Arrive 15 minutes early at the Welcome Centre. Photograph shows the exterior, not the interior tour.'),'https://www.sydneyoperahouse.com/tours/tour-and-dine','/assets/route-photos/sydney-opera-source.jpg',langText('AUD 84 预订 / 91 当日','AUD 84 pre-book / 91 on-day')]
      ].forEach(([title,description,url,picture,price])=>{const card=document.createElement('article'),detail=document.createElement('details'),summary=document.createElement('summary'),img=document.createElement('img'),heading=document.createElement('strong'),copy=document.createElement('p'),cost=document.createElement('small'),link=document.createElement('a');img.src=picture;img.alt=title;img.width=300;img.height=100;heading.textContent=title;summary.append(img,heading);cost.textContent=price;copy.textContent=description;link.href=url;link.textContent=langText('查看官网 · 图片来源','Official details · photo source');link.target='_blank';link.rel='noopener noreferrer';detail.append(summary,copy,link);card.append(detail,cost);essentials.append(card);});
      const rights=document.createElement('small');rights.textContent=langText('商家照片版权归 Bennelong / YHA；目前仅供本地样例评审，发布前需确认图片使用授权。','Merchant photographs © Bennelong / YHA. Local design review only; image-use permission must be confirmed before publication.');notes.append(rights);
      const original=add('details');original.className='place-original-details';const originalLabel=document.createElement('summary');originalLabel.textContent=langText('查看地标原始实拍与来源','Original landmark photograph and sources');original.append(originalLabel,image,credit,source);
      const nearbyFold=add('details');nearbyFold.className='place-nearby-fold';const nearbyLabel=document.createElement('summary');nearbyLabel.textContent=langText('顺路看看 · 3 个周边地点','Along the way · 3 nearby places');nearbyFold.append(nearbyLabel,nearby);
      const artCredit=add('small',langText('背景：Gathered 艺术衍生图，非现场实拍。源图 W. Bulach · CC BY-SA 4.0；背景沿用相同授权。','Background: Gathered artistic derivative, not documentary photography. Source: W. Bulach · CC BY-SA 4.0; derivative under the same license.'));artCredit.className='place-art-credit';
    }
    dialog.addEventListener('close',()=>dialog.remove(),{once:true});document.body.append(dialog);dialog.showModal();
    const detailMap=L.map(miniMap,{scrollWheelZoom:false}).setView(twp(place),13);TravelMapProviders.tileLayer(detailMap);
    const markerPhoto=document.createElement('img');markerPhoto.src=photo.url;markerPhoto.alt=langText(place.name,place.name_en);markerPhoto.className='place-mini-marker';L.marker(twp(place),{icon:L.divIcon({className:'tw-photo-place-icon',html:markerPhoto,iconSize:[46,46],iconAnchor:[23,23]})}).addTo(detailMap);
    dialog.addEventListener('close',()=>detailMap.remove(),{once:true});requestAnimationFrame(()=>detailMap.invalidateSize());
    (async()=>{try{const delta=.08,bounds=[place.latitude-delta,place.longitude-delta,place.latitude+delta,place.longitude+delta],response=await fetch('/api/map/places?bbox='+bounds.join(',')),payload=await response.json();if(!response.ok)throw new Error();const places=(payload.places||[]).filter(p=>p.id!==place.id).slice(0,8);if(!places.length){photoFeedback.textContent=langText('本范围暂无其他已收录地点。','No other catalogued places in this area.');return;}const photosResponse=await fetch('/api/map/place-images?ids='+places.map(p=>p.id).join('|')),{photos}=await photosResponse.json();if(!photosResponse.ok)throw new Error();if(!dialog.isConnected)return;let count=0;places.forEach(p=>{const pic=photos[p.id];if(!pic)return;count++;const button=document.createElement('button'),img=document.createElement('img'),label=document.createElement('strong');img.src=pic.url;img.alt=langText(p.name,p.name_en);label.textContent=img.alt;button.append(img,label);button.onclick=()=>{dialog.close();window.openSourcedMapPlace(p,pic);};photoGrid.append(button);const mini=img.cloneNode();mini.className='place-mini-marker';L.marker(twp(p),{title:label.textContent,icon:L.divIcon({className:'tw-photo-place-icon',html:mini,iconSize:[46,46],iconAnchor:[23,23]})}).addTo(detailMap).on('click',button.onclick);});photoFeedback.textContent=count?langText('照片对应各自标注的地点；作者及授权见详情。','Each photograph belongs to its labelled place. Open details for author and license.'):langText('附近地点暂无已关联的授权照片。','No licensed nearby photographs are linked.');}catch(_){photoFeedback.textContent=langText('周边实拍暂不可用，请稍后重试。','Nearby photographs are unavailable. Please try again later.');}})();
  }
  window.openSourcedMapPlace=async(place,photo)=>{window.go('map');await initMap();if(map){map.setView(twp(place),14);openPhotoPlace(place,photo,[place]);}};
  function schedulePlaces(){clearTimeout(placeTimer);placeController?.abort();renderNearbyPlaces();placeTimer=setTimeout(loadNearbyPlaces,650);}
  async function loadNearbyPlaces(){
    if(!map||map.getZoom()<4)return;
    const b=map.getBounds(),s=Math.max(-85,b.getSouth()),n=Math.min(85,b.getNorth()),w=Math.max(-180,b.getWest()),e=Math.min(180,b.getEast());
    if(w>=e||s>=n||(n-s)*(e-w)>2000)return;
    const sequence=++placeRequest;
    placeController?.abort();
    placeController=new AbortController();
    try{
      const response=await fetch('/api/map/places?bbox='+[s,w,n,e].map(v=>v.toFixed(3)).join(','),{signal:placeController.signal}),payload=await response.json();
      if(sequence!==placeRequest)return;if(!response.ok||!Array.isArray(payload.places))throw new Error();
      nearbyPlaces=payload.places;await renderNearbyPlaces();
      let credit=document.getElementById('mapPlaceAttribution');if(!credit){credit=document.createElement('small');credit.id='mapPlaceAttribution';document.getElementById('mapStatus')?.after(credit);}credit.replaceChildren();const source=document.createElement('a');source.href='https://github.com/audiala/open-data';source.target='_blank';source.rel='noopener noreferrer';source.textContent='Data by Audiala · CC BY 4.0';credit.append(source);
      status(nearbyPlaces.length
        ? langText('当前视野加载第三方地图目录点位 ','Third-party map catalogue points in this view: ')+nearbyPlaces.length+langText(' 条（单次最多400，不代表当地全部景点）。',' (up to 400 per request; not a complete attraction count).')
        : langText('当前视野的第三方地图目录返回 0 条；这不代表本站地标或当地景点为 0。搜索匹配的本站地点见上方列表。','The third-party map catalogue returned 0 entries in this view; this does not mean the site catalogue or local attractions are empty. Site matches remain listed above.'));
    }catch(error){if(sequence===placeRequest&&error.name!=='AbortError')status(langText('更多景点暂时无法加载，已保留现有地标；移动地图可重试。','More attractions could not load. Existing landmarks remain; move the map to retry.'));}
  }
  async function initMap() {
    const canvas = document.getElementById('mapCanvas');
    if (!canvas) return;
    if (canvas.offsetParent === null) return;
    try {
      data = await loadData();
      if (!window.L) { renderFallback(); status(langText('离线地图 · 使用已缓存地标数据；联网后可启用拖动、缩放和搜索。','Offline map · Showing cached landmarks. Reconnect to pan, zoom and search.')); return; }
      if (!map) { map = L.map(canvas, { zoomControl: true, worldCopyJump: true,dragging:!coarse,touchZoom:!coarse,scrollWheelZoom:!coarse,doubleClickZoom:!coarse,boxZoom:!coarse }).setView([20, 0], 1); map.on('zoomend', updateMarkerDensity); map.on('moveend',renderOnlineUsers);map.on('moveend',renderMarkers);map.on('moveend',schedulePlaces); }
      if (!map._twTileLayer) { map._twTileLayer = TravelMapProviders.tileLayer(map); }
      renderMarkers();
      updateMarkerDensity();
      renderLegend();
      watchProvider();
      setTimeout(() => map.invalidateSize(), 0);
      loadOnlineUsers();
      clearInterval(onlineRefreshTimer);
      onlineRefreshTimer = setInterval(loadOnlineUsers, 30_000);
      status(langText('在线地图 · 全球精选目录 ','Online map · Global curated catalogue ') + (data.globalCatalogCount || data.landmarks.length) + langText(' 个地点；缩小时按国家精选，放大后逐步展开。',' places; zoom out for country highlights and zoom in for detail.'));
      const savedRoute = JSON.parse(localStorage.getItem('tw-map-route') || '[]');
      if (!window.travelMapSkipSavedRoute && savedRoute.length > 1) setTimeout(() => window.showTravelRoute(savedRoute), 80);
    } catch (error) { status(langText('地图数据加载失败：','Failed to load map data: ') + error.message); }
  }
  async function openLandmark(id, options = {}) {
    if (!data) {
      try { data = await loadData(); }
      catch (_) { status(langText('地点详情暂时无法加载，请稍后重试。','Place details could not load. Please try again.')); return; }
    }
    const source = [...(data?.curated || []), ...(data?.landmarks || [])].find(entry => entry.id === id || entry.globalId === id || entry.wikidataId === id);
    if (!source) return;const item=localized(source);
    if (map && options.focus !== false) map.setView(twp(source), 11);
    if(window.openSelectedCityGuide){try{window.openSelectedCityGuide(source,source.image?{url:source.image,sourceUrl:source.image}:null);return;}catch(error){console.error('Selected city guide failed:',error);status(langText('新版地点详情暂时打不开：','The new place guide could not open: ')+(error?.message||''));return;}}
    const artworkIds={'cn-great-wall':'Q12501','fr-eiffel':'Q243','in-taj-mahal':'Q9141','fr-louvre':'Q19675','us-liberty':'Q9202','au-opera':'Q45178','cn-west-lake':'Q10866444','jp-kiyomizu':'jp-kiyomizu','gb-big-ben':'gb-big-ben','cn-oriental-pearl':'cn-oriental-pearl','jp-fuji':'jp-fuji','cn-forbidden-city':'cn-forbidden-city','cn-zhangjiajie':'cn-zhangjiajie','it-colosseum':'it-colosseum','es-sagrada':'es-sagrada','gr-acropolis':'gr-acropolis','us-golden-gate':'us-golden-gate','us-grand-canyon':'us-grand-canyon','ca-niagara':'ca-niagara','sg-merlion':'sg-merlion','ae-burj-khalifa':'ae-burj-khalifa','pe-machu-picchu':'pe-machu-picchu','br-christ':'br-christ','eg-pyramids':'eg-pyramids','au-great-barrier':'au-great-barrier','jp-tokyo-tower':'jp-tokyo-tower','kr-gyeongbokgung':'kr-gyeongbokgung','th-grand-palace':'th-grand-palace','vn-ha-long':'vn-ha-long','id-borobudur':'id-borobudur','tr-hagia-sophia':'tr-hagia-sophia','cn-erhai':'cn-erhai','mx-chichen-itza':'mx-chichen-itza','za-table-mountain':'za-table-mountain','nz-milford':'nz-milford','ru-hermitage':'ru-hermitage','my-petronas':'my-petronas','np-everest':'np-everest','jo-petra':'jo-petra','de-neuschwanstein':'de-neuschwanstein','pt-belem':'pt-belem'};
    const artworkId=artworkIds[id],art=(await backgroundData)[artworkId];
    if(art){openPhotoPlace({...source,id:artworkId,countryCode:source.country_en||source.country,sourceUrl:art.sourceUrl},{url:art.sourceImage||art.image.replace('gathered-background.png','source.jpg'),sourceUrl:art.sourceUrl,credit:art.sourceAuthor,license:art.license},[source]);return;}
    if(new URLSearchParams(location.search).get('preview')==='journal'){
      status(langText('正在关联地点实拍与详情…','Linking sourced place photographs…'));
      try{const bounds=[source.latitude-.5,source.longitude-.5,source.latitude+.5,source.longitude+.5],response=await fetch('/api/map/places?bbox='+bounds.join(',')),payload=await response.json();const normalize=value=>String(value||'').toLowerCase().replace(/[^\p{L}\p{N}]/gu,'');const target=(payload.places||[]).find(p=>[p.name,p.name_en].some(name=>[source.name,source.name_en].some(original=>normalize(name)===normalize(original))));if(target){const images=await fetch('/api/map/place-images?ids='+target.id).then(r=>r.json()),photo=images.photos?.[target.id];if(photo){openPhotoPlace(target,photo,[target]);return;}}}catch(_){}
    }
    if (window.showLandmark) window.showLandmark(source);
    status(langText('正在加载 ','Loading ') + item.name + langText(' 的热门实景图片…',' photos…'));
    try {
      const response = await fetch('/api/map/place-photos?q=' + encodeURIComponent(source.imageQuery || item.name + ' ' + item.city));
      const payload = await response.json();
      if (response.ok && window.showLandmark) window.showLandmark({ ...source, photos: payload.photos || [] });
      status(langText('已打开：','Opened: ') + item.name + ' · ' + item.city + langText('。','.'));
    } catch (_) { status(langText('已打开：','Opened: ') + item.name + langText('。','.')); }
  }
  async function searchPlace(providedQuery, expandedRadius, knownCenter) {
    if (!data) await initMap();
    const input = document.getElementById('mapSearch');
    const raw = String(providedQuery || (input && input.value) || '').trim();
    const query = raw.toLowerCase();
    if (!query) return status(langText('请输入城市或景点名称。','Enter a city or landmark name.'));
    if (input && providedQuery) input.value = raw;
    const sequence = ++searchSequence;
    searchController?.abort();
    searchController = new AbortController();
    const controller = searchController;
    clearSearchMarkers();
    const region = searchResultsRegion(); region.hidden = true; region.replaceChildren();
    const matches = matchingCatalogEntries(raw);
    if (matches.length && !knownCenter) {
      const first = matches[0];
      if (map) map.setView(twp(first), 13);
      showSearchResults(raw, matches, {
        title: langText('站内景点目录 · ' + matches.length + ' 个结果', 'In-app place catalogue · ' + matches.length + ' results'),
        summary: langText('按本站已收录的地标与城市字段匹配；点“地图定位”或“站内详情”继续。', 'Matched against places and city fields already in this site catalogue. Choose map location or in-app details to continue.')
      });
      status(langText('景点目录找到 ','Catalogue found ') + matches.length + langText(' 个相关地点。',' matching places.'));
      return;
    }
    let timedOut = false;
    const timeout = setTimeout(() => { timedOut = true; controller.abort(); }, 35_000);
    try {
      let center = knownCenter;
      let displayName = raw;
      if (!center) {
        status(langText('正在搜索地名与景点目录…','Searching the place name and attraction catalogue…'));
        const response = await fetch('/api/map/search?q=' + encodeURIComponent(raw), { signal: controller.signal });
        if (!response.ok) throw new Error('geocode ' + response.status);
        const payload = await response.json();
        if (sequence !== searchSequence) return;
        const result = (payload.results || [])[0];
        if (!result) {
          const retry = document.createElement('button'); retry.type = 'button'; retry.textContent = langText('重试搜索', 'Retry search'); retry.onclick = () => searchPlace(raw);
          showSearchResults(raw, [], { title: langText('没有匹配的地名', 'No matching place name'), summary: langText('地名服务没有返回结果；这与景点目录是否覆盖是两回事。请换一个名称或重试。', 'The place-name service returned no match; that is separate from catalogue coverage. Try another name or retry.'), action: retry });
          status(langText('没有找到该地名。','Place name not found.'));
          return;
        }
        center = { latitude: Number(result.latitude), longitude: Number(result.longitude) };
        displayName = result.displayName || raw;
        if (!Number.isFinite(center.latitude) || !Number.isFinite(center.longitude)) throw new Error('invalid coordinates');
        if (map) {
          const marker = L.marker(tw([center.latitude, center.longitude]), { title: displayName });
          const popup = document.createElement('span'); popup.textContent = displayName;
          marker.addTo(map).bindPopup(popup).openPopup(); searchMarkers.push(marker);
          map.setView(tw([center.latitude, center.longitude]), 13);
        }
      }
      if (sequence !== searchSequence) return;
      await showDirectoryNear(center, raw, Number(expandedRadius) || 15, sequence, controller);
      if (sequence === searchSequence) status(langText('地名已定位：','Place located: ') + displayName + langText('。目录状态见下方列表。','; catalogue status is shown in the list below.'));
    } catch (error) {
      showSearchError(raw, sequence, controller, timedOut)(error);
      if (sequence === searchSequence && !timedOut && error.name !== 'AbortError') status(langText('搜索请求失败；请重试。','Search request failed; please retry.'));
    } finally { clearTimeout(timeout); }
  }
  function locateUser() { if (!navigator.geolocation) return status(langText('当前设备不支持定位，仍可搜索和浏览地图。','This device does not support location. You can still search and browse the map.')); status(langText('正在获取当前位置…','Getting your location…')); navigator.geolocation.getCurrentPosition(position => { const point = [position.coords.latitude, position.coords.longitude]; lastPosition = position; if (map) { map.setView(point, 14); if (userMarker) userMarker.remove(); const icon = L.divIcon({ className: 'tw-user-pin', html: '<div class="tw-user-pin__arrow">➤</div><div class="tw-user-pin__pulse"></div>', iconSize: [34, 34], iconAnchor: [17, 17] }); const myLocation=langText('我的位置','My location'); userMarker = L.marker(point, { icon, title: myLocation, zIndexOffset: 1000 }).addTo(map).bindPopup('<strong>'+myLocation+'</strong><br>'+langText('定位精度约 ','Accuracy about ')+Math.round(position.coords.accuracy || 0)+langText(' 米',' m')).openPopup(); } if (document.getElementById('mapShareLocation')?.checked) publishPresence(); status(langText('已定位到当前位置；位置仅在本次页面使用。','Location found. It is used only on this page.')); }, error => { const reason = error.code === 1 ? langText('未获得定位权限','Location permission was not granted') : langText('暂时无法获取位置','Location is temporarily unavailable'); status(reason + langText('，仍可搜索地点和浏览地图。','. You can still search and browse the map.')); }, { enableHighAccuracy: true, timeout: 12000, maximumAge: 60000 }); }
  async function publishPresence(force = false) { const auth = window.TravelWorldAuth; if (!auth?.requireLogin()) return; if (!lastPosition) return locateUser(); if (!force && Date.now() - lastPresenceAt < 80_000) return; try { const latitude = lastPosition.coords.latitude, longitude = lastPosition.coords.longitude; const place = await fetch('/api/map/reverse?latitude=' + encodeURIComponent(latitude) + '&longitude=' + encodeURIComponent(longitude)).then(response => response.ok ? response.json() : ({})).catch(() => ({})); await auth.request('/api/map/presence', { method: 'POST', body: JSON.stringify({ latitude, longitude, country: place.country || '', city: place.city || '', sharing_enabled: true }) }); lastPresenceAt = Date.now(); status(langText('位置共享已开启','Location sharing is on') + (place.country ? ' · ' + place.country : '') + langText('，其他在线用户可看到你的 Q 版标识。','. Other online users can see your illustrated marker.')); } catch (error) { document.getElementById('mapShareLocation').checked = false; status(langText('位置共享未开启：','Location sharing could not be enabled: ') + error.message); } }
  async function toggleSharing(enabled) { const auth = window.TravelWorldAuth; if (!enabled) { if (presenceWatchId !== null) navigator.geolocation.clearWatch(presenceWatchId); clearInterval(presenceTimer); presenceWatchId = null; presenceTimer = null; try { if (auth?.session()) await auth.request('/api/map/presence', { method: 'DELETE' }); clearOnlineMarkers(); status(langText('位置共享已关闭，其他用户将立即看不到你。','Location sharing is off. Other users can no longer see you.')); } catch (error) { status(langText('关闭共享失败：','Failed to turn off sharing: ') + error.message); } return; } if (!navigator.geolocation) return status(langText('当前设备不支持定位。','This device does not support location.')); locateUser(); presenceWatchId = navigator.geolocation.watchPosition(position => { lastPosition = position; publishPresence(); }, () => {}, { enableHighAccuracy: true, maximumAge: 60_000, timeout: 15_000 }); clearInterval(presenceTimer); presenceTimer = setInterval(() => publishPresence(true), 120_000); }
  async function openOnlineUser(userId) { return window.openTravelUser(userId); }
  async function renderOnlineUsers() {
    if(!map||!window.L)return;
    const {clusterPoints}=await clusterModule;
    clearOnlineMarkers();
    const escape=value=>String(value??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
    const groups=clusterPoints(onlineUsers,entry=>map.latLngToLayerPoint(twp(entry)),map.getZoom()>=15?0:64);
    groups.forEach(group=>{
      if(group.items.length>1){
        const button=document.createElement('button');button.type='button';button.textContent=String(group.items.length);button.setAttribute('aria-label',group.items.length+langText(' 位共享位置的用户；点击放大',' users sharing their location; zoom in'));
        const icon=L.divIcon({className:'tw-user-cluster',html:button,iconSize:[38,38],iconAnchor:[19,19]});
        const marker=L.marker(twp(group),{icon,zIndexOffset:2100}).addTo(map);
        marker.on('click',()=>map.fitBounds(group.items.map(p=>twp(p)),{padding:[40,40],maxZoom:Math.min(18,map.getZoom()+3)}));onlineMarkers.push(marker);return;
      }
      const entry=group.items[0],profile=entry.profiles||{},id=String(profile.id||entry.user_id||'').replace(/[^a-zA-Z0-9-]/g,''),name=escape(profile.display_name||profile.username||langText('旅行者','Traveler'));
      const icon=L.divIcon({className:'tw-q-pin tw-online-pin',html:'<div class="tw-q-pin__body"><span class="tw-q-pin__icon">🧭</span><span class="tw-q-pin__label">'+name+'</span></div>',iconSize:[36,36],iconAnchor:[18,18]});
      const content=document.createElement('div');content.innerHTML='<strong>'+name+'</strong><p>'+escape(profile.bio||langText('这位旅行者还没有填写简介','This traveler has not added a bio yet.'))+'</p>';
      const follow=document.createElement('button');follow.textContent=langText('关注/取消关注','Follow / unfollow');follow.onclick=()=>followOnlineUser(id);
      const chat=document.createElement('button');chat.textContent=langText('私聊','Message');chat.onclick=()=>openOnlineUser(id);content.append(follow,chat);
      onlineMarkers.push(L.marker(twp(entry),{icon,title:name,zIndexOffset:2000}).addTo(map).bindPopup(content));
    });
  }
  async function followOnlineUser(userId) { const auth = window.TravelWorldAuth; if (!auth?.requireLogin()) return; try { const result = await auth.request('/api/community/users/' + encodeURIComponent(userId) + '/follow', { method: 'POST' }); status(result.following ? langText('已关注该旅行者。','Traveler followed.') : langText('已取消关注。','Traveler unfollowed.')); } catch (error) { status(langText('关注操作失败，请重试','Could not update follow status. Try again.')); } }
  async function loadOnlineUsers() {
    try {
      const country=document.getElementById('mapOnlineCountry')?.value.trim()||'';
      const response=await fetch('/api/map/online-users'+(country?'?country='+encodeURIComponent(country):''),{signal:AbortSignal.timeout(12000)});
      const payload=await response.json();if(!response.ok||!Array.isArray(payload.users))throw new Error();
      onlineUsers=payload.users;await renderOnlineUsers();
      const count=document.getElementById('mapOnlineCount');if(count)count.textContent=String(onlineUsers.length);
      status(langText('共享位置用户：','Users sharing their location: ')+onlineUsers.length+langText('；缩小聚合，放大展开。','; zoom out to group, zoom in to expand.'));
    }catch(_){status(langText('在线用户暂时不可用，保留最近已加载的位置。','Online users unavailable; keeping the last loaded locations.'));}
  }
  window.initTravelMap = initMap;
  window.activateTravelMap=()=>{if(!map)return;['dragging','touchZoom','scrollWheelZoom','doubleClickZoom','boxZoom','keyboard'].forEach(name=>map[name]?.enable());status(langText('地图交互已开启；现在可以拖动、缩放和点击地标。','Map interaction is active. You can now pan, zoom and open markers.'));};
  window.refreshTravelMapLocale=()=>{if(!data)return;renderMarkers();renderLegend();if(document.getElementById('landmarkDetailOverlay')&&window.currentMapLandmark)window.showLandmark(window.currentMapLandmark);};
  window.searchTravelMap = searchPlace;
  window.locateTravelMap = locateUser;
  window.toggleMapLocationSharing = toggleSharing;
  window.loadMapOnlineUsers = loadOnlineUsers;
  window.openMapDirectChat = openOnlineUser;
  window.followMapUser = followOnlineUser;
  window.openMapLandmark = openLandmark;
  window.focusTravelPlace = async function (point) {
    if (!Number.isFinite(point?.latitude) || !Number.isFinite(point?.longitude)) return;
    await initMap(); if (!map || !window.L) return;
    const title = String(point.name || '').replace(/[&<>"']/g, char => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[char]));
    focusedPlaceMarker?.remove();
    focusedPlaceMarker = L.marker(twp(point), {zIndexOffset:1500}).addTo(map).bindPopup(title);
    map.setView(twp(point), 15); focusedPlaceMarker.openPopup();
  };
  window.showTravelPlaces = async function (points) {
    await initMap(); if (!map || !window.L || !Array.isArray(points)) return;
    routeMarkers.forEach(marker => marker.remove()); routeMarkers = [];
    if (routeLayer) { routeLayer.remove(); routeLayer = null; }
    focusedPlaceMarker?.remove();
    const valid = points.filter(point => Number.isFinite(point?.latitude) && Number.isFinite(point?.longitude));
    valid.forEach((point, index) => {
      const title = String(point.name || '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
      const icon = L.divIcon({className:'tw-route-pin',html:'<div class="tw-route-pin__body">'+(index+1)+'</div>',iconSize:[28,28],iconAnchor:[14,14]});
      const content = document.createElement('div');
      content.innerHTML = '<strong>'+title+'</strong>';
      if (typeof window.onTravelPlaceSelected === 'function') {
        const button = document.createElement('button'); button.textContent = langText('查看地点详情','View place details');
        button.onclick = () => window.onTravelPlaceSelected(point.id); content.append(document.createElement('br'),button);
      }
      routeMarkers.push(L.marker(twp(point),{icon,zIndexOffset:1000}).addTo(map).bindPopup(content));
    });
    if (valid.length) map.fitBounds(valid.map(p=>twp(p)),{padding:[35,35],maxZoom:13});
    status(langText('已显示沿途地点，点击标记查看详情。','Places shown. Click a marker for details.'));
  };
  window.showTravelRoute = async function (points, options = {}) {
    if (!map || !Array.isArray(points)) return;
    const coords = points.map(point => Array.isArray(point) ? point : twp(point)).filter(point => point.length === 2 && point.every(Number.isFinite));
    if (coords.length < 2) return status(langText('路线至少需要两个有效地点。','A route needs at least two valid places.'));
    if (routeLayer) routeLayer.remove();
    routeMarkers.forEach(marker => marker.remove()); routeMarkers = [];
    let routeCoords = [], routeDetail = '', routed = false;
    try {
      const response = options.result ? null : await fetch('/api/map/route', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ points, mode: options.mode || 'driving' }) });
      if (response && !response.ok) throw new Error('route ' + response.status);
      const result = options.result || await response.json();
      routeCoords = (result.geometry?.coordinates || []).map(coord => [Number(coord[1]), Number(coord[0])]).filter(coord => coord.every(Number.isFinite));
      routed = routeCoords.length > 1;
      routeDetail = langText(' · 约 ',' · About ') + (result.distanceMeters / 1000).toFixed(1) + ' km / ' + Math.max(1, Math.round(result.durationSeconds / 60)) + langText(' 分钟',' min');
    } catch (_) { routeDetail = langText(' · 道路服务不可用，当前显示地点连线',' · Routing is unavailable; showing straight lines between places'); }
    if (!routed && options.requireRoad) { status(langText('道路路线未能加载，不显示虚构导航线。请重试。','Road routing failed. No invented navigation line is shown. Please retry.')); return; }
    routeLayer = L.polyline(routed ? routeCoords : coords, { color: '#d17d57', weight: 5, opacity: .85, dashArray: routed ? null : '9 7' }).addTo(map);
    points.forEach((point, index) => {
      const coord = coords[index]; if (!coord) return;
      const label = String(index + 1);
      const icon = L.divIcon({ className: 'tw-route-pin', html: '<div class="tw-route-pin__body">' + label + '</div>', iconSize: [28, 28], iconAnchor: [14, 14] });
      const title = point.name ? '<strong>' + String(point.name).replace(/[<>]/g, '') + '</strong><br>' : '';
      const detail = point.day ? 'Day ' + Number(point.day) + (point.time ? ' · ' + String(point.time).replace(/[<>]/g, '') : '') : '';
      routeMarkers.push(L.marker(coord, { icon }).addTo(map).bindPopup(title + detail));
    });
    map.fitBounds(routeLayer.getBounds(), { padding: [30, 30] });
    let summary=document.getElementById('mapRouteSummary');if(!summary){summary=document.createElement('p');summary.id='mapRouteSummary';summary.setAttribute('role','status');document.getElementById('mapStatus')?.before(summary);}summary.textContent=langText('站内道路路线','Road route on this map')+routeDetail;
    status(langText('已在地图显示旅行路线，共 ','Route shown on the map with ') + coords.length + langText(' 个地点',' places') + routeDetail + langText('。','.'));
  };
}());
