(function () {
  const commonsFile = name => 'https://commons.wikimedia.org/wiki/Special:FilePath/' + encodeURIComponent(name) + '?width=1000';
  const commonsPage = name => 'https://commons.wikimedia.org/wiki/File:' + encodeURIComponent(name.replaceAll(' ', '_'));
  window.openWestLakeGuide = place => {
    document.getElementById('photoPlaceDialog')?.remove();
    const en = () => window.TravelWorldI18n?.language?.() === 'en';
    const t = (zh, english) => en() ? english : zh;
    const dialog = document.createElement('dialog');
    dialog.id = 'photoPlaceDialog';
    dialog.className = 'tw-photo-detail place-west-lake-guide';
    dialog.setAttribute('aria-label', t('西湖旅行灵感', 'A day by West Lake'));
    const make = (tag, cls, copy, parent = dialog) => {
      const node = document.createElement(tag);
      if (cls) node.className = cls;
      if (copy) node.textContent = copy;
      parent.append(node);
      return node;
    };
    const link = (parent, label, href, cls = 'place-guide-link') => {
      const a = make('a', cls, label, parent);
      a.href = href; a.target = '_blank'; a.rel = 'noopener noreferrer';
      return a;
    };
    const directions = (name, mode = 'walk') => 'https://uri.amap.com/navigation?to=120.1503,30.2431,' + encodeURIComponent(t('西湖', 'West Lake')) + '&mode=' + mode + '&coordinate=wgs84&callnative=0';
    const close = make('button', 'place-guide-back', t('返回', 'Back'));
    close.type = 'button'; close.setAttribute('aria-label', t('返回地图', 'Back to map')); close.onclick = () => dialog.close();

    const hero = make('header', 'place-guide-hero');
    const intro = make('div', 'place-guide-intro', null, hero);
    make('h2', '', t('西湖', 'West Lake'), intro);
    const nav = make('nav', 'place-guide-actions');
    link(nav, t('步行去湖边', 'Walk to the lake'), directions('西湖'), 'place-guide-primary');
    link(nav, t('叫车到湖滨', 'Ride to Hubin'), directions('杭州湖滨公园', 'drive'), 'place-guide-secondary');

    const food = make('section', 'place-guide-section place-guide-food');
    const foodTitle = make('header', 'place-guide-heading', null, food);
    make('small', '', t('先吃点好的', 'A good first stop'), foodTitle);
    make('h3', '', t('两道杭州味，慢慢挑', 'Two local favorites'), foodTitle);
    const foodGrid = make('div', 'place-guide-grid', null, food);
    const foodItems = [
      { title: t('西湖醋鱼', 'West Lake vinegar fish'), subtitle: t('楼外楼 · 孤山路', 'Louwailou · Gushan Road'), copy: t('酸甜一口，很杭州。', 'Sweet, tangy, unmistakably Hangzhou.'), file: 'West Lake Fish in Vinegar Gravy Feb 2026.jpg', credit: 'Vesekskiy · CC BY-SA 4.0', href: 'https://ywhz.hangzhou.com.cn/scms/content/content_6218775.htm' },
      { title: t('龙井虾仁', 'Longjing tea prawns'), subtitle: t('杭州酒家 · 杭帮菜', 'Hangzhou Restaurant · local cooking'), copy: t('茶香清清的，适合配一碗饭。', 'A gentle tea aroma, lovely with rice.'), file: 'Longjing prawns in Hangzhou Restaurant 2015-07.JPG', credit: 'Māomāo de Rìjìběn · CC BY-SA 4.0', href: 'https://commons.wikimedia.org/wiki/Category:Gastronomy_in_Hangzhou' }
    ];
    foodItems.forEach(item => {
      const card = make('article', 'place-guide-card', null, foodGrid);
      const image = make('img', '', null, card);
      image.src = commonsFile(item.file); image.alt = item.title; image.loading = 'lazy'; image.decoding = 'async';
      image.onerror = () => { image.onerror = null; card.classList.add('place-guide-image-missing'); };
      make('h4', '', item.title, card); make('b', 'place-guide-subtitle', item.subtitle, card);
      make('p', '', item.copy, card);
      link(card, t('看店家信息', 'Restaurant details'), item.href, 'place-guide-link');
      card.dataset.credit = item.credit;
      card.dataset.source = commonsPage(item.file);
    });

    const stay = make('section', 'place-guide-section place-guide-stay');
    const stayTitle = make('header', 'place-guide-heading', null, stay);
    make('small', '', t('住得舒服一点', 'A comfortable place to stay'), stayTitle);
    make('h3', '', t('西湖国宾馆', 'West Lake State Guesthouse'), stayTitle);
    const stayCard = make('article', 'place-guide-stay-card', null, stay);
    const roomGallery = make('div', 'place-guide-stay-gallery', null, stayCard);
    [
      ['https://aw-d.tripcdn.com/images/200q18000001422n87567_R_960_660_R5_D.jpg', t('西湖国宾馆庭院景客房', 'Courtyard-view room at West Lake State Guesthouse')],
      ['https://aw-d.tripcdn.com/images/200k1800000144ysh1210_R_960_660_R5_D.jpg', t('西湖国宾馆客房', 'Guest room at West Lake State Guesthouse')]
    ].forEach(([url, alt]) => {
      const room = make('img', '', null, roomGallery);
      room.src = url; room.alt = alt; room.loading = 'lazy'; room.decoding = 'async';
      room.onerror = () => room.remove();
    });
    const stayCopy = make('div', 'place-guide-stay-copy', null, stayCard);
    make('p', '', t('杨公堤边，适合想把西湖住进一天的人。房价按日期看。', 'By Yanggong Causeway, for a stay that feels part of the lake. Rates vary by date.'), stayCopy);
    link(stayCopy, t('看房型与当日价格', 'See rooms and today’s rates'), 'https://www.westlakehz.cn/en/picture-6.html', 'place-guide-primary');

    const stroll = make('section', 'place-guide-section place-guide-stroll');
    const strollTitle = make('header', 'place-guide-heading', null, stroll);
    make('small', '', t('湖边半日', 'A half day by the lake'), strollTitle);
    make('h3', '', t('湖滨 → 断桥 → 孤山 → 苏堤', 'Hubin → Broken Bridge → Gushan → Su Causeway'), strollTitle);
    const strollGrid = make('div', 'place-guide-grid place-guide-nearby-grid', null, stroll);
    [
      { title: t('断桥', 'Broken Bridge'), file: 'Broken Bridge (Hangzhou) 20250505.jpg', credit: 'Suicasmo · CC0' },
      { title: t('苏堤', 'Su Causeway'), file: 'Su Causeway near West Lake, looking towards north 20120529 1.jpg', credit: 'DXR · CC BY-SA 4.0' },
      { title: t('三潭印月', 'Three Pools Mirroring the Moon'), file: 'Three Pools Mirroring the Moon.jpg', credit: 'Ten Thousand Strangers · CC BY 4.0' }
    ].forEach(item => {
      const card = make('article', 'place-guide-card place-guide-sight', null, strollGrid);
      const image = make('img', '', null, card);
      image.src = commonsFile(item.file); image.alt = t(item.title + '实景', 'Photo of ' + item.title); image.loading = 'lazy'; image.decoding = 'async';
      image.onerror = () => image.remove();
      make('strong', '', item.title, card); card.dataset.credit = item.credit; card.dataset.source = commonsPage(item.file);
    });

    const mapDetails = make('details', 'place-guide-map');
    make('summary', '', t('看看湖边地图', 'Open the lakeside map'), mapDetails);
    const mapNode = make('div', 'place-guide-mini-map', null, mapDetails);
    link(mapDetails, t('步行导航到西湖', 'Directions to West Lake'), directions('西湖'), 'place-guide-primary');
    const footer = make('footer', 'place-guide-footer');
    const credits = make('details', 'place-guide-credits', null, footer);
    make('summary', '', t('照片来源', 'Photo credits'), credits);
    [...foodGrid.children, ...strollGrid.children].forEach(card => link(credits, (card.querySelector('h4,strong')?.textContent || '') + ' · ' + card.dataset.credit, card.dataset.source, 'place-guide-credit'));
    const account = make('div', 'place-guide-account-actions', null, footer);
    const add = make('button', '', t('加入我的路线', 'Add to my route'), account); add.type = 'button'; add.onclick = () => window.addLandmark?.(place.id);
    const ai = make('button', '', t('帮我安排一天', 'Plan my day'), account); ai.type = 'button'; ai.onclick = () => window.planLandmarkWithAi?.(place.id);

    dialog.addEventListener('close', () => { dialog.remove(); if (dialog._map) dialog._map.remove(); }, { once: true });
    dialog.onclick = event => { if (event.target === dialog) dialog.close(); };
    document.body.classList.add('west-lake-guide-open');
    dialog.addEventListener('close', () => document.body.classList.remove('west-lake-guide-open'), { once: true });
    document.body.append(dialog); dialog.showModal();
    fetch('/modules/data/place-backgrounds.json').then(r => r.ok ? r.json() : {}).then(d => d.backgrounds?.Q10866444).then(art => {
      if (!art || !dialog.isConnected) return;
      dialog.classList.add('place-gathered'); dialog.style.setProperty('--place-art', 'url("' + art.image + '")');
    }).catch(() => {});
    mapDetails.addEventListener('toggle', () => {
      if (!mapDetails.open || dialog._map || !window.L) return;
      dialog._map = L.map(mapNode, { scrollWheelZoom: false }).setView([place.latitude, place.longitude], 13);
      L.tileLayer(TravelMapProviders.get().tile, { attribution: TravelMapProviders.get().attribution, maxZoom: 19 }).addTo(dialog._map);
      L.marker([place.latitude, place.longitude]).addTo(dialog._map).bindPopup(t('西湖', 'West Lake')).openPopup();
      requestAnimationFrame(() => dialog._map?.invalidateSize());
    });
  };
}());
