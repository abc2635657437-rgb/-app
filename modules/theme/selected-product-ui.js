(function () {
  const css = document.createElement('link');
  css.rel = 'stylesheet';
  css.href = '/modules/theme/selected-product-ui.css?v=12';
  document.head.append(css);
  const t = (zh, en) => window.TravelWorldI18n?.language?.() === 'en' ? en : zh;
  const auth = () => window.TravelWorldAuth;
  const userKey = () => auth()?.session?.()?.user?.id || 'guest';
  const draftKey = () => `tw-trip-draft:v1:${userKey()}`;
  const esc = value => String(value ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  let setupQueued = false;
  let stops = [];
  let buddyGroupChats = window.getBuddyChatThreads?.() || [];
  let chatFilter = 'all';
  const icon = {
    home: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="m3 10 9-7 9 7v10a1 1 0 0 1-1 1h-5v-6H9v6H4a1 1 0 0 1-1-1z"/></svg>',
    map: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="m3 6 6-3 6 3 6-3v15l-6 3-6-3-6 3zM9 3v15m6-12v15"/></svg>',
    messages: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 5h16v12H9l-5 4zM8 9h8M8 13h5"/></svg>',
    friends: '<svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="9" cy="8" r="3.5"/><path d="M2.5 20v-1.5a6.5 6.5 0 0 1 13 0V20zm14-10a3.5 3.5 0 1 0-1.5-6.7M18 14a5 5 0 0 1 3.5 4.8V20h-3"/></svg>',
    profile: '<svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="7.5" r="4"/><path d="M4 21v-1a8 8 0 0 1 16 0v1z"/></svg>'
  };

  function setupNavigation() {
    const nav = document.querySelector('.nav');
    document.querySelectorAll('.nav button[data-id]').forEach(button => {
      const image = button.querySelector('.nav-icon');
      if (image && icon[button.dataset.id] && image.dataset.selectedIcon !== 'true') {
        image.innerHTML = icon[button.dataset.id];
        image.dataset.selectedIcon = 'true';
      }
    });
    if (!nav || !document.body.classList.contains('selected-screens-preview')) return;
    const page = id => nav.querySelector('[data-id="' + id + '"]');
    const profile = page('profile');
    if (profile) { profile.hidden = true; profile.setAttribute('aria-hidden', 'true'); }
    let publish = nav.querySelector('[data-selected-publish]');
    if (!publish) {
      publish = document.createElement('button');
      publish.type = 'button';
      publish.dataset.selectedPublish = 'true';
      publish.className = 'selected-publish-nav';
      publish.setAttribute('aria-label', t('发布内容', 'Create a post'));
      publish.innerHTML = '<span class="nav-icon" aria-hidden="true"><svg viewBox="0 0 24 24"><path d="M12 5v14M5 12h14"/></svg></span><br><span>发布</span>';
      publish.addEventListener('click', () => window.openPublisher?.());
    }
    const home = page('home'), map = page('map'), messages = page('messages'), friends = page('friends');
    const ordered = [home, map, publish, messages, friends, profile].filter(Boolean);
    const extras = [...nav.children].filter(child => !ordered.includes(child));
    if (ordered.some((node, index) => nav.children[index] !== node)) nav.replaceChildren(...ordered, ...extras);
  }

  function routeSearch(value) {
    const query = String(value || '').trim();
    if (!query) return;
    document.body.dataset.exploreMode = 'map';
    window.go('map');
    window.loadMap?.();
    window.searchTravelMap?.(query);
  }

  function profileImageUrl() {
    const user = auth()?.session?.()?.user;
    const raw = user?.user_metadata?.avatar_url || user?.user_metadata?.picture || user?.avatar_url || '';
    if (!raw) return '';
    try {
      const url = new URL(raw, location.origin);
      return url.protocol === 'https:' || url.origin === location.origin ? url.href : '';
    } catch (_) { return ''; }
  }

  function ensureProfileButton(container, before = null) {
    if (!container) return null;
    let button = [...container.children].find(child => child.classList.contains('selected-profile-entry'));
    if (!button) {
      button = document.createElement('button');
      button.type = 'button';
      button.className = 'selected-profile-entry';
      button.dataset.selectedProfile = 'true';
    }
    button.setAttribute('aria-label', t('打开我的个人主页', 'Open my profile'));
    button.title = t('我的', 'My profile');
    const avatarUrl = profileImageUrl();
    if (button.dataset.avatarSrc !== avatarUrl) {
      button.dataset.avatarSrc = avatarUrl;
      button.innerHTML = avatarUrl ? '<img alt="" src="' + esc(avatarUrl) + '">' : icon.profile;
      const image = button.querySelector('img');
      if (image) image.onerror = () => { button.innerHTML = icon.profile; };
    }
    button.removeAttribute('onclick');
    if (before && before.parentElement === container && button !== before) container.insertBefore(button, before);
    else if (!button.isConnected || button.parentElement !== container) container.append(button);
    return button;
  }

  function setupHome() {
    const home = document.getElementById('home');
    const community = home?.querySelector('.home-community');
    if (!community) return;
    community.querySelector('.journal-community-heading')?.setAttribute('hidden', '');
    let intro = community.querySelector('.selected-home-intro');
    if (!intro) { intro = document.createElement('section'); intro.className = 'selected-home-intro'; }
    intro.querySelector('.selected-home-lead')?.remove();
    let search = intro.querySelector('form.selected-search');
    if (!search) {
      intro.innerHTML = '<form class="selected-search" role="search"><svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="10.8" cy="10.8" r="6.8"></circle><path d="m16 16 5 5"></path></svg><input id="selectedHomeSearch" type="search" autocomplete="off" placeholder="搜索城市或目的地" aria-label="搜索城市或目的地"><button type="submit" aria-label="开始搜索">搜索</button></form>';
      search = intro.querySelector('form');
      search.addEventListener('submit', event => { event.preventDefault(); routeSearch(intro.querySelector('input').value); });
    }
    const top = community.querySelector('.community-top');
    if (top && intro.parentElement !== community) top.after(intro);
    const brand = community.querySelector('.community-brand');
    if (brand) brand.textContent = '同路人';
    top?.querySelector('#authEntry')?.remove();
    if (document.body.classList.contains('selected-screens-preview')) top?.querySelector('.publish-button')?.remove();
    if (top) ensureProfileButton(top);
    const tabs = community.querySelector('.home-tabs');
    if (tabs) tabs.setAttribute('aria-label', t('首页内容','Home feed'));
  }

  function setupExplore() {
    const map = document.getElementById('map');
    if (!map) return;
    let intro = map.querySelector('.selected-explore-intro');
    if (!intro) {
      intro = document.createElement('section');
      intro.className = 'selected-explore-intro';
      intro.innerHTML = '<div class="selected-explore-topline"><p class="selected-kicker">TRAVEL WORLD</p></div><h1>探索</h1><p class="selected-lead-copy">去看更大的世界，遇见不一样的风景。</p><form class="selected-search" role="search"><svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="10.8" cy="10.8" r="6.8"></circle><path d="m16 16 5 5"></path></svg><input id="selectedExploreSearch" type="search" autocomplete="off" placeholder="搜索目的地、城市或体验" aria-label="搜索目的地、城市或体验"><button type="submit" aria-label="开始搜索">搜索</button></form><div class="selected-view-switch" role="group" aria-label="探索显示方式"><button type="button" data-explore-view="list" aria-pressed="true"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M9 6h11M9 12h11M9 18h11"/><circle cx="4" cy="6" r="1"/><circle cx="4" cy="12" r="1"/><circle cx="4" cy="18" r="1"/></svg> 列表</button><button type="button" data-explore-view="map" aria-pressed="false"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="m3 6 6-3 6 3 6-3v15l-6 3-6-3-6 3zM9 3v15M15 6v15"/></svg> 地图</button></div>';
      const title = map.querySelector('.title');
      if (title) { title.hidden = true; title.after(intro); } else map.prepend(intro);
      intro.querySelector('form').addEventListener('submit', event => { event.preventDefault(); routeSearch(intro.querySelector('input').value); });
      intro.querySelectorAll('[data-explore-view]').forEach(button => button.addEventListener('click', () => setExploreView(button.dataset.exploreView)));
    }
    let topLine = intro.querySelector('.selected-explore-topline');
    const kicker = intro.querySelector('.selected-kicker');
    if (!topLine) {
      topLine = document.createElement('div');
      topLine.className = 'selected-explore-topline';
      if (kicker) { kicker.before(topLine); topLine.append(kicker); }
    }
    ensureProfileButton(topLine);
    setExploreView(document.body.dataset.exploreMode || 'list', false);
    const where = document.getElementById('whereNow');
    if (where) {
      const title = where.querySelector('.head h2');
      if (title) title.textContent = t('目的地灵感','Destination inspiration');
      let subtitle = where.querySelector('.selected-destination-subtitle');
      if (!subtitle && title) {
        subtitle = document.createElement('p');
        subtitle.className = 'selected-destination-subtitle';
        subtitle.textContent = t('从山川湖海到人文古迹，发现下一段旅程的灵感。','From mountains and coastlines to culture and history, find inspiration for your next journey.');
        title.after(subtitle);
      }
      const heading = where.querySelector('.head');
      heading?.querySelector('small')?.setAttribute('hidden', '');
      let mapLink = heading?.querySelector('.selected-explore-map-link');
      if (heading && !mapLink) {
        mapLink = document.createElement('button');
        mapLink.type = 'button';
        mapLink.className = 'selected-explore-map-link';
        mapLink.textContent = t('在地图上查看 ›', 'View on map ›');
        mapLink.onclick = () => setExploreView('map');
        heading.querySelector('.muted')?.replaceWith(mapLink);
      }
      let categoryTabs = map.querySelector('.selected-destination-categories');
      if (!categoryTabs) {
        categoryTabs = document.createElement('nav');
        categoryTabs.className = 'selected-destination-categories';
        categoryTabs.setAttribute('aria-label', t('目的地类别', 'Destination categories'));
        categoryTabs.innerHTML = [['all','全部','All'],['natural','自然','Nature'],['city','城市','City'],['culture','文化','Culture'],['island','海岛','Islands'],['old-town','古镇','Old towns']].map(([id,zh,en],index) => '<button type="button" data-destination-category="' + id + '" aria-pressed="' + (index===0) + '">' + t(zh,en) + '</button>').join('');
        where.before(categoryTabs);
        categoryTabs.addEventListener('click', event => {
          const button = event.target.closest('[data-destination-category]');
          if (!button) return;
          categoryTabs.querySelectorAll('[data-destination-category]').forEach(item => item.setAttribute('aria-pressed', String(item === button)));
          const category = button.dataset.destinationCategory === 'all' ? '' : button.dataset.destinationCategory;
          import('../discover/destination-directory.js?v=5').then(module => module.filterDestinationCategory(category)).catch(() => {
            const grid = document.getElementById('whereNowGrid');
            if (!grid) return;
            const status = document.createElement('p');
            status.className = 'destination-feedback';
            status.setAttribute('role', 'alert');
            status.textContent = t('筛选暂时无法载入，请重试。', 'This filter could not load. Please try again.');
            grid.replaceChildren(status);
          });
        });
      }
      const categoryLabels = { all: ['全部','All'], natural: ['自然','Nature'], city: ['城市','City'], culture: ['文化','Culture'], island: ['海岛','Islands'], 'old-town': ['古镇','Old towns'] };
      categoryTabs.querySelectorAll('[data-destination-category]').forEach(button => { button.textContent = t(...categoryLabels[button.dataset.destinationCategory]); });
      let extraFilters = map.querySelector('.selected-explore-extra-filters');
      if (!extraFilters) {
        extraFilters = document.createElement('details');
        extraFilters.className = 'selected-explore-extra-filters';
        extraFilters.innerHTML = '<summary>更多筛选</summary>';
        where.after(extraFilters);
      }
      extraFilters.querySelector('summary').textContent = t('更多筛选', 'More filters');
      const moveAdvancedFilters = () => {
        const regions = map.querySelector('#destinationRegionTabs');
        if (regions && !extraFilters.contains(regions)) extraFilters.append(regions);
        const season = map.querySelector('#destinationSeason');
        if (season && !extraFilters.contains(season)) {
          let label = extraFilters.querySelector('[data-season-label]');
          if (!label) { label = document.createElement('label'); label.dataset.seasonLabel = 'true'; label.textContent = t('季节', 'Season'); }
          extraFilters.append(label, season);
        }
        const countries = map.querySelector('#destinationCountryControls');
        if (countries && !extraFilters.contains(countries)) extraFilters.append(countries);
      };
      moveAdvancedFilters();
      if (!where.dataset.selectedFilterObserver) {
        where.dataset.selectedFilterObserver = 'true';
        new MutationObserver(moveAdvancedFilters).observe(where, { childList: true, subtree: true });
      }
    }
    if (!window.__selectedExploreWorldFilter && window.filterDestinationRegion) {
      window.__selectedExploreWorldFilter = true;
      window.filterDestinationRegion('world');
    }
  }

  function setExploreView(mode, scroll = true) {
    const next = mode === 'map' ? 'map' : 'list';
    document.body.dataset.exploreMode = next;
    document.querySelectorAll('[data-explore-view]').forEach(button => button.setAttribute('aria-pressed', String(button.dataset.exploreView === next)));
    if (next === 'map') window.loadMap?.();
    if (scroll) document.querySelector('.selected-explore-intro')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }

  function renderBuddyChats() {
    const root = document.getElementById('selectedBuddyChatRows');
    if (!root) return;
    buddyGroupChats = window.getBuddyChatThreads?.() || buddyGroupChats;
    root.innerHTML = buddyGroupChats.length ? buddyGroupChats.map(chat => '<button class="selected-chat-row" type="button" data-buddy-chat="' + esc(chat.id) + '"><span class="selected-chat-symbol" aria-hidden="true">✦</span><span class="selected-chat-copy"><b>' + esc(chat.title) + '</b><small>' + esc(chat.destination || t('旅行讨论','Trip discussion')) + '</small></span>' + (chat.unreadCount ? '<span class="selected-chat-unread" aria-label="' + chat.unreadCount + ' 条未读">' + chat.unreadCount + '</span>' : '<span class="selected-chat-chevron" aria-hidden="true">›</span>') + '</button>').join('') : '<p class="selected-chat-empty">' + (auth()?.session?.() ? t('同意同行后，这里会出现对应的旅行群聊。','Group chats appear here after a trip request is accepted.') : t('登录后查看同行群聊；不会展示示例会话。','Sign in to view travel group chats. No sample conversations are shown.')) + '</p>';
    root.querySelectorAll('[data-buddy-chat]').forEach(button => button.onclick = () => {
      const chat = buddyGroupChats.find(item => item.id === button.dataset.buddyChat);
      if (chat) window.openBuddyChat?.(chat.id, encodeURIComponent(chat.title));
    });
  }

  function applyChatFilter() {
    document.querySelectorAll('[data-chat-filter]').forEach(button => button.setAttribute('aria-pressed', String(button.dataset.chatFilter === chatFilter)));
    const privateList = document.getElementById('selectedPrivateBlock');
    const groupList = document.getElementById('selectedBuddyBlock');
    if (privateList) privateList.hidden = chatFilter === 'groups';
    if (groupList) groupList.hidden = chatFilter === 'private';
  }

  function setupChat() {
    const messages = document.getElementById('messages');
    const list = document.getElementById('dmList');
    const head = messages?.querySelector('.dm-page-head');
    if (!messages || !list || !head) return;
    const pageTitle = head.querySelector('.title');
    const pageSubtitle = head.querySelector('p');
    if (pageTitle) pageTitle.textContent = t('聊天', 'Chat');
    if (pageSubtitle) pageSubtitle.textContent = t('把旅途中的每一次对话，都放在这里。', 'Every conversation from the road, together in one place.');
    let brand = messages.querySelector('.selected-messages-brand');
    if (!brand) {
      brand = document.createElement('div'); brand.className = 'selected-messages-brand';
      brand.innerHTML = '<div><span>TRAVEL WORLD</span><b>同路人</b></div>';
      messages.prepend(brand);
    }
    brand.querySelectorAll('button:not(.selected-profile-entry)').forEach(button => button.remove());
    ensureProfileButton(brand);
    let search = messages.querySelector('.selected-chat-search');
    if (!search) {
      search = document.createElement('form'); search.className = 'selected-chat-search selected-search'; search.setAttribute('role', 'search');
      search.innerHTML = '<svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="10.8" cy="10.8" r="6.8"></circle><path d="m16 16 5 5"></path></svg><input id="selectedChatSearch" type="search" autocomplete="off" placeholder="搜索聊天记录或关键词" aria-label="搜索聊天记录或关键词"><button type="reset" aria-label="清除搜索" hidden>清除</button>';
      head.after(search);
      search.addEventListener('submit', event => event.preventDefault());
      search.addEventListener('input', filterChatRows);
      search.addEventListener('reset', () => requestAnimationFrame(filterChatRows));
    }
    let tabs = messages.querySelector('.journal-tabs');
    if (!tabs) { tabs = document.createElement('div'); tabs.className = 'journal-tabs'; head.after(tabs); }
    if (tabs.dataset.selectedTabs !== 'true') {
      tabs.dataset.selectedTabs = 'true';
      tabs.innerHTML = '<button type="button" data-chat-filter="all" aria-pressed="true">全部</button><button type="button" data-chat-filter="private" aria-pressed="false">私聊</button><button type="button" data-chat-filter="groups" aria-pressed="false">同行群聊</button>';
      tabs.querySelectorAll('[data-chat-filter]').forEach(button => button.onclick = () => { chatFilter = button.dataset.chatFilter; applyChatFilter(); });
    }
    search.after(tabs);
    let request = messages.querySelector('.selected-request-card');
    if (!request) {
      request = document.createElement('button');
      request.type = 'button'; request.className = 'selected-request-card';
      request.innerHTML = '<span class="selected-request-icon" aria-hidden="true"><svg viewBox="0 0 24 24"><circle cx="9" cy="7" r="4"/><path d="M2.5 21v-1.5A6.5 6.5 0 0 1 9 13a6.5 6.5 0 0 1 6.5 6.5V21M19 8v8M15 12h8"/></svg></span><span><b>消息申请</b><small>查看新的好友申请或同行邀请</small></span><span aria-hidden="true">›</span>';
      tabs.after(request);
      request.onclick = () => { window.go('friends'); document.getElementById('incomingApplications')?.scrollIntoView({ behavior: 'smooth', block: 'center' }); };
    }
    let privateBlock = messages.querySelector('#selectedPrivateBlock');
    if (!privateBlock) {
      privateBlock = document.createElement('section'); privateBlock.id = 'selectedPrivateBlock'; privateBlock.className = 'selected-chat-block';
      privateBlock.innerHTML = '<div class="selected-chat-heading"><h2>最近联系</h2><span>私聊</span></div>';
      list.before(privateBlock); privateBlock.append(list);
    }
    let groupBlock = messages.querySelector('#selectedBuddyBlock');
    if (!groupBlock) {
      groupBlock = document.createElement('section'); groupBlock.id = 'selectedBuddyBlock'; groupBlock.className = 'selected-chat-block';
      groupBlock.innerHTML = '<div class="selected-chat-heading"><h2>行程讨论</h2><span>同行群聊</span></div><div id="selectedBuddyChatRows" aria-live="polite"></div>';
      privateBlock.after(groupBlock);
    }
    renderBuddyChats(); applyChatFilter();
  }

  function filterChatRows() {
    const input = document.getElementById('selectedChatSearch');
    const query = input?.value.trim().toLocaleLowerCase() || '';
    const clear = input?.form?.querySelector('[type="reset"]');
    if (clear) clear.hidden = !query;
    document.querySelectorAll('#dmList .dm-row, #selectedBuddyChatRows .selected-chat-row').forEach(row => {
      row.hidden = !!query && !row.textContent.toLocaleLowerCase().includes(query);
    });
  }

  function makeField(control, label, className = '') {
    if (!control || control.parentElement?.classList.contains('selected-trip-field')) return control?.parentElement;
    const field = document.createElement('label'); field.className = 'selected-trip-field ' + className; field.htmlFor = control.id;
    const caption = document.createElement('span'); caption.textContent = label;
    control.before(field); field.append(caption, control);
    return field;
  }

  const tripFieldIcons = {
    destination: '<svg viewBox="0 0 24 24"><path d="M20 10c0 5-8 12-8 12S4 15 4 10a8 8 0 1 1 16 0Z"/><circle cx="12" cy="10" r="2.5"/></svg>',
    date: '<svg viewBox="0 0 24 24"><rect x="3" y="5" width="18" height="16" rx="2"/><path d="M16 3v4M8 3v4M3 10h18"/></svg>',
    travelers: '<svg viewBox="0 0 24 24"><path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2M9 11a4 4 0 1 0 0-8 4 4 0 0 0 0 8ZM22 21v-2a4 4 0 0 0-3-3.87M16 3.13a4 4 0 0 1 0 7.75"/></svg>',
    budget: '<svg viewBox="0 0 24 24"><path d="M3 6.5A2.5 2.5 0 0 1 5.5 4H21v16H5.5A2.5 2.5 0 0 1 3 17.5zM3 7h18M17 13h4"/><circle cx="17" cy="13" r=".8"/></svg>'
  };

  function setTripFieldIcon(field, kind) {
    if (!field || field.querySelector('.selected-trip-field-icon')) return;
    field.classList.add('selected-trip-row');
    const icon = document.createElement('span'); icon.className = 'selected-trip-field-icon'; icon.setAttribute('aria-hidden', 'true');
    icon.innerHTML = tripFieldIcons[kind]; field.prepend(icon);
  }

  function getTripFormData() {
    const value = id => document.getElementById(id)?.value || '';
    return { title: value('tripTitle'), destination: value('tripDestination'), start: value('selectedTripStart'), end: value('selectedTripEnd'), travelers: value('selectedTripTravelers') || '1', budget: value('journalTripBudget'), type: value('journalTripType') || 'City walk', note: value('tripNote'), stops: [...stops] };
  }

  function saveTripDraft(showMessage = true) {
    try {
      localStorage.setItem(draftKey(), JSON.stringify(getTripFormData()));
      const status = document.getElementById('selectedTripStatus');
      if (status && showMessage) status.textContent = t('草稿已保存在这台设备；尚未公开。','Draft saved on this device; it has not been published.');
      return true;
    } catch (_) {
      const status = document.getElementById('selectedTripStatus');
      if (status) status.textContent = t('本机草稿保存失败，请检查浏览器存储空间。','Could not save the local draft. Check browser storage.');
      return false;
    }
  }

  function renderStops() {
    const list = document.getElementById('selectedTripStops');
    if (!list) return;
    list.innerHTML = stops.length ? stops.map((name, index) => '<li><span class="selected-stop-order">' + (index + 1) + '</span><span class="selected-stop-name">' + esc(name) + '</span><span class="selected-stop-actions"><button type="button" data-stop-up="' + index + '" aria-label="上移 ' + esc(name) + '" ' + (index === 0 ? 'disabled' : '') + '>↑</button><button type="button" data-stop-down="' + index + '" aria-label="下移 ' + esc(name) + '" ' + (index === stops.length - 1 ? 'disabled' : '') + '>↓</button><button type="button" data-stop-remove="' + index + '" aria-label="移除 ' + esc(name) + '">×</button></span></li>').join('') : '<li class="selected-stop-empty"><svg viewBox="0 0 160 108" aria-hidden="true"><path class="selected-route-hill" d="M8 50 35 33l23 14 16-10 30 20"/><path class="selected-route-path" d="M30 84c18-27 32 19 53-1s-12-23 8-42 22-8 34-21"/><path class="selected-route-pin" d="M27 70c-7 0-12 5-12 12 0 8 12 20 12 20s12-12 12-20c0-7-5-12-12-12Zm0 8a4 4 0 1 0 0 8 4 4 0 0 0 0-8ZM132 4c-7 0-12 5-12 12 0 8 12 20 12 20s12-12 12-20c0-7-5-12-12-12Zm0 8a4 4 0 1 0 0 8 4 4 0 0 0 0-8Z"/></svg><span>添加地点后，行程会显示在这里</span></li>';
    list.querySelectorAll('[data-stop-up]').forEach(button => button.onclick = () => moveStop(Number(button.dataset.stopUp), -1));
    list.querySelectorAll('[data-stop-down]').forEach(button => button.onclick = () => moveStop(Number(button.dataset.stopDown), 1));
    list.querySelectorAll('[data-stop-remove]').forEach(button => button.onclick = () => { stops.splice(Number(button.dataset.stopRemove), 1); renderStops(); saveTripDraft(false); });
  }

  function moveStop(index, delta) {
    const next = index + delta;
    if (next < 0 || next >= stops.length) return;
    [stops[index], stops[next]] = [stops[next], stops[index]]; renderStops(); saveTripDraft(false);
  }

  function restoreTripDraft() {
    let draft;
    try { draft = JSON.parse(localStorage.getItem(draftKey()) || 'null'); } catch (_) { draft = null; }
    if (!draft || typeof draft !== 'object') { stops = []; renderStops(); return; }
    const put = (id, value) => { const node = document.getElementById(id); if (node && value != null) node.value = String(value); };
    put('tripTitle', draft.title); put('tripDestination', draft.destination); put('selectedTripStart', draft.start); put('selectedTripEnd', draft.end); put('selectedTripTravelers', draft.travelers); put('journalTripBudget', draft.budget); put('journalTripType', draft.type); put('tripNote', draft.note);
    stops = Array.isArray(draft.stops) ? draft.stops.filter(item => typeof item === 'string').slice(0, 30) : [];
    renderStops();
  }

  function setupTrip() {
    const friends = document.getElementById('friends');
    const title = friends?.querySelector('.journal-buddy-heading');
    const subtitle = friends?.querySelector('.journal-buddy-subtitle');
    const composer = friends?.querySelector('.journal-composer');
    const card = composer?.querySelector('.card');
    if (!friends || !card) return;
    let brand = friends.querySelector('.selected-friends-brand');
    if (!brand) {
      brand = document.createElement('div'); brand.className = 'selected-friends-brand';
      brand.innerHTML = '<div><span>TRAVEL WORLD</span><b>同路人</b></div><button type="button">＋ 发布</button>';
      friends.prepend(brand); brand.querySelector('button').onclick = () => composer.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }
    if (title) title.textContent = t('新建旅行','Create a trip');
    if (subtitle) subtitle.textContent = t('从一个想去的地方，开始一段新的旅程。','Start a new journey with a place you want to visit.');
    let hero = friends.querySelector('.selected-trip-hero');
    if (!hero) {
      hero = document.createElement('img'); hero.className = 'selected-trip-hero'; hero.src = '/assets/route-photos/hr-dubrovnik-source.jpg'; hero.alt = t('亚得里亚海畔的古城与海岸','A historic Adriatic coast');
      (subtitle || title || brand).after(hero);
    }
    composer.open = true;
    composer.querySelector('summary')?.setAttribute('aria-label', t('旅行信息','Trip details'));
    card.classList.add('selected-trip-card');
    const cardTitle = card.querySelector(':scope > b'); if (cardTitle) cardTitle.textContent = t('旅行信息','Trip details');
    const tripTitle = document.getElementById('tripTitle'), destination = document.getElementById('tripDestination'), note = document.getElementById('tripNote');
    if (tripTitle) { tripTitle.placeholder = t('例如：杭州慢游 · 秋日周末','e.g. A slow weekend in Hangzhou'); tripTitle.required = true; makeField(tripTitle, t('旅行名称','Trip name')); }
    if (destination) { destination.placeholder = t('选择或输入目的地','Choose or enter a destination'); destination.required = true; makeField(destination, t('目的地','Destination')); }
    if (note) { note.placeholder = t('同行偏好、节奏或补充说明（选填）','Travel style, pace or extra notes (optional)'); note.rows = 3; makeField(note, t('旅行说明','Trip notes')); }
    let dates = card.querySelector('.selected-trip-dates');
    if (!dates) {
      dates = document.createElement('div'); dates.className = 'selected-trip-grid selected-trip-dates';
      dates.innerHTML = '<label class="selected-trip-field" for="selectedTripStart"><span>出行日期</span><input id="selectedTripStart" type="date"></label><label class="selected-trip-field" for="selectedTripEnd"><span>返程日期</span><input id="selectedTripEnd" type="date"></label>';
      (destination?.parentElement || destination || tripTitle?.parentElement || card).after(dates);
      dates.querySelector('#selectedTripStart').onchange = () => { const end = dates.querySelector('#selectedTripEnd'); end.min = dates.querySelector('#selectedTripStart').value; };
    }
    const type = document.getElementById('journalTripType'); if (type) makeField(type, t('旅行方式','Trip style'));
    const budget = document.getElementById('journalTripBudget'); if (budget) { budget.type = 'number'; budget.min = '0'; budget.step = '1'; budget.placeholder = t('人均预算（CNY，选填）','Budget per person (CNY, optional)'); makeField(budget, t('预算（选填）','Budget (optional)')); }
    let travelers = card.querySelector('#selectedTripTravelers');
    if (!travelers) {
      travelers = document.createElement('input'); travelers.id = 'selectedTripTravelers'; travelers.type = 'number'; travelers.min = '1'; travelers.max = '50'; travelers.step = '1'; travelers.value = '1'; travelers.inputMode = 'numeric'; travelers.setAttribute('aria-label', t('同行人数','Travelers'));
      const field = makeField(travelers, t('同行人数','Travelers'));
      const typeField = type?.parentElement;
      if (typeField?.parentElement === card) typeField.after(field); else dates.after(field);
    }
    let itinerary = card.querySelector('.selected-itinerary');
    if (!itinerary) {
      itinerary = document.createElement('section'); itinerary.className = 'selected-itinerary'; itinerary.innerHTML = '<div class="selected-itinerary-head"><div><h2>行程安排</h2><p>按顺序添加想去的地点，可随时调整。</p></div><button type="button" data-add-stop>＋ 添加地点</button></div><ol id="selectedTripStops"></ol><div class="selected-stop-entry" hidden><label for="selectedStopInput">地点名称</label><div><input id="selectedStopInput" type="text" placeholder="例如：苏堤、雷峰塔"><button type="button" data-confirm-stop>加入</button></div></div><button class="selected-route-editor" type="button" data-open-route>在地图上编辑详细路线 ↗</button>';
      card.append(itinerary);
      const entry = itinerary.querySelector('.selected-stop-entry'), stopInput = itinerary.querySelector('#selectedStopInput');
      itinerary.querySelector('[data-add-stop]').onclick = () => { entry.hidden = !entry.hidden; if (!entry.hidden) stopInput.focus(); };
      itinerary.querySelector('[data-confirm-stop]').onclick = () => { const value = stopInput.value.trim(); if (!value) { stopInput.focus(); return; } if (stops.length >= 30) return; stops.push(value); stopInput.value = ''; entry.hidden = true; renderStops(); saveTripDraft(false); };
      stopInput.addEventListener('keydown', event => { if (event.key === 'Enter') { event.preventDefault(); itinerary.querySelector('[data-confirm-stop]').click(); } });
      itinerary.querySelector('[data-open-route]').onclick = () => window.openRouteEditor?.();
    }
    let status = card.querySelector('#selectedTripStatus');
    if (!status) { status = document.createElement('p'); status.id = 'selectedTripStatus'; status.className = 'selected-trip-status'; status.setAttribute('role', 'status'); card.append(status); }
    let actions = card.querySelector('.selected-trip-actions');
    const publish = [...card.querySelectorAll('button')].find(button => button.getAttribute('onclick')?.includes('publishBuddyPlan'));
    if (!actions) {
      actions = document.createElement('div'); actions.className = 'selected-trip-actions';
      const save = document.createElement('button'); save.type = 'button'; save.className = 'selected-draft-button'; save.textContent = t('保存草稿','Save draft'); save.onclick = () => saveTripDraft(true);
      if (publish) { publish.textContent = t('发布招募','Publish trip'); publish.classList.add('selected-publish-button'); publish.parentElement?.insertBefore(actions, publish); actions.append(save, publish); }
      else card.append(actions), actions.append(save);
    }
    const start = card.querySelector('#selectedTripStart'), end = card.querySelector('#selectedTripEnd');
    if (start && end) { end.min = start.value || ''; start.onchange = () => { end.min = start.value; if (end.value && end.value < start.value) end.value = start.value; }; }
    const filters = friends.querySelector('.journal-trip-filters');
    const tripListHead = [...friends.querySelectorAll('.head')].find(node => /可申请同行|申请同行/.test(node.textContent));
    if (filters && tripListHead && filters.nextElementSibling !== tripListHead) tripListHead.after(filters);

    let mainFields = card.querySelector('.selected-trip-main-fields');
    if (!mainFields) mainFields = document.createElement('div'), mainFields.className = 'selected-trip-main-fields';
    let extra = card.querySelector('.selected-trip-extra');
    if (!extra) {
      extra = document.createElement('details'); extra.className = 'selected-trip-extra';
      extra.innerHTML = '<summary>更多旅行信息</summary><div class="selected-trip-extra-fields"></div>';
    }
    const extraFields = extra.querySelector('.selected-trip-extra-fields');
    const titleField = tripTitle?.parentElement, destinationField = destination?.parentElement;
    const startField = start?.parentElement, typeField = type?.parentElement, budgetField = budget?.parentElement;
    const travelersField = travelers?.parentElement, noteField = note?.parentElement;
    setTripFieldIcon(destinationField, 'destination'); setTripFieldIcon(startField, 'date');
    setTripFieldIcon(travelersField, 'travelers'); setTripFieldIcon(budgetField, 'budget');
    mainFields.replaceChildren(...[destinationField, startField, travelersField, budgetField].filter(Boolean));
    extraFields.replaceChildren(...[titleField, typeField, noteField].filter(Boolean));
    if (dates && end) extraFields.append(dates);
    if (publish) { publish.textContent = t('发布招募','Publish trip'); publish.classList.add('selected-publish-button'); extraFields.append(publish); }
    const saveButton = actions.querySelector('.selected-draft-button');
    actions.replaceChildren(...[saveButton].filter(Boolean));
    card.replaceChildren(mainFields, itinerary, extra, actions, status);
    if (composer.dataset.selectedDraftBound !== 'true') {
      composer.dataset.selectedDraftBound = 'true';
      card.addEventListener('input', event => { if (!event.target.closest('.selected-itinerary')) saveTripDraft(false); });
      restoreTripDraft();
    } else renderStops();
  }

  function wrapPublish() {
    if (!window.publishBuddyPlan || window.publishBuddyPlan.__selectedWrapped) return;
    const original = window.publishBuddyPlan;
    const wrapped = async function () {
      const start = document.getElementById('selectedTripStart')?.value;
      const end = document.getElementById('selectedTripEnd')?.value;
      const status = document.getElementById('selectedTripStatus');
      if (start && end && end < start) { if (status) status.textContent = '返程日期不能早于出行日期。'; document.getElementById('selectedTripEnd')?.focus(); return null; }
      const note = document.getElementById('tripNote');
      const extras = [];
      const people = document.getElementById('selectedTripTravelers')?.value;
      if (people) extras.push('同行人数：' + people);
      if (stops.length) extras.push('行程安排：\n' + stops.map((name, index) => (index + 1) + '. ' + name).join('\n'));
      if (note) note.dataset.selectedBaseNote = note.value;
      if (status) status.textContent = '正在发布同行招募…';
      if (note && extras.length) note.value = [note.value.trim(), extras.join('\n')].filter(Boolean).join('\n\n');
      let result = null;
      try { result = await original(); }
      finally { if (note) note.value = note.dataset.selectedBaseNote ?? note.value; }
      if (result) {
        try { localStorage.removeItem(draftKey()); } catch (_) {}
        stops = [];
        ['tripTitle', 'tripDestination', 'selectedTripStart', 'selectedTripEnd', 'journalTripBudget', 'tripNote'].forEach(id => { const field = document.getElementById(id); if (field) field.value = ''; });
        const count = document.getElementById('selectedTripTravelers'); if (count) count.value = '1';
        renderStops();
        const currentStatus = document.getElementById('selectedTripStatus');
        if (currentStatus) currentStatus.textContent = '同行招募已发布；人数、预算和地点安排已附在招募说明中。';
      } else if (status && !status.textContent.startsWith('发布失败')) status.textContent = auth()?.session?.() ? '尚未发布成功，草稿仍保存在本机，可检查信息后重试。' : '登录后才能发布招募；草稿仍保存在本机。';
      return result;
    };
    wrapped.__selectedWrapped = true;
    window.publishBuddyPlan = wrapped;
  }

  function setupAll() {
    setupNavigation(); setupHome(); setupExplore(); setupChat(); setupTrip(); wrapPublish();
  }

  function scheduleSetup() {
    if (setupQueued) return;
    setupQueued = true;
    requestAnimationFrame(() => { setupQueued = false; setupAll(); });
  }

  document.addEventListener('click', event => {
    const profileEntry = event.target.closest?.('.selected-profile-entry');
    if (profileEntry) { event.preventDefault(); window.go?.('profile'); window.loadTravelProfile?.(); return; }
  }, true);
  document.addEventListener('click', event => {
    const nav = event.target.closest('.nav button[data-id]');
    if (nav?.dataset.id === 'friends') { window.setTimeout(setupTrip, 0); }
    if (nav?.dataset.id === 'messages') { window.setTimeout(setupChat, 0); }
  });
  window.addEventListener('tw-buddy-chats-updated', event => { buddyGroupChats = event.detail || []; renderBuddyChats(); });
  window.addEventListener('tw-auth-change', () => { stops = []; window.setTimeout(() => { restoreTripDraft(); setupChat(); renderBuddyChats(); }, 0); });
  const app = document.querySelector('.app');
  if (app) new MutationObserver(scheduleSetup).observe(app, { childList: true, subtree: true });
  setupAll();
}());
