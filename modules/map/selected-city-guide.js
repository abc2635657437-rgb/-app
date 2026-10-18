(function () {
  const WEST_LAKE_ID = 'cn-west-lake';
  const WEST_LAKE = { latitude: 30.2431, longitude: 120.1503 };
  const tr = (zh, en) => window.TravelWorldI18n?.language?.() === 'en' ? en : zh;
  const imageUrl = name => 'https://commons.wikimedia.org/wiki/Special:FilePath/' + encodeURIComponent(name) + '?width=1000';
  const fileUrl = name => 'https://commons.wikimedia.org/wiki/File:' + encodeURIComponent(name.replaceAll(' ', '_'));

  function openWestLakeImageEdition(selected) {
    const dialog = document.createElement('dialog');
    dialog.id = 'photoPlaceDialog';
    dialog.className = 'tw-photo-detail place-westlake-image-v1';
    dialog.setAttribute('aria-label', '西湖旅行详情');
    const wrap = document.createElement('div');
    wrap.className = 'wl-image-wrap';
    const image = document.createElement('img');
    image.className = 'wl-reference-image';
    image.src = '/assets/route-photos/west-lake-selected-reference.png';
    image.alt = '西湖竖屏旅行详情图，包含景点导览、吃喝玩乐住行、酒店筛选和行程按钮';
    image.width = 798;
    image.height = 1971;
    image.fetchPriority = 'high';
    image.decoding = 'async';
    wrap.append(image);
    dialog.append(wrap);

    const search = query => 'https://uri.amap.com/search?' + new URLSearchParams({
      keyword: query, city: '杭州', center: '120.1503,30.2431', view: 'list', callnative: '1'
    });
    const dineSearch = query => 'https://www.dianping.com/search/keyword/3/0_' + encodeURIComponent(query);
    const directions = (query, point, mode = 'car') => 'https://uri.amap.com/navigation?' + new URLSearchParams({
      from: ',,',
      to: point ? point[1] + ',' + point[0] + ',' + query : '120.1503,30.2431,' + query,
      mode,
      callnative: '1'
    });
    const bookingUrl = (property = '') => {
      const query = { ss: property ? property + ' West Lake Hangzhou China' : area.value, checkin: dateOffset(1), checkout: dateOffset(2),
        group_adults: '2', group_children: '0', no_rooms: '1', selected_currency: 'CNY', lang: 'zh-cn' };
      if (star.value) query.nflt = star.value;
      if (price.value) query.nflt = [query.nflt, price.value].filter(Boolean).join(';');
      if (area.value) query.ss = area.value;
      return 'https://www.booking.com/searchresults.html?' + new URLSearchParams(query);
    };
    const dateOffset = offset => {
      const date = new Date();
      date.setDate(date.getDate() + offset);
      return [date.getFullYear(), String(date.getMonth() + 1).padStart(2, '0'), String(date.getDate()).padStart(2, '0')].join('-');
    };
    const addHotspot = (label, rect, href, className = 'wl-image-hit') => {
      const link = document.createElement('a');
      link.className = className;
      link.href = typeof href === 'function' ? href() : href;
      link.target = '_blank';
      link.rel = 'noopener noreferrer';
      link.setAttribute('aria-label', label);
      Object.entries({ left: rect[0], top: rect[1], width: rect[2], height: rect[3] }).forEach(([key, value]) => {
        link.style.setProperty('--' + key, value + '%');
      });
      wrap.append(link);
      return link;
    };
    const addButton = (label, rect, onClick, className = 'wl-image-hit') => {
      const button = document.createElement('button');
      button.type = 'button';
      button.className = className;
      button.setAttribute('aria-label', label);
      Object.entries({ left: rect[0], top: rect[1], width: rect[2], height: rect[3] }).forEach(([key, value]) => {
        button.style.setProperty('--' + key, value + '%');
      });
      button.addEventListener('click', onClick);
      wrap.append(button);
      return button;
    };
    const toast = text => {
      if (window.TravelWorldAuth?.toast) window.TravelWorldAuth.toast(text);
      else {
        let note = dialog.querySelector('.wl-image-feedback');
        if (!note) { note = document.createElement('div'); note.className = 'wl-image-feedback'; note.setAttribute('role', 'status'); dialog.append(note); }
        note.textContent = text;
        clearTimeout(note._timer);
        note._timer = setTimeout(() => note.remove(), 2200);
      }
    };

    addButton('返回景点列表', [3, 2.4, 10, 5], () => dialog.close());
    addHotspot('搜索西湖周边', [91.5, 0.5, 8, 4], search('杭州西湖'));
    [
      ['断桥残雪', [52, 18, 22, 5], [30.2592, 120.1483]],
      ['曲院风荷', [19, 23, 23, 5], [30.254, 120.132]],
      ['雷峰塔', [70, 27, 25, 5], [30.2317, 120.1492]],
      ['三潭印月', [26, 31, 24, 5], [30.2274, 120.1431]]
    ].forEach(([name, rect, point]) => addHotspot('在高德地图查看' + name, rect, search(name + ' 杭州西湖')));

    const categoryRects = [
      ['吃', [4, 40.5, 15, 6], 'eat'],
      ['喝', [20, 40.5, 15, 6], 'drink'],
      ['玩', [36, 40.5, 15, 6], 'play'],
      ['乐', [52, 40.5, 15, 6], 'tickets'],
      ['住', [68, 40.5, 15, 6], 'stay'],
      ['行', [84, 40.5, 14, 6], 'go']
    ];
    const sectionScroll = { eat: 45.8, drink: 62.1, play: 78.5, tickets: 78.5, stay: 87.2, go: 94 };
    categoryRects.forEach(([label, rect, action]) => addButton(label + '：跳转到' + label + '推荐', rect, () => {
      const top = wrap.getBoundingClientRect().height * sectionScroll[action] / 100;
      dialog.scrollTo({ top: Math.max(0, top - 90), behavior: 'smooth' });
    }, 'wl-image-hit wl-image-category'));

    const tripTickets = 'https://www.trip.com/travel-guide/attraction/hangzhou/west-lake-82922?curr=CNY&locale=zh-CN&scene=ticket';
    const food = [
      ['楼外楼（西湖边店）', '楼外楼 西湖 杭州', [3, 50.2, 36, 12]],
      ['湖畔居茶楼', '湖畔居 西湖 茶楼 杭州', [40, 50.2, 36, 12]],
      ['知味观（湖滨店）', '知味观 湖滨店 杭州', [77, 50.2, 22, 12]]
    ];
    food.forEach(([label, query, rect]) => addHotspot('在大众点评搜索' + label, rect, dineSearch(query)));
    addHotspot('查看更多西湖周边餐厅', [91, 48.5, 8, 2], dineSearch('西湖 杭帮菜 餐厅'));

    const pill = (label, rect, query, mode) => addHotspot(label + '前往' + query, rect,
      mode === 'didi' ? 'https://webapp.didi.cn/' : directions(query, null, mode),
      'wl-image-hit wl-image-pill');
    [[25,60.1,9,1.8],[34,60.1,8,1.8],[42,60.1,8,1.8],
     [46,60.1,9,1.8],[55,60.1,8,1.8],[63,60.1,8,1.8],
     [80,60.1,8,1.8],[88,60.1,7,1.8],[95,60.1,5,1.8]]
      .forEach((rect, i) => pill(['滴滴打车','地铁','公交'][i % 3], rect, food[Math.floor(i / 3)][0], ['didi','transit','bus'][i % 3]));

    const play = [
      ['雷峰塔', '雷峰塔 西湖 杭州', [3, 65.5, 31, 11]],
      ['三潭印月', '三潭印月 西湖 杭州', [34, 65.5, 32, 11]],
      ['断桥残雪', '断桥残雪 西湖 杭州', [67, 65.5, 32, 11]]
    ];
    play.forEach(([label, query, rect]) => addHotspot('导航前往' + label, rect, directions(query, null, 'car')));
    [[22,73,11,2],[55,73,11,2],[88,73,10,2]].forEach((rect, i) =>
      addHotspot('查询' + play[i][0] + '门票', rect, tripTickets, 'wl-image-hit wl-image-ticket'));
    [[25,75,9,1.8],[34,75,8,1.8],[42,75,8,1.8],
     [46,75,9,1.8],[55,75,8,1.8],[63,75,8,1.8],
     [80,75,8,1.8],[88,75,7,1.8],[95,75,5,1.8]]
      .forEach((rect, i) => pill(['滴滴打车','地铁','公交'][i % 3], rect, play[Math.floor(i / 3)][0], ['didi','transit','bus'][i % 3]));

    const stayItems = [
      ['西湖国宾馆', 'West Lake State Guest House Hangzhou', [3, 83, 31, 9]],
      ['杭州西子湖四季酒店', 'Four Seasons Hotel Hangzhou West Lake', [34, 83, 32, 9]],
      ['柳莺里酒店', 'Liuyingli Hotel Hangzhou West Lake', [67, 83, 32, 9]]
    ];
    const bookingHotelLinks = [];
    const selectOverlay = (label, rect, options) => {
      const select = document.createElement('select');
      select.className = 'wl-image-select';
      select.setAttribute('aria-label', label);
      Object.entries({ left: rect[0], top: rect[1], width: rect[2], height: rect[3] }).forEach(([key, value]) => select.style.setProperty('--' + key, value + '%'));
      options.forEach(([value, text]) => { const option = document.createElement('option'); option.value = value; option.textContent = text; select.append(option); });
      select.addEventListener('change', () => {
        bookingLink.href = bookingUrl();
        bookingHotelLinks.forEach((link, index) => { link.href = bookingUrl(stayItems[index][1]); });
      });
      wrap.append(select);
      return select;
    };
    const star = selectOverlay('住宿星级筛选', [3, 80.1, 19, 2.3], [['','不限星级'],['class=3;class=4;class=5','3星及以上'],['class=4;class=5','4星及以上'],['class=5','5星']]);
    const price = selectOverlay('住宿价格筛选', [21, 80.1, 19, 2.3], [['','不限价格'],['price=0-300','每晚300元以下'],['price=300-800','每晚300至800元'],['price=800-2000','每晚800元以上']]);
    const area = selectOverlay('住宿区域筛选', [39, 80.1, 23, 2.3], [['West Lake Hangzhou China','西湖附近'],['Hubin Hangzhou China','湖滨'],['Beishan Street Hangzhou China','北山街'],['Longjing Village Hangzhou China','龙井村']]);
    const bookingLink = addHotspot('在 Booking.com 查看西湖附近酒店和实时房价', [65, 80.1, 33, 2.5], () => bookingUrl(), 'wl-image-hit wl-image-booking');
    stayItems.forEach(([name, query, rect]) => bookingHotelLinks.push(addHotspot('在 Booking.com 搜索' + name, rect, () => bookingUrl(query))));
    addHotspot('查看更多西湖附近住宿', [65, 80.3, 33, 2], () => bookingUrl(), 'wl-image-hit wl-image-booking');

    stayItems.forEach(([name, query, rect], i) => {
      const [x, y, w] = rect;
      const transportY = 91.1;
      [['滴滴打车','didi'],['地铁','transit'],['公交','bus']].forEach(([label, mode], j) =>
        pill(label + '前往' + name, [x + j * (w / 3), transportY, w / 3, 1.8], name, mode));
    });

    const saveKey = 'tw-city-favorites:' + (window.TravelWorldAuth?.session?.()?.user?.id || 'guest');
    const favorite = addButton('收藏或取消收藏西湖', [17, 95.6, 30, 3.2], () => {
      try {
        const saved = JSON.parse(localStorage.getItem(saveKey) || '[]');
        const next = saved.includes(selected.id) ? saved.filter(id => id !== selected.id) : [...saved, selected.id];
        localStorage.setItem(saveKey, JSON.stringify(next));
        favorite.setAttribute('aria-pressed', String(next.includes(selected.id)));
        toast(next.includes(selected.id) ? '西湖已收藏' : '已取消收藏');
      } catch { toast('收藏暂时无法保存'); }
    }, 'wl-image-hit wl-image-footer-action');
    try { favorite.setAttribute('aria-pressed', String(JSON.parse(localStorage.getItem(saveKey) || '[]').includes(selected.id))); } catch {}
    addButton('将西湖加入旅行行程', [54, 95.6, 28, 3.2], () => {
      if (typeof window.addLandmark === 'function') window.addLandmark(selected.id);
      else {
        try {
          const key = 'tw-itinerary-draft';
          const items = JSON.parse(localStorage.getItem(key) || '[]');
          if (!items.some(item => item.id === selected.id)) items.push({ id: selected.id, name: '西湖', addedAt: new Date().toISOString() });
          localStorage.setItem(key, JSON.stringify(items));
          toast('西湖已加入行程');
        } catch { toast('行程暂时无法保存'); }
      }
    }, 'wl-image-hit wl-image-footer-action');

    dialog.addEventListener('close', () => { dialog.remove(); document.body.classList.remove('selected-city-guide-open'); }, { once: true });
    dialog.addEventListener('click', event => { if (event.target === dialog) dialog.close(); });
    document.body.classList.add('selected-city-guide-open');
    document.body.append(dialog);
    dialog.showModal();
    requestAnimationFrame(() => dialog.scrollTo({ top: 0, left: 0, behavior: 'instant' }));
  }

  window.openSelectedCityGuide = (place, heroPhoto = null) => {
    document.getElementById('photoPlaceDialog')?.remove();
    const selected = place || { id: WEST_LAKE_ID, name: '西湖', city: '杭州', country: '中国', latitude: WEST_LAKE.latitude, longitude: WEST_LAKE.longitude };
    window.currentMapLandmark = selected;
    let userPoint = null;
    const city = selected.destinationCity || selected.city || selected.name;
    const country = selected.country || selected.country_en || selected.countryCode || '';
    const name = selected.destinationCity || selected.name || city;
    const domestic = /^(中国|china|cn)$/i.test(country);
    if (selected.id === WEST_LAKE_ID) { window.openWestLakeGuide?.(selected); return; }
    const coords = () => {
      const loc = selected.location || selected;
      return [Number(loc.latitude ?? WEST_LAKE.latitude), Number(loc.longitude ?? WEST_LAKE.longitude)];
    };
    const center = () => userPoint || (window.TravelMapProviders?.amapLatLng ? window.TravelMapProviders.amapLatLng(...coords()) : coords());
    const mapSearch = query => domestic
      ? 'https://uri.amap.com/search?' + new URLSearchParams({ keyword: query, center: center()[1] + ',' + center()[0], view: 'list', callnative: '1' })
      : 'https://www.google.com/maps/search/?' + new URLSearchParams({ api: '1', query: [query, city, country].filter(Boolean).join(', ') });
    const mapDirection = mode => {
      const point = window.TravelMapProviders?.amapLatLng ? window.TravelMapProviders.amapLatLng(...coords()) : coords();
      if (!domestic) {
        const url = new URL('https://www.google.com/maps/dir/');
        url.searchParams.set('api', '1'); url.searchParams.set('destination', point[0] + ',' + point[1] + ' (' + name + ')');
        if (userPoint) url.searchParams.set('origin', userPoint[0] + ',' + userPoint[1]);
        url.searchParams.set('travelmode', ({ walk: 'walking', ride: 'bicycling', bus: 'transit', car: 'driving' })[mode] || 'driving');
        return url.toString();
      }
      const origin = userPoint ? userPoint[1] + ',' + userPoint[0] + ',' + tr('我的位置', 'My location') : ',,';
      const dest = point[1] + ',' + point[0] + ',' + name;
      return 'https://uri.amap.com/navigation?' + new URLSearchParams({ from: origin, to: dest, mode, callnative: '1' });
    };
    const uberRideUrl = (destination = name) => {
      const [latitude, longitude] = coords();
      const url = new URL('https://m.uber.com/looking/');
      url.searchParams.set('pickup', 'my_location');
      url.searchParams.set('drop[0]', JSON.stringify({ latitude, longitude, addressLine1: destination, addressLine2: [city, country].filter(Boolean).join(', ') }));
      return url.toString();
    };
    const tripSearch = query => {
      const url = new URL('https://www.trip.com/things-to-do/list');
      url.searchParams.set('pagetype', 'city');
      url.searchParams.set('keyword', query);
      url.searchParams.set('kwdfrom', 'srch');
      url.searchParams.set('ext-searchpage', '1');
      return url.toString();
    };
    const dialog = document.createElement('dialog');
    dialog.id = 'photoPlaceDialog';
    dialog.className = 'tw-photo-detail place-city-guide-v2';
    dialog.setAttribute('aria-label', tr(name + '旅行指南', name + ' travel guide'));
    const el = (tag, cls, copy, parent = dialog) => {
      const node = document.createElement(tag);
      if (cls) node.className = cls;
      if (copy) node.textContent = copy;
      parent.append(node);
      return node;
    };
    const outbound = (parent, copy, href, cls = 'city-action') => {
      const node = el('a', cls, copy, parent);
      node.href = href;
      node.target = '_blank';
      node.rel = 'noopener noreferrer';
      if (href.startsWith('https://uri.amap.com/search?')) node.dataset.mapSearch = new URL(href).searchParams.get('keyword') || '';
      else if (href.startsWith('https://www.google.com/maps/search/?')) node.dataset.mapSearch = new URL(href).searchParams.get('query') || '';
      return node;
    };
    const toast = message => {
      if (window.TravelWorldAuth?.toast) { window.TravelWorldAuth.toast(message); return; }
      const note = el('div', 'city-toast', message);
      window.setTimeout(() => note.remove(), 2300);
    };
    const pageSearch = (query, type = '') => mapSearch([query, type].filter(Boolean).join(' '));
    const close = () => dialog.close();

    const top = el('div', 'city-topbar');
    const back = el('button', 'city-top-button', tr('‹ 返回', '‹ Back'), top);
    back.type = 'button'; back.addEventListener('click', close);
    const share = el('button', 'city-top-button', tr('分享', 'Share'), top);
    share.type = 'button';
    share.addEventListener('click', async () => {
      const link = new URL(location.href); link.searchParams.set('landmark', selected.id);
      try {
        if (navigator.share) await navigator.share({ title: name + ' · ' + city, url: link.toString() });
        else if (navigator.clipboard?.writeText) { await navigator.clipboard.writeText(link.toString()); toast(tr('链接已复制', 'Link copied')); }
        else toast(tr('此浏览器暂不支持分享', 'Sharing is not available in this browser'));
      } catch (error) { if (error.name !== 'AbortError') toast(tr('分享没有完成', 'Could not share')); }
    });

    const hero = el('header', 'city-hero');
    const heroImage = heroPhoto?.url;
    hero.style.setProperty('--city-hero-art', heroImage ? 'url("' + String(heroImage).replace(/["\\]/g, '') + '")' : 'none');
    el('span', 'city-eyebrow', city + ' · ' + country, hero);
    el('h2', '', name, hero);
    el('p', 'city-tagline', tr('从这个城市开始，挑一段适合自己的旅程。', 'Start here; choose the pace that feels right.'), hero);
    const heroActions = el('div', 'city-hero-actions', null, hero);
    outbound(heroActions, tr('在地图查看位置 ↗', 'Open location in map ↗'), pageSearch(name));
    const quick = el('nav', 'city-tabs');
    quick.setAttribute('aria-label', tr('旅行指南栏目', 'Travel guide sections'));
    const sections = [
      ['eat', '吃'], ['drink', '喝'], ['play', '玩'], ['joy', '乐'], ['stay', '住'], ['go', '行']
    ];
    sections.forEach(([id, label]) => {
      const anchor = el('a', '', label, quick); anchor.href = '#city-' + id;
      anchor.addEventListener('click', event => { event.preventDefault(); dialog.querySelector('#city-' + id)?.scrollIntoView({ behavior: 'smooth', block: 'start' }); });
    });

    const searchQueries = {
      food: [city + ' local food restaurants', city + ' local restaurant'],
      drink: [city + ' cafes tea houses', city + ' cafe'],
      play: [name + ' famous attractions', city + ' attractions'],
      joy: [name + ' tickets tours', city + ' experiences tickets'],
      stay: [city + ' hotels', city + ' accommodation']
    };
    const section = (id, marker, title, note) => {
      const node = el('section', 'city-section'); node.id = 'city-' + id;
      const heading = el('header', 'city-section-head', null, node);
      el('span', 'city-section-mark', marker, heading);
      const copy = el('div', '', null, heading);
      el('h3', '', title, copy); el('p', '', note, copy);
      return node;
    };
    const transport = (parent, item) => {
      const row = el('div', 'city-transport', null, parent);
      row.setAttribute('aria-label', tr('前往' + item.title, 'Getting to ' + item.title));
      if (domestic) outbound(row, tr('🚕 滴滴', '🚕 DiDi'), 'https://webapp.didi.cn/', 'city-transport-link city-transport-taxi');
      else {
        row.classList.add('city-transport-international');
        outbound(row, '🚕 Uber', uberRideUrl(item.title + ' · ' + city), 'city-transport-link city-transport-taxi');
        outbound(row, 'Grab', 'https://www.grab.com/', 'city-transport-link city-transport-taxi');
      }
      outbound(row, tr('地铁', 'Metro'), pageSearch(item.query, tr('地铁站', 'metro station')), 'city-transport-link');
      outbound(row, tr('公交', 'Bus'), pageSearch(item.query, tr('公交站', 'bus stop')), 'city-transport-link');
      el('small', 'city-transport-note', tr('地图以此地点为中心；确认具体入口和路线后再出发。', 'Map centers on this place; confirm the exact entrance and route.'), parent);
    };
    const photoCard = (parent, item, category) => {
      const card = el('article', 'city-place-card', null, parent);
      if (item.image) {
        const img = el('img', '', null, card); img.src = imageUrl(item.image); img.alt = item.title; img.loading = 'lazy'; img.decoding = 'async';
        img.onerror = () => { img.onerror = null; card.classList.add('city-photo-missing'); };
      } else {
        const placeholder = el('div', 'city-photo-placeholder', tr('打开地图看真实地点', 'Open map for real places'), card);
        placeholder.setAttribute('aria-hidden', 'true');
      }
      el('h4', '', item.title, card); el('p', 'city-place-note', item.note, card);
      if (item.image && item.credit) card.dataset.source = fileUrl(item.image);
      const query = item.query || (searchQueries?.[category]?.[0] || name);
      outbound(card, tr(category === 'food' ? '找附近餐厅 ↗' : category === 'drink' ? '找附近茶馆 ↗' : category === 'stay' ? '查看附近住宿 ↗' : '地图定位 ↗', category === 'food' ? 'Nearby restaurants ↗' : category === 'drink' ? 'Nearby tea ↗' : category === 'stay' ? 'Nearby stays ↗' : 'Open map ↗'), pageSearch(query), 'city-map-link');
      transport(card, { title: item.title, query });
      return card;
    };
    const cardGrid = (parent, category) => {
      const grid = el('div', 'city-card-grid', null, parent);
      const hints = searchQueries[category];
      const labels = category === 'food' ? [tr('当地餐厅', 'Local restaurants'), tr('本地风味', 'Local specialties')] : category === 'drink' ? [tr('咖啡与茶馆', 'Cafes & tea'), tr('当地饮品', 'Local drinks')] : category === 'play' ? [tr('热门景点', 'Popular sights'), tr('城市漫步', 'City walks')] : category === 'joy' ? [tr('体验与门票', 'Experiences & tickets'), tr('当地一日游', 'Local day tours')] : [tr('附近住宿', 'Nearby stays'), tr('更多住宿', 'More stays')];
      const items = labels.map((title, i) => ({ title, note: tr('打开地图查看真实地点；营业与价格以店家或服务方为准。', 'Open the map for real places; hours and prices are set by providers.'), image: '', query: hints[i] }));
      items.forEach(item => photoCard(grid, item, category));
      return grid;
    };
    const eat = section('eat', '吃', tr('地道好味', 'Local food'), tr('按所在城市打开真实地图结果，不展示虚构店铺或价格。', 'Open live map results; no invented venues or prices.'));
    cardGrid(eat, 'food');
    outbound(eat, tr('找附近餐厅 ↗', 'Restaurants nearby ↗'), pageSearch(searchQueries.food[0]), 'city-section-cta');

    const drink = section('drink', '喝', tr('歇一歇', 'Take a pause'), tr('咖啡、茶馆和本地饮品，按位置查看。', 'Find cafes, tea houses and local drinks nearby.'));
    cardGrid(drink, 'drink');
    outbound(drink, tr('看看附近茶馆与咖啡馆 ↗', 'Tea & coffee nearby ↗'), pageSearch(searchQueries.drink[0]), 'city-section-cta');

    const play = section('play', '玩', tr('挑几处慢慢逛', 'Places worth a wander'), tr('打开城市热门景点地图，按距离与兴趣挑选。', 'See popular sights on the map and choose by distance.'));
    cardGrid(play, 'play');
    outbound(play, tr('地图查看附近景点 ↗', 'Nearby sights on map ↗'), pageSearch(searchQueries.play[0]), 'city-section-cta');

    const joy = section('joy', '乐', tr('体验与门票', 'Experiences & tickets'), tr('查看当天可订体验；是否有票及价格由服务平台显示。', 'Check live availability and prices with the ticket provider.'));
    cardGrid(joy, 'joy');
    outbound(joy, tr('在 Trip.com 查看门票与体验 ↗', 'Find tickets & experiences on Trip.com ↗'), tripSearch(city + ' ' + name), 'city-section-cta');
    outbound(joy, tr('地图查看体验地点 ↗', 'Find experiences on map ↗'), pageSearch(searchQueries.joy[0]), 'city-outline-cta');

    const stay = section('stay', '住', tr('住得舒服一点', 'Find a place to stay'), tr('把日期、人数和区域带到 Booking.com；星级、价格、距离与房态以平台实时结果为准。', 'Dates, guests and area go to Booking.com; filter stars, price, distance and availability there.'));
    const stayForm = el('form', 'city-stay-form', null, stay); stayForm.noValidate = true;
    const today = new Date(); const date = d => [d.getFullYear(), String(d.getMonth()+1).padStart(2,'0'), String(d.getDate()).padStart(2,'0')].join('-');
    const next = new Date(today.getFullYear(), today.getMonth(), today.getDate()+1); const next2 = new Date(today.getFullYear(), today.getMonth(), today.getDate()+2);
    const field = (label, type, value) => { const wrap = el('label', 'city-field', null, stayForm); el('span','',label,wrap); const input=el(type==='select'?'select':'input','',null,wrap); if(type!=='select'){input.type=type;input.value=value||'';input.required=type==='date';} return input; };
    const checkin=field(tr('入住','Check-in'),'date',date(next)); checkin.min=date(today);
    const checkout=field(tr('退房','Check-out'),'date',date(next2)); checkout.min=date(next);
    checkin.addEventListener('change',()=>{if(checkin.value){const d=new Date(checkin.value+'T12:00:00');d.setDate(d.getDate()+1);checkout.min=date(d);if(checkout.value<=checkin.value)checkout.value=date(d);}});
    const adults=field(tr('成人','Adults'),'select'); adults.setAttribute('aria-label',tr('成人数量','Number of adults'));
    for(let count=1;count<=6;count++){const option=document.createElement('option');option.value=String(count);option.textContent=count+tr(' 位','');if(count===2)option.selected=true;adults.append(option);}
    const area=field(tr('靠近哪里','Near'), 'select'); area.setAttribute('aria-label',tr('选择住宿区域','Choose stay area'));
    const areas=[[city,city+' '+country],[tr('市中心','City center'),city+' city center '+country],[tr('靠近景点','Near sights'),city+' near sights '+country]];
    areas.forEach(([label,value],i)=>{const option=document.createElement('option');option.value=value;option.textContent=label;if(!i)option.selected=true;area.append(option);});
    const stars=field(tr('星级','Stars'),'select');stars.setAttribute('aria-label',tr('住宿星级','Hotel star rating'));
    [[ '',tr('不限','Any') ],['class=3;class=4;class=5',tr('3 星及以上','3 stars and up')],['class=4;class=5',tr('4 星及以上','4 stars and up')],['class=5',tr('5 星','5 stars')]].forEach(([value,label],i)=>{const option=document.createElement('option');option.value=value;option.textContent=label;if(!i)option.selected=true;stars.append(option);});
    const budget=field(tr('预算档位','Budget band'),'select');budget.setAttribute('aria-label',tr('每晚预算','Nightly budget'));
    [['',tr('不限','Any')],['pri=1',tr('平台低价档','Lower priced')],['pri=3',tr('平台中位档','Mid range')],['pri=5',tr('平台高价档','Higher priced')]].forEach(([value,label],i)=>{const option=document.createElement('option');option.value=value;option.textContent=label;if(!i)option.selected=true;budget.append(option);});
    const stayError=el('p','city-error','',stayForm);stayError.hidden=true;stayError.setAttribute('role','alert');
    const staySubmit=el('button','city-section-cta',tr('查看 Booking.com 住宿 ↗','Search stays on Booking.com ↗'),stayForm);staySubmit.type='submit';
    stayForm.addEventListener('submit',event=>{event.preventDefault();stayError.hidden=true;if(!checkin.value||checkin.value<date(today)){stayError.textContent=tr('入住日期要从今天起选择。','Check-in must be today or later.');stayError.hidden=false;checkin.focus();return;}if(!checkout.value||checkout.value<=checkin.value){stayError.textContent=tr('退房日期要晚于入住日期。','Check-out must be after check-in.');stayError.hidden=false;checkout.focus();return;}let currency='CNY';try{const prefs=JSON.parse(localStorage.getItem('tw-state')||'{}');if(/^[A-Z]{3}$/.test(prefs.currency||''))currency=prefs.currency;}catch{}const filters=[stars.value,budget.value].filter(Boolean).join(';');const params={ss:area.value,checkin:checkin.value,checkout:checkout.value,group_adults:adults.value,group_children:'0',no_rooms:'1',selected_currency:currency,lang:window.TravelWorldI18n?.language?.()==='en'?'en-us':'zh-cn'};if(filters)params.nflt=filters;const url='https://www.booking.com/searchresults.html?'+new URLSearchParams(params);window.open(url,'_blank','noopener,noreferrer');});
    outbound(stay,tr('地图查看周边住宿 ↗','Nearby stays on map ↗'),pageSearch(searchQueries.stay[0]),'city-outline-cta');

    const go = section('go', '行', tr('轻松到达', 'Getting there'), tr('定位仅在你点击后请求；出行路线交给当地地图或打车服务。', 'Location is requested only when you choose; routes open in local map or ride services.'));
    const locate=el('button','city-locate',tr('使用我的当前位置','Use my current location'),go);locate.type='button';
    const locationStatus=el('p','city-location-status',tr('暂按'+city+'中心查看。', 'Showing results around '+city+'.'),go);locationStatus.setAttribute('role','status');
    locate.addEventListener('click',()=>{if(!navigator.geolocation){locationStatus.textContent=tr('当前浏览器不支持定位，仍可按城市中心搜索。','Location is not supported; searches remain centered on the city.');return;}locate.disabled=true;locate.textContent=tr('正在定位…','Locating…');navigator.geolocation.getCurrentPosition(pos=>{locate.disabled=false;userPoint=window.TravelMapProviders?.amapLatLng?window.TravelMapProviders.amapLatLng(pos.coords.latitude,pos.coords.longitude):[pos.coords.latitude,pos.coords.longitude];dialog.querySelectorAll('a[data-map-search]').forEach(a=>a.href=mapSearch(a.dataset.mapSearch));dialog.querySelectorAll('a[data-route-mode]').forEach(a=>a.href=mapDirection(a.dataset.routeMode));locationStatus.textContent=tr('已按你的位置更新路线；出发前确认上车点。','Routes now start from your location; confirm the pickup point before leaving.');locate.textContent=tr('已使用当前位置','Using current location');},()=>{locate.disabled=false;locate.textContent=tr('重试定位','Try location again');locationStatus.textContent=tr('没有取得定位权限，仍可按城市中心搜索。','Location permission was not granted; city searches are still available.');},{enableHighAccuracy:true,maximumAge:30000,timeout:9000});});
    const routeModes=el('div','city-route-modes',null,go);
    [['walk',tr('步行','Walk')],['ride',tr('骑行','Cycle')],['bus',tr('公交','Transit')],['car',tr('驾车','Drive')]].forEach(([mode,label])=>{const link=outbound(routeModes,label,mapDirection(mode),'city-route-link');link.dataset.routeMode=mode;});
    const taxi=el('div','city-taxi',null,go);el('strong','',tr('打车出发','Ride hail'),taxi);
    if(domestic){
      outbound(taxi,tr('打开滴滴 ↗','Open DiDi ↗'),'https://webapp.didi.cn/','city-ride-button city-ride-primary');
      outbound(taxi,tr('高德带入目的地 ↗','Route with destination ↗'),mapDirection('car'),'city-ride-button');
    }
    else {outbound(taxi,'Uber ↗',uberRideUrl(),'city-ride-button city-ride-primary');outbound(taxi,'Grab ↗','https://www.grab.com/','city-ride-button');}
    el('small','city-transport-note',tr('第三方应用会要求你核对目的地、上车点；可能需要登录，订单与费用由服务方处理。','Confirm destination and pickup in the third-party app; sign-in may be required. The provider handles orders and fares.'),taxi);
    const mapBox=el('div','city-map-box',null,go);el('div','city-mini-map',null,mapBox);
    outbound(go,tr('在高德地图查看周边 ↗','Open nearby in Amap ↗'),pageSearch(name),'city-section-cta');

    const credits = el('details','city-credits');el('summary','',tr('图片来源','Photo credits'),credits);
    if(heroPhoto?.sourceUrl)outbound(credits,tr('首屏实景照片来源','Hero photograph source'),heroPhoto.sourceUrl,'city-credit-link');
    dialog.querySelectorAll('.city-place-card[data-source]').forEach(card=>outbound(credits,card.querySelector('h4').textContent+' · '+(card.querySelector('.city-place-note')?.textContent||''),card.dataset.source,'city-credit-link'));
    const footer=el('footer','city-footer');
    const favorite=el('button','city-save',tr('收藏地点','Save place'),footer);favorite.type='button';
    const key='tw-city-favorites:'+(window.TravelWorldAuth?.session?.()?.user?.id||'guest');
    const sync=()=>{try{const list=JSON.parse(localStorage.getItem(key)||'[]');favorite.setAttribute('aria-pressed',String(list.includes(selected.id)));favorite.textContent=list.includes(selected.id)?tr('已收藏','Saved'):tr('收藏地点','Save place');}catch{favorite.setAttribute('aria-pressed','false');}};
    sync();favorite.addEventListener('click',()=>{try{const list=JSON.parse(localStorage.getItem(key)||'[]');const next=list.includes(selected.id)?list.filter(id=>id!==selected.id):[...list,selected.id];localStorage.setItem(key,JSON.stringify(next));sync();toast(next.includes(selected.id)?tr('已收藏到此设备','Saved on this device'):tr('已取消收藏','Removed from saved places'));}catch{toast(tr('收藏未保存成功。','Could not save this place.'));}});
    const add=el('button','city-add',tr('加入行程','Add to itinerary'),footer);add.type='button';add.addEventListener('click',()=>{if(typeof window.addLandmark==='function')window.addLandmark(selected.id);else toast(tr('行程功能暂不可用，请稍后再试。','Itinerary is unavailable right now.'));});

    dialog.addEventListener('close',()=>{dialog._map?.remove();dialog.remove();document.body.classList.remove('selected-city-guide-open');},{once:true});
    dialog.addEventListener('click',event=>{if(event.target===dialog)dialog.close();});
    document.body.classList.add('selected-city-guide-open');document.body.append(dialog);dialog.showModal();
    if(window.L){const [lat,lng]=coords();const point=window.TravelMapProviders?.focusLatLng(lat,lng)||[lat,lng];dialog._map=window.L.map(mapBox.firstElementChild,{scrollWheelZoom:false,zoomControl:true}).setView(point,13);window.TravelMapProviders?.tileLayer(dialog._map);window.L.marker(point).addTo(dialog._map).bindPopup(name);requestAnimationFrame(()=>dialog._map?.invalidateSize());}
  };
}());
