(function () {
  const catalogUrl = '/modules/data/global-landmark-guide-catalog.json?v=20261018-verified-2';
  const photoManifestUrl = '/modules/data/global-landmark-guide-assets.json?v=20261018-local-3';
  const photoSourceManifestUrl = '/modules/data/global-landmark-guide-images.json?v=20261018-expanded-3';
  const generatedManifestUrl = '/modules/data/global-guide-generated-images.json?v=20261019-category-slots-24';
  const sectionPhotoManifestUrl = '/modules/data/global-guide-section-images.json?v=20261019-sections-6';
  const transitUrl = 'https://overpass-api.de/api/interpreter';
  const openverseUrl = 'https://api.openverse.org/v1/images/';
  const generatedGuideArt = {
    Q62467: {
      src: '/assets/route-photos/coma-pedrosa-ai-guide.png',
      alt: '安道尔比利牛斯山湖景的 AI 生成示意图',
      label: 'AI 生成示意 · 非实景照片'
    }
  };
  const catalogAliases = { Q2047427: 'Q80290' };
  const labels = [
    ['eat', '吃', '地方风味'], ['drink', '喝', '咖啡与本地饮品'], ['play', '玩', '精选景点'],
    ['joy', '乐', '体验活动'], ['stay', '住', '精选住宿'], ['go', '行', '交通方式']
  ];
  const labelsById = Object.fromEntries(labels.map(([id, label, title]) => [id, { label, title }]));
  const sectionTitle = (id, item) => id === 'drink'
    ? itemDomestic(item) ? text('茶饮与本地饮品', 'Tea, coffee & local drinks') : text('咖啡与当地饮品', 'Coffee & local drinks')
    : labelsById[id]?.title || text('地点', 'Places');
  const photoCache = new Map();
  const usablePhoto = photo => !/\b(?:mascots?|souvenirs?|figurines?|toys?|selfies?|portraits?|little (?:girl|boy)|t-shirts?|posters?|logos?|stickers?|paintings?|engravings?|drawings?|postcards?)\b/i.test(photo.title || '');
  let catalogPromise;
  let photoManifestPromise;
  let photoManifestAt = 0;
  let userOrigin = null;
  const text = (zh, en) => window.TravelWorldI18n?.language?.() === 'en' ? en : zh;
  const escapeHtml = value => String(value ?? '').replace(/[&<>"']/g, char => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[char]);
  const make = (tag, className = '', copy = '', parent) => {
    const element = document.createElement(tag);
    if (className) element.className = className;
    if (copy !== '') element.textContent = copy;
    parent?.append(element);
    return element;
  };
  const coordinate = item => [Number(item.latitude), Number(item.longitude)];
  const usableCoordinates = item => coordinate(item).every(Number.isFinite) && Math.abs(item.latitude) <= 90 && Math.abs(item.longitude) <= 180;
  const distanceKm = (a, b) => {
    const [lat1, lon1] = coordinate(a).map(value => value * Math.PI / 180);
    const [lat2, lon2] = coordinate(b).map(value => value * Math.PI / 180);
    const dLat = lat2 - lat1;
    const dLon = lon2 - lon1;
    const h = Math.sin(dLat / 2) ** 2 + Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLon / 2) ** 2;
    return 6371 * 2 * Math.asin(Math.min(1, Math.sqrt(h)));
  };
  const closeEnough = (a, b, limitKm = 60) => distanceKm(a, b) <= limitKm;
  const displayName = item => window.TravelWorldI18n?.language?.() === 'en' ? (item.name_en || item.name || item.title) : (item.name || item.name_en || item.title);
  const countryName = item => window.TravelWorldI18n?.language?.() === 'en' ? (item.countryNameEn || item.country_en || item.country || '') : (item.countryName || item.country || item.country_en || '');
  const description = item => window.TravelWorldI18n?.language?.() === 'en'
    ? (item.description_en || item.description || text('No sourced description is available.', 'No sourced description is available.'))
    : (item.description_zh || item.description || text('暂无可靠来源的中文介绍；不编写未经核实的历史信息。', 'No sourced description is available.'));
  const placeLine = item => [item.city, countryName(item)].filter(Boolean).join(' · ');
  const searchText = item => [displayName(item), item.city, countryName(item)].filter(Boolean).join(' ');
  const safeHref = value => {
    try { const url = new URL(value); return url.protocol === 'https:' ? url.toString() : null; } catch { return null; }
  };
  const external = (href, label, className = 'wl-link', ariaLabel = '') => {
    const link = make('a', className, label);
    const safeUrl = safeHref(href);
    if (safeUrl) link.href = safeUrl;
    else { link.removeAttribute('href'); link.setAttribute('aria-disabled', 'true'); link.classList.add('is-unavailable'); }
    link.target = '_blank';
    link.rel = 'noopener noreferrer';
    if (ariaLabel) link.setAttribute('aria-label', ariaLabel);
    return link;
  };
  const bookingUrl = (item, filters = []) => {
    const query = {
      ss: searchText(item), lang: window.TravelWorldI18n?.language?.() === 'en' ? 'en-us' : 'zh-cn'
    };
    if (filters.length) query.nflt = filters.join(';');
    return 'https://www.booking.com/searchresults.html?' + new URLSearchParams(query);
  };
  const mapSearchUrl = (item, query = searchText(item)) => {
    const [lat, lon] = coordinate(item);
    if (item.countryCode === 'CN' || /^(中国|china)$/i.test(item.country || '')) {
      const [mapLat, mapLon] = window.TravelMapProviders?.amapLatLng(lat, lon) || [lat, lon];
      return 'https://uri.amap.com/search?' + new URLSearchParams({ keyword: query, center: `${mapLon},${mapLat}`, view: 'list', callnative: '1' });
    }
    return 'https://www.google.com/maps/search/?' + new URLSearchParams({ api: '1', query: `${query} ${lat},${lon}` });
  };
  const routeUrl = (item, mode = 'car') => {
    const [lat, lon] = coordinate(item);
    if (item.countryCode === 'CN' || /^(中国|china)$/i.test(item.country || '')) {
      const [toLat, toLon] = window.TravelMapProviders?.amapLatLng(lat, lon) || [lat, lon];
      const from = userOrigin ? window.TravelMapProviders?.amapLatLng(userOrigin.latitude, userOrigin.longitude) || [userOrigin.latitude, userOrigin.longitude] : null;
      return 'https://uri.amap.com/navigation?' + new URLSearchParams({ from: from ? `${from[1]},${from[0]},${text('当前位置', 'My location')}` : ',,', to: `${toLon},${toLat},${displayName(item)}`, mode: mode === 'metro' ? 'bus' : mode, callnative: '1' });
    }
    const query = { api: '1', destination: `${lat},${lon}`, travelmode: ({ walk: 'walking', bus: 'transit', metro: 'transit', car: 'driving' })[mode] || 'driving' };
    if (userOrigin) query.origin = `${userOrigin.latitude},${userOrigin.longitude}`;
    return 'https://www.google.com/maps/dir/?' + new URLSearchParams(query);
  };
  const transitSearchUrl = (item, mode) => mapSearchUrl(item, `${displayName(item)} ${mode === 'metro' ? text('附近地铁站', 'nearby metro stations') : text('附近公交站', 'nearby bus stops')}`);
  const rideUrl = item => {
    const [latitude, longitude] = coordinate(item);
    if (item.countryCode === 'CN' || /^(中国|china)$/i.test(item.country || '')) return 'https://webapp.didi.cn/';
    const url = new URL('https://m.uber.com/looking/');
    url.searchParams.set('pickup', 'my_location');
    url.searchParams.set('drop[0]', JSON.stringify({ latitude, longitude, addressLine1: displayName(item), addressLine2: placeLine(item) }));
    return url.toString();
  };
  const ticketUrl = item => 'https://www.trip.com/things-to-do/list?' + new URLSearchParams({ pagetype: 'city', keyword: `${displayName(item)} ${countryName(item)} tickets tours`, kwdfrom: 'srch', 'ext-searchpage': '1' });

  async function getCatalog() {
    if (!catalogPromise) catalogPromise = fetch(catalogUrl, { cache: 'force-cache', signal: AbortSignal.timeout(20000) })
      .then(response => { if (!response.ok) throw new Error(`Catalog HTTP ${response.status}`); return response.json(); })
      .catch(error => { catalogPromise = null; throw error; });
    return catalogPromise;
  }

  async function getPhotoManifest() {
    if (!photoManifestPromise || Date.now() - photoManifestAt > 60000) {
      photoManifestAt = Date.now();
      photoManifestPromise = Promise.all([
        fetch(photoManifestUrl, { cache: 'no-cache', signal: AbortSignal.timeout(15000) }).then(response => response.ok ? response.json() : null).catch(() => null),
        fetch(photoSourceManifestUrl, { cache: 'no-cache', signal: AbortSignal.timeout(15000) }).then(response => response.ok ? response.json() : null).catch(() => null),
        fetch(generatedManifestUrl, { cache: 'no-cache', signal: AbortSignal.timeout(15000) }).then(response => response.ok ? response.json() : null).catch(() => null)
      ]).then(([local, source, generated]) => {
        if (!local && !source && !generated) return null;
        const places = {};
        for (const id of new Set([...Object.keys(local?.places || {}), ...Object.keys(source?.places || {}), ...Object.keys(generated?.places || {})])) {
          const localPlace = local?.places?.[id] || {}, sourcePlace = source?.places?.[id] || {}, generatedPlace = generated?.places?.[id] || [], seen = new Set();
          const merge = (a = [], b = []) => [...a, ...b].filter(photo => {
            const key = photo.unique || photo.remoteSrc || photo.sourceUrl || photo.src;
            if (!key || seen.has(key)) return false;
            seen.add(key); return true;
          });
          places[id] = { ...sourcePlace, ...localPlace, photos: merge(localPlace.photos, sourcePlace.photos), generated: merge(merge(localPlace.generated, sourcePlace.generated), generatedPlace) };
        }
        return { ...source, ...local, places, transport: local?.transport || source?.transport || {} };
      });
    }
    return photoManifestPromise;
  }

  async function searchPhotos(item) {
    if (item.guidePhotos) return item.guidePhotos;
    const queries = [
      [item.name_en || displayName(item), item.city_en || item.city, item.countryNameEn || item.country_en || item.countryName || item.country],
      [item.name || displayName(item), item.city, item.countryName || item.country]
    ].map(parts => [...new Set(parts.filter(Boolean))].join(' ').slice(0, 190)).filter((query, index, all) => query && all.indexOf(query) === index);
    const key = queries.join(' | ').toLocaleLowerCase();
    if (photoCache.has(key)) return photoCache.get(key);
    const task = (async () => {
      const manifest = await getPhotoManifest();
      const prepared = manifest?.places?.[item.id];
      if (prepared?.photos?.some(usablePhoto)) return prepared.photos.filter(usablePhoto);
      const names = [item.name_en, item.name, displayName(item)].filter(Boolean).map(name => String(name).normalize('NFKC').toLocaleLowerCase());
      const results = [];
      for (const query of queries) {
        const params = new URLSearchParams({ q: query, license: 'by,by-sa,cc0,pdm', license_type: 'commercial', page_size: '20', mature: 'false' });
        const response = await fetch(openverseUrl + '?' + params, { signal: AbortSignal.timeout(15000) });
        if (!response.ok) throw new Error(`Photo search HTTP ${response.status}`);
        const payload = await response.json();
        for (const photo of payload.results || []) {
          const source = `${photo.source || ''} ${photo.provider || ''} ${photo.foreign_landing_url || ''}`;
          const identity = `${photo.title || ''} ${photo.description || ''} ${photo.foreign_landing_url || ''}`.normalize('NFKC').toLocaleLowerCase();
          const placeMatched = names.some(name => {
            const tokens = name.split(/[^\p{L}\p{N}]+/u).filter(token => token.length > 2);
            const exactMatch = name.length > 2 && identity.includes(name);
            const tokenMatches = tokens.filter(token => identity.includes(token)).length;
            return exactMatch || (tokens.length >= 2 && tokenMatches >= Math.max(2, Math.ceil(tokens.length * .7)));
          });
          if (!placeMatched || !usablePhoto(photo) || /(wikimedia|wikipedia)/i.test(source) || !['by', 'by-sa', 'cc0', 'pdm'].includes(photo.license)
            || !safeHref(photo.thumbnail) || !safeHref(photo.foreign_landing_url) || !safeHref(photo.license_url)) continue;
          const unique = photo.id || photo.foreign_landing_url;
          if (results.some(result => result.unique === unique)) continue;
          results.push({ unique, src: safeHref(photo.thumbnail), title: photo.title || displayName(item), creator: photo.creator || text('作者未标注', 'Creator not listed'),
            license: `${photo.license || ''}${photo.license_version ? ` ${photo.license_version}` : ''}`.trim(),
            licenseUrl: safeHref(photo.license_url), sourceUrl: safeHref(photo.foreign_landing_url), provider: photo.provider || photo.source || 'Openverse' });
          if (results.length === 5) break;
        }
        if (results.length === 5) break;
      }
      return results;
    })();
    photoCache.set(key, task);
    try { return await task; } catch (error) { photoCache.delete(key); throw error; }
  }

  function icon(id, cls = 'wl-category-icon') {
    if (window.TravelGuideIcon) {
      const shared = window.TravelGuideIcon(id === 'joy' ? 'leisure' : id, cls);
      shared.dataset.categoryIcon = id;
      return shared;
    }
    const paths = {
      eat: '<path d="M9 25h30c-1.6 8.5-7.1 13-15 13S10.6 33.5 9 25Z"/><path d="M12 22c3-3 5 2 8 0s5-3 8 0 5-3 8 0"/><path d="m13 8 17 16m-13-18 17 16"/><circle cx="18" cy="19" r="1"/><circle cx="25" cy="21" r="1"/><circle cx="31" cy="20" r="1"/>',
      drink: '<path d="M11 19h24v8a12 12 0 0 1-24 0v-8Zm24 3h3.5a4.5 4.5 0 0 1 0 9H34M14 41h22"/><path d="M17 13c-2-2 2-3 0-6m7 6c-2-2 2-3 0-6m7 6c-2-2 2-3 0-6"/>',
      play: '<circle cx="24" cy="20" r="14"/><circle cx="24" cy="20" r="3"/><path d="M24 6v11m14-1-11 3m6 13-7-9m-14 9 7-9m-11-7 11 3M17 34l-5 8m19-8 5 8M13 42h22"/><path d="M24 3V1"/>',
      joy: '<path d="M7 37 24 9l17 28H7Z"/><path d="m13 27 11 8 11-8M17 20l7 5 7-5M24 9V5"/><path d="M10 41h28"/>',
      stay: '<path d="M7 18V8h14v10m-14 8h34v13H7V26Zm0 0v-4a4 4 0 0 1 4-4h9a6 6 0 0 1 6 6v2m0 0v-3a5 5 0 0 1 5-5h5a5 5 0 0 1 5 5v3M11 39v3m26-3v3"/>',
      go: '<path d="m8 29 3-11a5 5 0 0 1 5-4h16a5 5 0 0 1 5 4l3 11v9H8v-9Z"/><path d="M11 28h26m-22-8h18M14 34h.1m20 0h.1M14 43l4-5m16 5-4-5"/>',
      car: '<path d="m7 27 4-11a5 5 0 0 1 5-3h16a5 5 0 0 1 5 3l4 11v11H7V27Z"/><path d="M10 27h28M14 34h.1M34 34h.1M13 20h22"/>',
      metro: '<rect x="9" y="6" width="30" height="31" rx="7"/><path d="M16 13h16v12H16zm-7 12h30M15 43l9-6 9 6M17 31l-3 4m17-4 3 4"/>',
      bus: '<rect x="7" y="8" width="34" height="30" rx="6"/><path d="M13 14h22v13H13zm-6 13h34M14 34h.1M34 34h.1M14 43l5-5m15 5-5-5"/>'
    };
    const holder = make('span', cls); holder.setAttribute('aria-hidden', 'true'); holder.dataset.categoryIcon = id;
    holder.innerHTML = `<svg viewBox="0 0 48 48" focusable="false">${paths[id] || paths.play}</svg>`;
    return holder;
  }

  async function loadNearby(item, controller) {
    const [lat, lon] = coordinate(item);
    const beverages = itemDomestic(item) ? 'cafe|bar|pub|ice_cream|juice_bar|tea_house|tea_room|tea' : 'cafe|bar|pub|ice_cream|juice_bar';
    const query = `[out:json][timeout:15];nwr(around:4500,${lat},${lon})["amenity"~"restaurant|fast_food|food_court"]["name"];out center tags 20;nwr(around:4500,${lat},${lon})["amenity"~"${beverages}"]["name"];out center tags 20;nwr(around:10000,${lat},${lon})["tourism"~"hotel|hostel|guest_house|motel"]["name"];out center tags 20;`;
    let payload, lastError;
    for (const endpoint of [transitUrl, 'https://overpass.kumi.systems/api/interpreter']) {
      try {
        const response = await fetch(endpoint, { method: 'POST', body: new URLSearchParams({ data: query }), signal: AbortSignal.any([controller.signal, AbortSignal.timeout(22000)]) });
        if (!response.ok) throw new Error(`Nearby places HTTP ${response.status}`);
        payload = await response.json();
        if (payload.remark && !payload.elements?.length) throw new Error(payload.remark);
        break;
      } catch (error) { if (controller.signal.aborted) throw error; lastError = error; }
    }
    if (!payload) throw lastError;
    const seen = new Set();
    return (payload.elements || []).flatMap(element => {
      const tags = element.tags || {};
      const title = tags.name || tags['name:en'] || tags['name:zh'];
      if (!title || !title.trim()) return [];
      const point = element.center || element;
      const place = {
        id: `osm-${element.type}-${element.id}`, name: title.trim(), name_en: tags['name:en'] || title.trim(),
        city: item.city || '', country: item.country || countryName(item), countryCode: item.countryCode,
        latitude: Number(point.lat), longitude: Number(point.lon), tags, source: 'openstreetmap',
        sourceUrl: `https://www.openstreetmap.org/${element.type}/${element.id}`
      };
      const key = `${title.toLocaleLowerCase()}:${Math.round(place.latitude * 1000)}:${Math.round(place.longitude * 1000)}`;
      if (seen.has(key) || !usableCoordinates(place)) return [];
      seen.add(key);
      const beveragePlace = itemDomestic(item) ? /^(cafe|bar|pub|ice_cream|juice_bar|tea_house|tea_room|tea)$/.test(tags.amenity || '') : /^(cafe|bar|pub|ice_cream|juice_bar)$/.test(tags.amenity || '');
      place.section = /^(hotel|hostel|guest_house|motel)$/.test(tags.tourism || '') ? 'stay' : beveragePlace ? 'drink' : 'eat';
      place.category = tags.amenity || tags.tourism || 'local place';
      place.summary = `${distanceKm(place, item).toFixed(1)} km · ${text('OpenStreetMap 地点记录；没有可靠评分或实时价格数据。', 'OpenStreetMap listing; no verified rating or live price data.')}`;
      return [place];
    });
  }

  async function renderGuide(selected) {
    const [imageManifest, sectionManifest] = await Promise.all([
      getPhotoManifest(),
      fetch(sectionPhotoManifestUrl, { cache: 'no-cache', signal: AbortSignal.timeout(15000) })
        .then(response => response.ok ? response.json() : null).catch(() => null)
    ]);
    const generatedArtFor = (item, kind = 'hero') => imageManifest?.places?.[item.id]?.generated?.find(art => (art.kind || 'hero') === kind)
      || (kind === 'hero' ? generatedGuideArt[item.id] : null);
    document.getElementById('photoPlaceDialog')?.remove();
    window.currentMapLandmark = selected;
    const dialog = document.createElement('dialog');
    dialog.id = 'photoPlaceDialog';
    dialog.className = 'tw-photo-detail place-westlake-guide-v2 global-landmark-guide';
    dialog.setAttribute('aria-label', text(`${displayName(selected)}景点导览`, `${displayName(selected)} travel guide`));
    const shell = make('div', 'wl-shell', '', dialog);
    const scroll = make('div', 'wl-scroll', '', shell);
    const topbar = make('div', 'wl-topbar', '', scroll);
    const back = make('button', 'wl-quiet-button', text('‹ 返回探索', '‹ Back to Explore'), topbar); back.type = 'button'; back.addEventListener('click', () => dialog.close());
    make('span', 'wl-top-note', 'TRAVEL WORLD · PLACE GUIDE', topbar);
    const hero = make('header', 'wl-hero global-guide-hero', '', scroll);
    const heroArt = make('img', 'global-guide-hero-image', '', hero); heroArt.alt = `${displayName(selected)} · ${countryName(selected)}`; heroArt.hidden = true;
    const heroPhotoStatus = make('span', 'global-hero-photo-status', text('正在核对地点实景图片…', 'Checking matched place photos…'), hero);
    const heroCopy = make('div', 'wl-hero-copy global-guide-hero-copy', '', hero);
    make('span', 'wl-kicker', `${countryName(selected)}${selected.city ? ` · ${selected.city}` : ''}`, heroCopy);
    make('h1', '', displayName(selected), heroCopy);
    make('p', '', description(selected), heroCopy);
    const photoCredit = make('div', 'global-hero-credit', '', hero); photoCredit.hidden = true;
    const searchButton = make('button', 'wl-search-button', '⌖', hero); searchButton.type = 'button'; searchButton.setAttribute('aria-label', text('查看交通与导航', 'View transport and directions'));
    searchButton.addEventListener('click', () => scroll.querySelector('#global-go')?.scrollIntoView({ behavior: matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth', block: 'start' }));

    const nav = make('nav', 'wl-categories global-guide-categories', '', scroll); nav.setAttribute('aria-label', text('景区导览分类', 'Destination categories'));
    labels.forEach(([id, label, title]) => {
      const button = make('button', 'wl-category', '', nav); button.type = 'button'; button.setAttribute('aria-label', `${label}：${sectionTitle(id, selected)}`);
      button.append(icon(id)); make('span', 'global-guide-category-label', label, button);
      button.addEventListener('click', () => scroll.querySelector(`#global-${id}`)?.scrollIntoView({ behavior: matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth', block: 'start' }));
    });

    const intro = make('section', 'wl-intro global-guide-intro', '', scroll);
    const introCopy = make('div', '', '', intro);
    make('span', 'wl-kicker', text('目的地导览', 'DESTINATION GUIDE'), introCopy);
    make('h2', '', text('把附近慢慢逛明白', 'Explore the place at your pace'), introCopy);
    make('p', '', text('点击地点看站内介绍；只有导航和第三方服务入口才会离开本页。', 'Open place details here; only navigation and provider actions leave this page.'), intro);

    const mapPanel = make('section', 'global-guide-map-panel', '', scroll); mapPanel.setAttribute('aria-label', text('景点位置地图', 'Map location'));
    const mapCanvas = make('div', 'global-guide-map', '', mapPanel);
    const mapCaption = make('div', 'global-guide-map-caption', '', mapPanel);
    make('strong', '', displayName(selected), mapCaption);
    make('span', '', `${coordinate(selected).map(value => value.toFixed(4)).join(', ')} · ${text('地图点位', 'Map pin')}`, mapCaption);
    const mapLink = external(mapSearchUrl(selected), text('打开地图 ↗', 'Open map ↗'), 'wl-primary-action'); mapPanel.append(mapLink);
    let map = null;
    if (window.L && usableCoordinates(selected)) {
      const [lat, lon] = coordinate(selected);
      const center = window.TravelMapProviders?.focusLatLng(lat, lon) || [lat, lon];
      try { map = window.L.map(mapCanvas, { scrollWheelZoom: false, zoomControl: true }).setView(center, 13); window.TravelMapProviders?.tileLayer(map); window.L.marker(center).addTo(map).bindPopup(displayName(selected)); requestAnimationFrame(() => map?.invalidateSize()); } catch { map = null; }
    }

    const sections = make('main', 'wl-sections global-guide-sections', '', scroll);
    const feedback = make('p', 'wl-status', '', shell); feedback.hidden = true; feedback.setAttribute('role', 'status');
    const controller = new AbortController();
    async function showCardImageFallback(image, item, categoryId) {
      const art = generatedArtFor(item, categoryId);
      if (art) {
        if (!image.isConnected) return;
        const generated = document.createElement('span'); generated.className = `${image.className} global-generated-card-image`;
        generated.setAttribute('role', 'img'); generated.setAttribute('aria-label', art.alt);
        const photo = document.createElement('img'); photo.src = art.src; photo.alt = ''; photo.loading = 'lazy'; photo.decoding = 'async'; generated.append(photo);
        make('span', 'global-generated-card-label', art.label, generated);
        image.replaceWith(generated); return;
      }
      const manifest = await getPhotoManifest();
      if (!image.isConnected) return;
      const missing = document.createElement('span'); missing.className = `${image.className} global-photo-unavailable`;
      missing.setAttribute('role', 'img');
      const manifestEntry = manifest?.places?.[item.id];
      const isLandmark = Boolean(item.wikidataEntityUrl || item.wikidataId || /^Q\d+$/.test(item.id || ''));
      const label = isLandmark && manifestEntry?.generationPrompt
        ? text('地点示意图待生成；暂无匹配实景照片。', 'Place illustration pending; no matched real photo yet.')
        : text('暂无匹配且可核验的照片。', 'No matched, verifiable photo is available.');
      missing.setAttribute('aria-label', `${displayName(item)}：${label}`); missing.textContent = label;
      image.replaceWith(missing);
    }

    const photoObserver = new IntersectionObserver(entries => entries.forEach(entry => {
      if (!entry.isIntersecting) return;
      const image = entry.target; photoObserver.unobserve(image);
      const owner = image._guideItem;
      searchPhotos(owner).then(photos => {
        const orderedPhotos = image._guideCategory === 'joy' && photos.length > 1 ? [...photos.slice(1), photos[0]] : photos;
        let photoIndex = 0;
        let photo = orderedPhotos[photoIndex];
        if (!image.isConnected) return;
        if (!photo) { showCardImageFallback(image, owner, image._guideCategory); return; }
        const article = image.closest('.global-guide-card');
        const replacement = document.createElement('img'); replacement.className = image.className; replacement.alt = photo.title; replacement.loading = 'lazy'; replacement.decoding = 'async';
        replacement.addEventListener('load', () => {
          if (!article?.isConnected) return;
          const credit = make('div', 'wl-card-photo-credit', '', article);
          make('span', '', `${photo.creator} · ${photo.license}`, credit);
          credit.append(external(photo.sourceUrl, text('图片来源', 'Photo source'), 'wl-card-photo-credit-link'));
          credit.append(external(photo.licenseUrl, text('许可', 'License'), 'wl-card-photo-credit-link'));
          const transport = article.querySelector('.wl-card-ways, .wl-card-provider');
          if (transport) article.insertBefore(credit, transport);
        }, { once: true });
        replacement.addEventListener('error', () => {
          photo = orderedPhotos[++photoIndex];
          if (photo) { replacement.alt = photo.title; replacement.src = photo.src; }
          else showCardImageFallback(replacement, owner, image._guideCategory);
        });
        replacement.src = photo.src;
        image.replaceWith(replacement);
      }).catch(() => showCardImageFallback(image, owner, image._guideCategory));
    }), { root: scroll, rootMargin: '180px' });

    function setStatus(message) { feedback.hidden = false; feedback.textContent = message; clearTimeout(feedback._timer); feedback._timer = setTimeout(() => { feedback.hidden = true; }, 2600); }
    function photoPlaceholder(item, parent, categoryId) { const image = make('span', 'wl-card-image global-photo-placeholder', '', parent); image.setAttribute('role', 'img'); image.setAttribute('aria-label', text(`${displayName(item)}授权图片加载中`, `Searching licensed images for ${displayName(item)}`)); make('span', 'global-photo-loading-label', text('正在查找授权实景图…', 'Finding an openly licensed photo…'), image); image._guideItem = item; image._guideCategory = categoryId; photoObserver.observe(image); return image; }
    function detail(item, categoryId, trigger) {
      shell.querySelector('.wl-detail')?.remove();
      const page = make('article', 'wl-detail', '', shell); page.tabIndex = -1;
      const toolbar = make('div', 'wl-detail-top', '', page);
      const close = make('button', 'wl-quiet-button', text('‹ 返回导览', '‹ Back to guide'), toolbar); close.type = 'button'; close.addEventListener('click', () => { page.remove(); scroll.hidden = false; trigger?.focus({ preventScroll: true }); });
      const heading = make('header', 'wl-detail-heading', '', page);
      make('span', '', `${sectionTitle(categoryId, item)} · ${countryName(item)}`, heading);
      make('h2', '', displayName(item), heading);
      make('p', '', item.summary || description(item), heading);
      const gallery = make('div', 'wl-detail-gallery global-guide-gallery', '', page); gallery.setAttribute('aria-label', `${displayName(item)} ${text('照片', 'photos')}`);
      const loading = make('p', 'global-photo-status', text('正在查找可合法展示的地点照片…', 'Searching for openly licensed place photos…'), gallery);
      const generatedArt = generatedArtFor(item);
      if (generatedArt) {
        const figure = make('figure', 'wl-photo global-generated-photo', '', gallery);
        const image = make('img', '', '', figure); image.src = generatedArt.src; image.alt = generatedArt.alt; image.loading = 'eager'; image.decoding = 'async';
        make('figcaption', '', generatedArt.label, figure);
      }
      searchPhotos(item).then(photos => {
        loading.remove();
        if (!photos.length) { make('p', 'global-photo-status', text(generatedArt ? '暂未找到可确认许可的实景照片；上图为 AI 示意。' : '暂未找到可确认许可且排除维基来源的照片。', generatedArt ? 'No openly licensed real photo was found; the image above is AI-generated.' : 'No compatible photo found outside Wikipedia/Wikimedia sources.'), gallery); return; }
        photos.forEach(photo => {
          const figure = make('figure', 'wl-photo', '', gallery);
          const image = make('img', '', '', figure); image.src = photo.src; image.alt = photo.title; image.loading = 'lazy'; image.decoding = 'async';
          const caption = make('figcaption', '', photo.generated ? photo.label : `${photo.creator} · ${photo.license} · ${photo.provider}`, figure);
          if (photo.sourceUrl) caption.append(external(photo.sourceUrl, text('查看原图来源', 'Source'), 'wl-photo-source'));
          if (photo.licenseUrl) caption.append(external(photo.licenseUrl, text('许可', 'License'), 'wl-photo-source'));
        });
      }).catch(() => { loading.textContent = text('图片服务暂时不可用；不显示未核验替代图。', 'Photo search is unavailable; no substitute image is shown.'); });
      if (item.referencePhoto) {
        make('p', 'wl-honesty-note', text('照片展示当地或所在地区的风貌，不冒充具体商户、房型或实时服务；原图来源和使用许可见图片下方。', 'These photos show the destination or its region, not a claim about a specific business, room or live service. Sources and licenses are linked below.'), page);
        scroll.hidden = true; page.focus({ preventScroll: true }); shell.scrollTop = 0;
        return;
      }
      const facts = make('dl', 'global-guide-facts', '', page);
      const tags = item.tags || {};
      const address = tags['addr:full'] || [tags['addr:housenumber'], tags['addr:street'], tags['addr:city'], tags['addr:postcode']].filter(Boolean).join(' ');
      const factsList = [[text('国家/地区', 'Country/region'), countryName(item)], [text('坐标', 'Coordinates'), usableCoordinates(item) ? `${Number(item.latitude).toFixed(5)}, ${Number(item.longitude).toFixed(5)}` : text('暂无', 'Unavailable')],
        [text('类别', 'Type'), item.category || tags.amenity || tags.tourism || text('景点', 'Place')], [text('知名度参考', 'Notability proxy'), item.rank ? `${item.rank} ${text('条跨语言条目链接；不是游客数', 'sitelinks; not visitor counts')}` : text('暂无比较值', 'Unavailable')]];
      if (address) factsList.push([text('地址（地图标注）', 'Address (map listing)'), address]);
      if (tags.opening_hours) factsList.push([text('营业时间（地图标注）', 'Hours (map listing)'), tags.opening_hours]);
      if (tags.cuisine) factsList.push([text('菜系（地图标注）', 'Cuisine (map listing)'), tags.cuisine]);
      if (tags.phone) factsList.push([text('电话（地图标注）', 'Phone (map listing)'), tags.phone]);
      factsList.forEach(([term, value]) => {
        const row = make('div', '', '', facts); make('dt', '', term, row); make('dd', '', value || text('未提供', 'Not provided'), row);
      });
      make('p', 'wl-detail-copy', description(item), page);
      const actions = make('div', 'wl-detail-actions', '', page);
      actions.append(external(routeUrl(item, 'car'), text('导航到这里 ↗', 'Navigate here ↗'), 'wl-primary-action'));
      if (safeHref(tags.website || tags.url)) actions.append(external(tags.website || tags.url, text('商家网站 ↗', 'Business website ↗')));
      if (categoryId === 'stay') actions.append(external(bookingUrl(item), text('在 Booking.com 搜索住宿 ↗', 'Search stays on Booking.com ↗')));
      else if (categoryId === 'joy' || categoryId === 'play') actions.append(external(ticketUrl(item), text('查询门票与体验 ↗', 'Search tickets and experiences ↗')));
      const sourceLink = item.wikidataEntityUrl || item.sourceUrl;
      if (sourceLink) actions.append(external(sourceLink, text('查看地点数据来源 ↗', 'View place data source ↗')));
      make('p', 'wl-honesty-note', text('营业状态、票价、库存、商户评分与酒店价格不在此页伪造；请以第三方实时页面为准。图片署名和许可见图下链接。', 'Opening status, tickets, availability, business ratings and hotel prices are not fabricated here. Check live providers; photo credits and licenses are linked below.'), page);
      scroll.hidden = true; page.focus({ preventScroll: true }); shell.scrollTop = 0;
    }

    function transportRow(item, parent) {
      const row = make('nav', 'wl-card-ways global-guide-ways', '', parent); row.setAttribute('aria-label', `${text('前往', 'Getting to ')}${displayName(item)}`);
      [['car', text('打车', 'Ride')], ['metro', text('地铁', 'Metro')], ['bus', text('公交', 'Bus')]].forEach(([kind, label]) => {
        const href = kind === 'car' ? rideUrl(item) : transitSearchUrl(item, kind);
        const link = external(href, '', 'wl-card-way', `${label} · ${displayName(item)}`); link.append(icon(kind, 'wl-way-icon'));
        link.dataset.routeMode = kind;
        link._guideItem = item;
        make('span', 'wl-way-label', label, link); row.append(link);
      });
      return row;
    }

    function card(item, categoryId, options = {}) {
      const article = make('article', 'wl-card global-guide-card', '', options.parent);
      const open = make('button', 'wl-card-open', '', article); open.type = 'button'; open.setAttribute('aria-label', text(`查看${displayName(item)}介绍`, `View ${displayName(item)} details`));
      photoPlaceholder(item, open, categoryId);
      const copy = make('span', 'wl-card-copy', '', open);
      make('strong', '', displayName(item), copy);
      make('span', 'wl-card-summary', item.summary || description(item) || item.category || text('查看地点信息与照片', 'View place information and photos'), copy);
      make('span', 'wl-card-more', text('地点介绍与照片 →', 'Details and photos →'), copy);
      open.addEventListener('click', () => detail(item, categoryId, open));
      if (options.transport) transportRow(item, article);
      if (options.provider) article.append(external(options.provider.href, options.provider.label, 'wl-card-provider'));
      return article;
    }

    function carousel(parent, items, categoryId, options = {}) {
      const controls = make('div', 'wl-carousel-controls', '', parent);
      make('span', 'wl-scroll-hint', text('左右滑动查看更多', 'Swipe to explore'), controls);
      const prev = make('button', 'wl-arrow', '←', controls); prev.type = 'button'; prev.setAttribute('aria-label', text('向左滑动', 'Scroll left'));
      const next = make('button', 'wl-arrow', '→', controls); next.type = 'button'; next.setAttribute('aria-label', text('向右滑动', 'Scroll right'));
      const rail = make('div', 'wl-carousel', '', parent); rail.setAttribute('role', 'region'); rail.setAttribute('aria-label', `${sectionTitle(categoryId, window.currentMapLandmark)} ${text('卡片，可横向滑动', 'cards, horizontally scrollable')}`);
      items.forEach(item => card(item, categoryId, { parent: rail, transport: options.transport, provider: options.providerFor?.(item) }));
      const update = () => { const max = Math.max(0, rail.scrollWidth - rail.clientWidth); prev.disabled = rail.scrollLeft < 4; next.disabled = rail.scrollLeft >= max - 4; };
      prev.addEventListener('click', () => rail.scrollBy({ left: -rail.clientWidth * .8, behavior: 'smooth' }));
      next.addEventListener('click', () => rail.scrollBy({ left: rail.clientWidth * .8, behavior: 'smooth' }));
      rail.addEventListener('scroll', update, { passive: true }); requestAnimationFrame(update);
      let drag = null; let suppressClickUntil = 0;
      rail.addEventListener('pointerdown', event => { if (event.pointerType === 'mouse' && event.button === 0) drag = { x: event.clientX, left: rail.scrollLeft, moved: false }; });
      rail.addEventListener('pointermove', event => { if (!drag) return; const delta = event.clientX - drag.x; if (Math.abs(delta) > 10) { drag.moved = true; rail.scrollLeft = drag.left - delta; } });
      const end = () => { if (drag?.moved) suppressClickUntil = Date.now() + 280; drag = null; };
      rail.addEventListener('pointerup', end); rail.addEventListener('pointercancel', end);
      rail.addEventListener('click', event => { if (Date.now() < suppressClickUntil) { event.preventDefault(); event.stopImmediatePropagation(); } }, true);
      return rail;
    }

    function section(id, index, note, items, options = {}) {
      const definition = labelsById[id];
      const previousSection = sections.querySelector(`#global-${id}`);
      const node = make('section', 'wl-section global-guide-section'); node.id = `global-${id}`;
      if (previousSection) previousSection.replaceWith(node); else sections.append(node);
      const heading = make('div', 'wl-section-heading', '', node);
      const title = make('div', 'wl-section-title', '', heading);
      make('span', '', definition.label, title);
      const titleText = make('div', '', '', title); make('h2', '', `${text('附近推荐 · ', 'Nearby · ')}${sectionTitle(id, selected)}`, titleText); make('p', '', note, titleText);
      make('span', 'wl-section-index', String(index + 1).padStart(2, '0'), heading);
      const sectionPhotos = (sectionManifest?.places?.[selected.id]?.[id] || []).slice(0, 2);
      const generatedSectionPhotos = (imageManifest?.places?.[selected.id]?.generated || [])
        .filter(art => art.kind === id && Number(art.slot || 1) > sectionPhotos.length)
        .sort((a, b) => Number(a.slot || 1) - Number(b.slot || 1))
        .map(art => ({ src: art.src, title: `${displayName(selected)} · ${sectionTitle(id, selected)}`, label: art.label || text('AI 生成示意 · 非实景照片', 'AI illustration · not a documentary photo'), generated: true, scope: countryName(selected), unique: art.src }));
      sectionPhotos.push(...generatedSectionPhotos.slice(0, Math.max(0, 2 - sectionPhotos.length)));
      if (sectionPhotos.length) {
        const gallery = make('div', 'global-section-photo-pair', '', node);
        sectionPhotos.forEach(photo => {
          const photoItem = { ...selected, id: `section-${selected.id}-${id}`, name: `${displayName(selected)} · ${sectionTitle(id, selected)}`, name_en: `${selected.name_en || displayName(selected)} · ${sectionTitle(id, selected)}`, summary: photo.scope || photo.title, referencePhoto: true, guidePhotos: sectionPhotos };
          const button = make('button', 'global-section-photo', '', gallery); button.type = 'button';
          button.setAttribute('aria-label', text(`查看${sectionTitle(id, selected)}照片：${photo.title}`, `View ${sectionTitle(id, selected)} photos: ${photo.title}`));
          const image = make('img', '', '', button); image.src = photo.src; image.alt = photo.title; image.loading = 'lazy'; image.decoding = 'async';
          if (photo.generated) make('span', 'global-generated-card-label', photo.label, button);
          else make('span', '', photo.title, button);
          button.addEventListener('click', () => detail(photoItem, id, button));
        });
      }
      if (id === 'stay') {
        const filters = make('div', 'wl-stay-filters', '', node);
        const star = make('select', '', '', filters); star.setAttribute('aria-label', text('酒店星级', 'Hotel stars'));
        [['', text('不限星级', 'Any star rating')], ['class=3;class=4;class=5', text('3 星及以上', '3 stars and up')], ['class=4;class=5', text('4 星及以上', '4 stars and up')], ['class=5', text('5 星', '5 stars')]].forEach(([value, label]) => { const option = make('option', '', label, star); option.value = value; });
        const price = make('select', '', '', filters); price.setAttribute('aria-label', text('酒店价格', 'Hotel price'));
        [['', text('不限价格', 'Any price')], ['pri=1', text('平台低价档', 'Lower priced on Booking.com')], ['pri=3', text('平台中位档', 'Mid range on Booking.com')], ['pri=5', text('平台高价档', 'Higher priced on Booking.com')]].forEach(([value, label]) => { const option = make('option', '', label, price); option.value = value; });
        const search = external(bookingUrl(selected), text('Booking.com 查看房源 ↗', 'View stays on Booking.com ↗'), 'wl-primary-action wl-stay-search'); node.append(search);
        const update = () => { search.href = bookingUrl(selected, [star.value, price.value].filter(Boolean)); };
        star.addEventListener('change', update); price.addEventListener('change', update);
      }
      if (id === 'joy') {
        const providers = make('div', 'global-provider-row', '', node);
        providers.append(external(ticketUrl(selected), text('Trip.com 门票 / 活动 ↗', 'Trip.com tickets / activities ↗'), 'wl-primary-action'));
        providers.append(external('https://www.google.com/search?' + new URLSearchParams({ q: `${displayName(selected)} ${countryName(selected)} official tickets` }), text('官方票务信息搜索 ↗', 'Search official ticket information ↗'), 'wl-link'));
      }
      if (id === 'go') {
        const routes = make('div', 'wl-routes global-guide-routes', '', node);
        [['walk', text('步行', 'Walk')], ['metro', text('地铁', 'Metro')], ['bus', text('公交', 'Bus')], ['car', text('打车', 'Ride hail')]].forEach(([mode, label]) => {
          const tile = make('article', 'wl-route-card', '', routes);
          const transportArt = imageManifest?.transport?.[mode];
          if (transportArt && !sectionPhotos.length) {
            const figure = make('figure', 'global-route-photo', '', tile);
            const photo = make('img', '', '', figure); photo.src = transportArt.src; photo.alt = transportArt.alt; photo.loading = 'lazy'; photo.decoding = 'async';
            make('figcaption', '', transportArt.label, figure);
          }
          make('h3', '', label, tile);
          const note = mode === 'car'
            ? itemDomestic(selected) ? text('打开滴滴服务；滴滴网页会要求用户自行登录并确认上车点。', 'Opens DiDi; sign in and confirm pickup in its service.') : text('打开当地叫车服务；请在服务中确认车型、上车点和价格。', 'Opens a local ride service; confirm pickup, vehicle and fare there.')
            : text(`以${displayName(selected)}为目的地规划${label}；路线和站点信息由地图实时提供。`, `Plan ${label.toLowerCase()} to ${displayName(selected)} using live map routing.`);
          make('p', '', note, tile);
          const link = external(mode === 'car' ? rideUrl(selected) : routeUrl(selected, mode), mode === 'car' ? text(itemDomestic(selected) ? '打开滴滴 ↗' : '打开 Uber ↗', itemDomestic(selected) ? 'Open DiDi ↗' : 'Open Uber ↗') : `${text('规划', 'Plan ')}${label} ↗`, 'wl-primary-action');
          link.dataset.routeMode = mode; link._guideItem = selected; tile.append(link);
          if (mode === 'metro' || mode === 'bus') tile.append(external(transitSearchUrl(selected, mode), text(`搜索附近${label}站 ↗`, `Find nearby ${label.toLowerCase()} stops ↗`), 'wl-link'));
          if (mode === 'car' && !itemDomestic(selected)) tile.append(external('https://www.grab.com/', text('打开 Grab ↗', 'Open Grab ↗'), 'wl-link'));
        });
        const location = make('button', 'wl-location-button', text('使用当前位置', 'Use my current location'), node); location.type = 'button';
        const status = make('p', 'wl-location-status', text('只在你点击后请求定位；拒绝授权不影响按景点搜索。', 'Location is requested only after you tap; searches still work if denied.'), node); status.setAttribute('role', 'status');
        location.addEventListener('click', () => {
          if (!navigator.geolocation) { status.textContent = text('此设备暂不支持定位。', 'Location is unavailable on this device.'); return; }
          location.disabled = true; status.textContent = text('正在请求当前位置…', 'Requesting location…');
          navigator.geolocation.getCurrentPosition(position => {
            location.disabled = false;
            userOrigin = { latitude: position.coords.latitude, longitude: position.coords.longitude };
            scroll.querySelectorAll('[data-route-mode]').forEach(link => {
              const item = link._guideItem || selected;
              const mode = link.dataset.routeMode;
              link.href = mode === 'car' ? rideUrl(item) : routeUrl(item, mode);
            });
            status.textContent = `${text('当前位置已用于路线起点；打车平台仍需你确认上车点。', 'Your location is now the route origin; confirm the ride pickup in the provider.')} (${position.coords.latitude.toFixed(4)}, ${position.coords.longitude.toFixed(4)})`;
          }, () => { location.disabled = false; status.textContent = text('没有取得定位权限；仍可按景点位置规划。', 'Location permission was not granted; destination-based routing still works.'); }, { enableHighAccuracy: true, maximumAge: 30000, timeout: 9000 });
        });
      } else {
        if (items.length) carousel(node, items, id, { transport: id === 'eat' || id === 'drink' || id === 'play' || id === 'stay', providerFor: options.providerFor });
        else make('p', 'global-guide-empty', options.emptyLabel || text('暂未找到可核验的本地地点；不会用地图搜索卡代替。', 'No verified local listings yet; no map-search placeholder is shown.'), node);
        if (options.moreHref) node.append(external(options.moreHref, text('更多　›', 'More　›'), 'wl-section-more'));
      }
      return node;
    }

    const nearbyPromise = loadNearby(selected, controller).catch(error => { if (error.name !== 'AbortError') setStatus(text('周边地点暂时无法加载，请稍后重试。', 'Nearby listings are temporarily unavailable; please try again later.')); return []; });
    const catalogTask = getCatalog().catch(() => ({ places: [] }));
    const candidatesTask = catalogTask.then(catalog => catalog.places.filter(place => place.id !== selected.id && usableCoordinates(place) && closeEnough(place, selected)).sort((a, b) => Number(b.rank) - Number(a.rank)));
    const pending = text('正在查找可核验的本地地点…', 'Finding verifiable local places…');
    const unavailable = text('暂未找到可核验的本地地点；请稍后重试。', 'No verifiable local listings found yet; please try again later.');
    const eatItems = [];
    const drinkItems = [];
    const stayItems = [];
    const attractions = [{ ...selected, summary: description(selected), section: 'play' }];
    const joyItems = [{ ...selected, name: `${displayName(selected)} · ${text('门票与体验', 'tickets and experiences')}`, name_en: `${selected.name_en || displayName(selected)} · tickets and experiences`, summary: text('查看第三方票务与游览体验；具体票价、库存和开放状态以平台实时页面为准。', 'Browse third-party tickets and experiences; check live provider pages for prices and availability.'), section: 'joy' }];
    const renderEat = (items, loading = false) => section('eat', 0, text('展示有名称的当地餐厅；不虚构评分、价格或营业信息。', 'Named local restaurants only; no ratings, prices or hours are invented.'), items, { emptyLabel: loading ? pending : unavailable });
    const renderDrink = (items, loading = false) => section('drink', 1, itemDomestic(selected) ? text('茶饮、咖啡与当地饮品；以可核验的真实门店为准。', 'Tea, coffee and local drinks; only verifiable venues are shown.') : text('咖啡与当地饮品；不展示茶馆推荐。', 'Cafés and local drinks; tea-house recommendations are excluded.'), items, { emptyLabel: loading ? pending : unavailable });
    const renderPlay = items => section('play', 2, text('附近地点按实际距离排序；点击卡片看站内介绍。', 'Nearby places are ordered by distance; tap a card for on-site details.'), items, { emptyLabel: unavailable });
    const renderStay = (items, loading = false) => {
      const hotelsRow = section('stay', 4, text('仅展示有名称的真实住宿；入住日期、价格与房态请在 Booking.com 自行选择并核对。', 'Named stays only; choose your dates and verify rates and availability on Booking.com.'), items, { emptyLabel: loading ? pending : unavailable });
      hotelsRow.querySelectorAll('.global-guide-card').forEach((article, index) => {
        article.append(external(bookingUrl(items[index]), text('Booking.com 查看房源 ↗', 'View on Booking.com ↗'), 'wl-card-provider'));
      });
    };
    renderEat(eatItems, true); renderDrink(drinkItems, true); renderPlay(attractions);
    section('joy', 3, text('门票、游览和体验由票务平台实时显示，不在此页伪造库存。', 'Tickets and experiences are shown by live providers; no availability is fabricated.'), joyItems, { moreHref: ticketUrl(selected), providerFor: item => ({ href: ticketUrl(item), label: text('查询门票 ↗', 'Find tickets ↗') }) });
    renderStay(stayItems, true);
    section('go', 5, text('各交通入口分别跳到对应地图或叫车服务；目的地已定位。', 'Each transport action opens its relevant map or ride provider.'), [], {});
    nearbyPromise.then(nearby => {
      if (!dialog.isConnected) return;
      const sorted = sectionName => nearby.filter(place => place.section === sectionName).sort((a, b) => distanceKm(a, selected) - distanceKm(b, selected)).slice(0, 6);
      renderEat(sorted('eat'));
      renderDrink(sorted('drink'));
      renderStay(sorted('stay'));
    });
    candidatesTask.then(candidates => {
      if (!dialog.isConnected || !candidates.length) return;
      const sights = candidates.sort((a, b) => distanceKm(a, selected) - distanceKm(b, selected) || Number(b.rank) - Number(a.rank)).slice(0, 8)
        .map(place => ({ ...place, summary: `${distanceKm(place, selected).toFixed(1)} km · ${place.category || text('附近地点', 'Nearby place')}`, section: 'play' }));
      renderPlay(sights);
    }).catch(error => { if (dialog.isConnected) setStatus(text(`景点目录暂时无法读取：${error.message}`, `Landmark catalog could not load: ${error.message}`)); });
    requestAnimationFrame(() => { map?.invalidateSize(); });

    const footer = make('footer', 'wl-footer', '', shell);
    const favorite = make('button', 'wl-save', text('☆　收藏地点', '☆　Save place'), footer); favorite.type = 'button'; favorite.setAttribute('aria-pressed', 'false');
    const favoriteKey = 'tw-city-favorites:' + (window.TravelWorldAuth?.session?.()?.user?.id || 'guest');
    const syncFavorite = () => { try { const favorites = JSON.parse(localStorage.getItem(favoriteKey) || '[]'); const saved = favorites.includes(selected.id); favorite.setAttribute('aria-pressed', String(saved)); favorite.textContent = saved ? text('★　已收藏', '★　Saved') : text('☆　收藏地点', '☆　Save place'); } catch {} };
    syncFavorite(); favorite.addEventListener('click', () => { try { const favorites = JSON.parse(localStorage.getItem(favoriteKey) || '[]'); const next = favorites.includes(selected.id) ? favorites.filter(id => id !== selected.id) : [...favorites, selected.id]; localStorage.setItem(favoriteKey, JSON.stringify(next)); syncFavorite(); setStatus(text(next.includes(selected.id) ? '已收藏到我的收藏' : '已从收藏移除', next.includes(selected.id) ? 'Saved to My Favorites' : 'Removed from favorites')); } catch { setStatus(text('收藏保存失败，请稍后重试。', 'Could not save this place.')); } });
    const itinerary = make('button', 'wl-add', text('＋　加入行程', '＋　Add to itinerary'), footer); itinerary.type = 'button'; itinerary.addEventListener('click', () => { if (typeof window.addLandmark === 'function') window.addLandmark(selected.id); else setStatus(text('行程功能暂不可用，请稍后再试。', 'Itinerary is unavailable right now.')); });

    dialog.addEventListener('close', () => { controller.abort(); photoObserver.disconnect(); map?.remove(); dialog.remove(); document.body.classList.remove('selected-city-guide-open'); }, { once: true });
    dialog.addEventListener('click', event => { if (event.target === dialog) dialog.close(); });
    document.body.classList.add('selected-city-guide-open'); document.body.append(dialog); dialog.showModal();
    const generatedArt = generatedArtFor(selected);
    const showGeneratedHero = () => {
      if (!dialog.isConnected) return;
      if (!generatedArt) { heroArt.hidden = true; heroPhotoStatus.hidden = false; heroPhotoStatus.textContent = text('此景区图片正在补齐。', 'Images for this destination are being added.'); return; }
      heroArt.onload = () => { heroPhotoStatus.hidden = true; };
      heroArt.onerror = () => { heroArt.hidden = true; heroPhotoStatus.hidden = false; heroPhotoStatus.textContent = text('图片暂时无法载入。', 'The image could not be loaded.'); };
      heroArt.hidden = false; heroArt.src = generatedArt.src; heroArt.alt = generatedArt.alt;
      photoCredit.hidden = false; photoCredit.replaceChildren(); make('span', '', generatedArt.label, photoCredit);
    };
    (generatedArt?.preferred ? Promise.resolve([]) : searchPhotos(selected)).then(photos => {
      if (!dialog.isConnected) return;
      const showPhoto = index => {
        const photo = photos[index];
        if (!photo) { showGeneratedHero(); return; }
        heroArt.onload = () => { heroPhotoStatus.hidden = true; };
        heroArt.onerror = () => showPhoto(index + 1);
        heroArt.hidden = false; heroArt.src = photo.src; heroArt.alt = photo.title;
        photoCredit.hidden = false; photoCredit.replaceChildren();
        make('span', '', `${photo.creator} · ${photo.license}`, photoCredit);
        photoCredit.append(external(photo.sourceUrl, text('来源', 'Source'), 'global-hero-credit-link'));
        photoCredit.append(external(photo.licenseUrl, text('许可', 'License'), 'global-hero-credit-link'));
      };
      showPhoto(0);
    }).catch(showGeneratedHero);
    if (window.matchMedia('(max-width:600px)').matches) dialog.scrollTop = 0;
  }

  function itemDomestic(item) { return item.countryCode === 'CN' || /^(中国|china)$/i.test(item.country || ''); }

  const previous = window.openSelectedCityGuide;
  window.openGlobalLandmarkGuide = renderGuide;
  window.openSelectedCityGuide = async (place, photo) => {
    if (!place || place.id === 'cn-west-lake') return previous?.(place, photo);
    try {
      const catalog = await getCatalog();
      const normalizeName = value => String(value || '').normalize('NFKC').toLocaleLowerCase().replace(/[^\p{L}\p{N}]/gu, '');
      const names = [place.name, place.name_en].map(normalizeName).filter(Boolean);
      const indexed = catalog.places.find(item => item.id === (catalogAliases[place.id] || place.id) || item.id === place.globalId || item.id === place.wikidataId)
        || catalog.places.find(item => usableCoordinates(place) && closeEnough(item, place, 5) && [item.name, item.name_en].map(normalizeName).some(name => names.includes(name)));
      if (indexed) return renderGuide({ ...place, ...indexed, id: indexed.id });
    } catch (error) {
      console.warn('Global destination catalog unavailable:', error);
    }
    return previous?.(place, photo);
  };
}());
