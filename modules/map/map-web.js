(function () {
  const photoStyles=document.createElement('link');photoStyles.rel='stylesheet';photoStyles.href='modules/map/photo-places.css?v=30-global-category-icons';document.head.append(photoStyles);
  let map;
  let markers = [];
  let routeLayer;
  let routeMarkers = [];
  let focusedPlaceMarker;
  let userMarker;
  let onlineMarkers = [];
  let onlineUsers = [];
  let nearbyPlaces=[],nearbyMarkers=[],placeTimer,placeRequest=0;
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
  const status = text => { const el = document.getElementById('mapStatus'); if (el) el.textContent = text; };
  // The catalogue is WGS-84; the active basemap may not be. Re-project here.
  const tw = (pair) => (window.TravelMapProviders ? window.TravelMapProviders.focusLatLng(pair[0], pair[1]) : pair);
  const twp = (point) => (window.TravelMapProviders ? window.TravelMapProviders.focusPoint(point) : [point.latitude, point.longitude]);
  async function loadData() {
    const key = 'tw-map-cache-v7-global-1000-verified-images';
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
      pin.innerHTML = item.icon + '<small>' + item.name + '</small>';
      pin.onclick = () => openLandmark(source.id);
      canvas.appendChild(pin);
    });
  }
  async function renderMarkers() {
    if (!map || !data) return;
    const {clusterPoints}=await clusterModule;
    clearMarkers();
    const zoom=map.getZoom(),limit=zoom<5?5:zoom<7?12:zoom<8?30:Infinity;
    const ranked=[...data.landmarks].sort((a,b)=>(Number(b.globalRank||b.rank)||0)-(Number(a.globalRank||a.rank)||0));
    const perCountry=new Map();
    const visible=ranked.filter(place=>{
      if(!map.getBounds().contains(twp(place))||nearbyPlaces.some(n=>placePhotos.has(n.id)&&Math.abs(n.latitude-place.latitude)<.01&&Math.abs(n.longitude-place.longitude)<.01))return false;
      if(!Number.isFinite(limit))return true;
      const country=place.countryCode||place.country_en||place.country||'unknown',count=perCountry.get(country)||0;
      if(count>=limit)return false;perCountry.set(country,count+1);return true;
    });
    const clusterRadius=zoom>=15?0:zoom>=11?18:zoom>=8?40:zoom>=5?62:88;
    clusterPoints(visible,p=>map.latLngToLayerPoint(twp(p)),clusterRadius).forEach(group=>{
      if(group.items.length>1){const representative=localized(group.items[0]),pin=document.createElement('div');pin.className='tw-landmark-group';if(representative.image){const image=document.createElement('img');image.src=representative.image;image.alt='';pin.append(image);}else{const symbol=document.createElement('span');symbol.className='tw-landmark-group-symbol';symbol.textContent=representative.icon||'📍';pin.append(symbol);}const count=document.createElement('span');count.className='tw-cluster-count';count.textContent=group.items.length;const label=document.createElement('small');label.textContent=representative.name;pin.append(count,label);const marker=L.marker(twp(group),{title:group.items.length+langText(' 个精选地标，点击展开',' curated landmarks; zoom in'),icon:L.divIcon({className:'tw-landmark-cluster',html:pin,iconSize:[46,46],iconAnchor:[23,23]})}).addTo(map);marker.on('click',()=>map.fitBounds(group.items.map(p=>twp(p)),{padding:[30,30],maxZoom:Math.min(16,map.getZoom()+3)}));markers.push(marker);return;}
      const source=group.items[0],item=localized(source);
      const pin=document.createElement('div');pin.className='tw-q-pin__body';if(item.image){const image=document.createElement('img');image.className='tw-landmark-thumb';image.src=item.image;image.alt='';pin.append(image);}else{const symbol=document.createElement('span');symbol.className='tw-q-pin__icon';symbol.textContent=item.icon||'📍';pin.append(symbol);}const label=document.createElement('span');label.className='tw-q-pin__label';label.textContent=item.name;pin.append(label);
      const icon = L.divIcon({ className: 'tw-q-pin', html:pin, iconSize: [30, 30], iconAnchor: [15, 15] });
      const popup = document.createElement('div');
      const title = document.createElement('strong'); title.textContent = (source.icon || '📍') + ' ' + item.name; popup.append(title, document.createElement('br'));
      const location = document.createElement('span'); location.textContent = item.country + ' · ' + item.city; popup.append(location, document.createElement('br'));
      const details = document.createElement('button'); details.type = 'button'; details.textContent = langText('查看详情','View details');
      details.addEventListener('click', () => openLandmark(source.id)); popup.append(details);
      const marker = L.marker(twp(source), { icon, title: item.name, zIndexOffset: 200 }).addTo(map).bindPopup(popup);
      markers.push(marker);
    });
  }
  function updateMarkerDensity() { document.getElementById('mapCanvas')?.classList.toggle('map-compact-labels', Boolean(map && map.getZoom() < 5)); }
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
  function schedulePlaces(){clearTimeout(placeTimer);renderNearbyPlaces();placeTimer=setTimeout(loadNearbyPlaces,650);}
  async function loadNearbyPlaces(){
    if(!map||map.getZoom()<4)return;
    const b=map.getBounds(),s=Math.max(-85,b.getSouth()),n=Math.min(85,b.getNorth()),w=Math.max(-180,b.getWest()),e=Math.min(180,b.getEast());
    if(w>=e||s>=n||(n-s)*(e-w)>2000)return;
    const sequence=++placeRequest;
    try{
      const response=await fetch('/api/map/places?bbox='+[s,w,n,e].map(v=>v.toFixed(3)).join(','),{signal:AbortSignal.timeout(28000)}),payload=await response.json();
      if(sequence!==placeRequest)return;if(!response.ok||!Array.isArray(payload.places))throw new Error();
      nearbyPlaces=payload.places;await renderNearbyPlaces();
      let credit=document.getElementById('mapPlaceAttribution');if(!credit){credit=document.createElement('small');credit.id='mapPlaceAttribution';document.getElementById('mapStatus')?.after(credit);}credit.replaceChildren();const source=document.createElement('a');source.href='https://github.com/audiala/open-data';source.target='_blank';source.rel='noopener noreferrer';source.textContent='Data by Audiala · CC BY 4.0';credit.append(source);
      status(langText('本范围已加载 ','Loaded ')+nearbyPlaces.length+langText(' 个地图景点（单次最多400）；继续放大查看其他地点。',' mapped attractions in this view (up to 400 per request). Zoom in for more places.'));
    }catch(_){if(sequence===placeRequest)status(langText('更多景点暂时无法加载，已保留现有地标；移动地图可重试。','More attractions could not load. Existing landmarks remain; move the map to retry.'));}
  }
  async function initMap() {
    const canvas = document.getElementById('mapCanvas');
    if (!canvas) return;
    if (canvas.offsetParent === null) return;
    try {
      data = await loadData();
      if (!window.L) { renderFallback(); status(langText('离线地图 · 使用已缓存地标数据；联网后可启用拖动、缩放和搜索。','Offline map · Showing cached landmarks. Reconnect to pan, zoom and search.')); return; }
      if (!map) { map = L.map(canvas, { zoomControl: true, worldCopyJump: true,dragging:!coarse,touchZoom:!coarse,scrollWheelZoom:!coarse,doubleClickZoom:!coarse,boxZoom:!coarse }).setView([20, 10], 1); map.on('zoomend', updateMarkerDensity); map.on('moveend',renderOnlineUsers);map.on('moveend',renderMarkers);map.on('moveend',schedulePlaces); }
      if (!map._twTileLayer) { map._twTileLayer = TravelMapProviders.tileLayer(map); }
      renderMarkers();
      updateMarkerDensity();
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
  async function openLandmark(id) {
    if (!data) {
      try { data = await loadData(); }
      catch (_) { status(langText('地点详情暂时无法加载，请稍后重试。','Place details could not load. Please try again.')); return; }
    }
    const source = (data && data.landmarks || []).find(entry => entry.id === id || entry.globalId === id);
    if (!source) return;const item=localized(source);
    if (map) map.setView(twp(source), 11);
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
      map.setView(tw([lat, lon]), 13);
      const icon = L.divIcon({ className: 'tw-q-pin', html: '<div class="tw-q-pin__body"><span class="tw-q-pin__icon">📍</span><span class="tw-q-pin__label">' + raw.replace(/[<>]/g, '') + '</span></div>', iconSize: [36, 36], iconAnchor: [18, 18] });
      const marker = L.marker(tw([lat, lon]), { icon }).addTo(map).bindPopup(result.displayName).openPopup(); markers.push(marker);
      status(langText('在线地图已定位：','Located on the map: ') + result.displayName);
    } catch (_) { status(langText('在线搜索暂时不可用；仍可浏览已缓存的 ','Online search is temporarily unavailable. You can still browse ') + (data?.landmarks?.length || 0) + langText(' 个地标。',' cached landmarks.')); }
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
  window.refreshTravelMapLocale=()=>{if(!data)return;renderMarkers();if(document.getElementById('landmarkDetailOverlay')&&window.currentMapLandmark)window.showLandmark(window.currentMapLandmark);};
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
