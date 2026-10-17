(function () {
  const LAKE = { lat: 30.2431, lng: 120.1503 };
  const commons = (file, credit, license, alt = '') => ({
    file,
    src: 'https://commons.wikimedia.org/wiki/Special:FilePath/' + encodeURIComponent(file) + '?width=1000',
    page: 'https://commons.wikimedia.org/wiki/File:' + encodeURIComponent(file.replaceAll(' ', '_')),
    credit,
    license,
    alt
  });
  const sights = [
    {
      id: 'broken-bridge', title: '断桥残雪', eyebrow: '白堤 · 西湖北岸', category: 'play',
      summary: '沿白堤走到湖的北岸，冬雪消融时桥面若隐若现。',
      history: '“断桥残雪”是西湖十景之一。雪后初晴，桥面向阳处积雪先融，远看像桥身从白雪中断开；断桥也因《白蛇传》的故事而广为人知。',
      tip: '清晨人少，适合从断桥步行上白堤；花期、雪景和水位会改变观感。',
      coords: [30.2592, 120.1483], map: '断桥残雪 杭州西湖', official: 'https://z.hangzhou.com.cn/2022/syjy/content/content_8420812.html',
      facts: [['开放/门票', '湖岸公共步道；当日游园安排请核实'], ['建议停留', '约 30–60 分钟，沿白堤继续步行'], ['周边', '白堤、平湖秋月、孤山']],
      photos: [
        commons('Broken Bridge (Hangzhou) 20250505.jpg', 'Suicasmo', 'CC0 1.0', '杭州断桥实景，2025 年拍摄'),
        commons('杭州.西湖.白堤断桥 - panoramio.jpg', 'zhiyin586@163.com', 'CC BY 3.0', '西湖白堤断桥实景'),
        commons('杭州.西湖雪景（断桥残雪） - panoramio.jpg', 'zhiyin586@163.com', 'CC BY 3.0', '断桥残雪实景')
      ]
    },
    {
      id: 'quyuan-fenghe', title: '曲院风荷', eyebrow: '北山街 · 岳湖一带', category: 'play',
      summary: '夏日看荷，沿岳湖和园林小径慢慢走。',
      history: '曲院风荷是西湖十景之一，也是西湖周边的大型公园。官方介绍提到它邻近岳湖、郭庄与岳王庙，盛夏荷花是最具代表性的季节景致。',
      tip: '夏季荷花盛开时更有代表性；沿池边步道走，给拍照和休息留出时间。',
      coords: [30.254, 120.132], map: '曲院风荷 杭州', official: 'https://eng.hangzhou.gov.cn/art/2024/1/30/art_811217_58876221.html',
      facts: [['开放/门票', '以西湖景区当日公告为准'], ['建议停留', '约 1–2 小时，夏季可多留些时间'], ['周边', '岳王庙、郭庄、苏堤北口']],
      photos: [
        commons('Lotus in the Breeze at the Winding Courtyard 0.jpg', '钉钉', 'CC BY-SA 4.0', '曲院风荷荷花'),
        commons('Lotus in the Breeze at the Winding Courtyard 3.jpg', '钉钉', 'CC BY-SA 4.0', '曲院风荷园林'),
        commons('Lotus in the Breeze at the Winding Courtyard 6.jpg', '钉钉', 'CC BY-SA 4.0', '曲院风荷荷塘')
      ]
    },
    {
      id: 'three-pools', title: '三潭印月', eyebrow: '小瀛洲 · 西湖湖心', category: 'play',
      summary: '乘船登岛，看湖中石塔与岛屿园林。',
      history: '三潭印月是西湖十景之一。小瀛洲上的园林与湖中三座石塔共同组成这幅湖心景观；杭州文旅推荐的白蛇主题水上线路也包含登岛漫步与远眺雷峰塔。',
      tip: '登岛需要乘船；船班、码头和末班时间以现场公告为准。遇到风雨时先确认航线。',
      coords: [30.2274, 120.1431], map: '三潭印月 小瀛洲 杭州', official: 'https://wgly.hangzhou.gov.cn/art/2025/2/11/art_1229505585_58959107.html',
      facts: [['开放/门票', '需结合当日游船/登岛安排核实'], ['建议停留', '岛上约 1–2 小时，另预留船程'], ['周边', '花港观鱼、雷峰塔、湖心亭']],
      photos: [
        commons('2014.11.21.110937 Three Pools Mirroring the Moon Xihu Hangzhou.jpg', 'Hermann Luyken', 'CC0', '三潭印月石塔'),
        commons('2014.11.21.112332 Three Pools Mirroring the Moon Xihu Hangzhou.jpg', 'Hermann Luyken', 'CC0', '小瀛洲与西湖'),
        commons('2014.11.21.113153 Three Pools Mirroring the Moon Xihu Hangzhou.jpg', 'Hermann Luyken', 'CC0', '三潭印月湖景')
      ]
    },
    {
      id: 'leifeng-pagoda', title: '雷峰塔', eyebrow: '夕照山 · 西湖南岸', category: 'play',
      summary: '登塔看湖山，也可以从长桥一带远望塔影。',
      history: '雷峰塔位于西湖南岸夕照山。杭州文旅介绍：旧塔遗址经考古发掘后原地保护，新塔于 2000 年启动重建，延续“雷峰夕照”的湖山景观。',
      tip: '想看夕照，可把它排在傍晚；登塔票价、开放时间与限流规则请出发前查官方公告。',
      coords: [30.2317, 120.1492], map: '雷峰塔 杭州西湖', official: 'https://wgly.hangzhou.gov.cn/art/2022/12/1/art_1229696389_58943150.html',
      facts: [['开放/门票', '请查雷峰塔景区当日公告'], ['建议停留', '约 1–2 小时；日落时段另预留排队时间'], ['周边', '净慈寺、长桥公园、南屏山']],
      photos: [
        commons('Leifeng Pagoda, Hangzhou by TheTokl - 32.jpg', 'TheTokl', 'CC BY-SA 3.0', '雷峰塔与湖山'),
        commons('Leifeng Pagoda 20191102.jpg', 'xiquinhosilva', 'CC BY 2.0', '雷峰塔'),
        commons('Leifeng Pagoda at West Lake (Xi Hu), Hangzhou.jpg', 'Peter', 'CC BY 2.0', '西湖畔雷峰塔')
      ]
    }
  ];
  const makeVenue = (id, title, section, summary, query, photos, extra = {}) => ({ id, title, section, summary, query, photos, ...extra });
  const venues = {
    eat: [
      makeVenue('lou-wai-lou', '楼外楼', 'eat', '西湖边的杭州老字号；菜单、门店与营业状态以店方页面为准。', '楼外楼 杭州 西湖', [
        commons('2014.11.21.171942 Food Lou Wai Lou Restaurant Xihu Hangzhou.jpg', 'Hermann Luyken', 'CC0', '楼外楼菜品实拍'),
        commons('Lou Wai Lou Restaurant, Hangzhou.jpg', '钉钉', 'CC BY-SA 4.0', '楼外楼建筑实拍'),
        commons('Lou Wai Lou Restaurant at Bai Causeway.jpg', '钉钉', 'CC BY-SA 4.0', '白堤旁楼外楼')
      ], { dishes: '可在当日菜单中留意西湖醋鱼、龙井虾仁等杭帮菜；菜品供应以店家为准。' }),
      makeVenue('hangzhou-restaurant', '杭州酒家', 'eat', '杭帮菜老字号；龙井虾仁的实拍照片摄于杭州酒家，门店信息请在商户平台核对。', '杭州酒家 杭州', [
        commons('Longjing prawns in Hangzhou Restaurant 2015-07.JPG', '猫猫的日记本', 'CC BY-SA 4.0', '摄于杭州酒家的龙井虾仁')
      ], { dishes: '图片记录的是龙井虾仁；现行菜单和价格需以店方为准。' }),
      makeVenue('zhiweiguan', '知味观', 'eat', '杭州传统餐饮品牌；请选择具体门店后再核对地址、菜单和营业信息。', '知味观 杭州 西湖', [
        commons('Zhi Wei Guan, Longjing Shrimps.jpg', 'Gu0427', 'CC BY-SA 4.0', '知味观龙井虾仁实景照片')
      ], { dishes: '龙井虾仁；具体门店、菜单和价格请在商户页核对。' })
    ],
    drink: [
      makeVenue('hupanju', '湖畔居茶楼', 'drink', '西湖边的临湖茶楼；包厢、茶位与营业信息请向门店核实。', '湖畔居茶楼 杭州 西湖', [
        commons('湖畔居 (Home by the lake) - panoramio.jpg', 'HaoD Wu', 'CC BY-SA 3.0', '湖畔居茶楼实景'),
        commons('杭州。西湖茶室-湖畔居（ 远景： 白堤- 北高峰美人峰烟云茫茫) - panoramio.jpg', 'zhiyin586@163.com', 'CC BY 3.0', '湖畔居与西湖远景')
      ], { drinks: '可询问西湖龙井与当季茶点；实际供应和价格以门店为准。' }),
      makeVenue('meijiawu', '梅家坞茶村', 'drink', '想了解茶叶产地，可把湖边漫步延伸到龙井茶村；先确认交通与茶园接待安排。', '梅家坞 龙井茶 杭州', [
        commons('Hangzhou-Teeplantage-04-Straeucher-2012-gje.jpg', 'Gje', 'CC BY-SA 3.0', '杭州龙井茶园实景'),
        commons('Longjing tea 5.jpg', 'Joriz De Guzman', 'CC BY 2.0', '西湖附近茶村景观')
      ], { drinks: '以茶园体验、品茶为主；是否开放体验及费用请联系经营方确认。' }),
      { id: 'nearby-drink-search', title: '西湖边的咖啡馆', section: 'drink', query: '杭州西湖 咖啡馆', searchOnly: true,
        summary: '浏览西湖周边咖啡馆；图片为 AI 氛围示意，不代表某一家店。门店与营业信息以平台为准。',
        photos: [{ src: '/assets/route-photos/west-lake-cafe-search-illustration.png', alt: '西湖边咖啡馆氛围示意图', credit: 'AI 生成', license: '示意图（非店铺实拍）', illustration: true }] }
    ],
    play: sights,
    leisure: [
      makeVenue('west-lake-cruise', '西湖游船', 'leisure', '可选手划船或公共游船，实际码头、航线与班次随天气和现场安排变化。', '杭州西湖 游船 门票', [
        commons('Boat WestLake.jpg', 'Farm', 'CC BY 3.0', '杭州西湖游船'),
        commons('West Lake boat.jpg', 'Lishuilynn', 'CC BY-SA 4.0', '杭州西湖游船')
      ], { booking: true, facts: [['班次/票价', '未接入实时船票；请查现场与官方渠道'], ['建议', '先选登岛或环湖路线，再确认码头和末班船'], ['适合', '想少走路、从湖面看三潭与雷峰塔']]}),
      makeVenue('west-lake-walk', '环湖慢行', 'leisure', '从湖滨、白堤或南山路选一段步行，不必一次走完整圈。', '杭州西湖 环湖路线', [
        commons('Su Causeway, West Lake.jpg', '钉钉', 'CC BY-SA 4.0', '西湖苏堤步行实景')
      ], { booking: false, facts: [['建议', '按体力分段，留出休息与返程时间'], ['提醒', '周末与节假日热门湖岸较拥挤']]}),
      makeVenue('leifeng-ticket', '雷峰塔登塔', 'leisure', '先看塔与湖的历史，再到官方渠道核对当天票务。', '雷峰塔 杭州 门票', [sights[3].photos[1], sights[3].photos[2]], { booking: true, facts: [['票价/开放', '未接入实时库存或票价；以官方公告为准'], ['适合', '对吴越历史、白蛇传说与湖山视野感兴趣'] ] })
    ],
    stay: [
      makeVenue('west-lake-state-guest-house', '西湖国宾馆', 'stay', '西湖景区内的住宿选择；房型、设施、评分与房价以 Booking.com 当前页面为准。', 'West Lake State Guest House Hangzhou China', [
        commons('杭州西湖国宾馆， West Lake State House，Hangzhou - panoramio.jpg', 'Aaron Zhu', 'CC BY-SA 3.0', '西湖国宾馆外景'),
        commons('杭州西湖国宾馆， West Lake State House，Hangzhou - panoramio (7).jpg', 'Aaron Zhu', 'CC BY-SA 3.0', '西湖国宾馆园景')
      ], { location: '西湖景区周边；具体房源地址请在预订页确认。', booking: true }),
      makeVenue('four-seasons-west-lake', '杭州西子湖四季酒店', 'stay', '西湖周边酒店；设施、评分、价格和可订房型只以 Booking.com 当前结果为准。', 'Four Seasons Hotel Hangzhou West Lake China', [
        commons('Four Seasons Hotel Hangzhou West Lake 20201001.jpg', 'Nat4Eben', 'CC BY-SA 4.0', '杭州西子湖四季酒店实景')
      ], { location: '西湖西侧；入住地址与接驳请在预订页确认。', booking: true }),
      makeVenue('hangzhou-west-lake-hotel-search', '西湖附近更多住宿', 'stay', '按入住日期和偏好，在 Booking.com 查看当前房源。', 'West Lake Hangzhou China', [
        commons('杭州西湖国宾馆， West Lake State House，Hangzhou - panoramio (6).jpg', 'Aaron Zhu', 'CC BY-SA 3.0', '西湖附近住宿区域参考；并非待订房源照片')
      ], { location: '可在 Booking.com 结果页按地图位置筛选。', booking: true })
    ]
  };

  const categories = [
    { id: 'eat', label: '吃', title: '附近好味', note: '杭帮菜与湖畔餐桌；菜单和营业信息以商家为准。' },
    { id: 'drink', label: '喝', title: '茶与咖啡', note: '龙井茶、临湖茶座和咖啡；到店前查看当日信息。' },
    { id: 'play', label: '玩', title: '西湖十景', note: '断桥、曲院、三潭与雷峰塔，点卡片看照片和故事。' },
    { id: 'leisure', label: '乐', title: '湖上体验', note: '游船、夜游与慢行体验，票务入口单独标明。' },
    { id: 'stay', label: '住', title: '湖畔住宿', note: '先选星级、预算和区域，再到 Booking.com 看实时房源。' },
    { id: 'go', label: '行', title: '湖边出行', note: '步行、公共交通和滴滴分别提供入口。' }
  ];
  const imageUrl = photo => photo.src;
  const filePage = photo => photo.page;
  const safe = value => String(value ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);
  const amapSearch = query => 'https://uri.amap.com/search?' + new URLSearchParams({ keyword: query, city: '杭州', center: `${LAKE.lng},${LAKE.lat}`, view: 'list', callnative: '1' });
  const amapRoute = (name, coords, mode, origin = null, policy = null) => {
    const params = new URLSearchParams({ from: origin ? `${origin[1]},${origin[0]},我的位置` : ',,', to: `${coords[1]},${coords[0]},${name}`, mode, callnative: '1' });
    if (policy !== null) params.set('policy', String(policy));
    return 'https://uri.amap.com/navigation?' + params;
  };
  const dianping = query => 'https://m.dianping.com/search/keyword/3/0_' + encodeURIComponent(query);
  const tripSearch = query => 'https://www.trip.com/things-to-do/list?' + new URLSearchParams({ pagetype: 'city', keyword: query, kwdfrom: 'srch', 'ext-searchpage': '1' });
  const tomorrow = offset => { const date = new Date(); date.setDate(date.getDate() + offset); return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`; };
  const booking = (query, stars = '', price = '') => {
    const params = new URLSearchParams({ ss: query, checkin: tomorrow(1), checkout: tomorrow(2), group_adults: '2', group_children: '0', no_rooms: '1', selected_currency: 'CNY', lang: 'zh-cn' });
    const filters = [stars, price].filter(Boolean).join(';');
    if (filters) params.set('nflt', filters);
    return 'https://www.booking.com/searchresults.html?' + params;
  };
  const external = (href, label, cls = 'wl-link') => {
    const a = document.createElement('a'); a.className = cls; a.href = href; a.target = '_blank'; a.rel = 'noopener noreferrer'; a.textContent = label; return a;
  };
  const iconPaths = {
    eat: '<path d="M9 24h30c-1 9-7 14-15 14S10 33 9 24Z"/><path d="M13 20c2-3 5-3 7 0s5 3 7 0 5-3 7 0M15 13l9 7m0-9 8 9"/>',
    drink: '<path d="M10 17h25v9a12.5 12.5 0 0 1-25 0v-9Zm25 3h4a5 5 0 0 1 0 10h-5M13 39h21"/><path d="M17 11c-2 2 2 3 0 5m7-7c-2 2 2 3 0 5m7-3c-2 2 2 3 0 5"/>',
    play: '<path d="m7 19 17-8 17 8-17 4-17-4Zm4 8 13 3 13-3M15 34l9 2 9-2M19 22v5m10-5v5M20 35v5m8-5v5"/><path d="M24 11V7m-5 4V9m10 2V9"/>',
    leisure: '<path d="M7 22a17 17 0 0 1 34 0H7Zm17 0 1 18m-1-18L12 36m12-14 13 14M17 10l7 12m7-12-7 12M9 16l15 6m15-6-15 6"/>',
    stay: '<path d="m6 20 18-11 18 11M10 19v20h28V19M17 39V26h14v13M6 22h36"/><path d="M20 17h8"/>',
    go: '<path d="M12 8h24a4 4 0 0 1 4 4v22H8V12a4 4 0 0 1 4-4Z"/><path d="M12 13h10v9H12zm14 0h10v9H26zM8 27h32"/><circle cx="14" cy="34" r="2"/><circle cx="34" cy="34" r="2"/>',
    car: '<path d="m8 28 3-10a4 4 0 0 1 4-3h18a4 4 0 0 1 4 3l3 10v8H8v-8Z"/><path d="m12 24 2-6h20l2 6M8 29h32"/><circle cx="15" cy="33" r="2"/><circle cx="33" cy="33" r="2"/>',
    metro: '<rect x="11" y="7" width="26" height="30" rx="5"/><path d="M16 13h16v11H16zm-5 13h26M18 43l6-6 6 6m-15-2h18"/><circle cx="18" cy="31" r="1"/><circle cx="30" cy="31" r="1"/>',
    bus: '<path d="M12 8h24a4 4 0 0 1 4 4v22H8V12a4 4 0 0 1 4-4Z"/><path d="M12 13h10v9H12zm14 0h10v9H26zM8 27h32"/><circle cx="14" cy="34" r="2"/><circle cx="34" cy="34" r="2"/>',
    walk: '<circle cx="28" cy="9" r="4"/><path d="m23 16 7 4 4 8m-11-12-5 9-8 4m14-10-2 10 8 8m-10-9-7 10"/>',
    ticket: '<path d="M8 15a4 4 0 0 0 0 8v7h32v-7a4 4 0 0 1 0-8v-7H8v7Z"/><path d="m28 14-9 17m-3-12h.1m13 7h.1"/>'
  };
  const icon = (name, cls = 'wl-icon') => {
    const wrap = document.createElement('span'); wrap.className = cls; wrap.setAttribute('aria-hidden', 'true');
    wrap.innerHTML = `<svg viewBox="0 0 48 48" focusable="false">${iconPaths[name] || iconPaths.go}</svg>`;
    return wrap;
  };

  function openWestLakeGuide(selected = {}) {
    document.getElementById('photoPlaceDialog')?.remove();
    const dialog = document.createElement('dialog'); dialog.id = 'photoPlaceDialog'; dialog.className = 'tw-photo-detail place-westlake-guide-v2'; dialog.setAttribute('aria-label', '西湖交互式旅行导览');
    const shell = document.createElement('div'); shell.className = 'wl-shell';
    const scroll = document.createElement('div'); scroll.className = 'wl-scroll';
    const top = document.createElement('div'); top.className = 'wl-topbar';
    const back = document.createElement('button'); back.type = 'button'; back.className = 'wl-quiet-button'; back.textContent = '‹ 返回'; back.setAttribute('aria-label', '关闭西湖导览'); back.addEventListener('click', () => dialog.close());
    const topNote = document.createElement('span'); topNote.className = 'wl-top-note'; topNote.textContent = 'TRAVEL WORLD · HANGZHOU';
    top.append(back, topNote);
    const hero = document.createElement('header'); hero.className = 'wl-hero';
    const heroCopy = document.createElement('div'); heroCopy.className = 'wl-hero-copy';
    heroCopy.innerHTML = '<h1>西湖</h1>';
    const searchButton = document.createElement('button'); searchButton.type = 'button'; searchButton.className = 'wl-search-button'; searchButton.setAttribute('aria-label', '搜索西湖景点、餐厅和住宿'); searchButton.textContent = '⌕';
    const searchPanel = document.createElement('div'); searchPanel.className = 'wl-search-panel'; searchPanel.hidden = true; searchPanel.setAttribute('role', 'search');
    const searchInput = document.createElement('input'); searchInput.type = 'search'; searchInput.placeholder = '搜索景点、餐厅、茶馆或酒店'; searchInput.setAttribute('aria-label', '搜索西湖导览内容');
    const searchResults = document.createElement('div'); searchResults.className = 'wl-search-results'; searchResults.setAttribute('role', 'list');
    const searchable = [...new Map([...sights, ...Object.values(venues).flat()].map(item => [item.id, item])).values()];
    const renderSearch = () => {
      searchResults.replaceChildren();
      const term = searchInput.value.trim().toLocaleLowerCase();
      const matches = searchable.filter(item => !term || `${item.title} ${item.summary}`.toLocaleLowerCase().includes(term)).slice(0, 8);
      if (!matches.length) { const empty = document.createElement('p'); empty.textContent = '没有找到匹配内容'; searchResults.append(empty); return; }
      matches.forEach(item => {
        const result = document.createElement('button'); result.type = 'button'; result.className = 'wl-search-result'; result.textContent = `${item.title}　›`;
        result.addEventListener('click', () => { searchPanel.hidden = true; detail(item, item.section || item.category || 'play'); }); searchResults.append(result);
      });
    };
    searchButton.addEventListener('click', () => { searchPanel.hidden = !searchPanel.hidden; if (!searchPanel.hidden) { renderSearch(); searchInput.focus(); } });
    searchInput.addEventListener('input', renderSearch);
    searchPanel.append(searchInput, searchResults); hero.append(heroCopy, searchButton, searchPanel);
    const categoryNav = document.createElement('nav'); categoryNav.className = 'wl-categories'; categoryNav.setAttribute('aria-label', '西湖导览分类');
    categories.forEach(item => {
      const button = document.createElement('button'); button.type = 'button'; button.className = 'wl-category';
      const categoryIcon = icon(item.id, 'wl-category-icon');
      const label = document.createElement('span'); label.className = 'wl-category-label'; label.textContent = item.label;
      button.append(categoryIcon, label); button.setAttribute('aria-label', `跳转到${item.label}：${item.title}`);
      button.addEventListener('click', () => { document.getElementById('wl-section-' + item.id)?.scrollIntoView({ behavior: matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth', block: 'start' }); });
      categoryNav.append(button);
    });
    const mapPanel = document.createElement('section'); mapPanel.className = 'wl-map-panel';
    mapPanel.setAttribute('aria-label', '西湖导览图，点选景点查看详情');
    const mapArt = document.createElement('div'); mapArt.className = 'wl-map-art';
    const mapImage = document.createElement('img'); mapImage.className = 'wl-map-reference'; mapImage.src = '/assets/route-photos/west-lake-map-clean.png'; mapImage.alt = '西湖水墨导览地图'; mapImage.width = 1672; mapImage.height = 947; mapImage.loading = 'eager'; mapImage.decoding = 'async';
    mapArt.append(mapImage);
    const mapTitle = document.createElement('div'); mapTitle.className = 'wl-map-title'; mapTitle.innerHTML = '<strong>西湖导览图</strong><span>精选四处 · 漫游湖光山色</span>';
    const compass = document.createElement('span'); compass.className = 'wl-map-compass'; compass.setAttribute('aria-hidden', 'true'); compass.innerHTML = '<span>N</span>⌖'; mapArt.append(mapTitle, compass);
    const mapPositions = { 'quyuan-fenghe': [23, 51], 'broken-bridge': [49, 31], 'three-pools': [37, 68], 'leifeng-pagoda': [82, 48] };
    sights.forEach(sight => {
      const pin = document.createElement('button'); pin.type = 'button'; pin.className = 'wl-map-pin';
      pin.style.setProperty('--pin-x', mapPositions[sight.id][0] + '%'); pin.style.setProperty('--pin-y', mapPositions[sight.id][1] + '%');
      pin.setAttribute('aria-label', `查看${sight.title}景点详情`);
      const thumbnail = document.createElement('img'); thumbnail.src = imageUrl(sight.photos[0]); thumbnail.alt = ''; thumbnail.loading = 'lazy'; thumbnail.decoding = 'async';
      const pinLabel = document.createElement('span'); pinLabel.className = 'wl-map-pin-label'; pinLabel.textContent = sight.title;
      pin.append(thumbnail, pinLabel); pin.addEventListener('click', () => detail(sight, 'play')); mapArt.append(pin);
    });
    mapPanel.append(mapArt);
    const sections = document.createElement('main'); sections.className = 'wl-sections';
    const status = document.createElement('p'); status.className = 'wl-status'; status.setAttribute('role', 'status'); status.setAttribute('aria-live', 'polite');

    function imageFigure(photo, cls = '') {
      const figure = document.createElement('figure'); figure.className = 'wl-photo ' + cls;
      const img = document.createElement('img'); img.src = imageUrl(photo); img.alt = photo.alt || '西湖实景照片'; img.loading = 'lazy'; img.decoding = 'async'; img.width = 960; img.height = 640;
      img.addEventListener('error', () => { img.hidden = true; figure.classList.add('is-missing'); }, { once: true });
      const caption = document.createElement('figcaption');
      caption.append(document.createTextNode(`${photo.credit} · ${photo.license}${photo.page ? ' ' : ''}`));
      if (photo.page) caption.append(external(filePage(photo), '来源', 'wl-photo-source'));
      figure.append(img, caption); return figure;
    }

    function detail(item, categoryId) {
      const page = document.createElement('article'); page.className = 'wl-detail'; page.tabIndex = -1;
      const detailTop = document.createElement('div'); detailTop.className = 'wl-detail-top';
      const returnButton = document.createElement('button'); returnButton.type = 'button'; returnButton.className = 'wl-quiet-button'; returnButton.textContent = '‹ 返回导览'; returnButton.addEventListener('click', () => { page.remove(); scroll.hidden = false; back.focus(); });
      const closeButton = document.createElement('button'); closeButton.type = 'button'; closeButton.className = 'wl-quiet-button'; closeButton.textContent = '关闭'; closeButton.addEventListener('click', () => dialog.close());
      detailTop.append(returnButton, closeButton);
      const category = categories.find(row => row.id === categoryId);
      const heading = document.createElement('header'); heading.className = 'wl-detail-heading';
      heading.innerHTML = `<span>${safe(category?.title || '西湖推荐')} · 杭州</span><h2>${safe(item.title)}</h2><p>${safe(item.summary)}</p>`;
      const gallery = document.createElement('div'); gallery.className = 'wl-detail-gallery'; gallery.setAttribute('aria-label', item.title + '照片');
      (item.photos || []).forEach((photo, index) => gallery.append(imageFigure(photo, index === 0 ? 'is-lead' : '')));
      const description = document.createElement('p'); description.className = 'wl-detail-copy'; description.textContent = item.history || item.dishes || item.drinks || item.summary;
      const facts = document.createElement('dl'); facts.className = 'wl-facts';
      const factRows = item.facts || [['菜单/价格/营业', '未接入商户实时数据；点击下方商户平台核对'], ['位置', item.location || '西湖景区周边；请在地图结果中确认具体门店'], ['照片说明', item.dishes || item.drinks || '真实地点照片；来源与授权见每张图片下方']];
      factRows.forEach(([key, value]) => { const row = document.createElement('div'); row.innerHTML = `<dt>${safe(key)}</dt><dd>${safe(value)}</dd>`; facts.append(row); });
      const tip = document.createElement('aside'); tip.className = 'wl-honesty-note'; tip.textContent = item.tip || '实时价格、评分、营业状态与库存未接入；请在商户或票务平台确认。';
      const actions = document.createElement('div'); actions.className = 'wl-detail-actions';
      if (item.category === 'play' || categoryId === 'play') {
        const nav = external(amapRoute(item.title, item.coords || [LAKE.lat, LAKE.lng], 'car'), '导航到这里 ↗', 'wl-primary-action');
        actions.append(nav);
        if (item.official) actions.append(external(item.official, '官方景区介绍 ↗'));
        actions.append(external(tripSearch(item.title + ' 杭州 门票'), '查询票务 ↗'));
      } else if (categoryId === 'eat') {
        actions.append(external(dianping(item.query), '查看门店 / 菜单 ↗', 'wl-primary-action'));
        actions.append(external(amapSearch(item.query), '导航到所选门店 ↗'));
      } else if (categoryId === 'drink') {
        actions.append(external(dianping(item.query), '查看茶馆 / 茶园信息 ↗', 'wl-primary-action'));
        actions.append(external(amapSearch(item.query), '导航到这里 ↗'));
      } else if (categoryId === 'stay') {
        actions.append(external(booking(item.query), '在 Booking.com 查看房源 ↗', 'wl-primary-action'));
        actions.append(external(amapSearch(item.title + ' 杭州'), '查看地图位置 ↗'));
      } else if (categoryId === 'leisure') {
        actions.append(external(item.booking ? tripSearch(item.query) : amapSearch(item.query), item.booking ? '查询当前票务 ↗' : '查看地图路线 ↗', 'wl-primary-action'));
        actions.append(external(amapRoute(item.title, [LAKE.lat, LAKE.lng], 'walk'), '步行导航 ↗'));
      }
      page.append(detailTop, heading, gallery, description, facts, tip, actions);
      scroll.hidden = true; shell.append(page); page.focus({ preventScroll: true }); dialog.scrollTop = 0;
    }

    function card(item, categoryId) {
      const article = document.createElement('article'); article.className = 'wl-card';
      const open = document.createElement(item.searchOnly ? 'a' : 'button');
      open.className = 'wl-card-open'; open.setAttribute('aria-label', item.searchOnly ? `在大众点评搜索${item.title}` : `查看${item.title}详情`);
      if (item.searchOnly) { open.href = dianping(item.query); open.target = '_blank'; open.rel = 'noopener noreferrer'; }
      else open.type = 'button';
      const photo = document.createElement('img'); photo.className = 'wl-card-image'; photo.src = imageUrl(item.photos[0]); photo.alt = item.photos[0].alt || item.title; photo.loading = 'lazy'; photo.decoding = 'async'; photo.width = 960; photo.height = 640;
      photo.addEventListener('error', () => { photo.hidden = true; article.classList.add('is-missing'); }, { once: true });
      if (item.photos[0].illustration) { const note = document.createElement('span'); note.className = 'wl-card-image-note'; note.textContent = 'AI 氛围示意 · 非店铺实拍'; article.append(note); }
      const copy = document.createElement('span'); copy.className = 'wl-card-copy';
      copy.innerHTML = `<strong>${safe(item.title)}<span class="wl-card-chevron" aria-hidden="true">›</span></strong><span class="wl-card-summary">${safe(item.summary)}</span><span class="wl-card-more">${item.searchOnly ? '打开平台查看' : '图片与介绍'}　→</span>`;
      open.append(photo, copy);
      if (!item.searchOnly) open.addEventListener('click', event => { event.preventDefault(); event.stopPropagation(); detail(item, categoryId); });
      article.append(open);
      if (!item.searchOnly) {
        const ways = document.createElement('nav'); ways.className = 'wl-card-ways'; ways.setAttribute('aria-label', `前往${item.title}`);
        const destination = item.coords || [LAKE.lat, LAKE.lng];
        const waysToGo = [
          ['car', '滴滴打车', 'https://webapp.didi.cn/'],
          ['metro', '地铁', amapSearch(item.title + ' 附近地铁站')],
          ['bus', '公交', item.coords ? amapRoute(item.title, destination, 'bus', null, 3) : amapSearch(item.title + ' 附近公交站')]
        ];
        waysToGo.forEach(([iconName, label, href]) => {
          const link = external(href, '', 'wl-card-way'); link.setAttribute('aria-label', `${label}前往${item.title}`);
          const text = document.createElement('span'); text.className = 'wl-way-label'; text.textContent = label;
          link.append(icon(iconName, 'wl-way-icon'), text); ways.append(link);
        });
        article.append(ways);
      }
      return article;
    }

    function carousel(items, categoryId, section) {
      const controls = document.createElement('div'); controls.className = 'wl-carousel-controls';
      const hint = document.createElement('span'); hint.className = 'wl-scroll-hint'; hint.textContent = '左右滑动查看';
      const prev = document.createElement('button'); prev.type = 'button'; prev.textContent = '←'; prev.className = 'wl-arrow'; prev.setAttribute('aria-label', '向左查看');
      const next = document.createElement('button'); next.type = 'button'; next.textContent = '→'; next.className = 'wl-arrow'; next.setAttribute('aria-label', '向右查看');
      const rail = document.createElement('div'); rail.className = 'wl-carousel'; rail.setAttribute('role', 'region'); rail.setAttribute('aria-label', `${categories.find(c => c.id === categoryId)?.label}推荐，可左右滑动`);
      items.forEach(item => rail.append(card(item, categoryId)));
      const update = () => {
        const max = Math.max(0, rail.scrollWidth - rail.clientWidth);
        prev.disabled = max <= 4 || rail.scrollLeft < 4; next.disabled = max <= 4 || rail.scrollLeft >= max - 4;
      };
      prev.addEventListener('click', () => rail.scrollBy({ left: -rail.clientWidth * .82, behavior: 'smooth' }));
      next.addEventListener('click', () => rail.scrollBy({ left: rail.clientWidth * .82, behavior: 'smooth' }));
      rail.addEventListener('scroll', update, { passive: true });
      controls.append(hint, prev, next); section.append(controls, rail); requestAnimationFrame(update);
      let pointerStart = null; let suppressClickUntil = 0;
      rail.addEventListener('pointerdown', event => { if (event.pointerType !== 'mouse' || event.button !== 0) return; pointerStart = { x: event.clientX, left: rail.scrollLeft, moved: false, captured: false }; });
      rail.addEventListener('pointermove', event => {
        if (!pointerStart) return;
        const delta = event.clientX - pointerStart.x;
        if (Math.abs(delta) > 10) {
          pointerStart.moved = true;
          if (!pointerStart.captured) { rail.setPointerCapture(event.pointerId); pointerStart.captured = true; }
          rail.scrollLeft = pointerStart.left - delta;
        }
      });
      rail.addEventListener('click', event => { if (Date.now() < suppressClickUntil) { suppressClickUntil = 0; event.preventDefault(); event.stopImmediatePropagation(); } }, true);
      const finishDrag = () => { if (pointerStart?.moved) suppressClickUntil = Date.now() + 300; pointerStart = null; };
      rail.addEventListener('pointerup', finishDrag); rail.addEventListener('pointercancel', finishDrag); rail.addEventListener('lostpointercapture', finishDrag);
    }

    categories.forEach((category, index) => {
      const section = document.createElement('section'); section.className = 'wl-section'; section.id = 'wl-section-' + category.id; section.setAttribute('aria-labelledby', 'wl-heading-' + category.id);
      const head = document.createElement('div'); head.className = 'wl-section-heading';
      head.innerHTML = `<div class="wl-section-title"><span aria-hidden="true"></span><div><h2 id="wl-heading-${category.id}">附近推荐 · ${category.label}</h2><p>${category.note}</p></div></div>`;
      const moreHref = category.id === 'eat' ? dianping('杭州西湖 杭帮菜') : category.id === 'drink' ? dianping('杭州西湖 茶馆') : category.id === 'stay' ? booking('West Lake Hangzhou China') : category.id === 'go' ? amapSearch('西湖 公交 地铁 站') : tripSearch(category.id === 'play' ? '杭州西湖 景点 门票' : '杭州西湖 游船 体验');
      head.append(external(moreHref, '更多　›', 'wl-section-more'));
      section.append(head);
      if (category.id === 'go') {
        const routes = document.createElement('div'); routes.className = 'wl-routes';
        const locationButton = document.createElement('button'); locationButton.type = 'button'; locationButton.className = 'wl-location-button'; locationButton.textContent = '使用当前位置规划路线';
        locationButton.setAttribute('aria-label', '仅在点击后申请当前位置，用于规划西湖路线');
        const locationStatus = document.createElement('p'); locationStatus.className = 'wl-location-status'; locationStatus.setAttribute('role', 'status'); locationStatus.textContent = '不授权也可直接打开路线；仅点此按钮时才申请定位。';
        const routeLinks = [];
        [
          { title: '步行', copy: '沿湖慢走，路线按当前位置生成。', mode: 'walk', icon: 'walk', href: amapRoute('西湖景区', [LAKE.lat, LAKE.lng], 'walk') },
          { title: '公交 / 地铁', copy: '查看到西湖景区的公共交通方案。', mode: 'bus', icon: 'metro', href: amapRoute('西湖景区', [LAKE.lat, LAKE.lng], 'bus') },
          { title: '打车', copy: '打开滴滴后请核对上车点与“西湖景区”目的地；登录和下单由滴滴处理。', mode: 'didi', icon: 'car', href: 'https://webapp.didi.cn/' }
        ].forEach(route => {
          const article = document.createElement('article'); article.className = 'wl-route-card';
          const heading = document.createElement('h3'); heading.append(icon(route.icon, 'wl-route-icon'), document.createTextNode(route.title));
          const copy = document.createElement('p'); copy.textContent = route.copy;
          const link = external(route.href, '', 'wl-primary-action'); link.append(icon(route.icon, 'wl-way-icon'), document.createTextNode(route.mode === 'didi' ? '打开滴滴 ↗' : `规划${route.title}路线 ↗`));
          if (route.mode !== 'didi') routeLinks.push({ link, route });
          article.append(heading, copy, link); routes.append(article);
        });
        locationButton.addEventListener('click', () => {
          if (!navigator.geolocation) { locationStatus.textContent = '此浏览器不支持定位；仍可手动打开地图规划路线。'; return; }
          locationButton.disabled = true; locationStatus.textContent = '正在请求当前位置…';
          navigator.geolocation.getCurrentPosition(position => {
            const origin = [position.coords.latitude, position.coords.longitude];
            routeLinks.forEach(({ link, route }) => { link.href = amapRoute('西湖景区', [LAKE.lat, LAKE.lng], route.mode, origin); });
            locationButton.disabled = false; locationStatus.textContent = '路线起点已更新为当前位置；位置没有保存到 Travel World。';
          }, error => {
            locationButton.disabled = false;
            locationStatus.textContent = error.code === error.PERMISSION_DENIED ? '你没有授权定位；仍可手动打开地图规划路线。' : '暂时无法获取位置；仍可手动打开地图规划路线。';
          }, { enableHighAccuracy: false, timeout: 8000, maximumAge: 60000 });
        });
        section.append(locationButton, locationStatus, routes);
      } else if (category.id === 'stay') {
        const filters = document.createElement('form'); filters.className = 'wl-stay-filters'; filters.setAttribute('aria-label', 'Booking.com 住宿搜索筛选'); filters.addEventListener('submit', event => event.preventDefault());
        filters.innerHTML = '<label>星级<select name="stars"><option value="">不限</option><option value="class=3">3 星</option><option value="class=4">4 星</option><option value="class=5">5 星</option></select></label><label>预算<select name="price"><option value="">不限定</option><option value="price=0-300">300 元内</option><option value="price=300-800">300–800 元</option><option value="price=800-2000">800 元以上</option></select></label><label>靠近<select name="near"><option value="West Lake Hangzhou China">西湖</option><option value="Hubin Hangzhou China">湖滨</option><option value="Beishan Street Hangzhou China">北山街</option><option value="Longjing Village Hangzhou China">龙井村</option></select></label>';
        const moreStay = external(booking('West Lake Hangzhou China'), '按所选条件查看 Booking.com 房源 ↗', 'wl-primary-action wl-stay-search');
        const changeStay = () => { const data = new FormData(filters); moreStay.href = booking(data.get('near'), data.get('stars'), data.get('price')); };
        filters.addEventListener('change', changeStay); section.append(filters, moreStay);
        carousel(venues.stay, 'stay', section);
      } else {
        const items = category.id === 'play' ? venues.play : category.id === 'leisure' ? venues.leisure : venues[category.id];
        carousel(items, category.id, section);
      }
      sections.append(section);
    });
    const credits = document.createElement('details'); credits.className = 'wl-credits'; credits.innerHTML = '<summary>图片来源与使用授权</summary><p>照片来自 Wikimedia Commons，图片下方标注作者、授权方式与原文件页；部分菜品/茶叶参考照片明确标注并非该门店实拍。若授权页面变化，图片会显示为不可用，不用无来源图片替代。</p>';
    const heroArtCredit = external('https://commons.wikimedia.org/wiki/Category:West_Lake,_Hangzhou', '西湖水墨背景为 Travel World 插画；照片授权见卡片'); credits.append(heroArtCredit);
    const footer = document.createElement('div'); footer.className = 'wl-footer';
    const favorite = document.createElement('button'); favorite.type = 'button'; favorite.className = 'wl-secondary-action';
    const add = document.createElement('button'); add.type = 'button'; add.className = 'wl-primary-action'; add.textContent = '+ 加入行程';
    const saveKey = 'tw-city-favorites:' + (window.TravelWorldAuth?.session?.()?.user?.id || 'guest');
    const refreshFavorite = () => { let isSaved = false; try { isSaved = JSON.parse(localStorage.getItem(saveKey) || '[]').includes(selected.id || 'cn-west-lake'); } catch {} favorite.setAttribute('aria-pressed', String(isSaved)); favorite.textContent = isSaved ? '已收藏西湖' : '收藏地点'; };
    favorite.addEventListener('click', () => { try { const id = selected.id || 'cn-west-lake'; const current = JSON.parse(localStorage.getItem(saveKey) || '[]'); const next = current.includes(id) ? current.filter(value => value !== id) : [...current, id]; localStorage.setItem(saveKey, JSON.stringify(next)); refreshFavorite(); status.textContent = next.includes(id) ? '西湖已收藏。' : '已取消收藏。'; } catch { status.textContent = '收藏暂时无法保存，请稍后重试。'; } });
    add.addEventListener('click', () => { if (typeof window.addLandmark === 'function') { window.addLandmark(selected.id || 'cn-west-lake'); status.textContent = '已打开行程添加流程。'; return; } try { const key = 'tw-itinerary-draft'; const items = JSON.parse(localStorage.getItem(key) || '[]'); const id = selected.id || 'cn-west-lake'; if (!items.some(item => item.id === id)) items.push({ id, name: '西湖', addedAt: new Date().toISOString() }); localStorage.setItem(key, JSON.stringify(items)); status.textContent = '西湖已加入本机行程草稿。'; } catch { status.textContent = '行程暂时无法保存，请稍后重试。'; } });
    refreshFavorite(); footer.append(favorite, add);
    scroll.append(top, hero, mapPanel, categoryNav, sections, credits, status, footer);
    shell.append(scroll); dialog.append(shell);
    dialog.addEventListener('close', () => { dialog.remove(); document.body.classList.remove('selected-city-guide-open'); }, { once: true });
    dialog.addEventListener('click', event => { if (event.target === dialog) dialog.close(); });
    document.body.classList.add('selected-city-guide-open'); document.body.append(dialog); dialog.showModal();
  }

  window.openWestLakeGuide = openWestLakeGuide;
  window.WestLakeGuideData = { sights, venues, categories };
}());
