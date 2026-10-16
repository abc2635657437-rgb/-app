/* Route Studio - publish a travel route with its 衣 / 食 / 住 / 行 / 玩 plan.
   Uses only the existing /api/routes endpoints; the plan is stored inside routes.days
   (jsonb), so no schema migration is needed.
   NOTE: this file is written without template interpolation on purpose. */
(function () {
  var ICON = { outfit: '衣', food: '食', stay: '住', move: '行', play: '玩' };
  var KEY = { outfit: '行装 / 穿搭', food: '必吃推荐', stay: '住宿建议', move: '交通衔接', play: '玩法建议', itinerary: '行程顺序' };
  var LABELS = ['outfit', 'food', 'stay', 'move', 'play'];
  var state = { editing: null, points: [], plan: { outfit: [], food: [], stay: [], move: [], play: [] }, itinerary: [], filter: '' };
  var returnToPublisher = false;

  var ESC = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' };
  function auth() { return window.TravelWorldAuth; }
  function esc(v) { return String(v == null ? '' : v).replace(/[&<>"']/g, function (c) { return ESC[c]; }); }
  function money(v) { return (!v || !v.trim()) ? '' : ' · <span>' + esc(v) + '</span>'; }

  var CSS = [
    '.studio-bar{display:flex;gap:8px;align-items:center;margin:0 0 12px}',
    '.studio-bar button{flex:1;min-height:44px;border:1px solid #b7c2c0;background:#fff;color:var(--ink);border-radius:999px;font:inherit;font-weight:700;cursor:pointer}',
    '.studio-bar button.on{background:var(--ink);color:#fff;border-color:var(--ink)}',
    '.plan-head{display:flex;justify-content:space-between;align-items:baseline;margin:18px 0 8px}',
    '.plan-head h2{font-size:18px;margin:0;color:var(--ink)}',
    '.plan-row{display:grid;grid-template-columns:1fr 1fr 92px auto;gap:8px;align-items:start;background:#f7faf8;border-radius:11px;padding:9px;margin:8px 0}',
    '.plan-row input{width:100%;padding:10px;border:1px solid transparent;background:#fff;border-radius:9px;font:inherit;color:inherit}',
    '.plan-row .x{min-width:44px;min-height:44px;border:0;background:#eef3ef;color:#8a3b2a;border-radius:9px;font-size:17px;cursor:pointer}',
    '@media(max-width:520px){.plan-row{grid-template-columns:1fr 1fr}.plan-row .x{grid-column:2;justify-self:end}}',
    '.studio-save{width:100%;margin-top:18px}',
    '.travel-card{display:grid;grid-template-columns:84px 1fr;gap:12px;align-items:start}',
    '.travel-card .art{width:84px;height:84px;object-fit:cover;border-radius:12px;background:#eef3ef}',
    '.travel-card .t{font-weight:700;color:var(--ink);line-height:1.35}',
    '.travel-card .m{font-size:12px;color:var(--muted);margin-top:3px}',
    '.travel-card .c{display:flex;flex-wrap:wrap;gap:5px;margin-top:8px}',
    '.travel-card .c span{font-size:11px;padding:4px 8px;border-radius:999px;background:#eef3ef;border:0;color:#366052;cursor:pointer}',
    '.detail-plan h4{margin:18px 0 6px;font-size:15px;color:var(--ink)}',
    '.detail-plan ul{margin:0;padding-left:18px;color:#2f4b52;font-size:13px;line-height:1.7}',
    '.detail-plan li b{color:#1d3f4a}',
    '.empty{border:1px dashed #c4d0cb;border-radius:12px;padding:16px;text-align:center;color:var(--muted);font-size:13px}'
  ].join('\n');

  function studioHTML() {
    return [
      '<section id="studio" class="screen">',
      '  <div class="route-page-head"><button onclick="window.closeStudio()" aria-label="返回">‹</button>',
      '    <div><small>ROUTE STUDIO</small><h1>发布旅行路线</h1></div>',
      '    <button class="route-save" onclick="window.saveStudioRoute()">发布</button></div>',
      '  <div class="studio-bar">',
      '    <button id="studioBasic" class="on" type="button" onclick="window.studioTab(\'basic\')">路线</button>',
      '    <button id="studioPlan" type="button" onclick="window.studioTab(\'plan\')">衣·食·住·行·玩</button>',
      '  </div>',
      '  <div id="studioBasicPane">',
      '    <label class="muted">路线名称<input id="studioTitle" class="input" maxlength="120" placeholder="例如：大理洱海环湖三日"></label>',
      '    <label class="muted">目的地<input id="studioDest" class="input" maxlength="120" placeholder="例如 大理 · 中国"></label>',
      '    <div class="grid">',
      '      <label class="muted">交通方式<select id="studioMode" class="input">',
      '        <option value="walking">步行</option><option value="cycling">骑行</option>',
      '        <option value="driving" selected>自驾 / 驾车</option><option value="transit">公共交通</option></select></label>',
      '      <label class="muted">最佳季节<input id="studioSeason" class="input" maxlength="60" placeholder="3-5月 / 9-11月"></label>',
      '    </div>',
      '    <label class="muted">人均预算<input id="studioBudget" class="input" maxlength="40" placeholder="例如 ¥1800 / 3 天"></label>',
      '    <div class="card"><b>途经点</b>',
      '      <p class="muted" style="margin:6px 0 10px">至少两个地点。可以先去「探索」页选点，再回来带过来。</p>',
      '      <button class="btn alt" type="button" onclick="window.studioPickPoints()">从地图带入选点</button>',
      '      <div id="studioPoints" class="muted" style="margin-top:10px">尚未带入途经点</div>',
      '    </div>',
      '  </div>',
      '  <div id="studioPlanPane" style="display:none"></div>',
      '  <div class="card"><label class="muted">给后来者的提示<textarea id="studioTips" class="input" rows="3" maxlength="1200" placeholder="例如：环湖西路日落前两小时风大，带防风外套；周一索道检修。"></textarea></label></div>',
      '  <button class="btn studio-save" type="button" onclick="window.saveStudioRoute()">发布这条路线</button>',
      '</section>'
    ].join('\n');
  }

  function travelsHTML() {
    return [
      '<section id="travels" class="screen">',
      '  <div class="eyebrow">TRAVELLER ROUTES</div>',
      '  <div class="title">旅行者发布的路线</div>',
      '  <div class="sub">每一条都带衣 · 食 · 住 · 行 · 玩的可执行建议。</div>',
      '  <div class="studio-bar">',
      '    <button id="travelsTabAll" class="on" type="button" onclick="window.travelsFilter(\'\')">全部</button>',
      '    <button id="travelsTabMine" type="button" onclick="window.travelsFilter(\'mine\')">我发布的</button>',
      '  </div>',
      '  <div id="travelsList"><div class="muted">正在加载旅行者路线…</div></div>',
      '</section>'
    ].join('\n');
  }

  function planRow(key, item) {
    var it = item || { title: '', note: '', price: '' };
    return '<div class="plan-row" data-key="' + key + '">' +
      '<input placeholder="名称，例如 才村码头日落" value="' + esc(it.title) + '">' +
      '<input placeholder="说明 / 实测建议" value="' + esc(it.note) + '">' +
      '<input placeholder="参考价" value="' + esc(it.price) + '">' +
      '<button class="x" type="button" aria-label="删除这一条" onclick="window.studioDropRow(this)">×</button></div>';
  }

  function planBlock(key) {
    var list = (key === 'itinerary' ? state.itinerary : state.plan[key]) || [];
    var rows = list.length ? list.map(function (item) { return planRow(key, item); }).join('') : planRow(key, {});
    return '<div class="card"><div class="plan-head"><h2>' + (ICON[key] || '🗓') + ' ' + KEY[key] + '</h2>' +
      '<button class="pill" type="button" onclick="window.studioAddRow(\'' + key + '\')">＋ 加一条</button></div>' +
      '<div data-plan="' + key + '">' + rows + '</div></div>';
  }

  function renderPlan() {
    var pane = document.getElementById('studioPlanPane');
    if (!pane) return;
    var html = LABELS.map(planBlock).join('');
    html += planBlock('itinerary');
    html += '<p class="muted" style="font-size:12px">只写你核实过的内容：价格写“参考价”而不是实时价；不确定就留空，空条目不会被保存。</p>';
    pane.innerHTML = html;
  }

  window.studioAddRow = function (key) {
    var box = document.querySelector('[data-plan="' + key + '"]');
    if (!box) return;
    box.insertAdjacentHTML('beforeend', planRow(key, {}));
  };
  window.studioDropRow = function (button) {
    var row = button.closest('.plan-row');
    var box = row && row.parentElement;
    if (!box) return;
    row.remove();
    if (!box.querySelectorAll('.plan-row').length) box.insertAdjacentHTML('beforeend', planRow(box.getAttribute('data-plan'), {}));
  };

  window.studioTab = function (tab) {
    var basic = document.getElementById('studioBasicPane'), plan = document.getElementById('studioPlanPane');
    var b = document.getElementById('studioBasic'), p = document.getElementById('studioPlan');
    if (!basic || !plan) return;
    if (tab === 'plan') {
      if (!plan.innerHTML) renderPlan();
      basic.style.display = 'none'; plan.style.display = 'block';
      b.classList.remove('on'); p.classList.add('on');
    } else {
      readPlanIntoState();
      basic.style.display = 'block'; plan.style.display = 'none';
      p.classList.remove('on'); b.classList.add('on');
    }
  };

  function readPlanIntoState() {
    LABELS.concat('itinerary').forEach(function (key) {
      var box = document.querySelector('[data-plan="' + key + '"]');
      if (!box) return;
      var items = [].slice.call(box.querySelectorAll('.plan-row')).map(function (row) {
        var inputs = row.querySelectorAll('input');
        return { title: inputs[0].value.trim(), note: inputs[1].value.trim(), price: inputs[2].value.trim() };
      }).filter(function (item) { return item.title || item.note; });
      if (key === 'itinerary') state.itinerary = items; else state.plan[key] = items;
    });
  }

  function renderPoints() {
    var box = document.getElementById('studioPoints');
    if (!box) return;
    box.innerHTML = state.points.length
      ? '<ol style="margin:0;padding-left:18px;font-size:13px;color:#2f4b52">' +
        state.points.map(function (p, i) { return '<li>' + esc(p.name) + ' <span style="color:#8b938f">' +
          p.latitude.toFixed(4) + ', ' + p.longitude.toFixed(4) + '</span></li>'; }).join('') + '</ol>'
      : '尚未添加途经点';
  }

  // Pick waypoints by name through the existing search endpoint, so the studio works
  // on a phone without dragging a map.
  window.studioPickPoints = function () {
    var box = document.getElementById('studioPoints');
    if (!box) return;
    box.innerHTML =
      '<input id="studioSearch" class="input" placeholder="输入地点名称，回车或点添加">' +
      '<button class="btn alt" type="button" id="studioSearchBtn" style="margin-top:8px">添加为途经点</button>' +
      '<div id="studioSearchMsg" class="muted" style="font-size:12px;margin-top:6px"></div>' +
      '<div id="studioSearchList" style="margin-top:8px"></div>' +
      '<button class="btn alt" type="button" id="studioDoneBtn" style="margin-top:8px">完成选点（' + state.points.length + '）</button>';
    renderPoints();
    var input = document.getElementById('studioSearch'), msg = document.getElementById('studioSearchMsg');
    async function search() {
      var q = input.value.trim();
      if (q.length < 2) { msg.textContent = '请输入至少两个字符'; return; }
      msg.textContent = '搜索中…';
      try {
        var data = await auth().request('/api/map/search?q=' + encodeURIComponent(q));
        var list = document.getElementById('studioSearchList');
        var results = (data.results || []).slice(0, 5);
        list.innerHTML = results.length ? results.map(function (r, i) {
          return '<button class="pill" type="button" data-i="' + i + '">' + esc(r.name) + ' · ' + esc(r.displayName).slice(0, 40) + '</button>';
        }).join('') : '<span class="muted">没有找到地点</span>';
        list.onclick = async function (event) {
          var button = event.target.closest('button[data-i]');
          if (!button) return;
          var r = results[Number(button.getAttribute('data-i'))];
          state.points.push({ id: String(r.id), name: r.name, latitude: Number(r.latitude), longitude: Number(r.longitude), provider: r.provider || 'OpenStreetMap' });
          msg.textContent = '已添加：' + r.name + '（共 ' + state.points.length + ' 个）';
          renderPoints();
        };
        msg.textContent = results.length ? '点结果即可加入路线' : '没有找到地点，换个更完整的名称';
      } catch (error) { msg.textContent = '搜索失败：' + error.message; }
    }
    document.getElementById('studioSearchBtn').onclick = search;
    input.onkeydown = function (event) { if (event.key === 'Enter') { event.preventDefault(); search(); } };
    document.getElementById('studioDoneBtn').onclick = function () {
      document.getElementById('studioBasicPane').style.display = 'block';
      renderPlan();
      window.studioTab('basic');
    };
  };

  window.closeStudio = function () { go(returnToPublisher ? 'publish' : 'home'); };
  window.openStudio = async function (routeId, draft, options) {
    if (!auth().requireLogin()) return;
    returnToPublisher = Boolean(options && options.returnToPublisher);
    inject();
    state.editing = routeId || null;
    state.points = [];
    state.plan = { outfit: [], food: [], stay: [], move: [], play: [] };
    state.itinerary = [];
    var title = document.getElementById('studioTitle'), dest = document.getElementById('studioDest');
    var mode = document.getElementById('studioMode'), season = document.getElementById('studioSeason');
    var budget = document.getElementById('studioBudget'), tips = document.getElementById('studioTips');
    title.value = ''; dest.value = ''; season.value = ''; budget.value = ''; tips.value = '';
    mode.value = 'driving';
    var pane = document.getElementById('studioPlanPane'); if (pane) pane.innerHTML = '';
    window.studioTab('basic');
    renderPoints();
    // A draft arrives from the AI assistant: the user reviewed a plan and wants to
    // publish it, so the answer is carried over as editable starting content.
    if (!routeId && draft) {
      if (draft.title) title.value = String(draft.title).slice(0, 120);
      if (draft.dest) dest.value = String(draft.dest).slice(0, 160);
      if (draft.season) season.value = String(draft.season).slice(0, 60);
      if (draft.budget) budget.value = String(draft.budget).slice(0, 40);
      if (draft.tips) tips.value = String(draft.tips).slice(0, 1200);
    }
    if (routeId) {
      try {
        var route = await auth().request('/api/routes/' + routeId);
        title.value = route.title || '';
        dest.value = route.destination || '';
        mode.value = route.transport_mode || 'driving';
        var day = (route.days || [])[0] || {};
        season.value = day.season || '';
        budget.value = day.budget || '';
        tips.value = day.tips || '';
        state.plan = { outfit: day.outfit || [], food: day.food || [], stay: day.stay || [], move: day.move || [], play: day.play || [] };
        state.itinerary = day.itinerary || [];
        state.points = (window.TravelPostUI.points(route) || []).map(function (p) {
          return { id: p.external_place_id || '', name: p.name, latitude: Number(p.latitude), longitude: Number(p.longitude), provider: p.provider || 'OpenStreetMap' };
        });
        renderPoints();
      } catch (error) { auth().toast('路线加载失败：' + error.message); }
    }
    go('studio');
  };

  window.saveStudioRoute = async function () {
    var A = auth();
    if (!A.requireLogin()) return;
    readPlanIntoState();
    var title = document.getElementById('studioTitle').value.trim();
    if (!title) return A.toast('请填写路线名称');
    if (state.points.length < 2) return A.toast('至少需要两个途经点');
    var hasPlan = LABELS.some(function (k) { return state.plan[k].length; }) || state.itinerary.length;
    if (!hasPlan) return A.toast('请至少填写一项衣·食·住·行·玩建议');
    var payload = {
      title: title,
      destination: document.getElementById('studioDest').value.trim() || state.points[state.points.length - 1].name,
      transport_mode: document.getElementById('studioMode').value,
      is_public: true,
      points: state.points,
      plan: {
        outfit: state.plan.outfit, food: state.plan.food, stay: state.plan.stay,
        move: state.plan.move, play: state.plan.play, itinerary: state.itinerary,
        season: document.getElementById('studioSeason').value.trim(),
        budget: document.getElementById('studioBudget').value.trim(),
        tips: document.getElementById('studioTips').value.trim()
      }
    };
    if (!state.editing) {
      try {
        var geo = await A.request('/api/map/route', {
          method: 'POST', headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ points: state.points, mode: payload.transport_mode })
        });
        payload.geometry = geo.geometry || null;
        payload.distance_meters = geo.distanceMeters || 0;
        payload.duration_seconds = geo.durationSeconds || 0;
      } catch (error) { /* a route without road geometry is still publishable */ }
    }
    try {
      var route = await A.request('/api/routes' + (state.editing ? '/' + state.editing : ''), {
        method: state.editing ? 'PATCH' : 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });
      A.toast(state.editing ? '路线已更新' : '路线已发布');
      state.editing = null;
      if (returnToPublisher) {
        window.selectPublishRoute?.(Array.isArray(route) ? route[0] : route);
        go('publish');
      } else {
        window.loadTravels();
        window.openRouteDetail(route.id || route[0] && route[0].id);
        go('travels');
      }
    } catch (error) { A.toast('保存失败：' + error.message); }
  };

  function planSummary(route) {
    var day = (route.days || [])[0] || {};
    return LABELS.map(function (k) { return { key: k, label: ICON[k] + ' ' + KEY[k], items: day[k] || [] }; });
  }

  function routePlanHTML(route) {
    var day = (route.days || [])[0] || {};
    var blocks = planSummary(route).map(function (b) {
      if (!b.items.length) return '';
      return '<h4>' + b.label + '</h4><ul>' + b.items.map(function (item) {
        return '<li><b>' + esc(item.title) + '</b>' + (item.note ? ' — ' + esc(item.note) : '') + money(item.price) + '</li>';
      }).join('') + '</ul>';
    }).join('');
    var it = (day.itinerary || []).map(function (item) {
      return '<li><b>' + esc(item.title) + '</b>' + (item.note ? ' — ' + esc(item.note) : '') + money(item.price) + '</li>';
    }).join('');
    if (it) blocks += '<h4>🗓 行程顺序</h4><ul>' + it + '</ul>';
    var meta = [];
    if (day.season) meta.push('最佳季节 ' + esc(day.season));
    if (day.budget) meta.push('人均预算 ' + esc(day.budget));
    if (meta.length) blocks += '<h4>先看这里</h4><ul>' + meta.map(function (m) { return '<li>' + m + '</li>'; }).join('') + '</ul>';
    if (day.tips) blocks += '<h4>给后来者的提示</h4><p style="margin:0;font-size:13px;color:#2f4b52;line-height:1.7">' + esc(day.tips) + '</p>';
    return blocks || '<div class="empty">这条路线还没有填写衣·食·住·行·玩建议。</div>';
  }

  function routeCard(route) {
    var day = (route.days || [])[0] || {};
    var blocks = planSummary(route).map(function (b) { return b.items.length ? b.key : null; }).filter(Boolean);
    var owner = route.owner || {};
    var mine = owner.id && auth().session && auth().session() && owner.id === (auth().session().user || {}).id;
    return '<article class="card"><div class="travel-card">' +
      '<div class="art" style="display:flex;align-items:center;justify-content:center;font:700 26px SimSun,Georgia,serif;color:#d17d57">' +
      esc((route.destination || route.title || '·').slice(0, 1)) + '</div><div style="min-width:0">' +
      '<div class="t">' + esc(route.title) + '</div>' +
      '<div class="m">' + esc(route.destination || '') + ' · ' + esc(window.TravelPostUI.routeStats ? window.TravelPostUI.routeStats(route) : '') + '</div>' +
      '<div class="m">由 ' + esc(owner.display_name || '旅行者') + ' 发布' + (mine ? ' · 我的' : '') + '</div>' +
      '<div class="c">' + (blocks.length ? blocks.map(function (k) { return '<span>' + ICON[k] + '</span>'; }).join('') : '<span>暂无行程规划</span>') + '</div>' +
      '<div class="c">' +
        '<span onclick="window.openRouteDetail(\'' + route.id + '\')">完整详情</span>' +
        (mine ? '<span onclick="window.openStudio(\'' + route.id + '\')">编辑规划</span>' : '') +
      '</div></div></div></article>';
  }

  window.loadTravels = async function () {
    inject();
    var list = document.getElementById('travelsList');
    if (!list) return;
    list.innerHTML = '<div class="muted">正在加载旅行者路线…</div>';
    try {
      var all = await auth().request('/api/routes');
      var mine = [];
      try { mine = auth().session && auth().session() ? await auth().request('/api/community/me/routes') : []; } catch (error) { mine = []; }
      var rows = state.filter === 'mine' ? mine : (all || []).concat(mine.filter(function (r) {
        return !(all || []).some(function (p) { return p.id === r.id; });
      }));
      list.innerHTML = rows.length ? rows.map(routeCard).join('') : '<div class="empty">还没有人发布带衣·食·住·行·玩规划的路线。成为第一个：<span onclick="window.openStudio()" style="color:#d17d57;cursor:pointer">发布我的路线</span></div>';
    } catch (error) {
      list.innerHTML = '<div class="empty">旅行者路线暂时无法加载：' + esc(error.message) + '</div>';
    }
  };

  window.travelsFilter = function (mode) {
    state.filter = mode;
    var a = document.getElementById('travelsTabAll'), m = document.getElementById('travelsTabMine');
    if (a) a.classList.toggle('on', mode !== 'mine');
    if (m) m.classList.toggle('on', mode === 'mine');
    window.loadTravels();
  };

  // Decorate the existing route detail page with the 衣·食·住·行·玩 sections.
  function decorateDetail() {
    var root = document.getElementById('routeDetailContent');
    if (!root || root.querySelector('.detail-plan')) return;
    var id = root.getAttribute('data-route-id');
    if (!id) return;
    auth().request('/api/routes/' + id).then(function (route) {
      if (!root.isConnected) return;
      var box = document.createElement('div');
      box.className = 'detail-plan card';
      var head = document.createElement('div');
      head.className = 'head';
      head.innerHTML = '<h2>衣 · 食 · 住 · 行 · 玩</h2>';
      var body = document.createElement('div');
      body.innerHTML = routePlanHTML(route);
      box.append(head, body);
      root.append(box);
    }).catch(function () { /* the standard detail content stays usable without the plan */ });
  }

  var originalDetail = window.openRouteDetail;
  window.openRouteDetail = function (id) {
    var result = originalDetail ? originalDetail(id) : undefined;
    setTimeout(function () {
      var root = document.getElementById('routeDetailContent');
      if (root) root.setAttribute('data-route-id', id);
      decorateDetail();
    }, 260);
    return result;
  };

  function inject() {
    if (document.getElementById('studio')) return;
    if (!document.getElementById('cssRouteStudio')) {
      var style = document.createElement('style');
      style.id = 'cssRouteStudio';
      style.textContent = CSS;
      document.head.append(style);
    }
    var shell = document.querySelector('.app') || document.body;
    shell.insertAdjacentHTML('beforeend', studioHTML() + travelsHTML());
    var publishRoute = document.querySelector('#publish .publish-section-head button');
    if (publishRoute) {
      publishRoute.textContent = '发布我的路线';
      publishRoute.onclick = function () { window.openStudio(null, null, { returnToPublisher: true }); };
    }
  }

  function start() {
    if (!window.TravelWorldAuth) return setTimeout(start, 60);
    inject();
  }
  start();
})();
