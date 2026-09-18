(function () {
  const fields = { dest: ['输入目的地，例如大理', ''], budget: ['预算（CNY）', ''], date: ['出发日期', ''], days: ['旅行天数', ''], interest: ['兴趣，例如自然、美食、摄影', ''] };
  const auth = () => window.TravelWorldAuth;
  const safe = value => String(value ?? '').replace(/[&<>"']/g, char => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[char]));
  let communityRoutes = [], routeFavoriteIds = new Set();
  const photoCache = new Map(), photoRequests = new Map();
  const fallbackImage = '/assets/ukiyoe-journey.svg';
  function setup() {
    const style = document.createElement('style');
    style.textContent = '.route-filters{display:flex;flex-wrap:wrap;gap:4px;margin:12px 0}.route-grid{display:grid;grid-template-columns:1fr;gap:14px}.route-card-top{display:flex;justify-content:space-between;align-items:center}.route-tags{line-height:1.8}.map-controls{display:flex;gap:7px;align-items:center;margin-bottom:10px}.map-controls input{flex:1;padding:10px;border:1px solid #dfe6e1;border-radius:999px;font:inherit}.leaflet-container{font-family:-apple-system,BlinkMacSystemFont,"Segoe UI","PingFang SC",sans-serif}';
    document.head.appendChild(style);
    Object.keys(fields).forEach(id => { const input = document.getElementById(id); if (input) { input.value = fields[id][1]; input.placeholder = fields[id][0]; } });
    const section = document.getElementById('mapExplore') || document.getElementById('discover');
    if (!section || document.getElementById('routeLibrary')) return;
    const library = document.createElement('div');
    library.id = 'routeLibrary';
    library.innerHTML = '<div class="head"><h2>参考路线</h2><span class="muted">国内 · 海外</span></div><div id="routeFilters" class="route-filters"></div><div id="routeGrid" class="route-grid"></div><div class="head"><h2>旅行者路线</h2><span class="muted">真实发布</span></div><div id="communityRouteGrid" class="route-grid"></div>';
    section.appendChild(library);
    fetch('modules/data/routes.json?v=2').then(response => response.json()).then(data => { window.travelRoutes = data.routes; renderRoutes('全部'); }).catch(() => { document.getElementById('routeGrid').textContent = '参考路线暂时无法加载，请检查网络后重试。'; });
    loadCommunityRoutes();
  }
  function renderRoutes(type) {
    const routes = window.travelRoutes || [];
    const filtered = type === '全部' ? routes : routes.filter(route => route.type === type);
    document.getElementById('routeFilters').innerHTML = ['全部', '城市旅行', '自然风景', '美食旅行', '文化旅行', '独自旅行', '家庭旅行', '摄影旅行', '户外旅行'].map(item => '<button class="pill ' + (item === type ? 'active' : '') + '" onclick="filterTravelRoutes(\'' + item + '\')">' + item + '</button>').join('');
    document.getElementById('routeGrid').innerHTML = filtered.map(route => '<article class="route-reference-card route-photo-loading" data-route-cover="' + safe(route.id) + '"><img class="route-reference-cover" alt="' + safe(route.destination) + '旅行风景" loading="lazy" decoding="async"><div class="route-reference-shade"></div><div class="route-reference-copy"><div class="route-card-top"><span class="route-country">' + safe(route.country) + ' · ' + safe(route.destination) + '</span><span>' + route.days + ' 天</span></div><div class="route-reference-main"><p>' + safe(route.type) + '</p><h3>' + safe(route.title) + '</h3><div class="route-tags">' + route.tags.map(tag => '<span>#' + safe(tag) + '</span>').join(' ') + '</div><div class="route-reference-footer"><b>' + safe(route.budget) + '</b><button class="route-view-button" onclick="openTravelRoute(\'' + route.id + '\')">查看路线 <span>→</span></button></div></div></div></article>').join('');
    filtered.forEach(route => setRoutePhoto(document.querySelector('[data-route-cover="' + route.id + '"] img'), route.coverQuery));
  }
  window.filterTravelRoutes = renderRoutes;
  async function getPhoto(query) {
    if (!query) return fallbackImage;
    if (photoCache.has(query)) return photoCache.get(query);
    if (!photoRequests.has(query)) photoRequests.set(query, fetch('/api/map/place-photos?q=' + encodeURIComponent(query)).then(response => response.ok ? response.json() : Promise.reject()).then(data => data.photos?.[0]?.url || fallbackImage).catch(() => fallbackImage).then(url => { photoCache.set(query, url); photoRequests.delete(query); return url; }));
    return photoRequests.get(query);
  }
  async function setRoutePhoto(image, query) {
    if (!image) return;
    const url = await getPhoto(query);
    image.onerror = () => { image.onerror = null; image.src = fallbackImage; };
    image.src = url;
    image.closest('.route-photo-loading')?.classList.remove('route-photo-loading');
  }
  const activityCard = (activity, routeId, dayNumber, index) => '<article class="route-activity route-photo-loading" data-route-photo="' + safe(routeId + '-' + dayNumber + '-' + index) + '"><div class="route-activity-image"><img alt="' + safe(activity.name) + '实景" loading="lazy" decoding="async"><span>' + safe(activity.time) + '</span></div><div class="route-activity-copy"><h4>' + safe(activity.name) + '</h4><p>' + safe(activity.description) + '</p><dl><div><dt>建议停留</dt><dd>' + safe(activity.duration) + '</dd></div><div><dt>门票参考</dt><dd>' + safe(activity.ticket) + '</dd></div><div><dt>怎么去</dt><dd>' + safe(activity.transport) + '</dd></div></dl><aside><b>旅行提示</b>' + safe(activity.tips) + '</aside></div></article>';
  window.openTravelRoute = id => {
    const route = (window.travelRoutes || []).find(item => item.id === id); if (!route) return;
    document.getElementById('routeDetailOverlay')?.remove();
    const overlay = document.createElement('div'); overlay.id = 'routeDetailOverlay'; overlay.className = 'dm-overlay route-detail-overlay';
    overlay.innerHTML = '<article class="route-detail" role="dialog" aria-label="' + safe(route.title) + '"><header class="route-detail-hero route-photo-loading"><img alt="' + safe(route.destination) + '路线封面"><div class="route-detail-gradient"></div><button class="route-detail-back" data-close aria-label="返回">← 返回</button><div><span>CURATED JOURNEY · ' + safe(route.country) + '</span><h2>' + safe(route.title) + '</h2><p>' + safe(route.destination) + ' · ' + route.days + ' 天 · ' + safe(route.type) + '</p></div></header><section class="route-detail-intro"><div class="route-detail-facts"><span><small>预算参考</small><b>' + safe(route.budget) + '</b></span><span><small>适合人群</small><b>' + safe(route.audience) + '</b></span></div><p>' + safe(route.summary) + '</p><div class="route-tags">' + route.tags.map(tag => '<span>#' + safe(tag) + '</span>').join(' ') + '</div></section><section class="route-days">' + route.daysPlan.map(day => '<article class="route-day"><header><span>DAY ' + day.dayNumber + '</span><div><h3>' + safe(day.title) + '</h3><p>' + safe(day.summary) + '</p></div><b>' + safe(day.cost) + '</b></header>' + day.activities.map((activity, index) => activityCard(activity, route.id, day.dayNumber, index)).join('') + '<div class="route-day-notes"><div><small>吃什么</small><p>' + safe(day.food) + '</p></div><div><small>住哪里</small><p>' + safe(day.stay) + '</p></div><div><small>交通</small><p>' + safe(day.transport) + '</p></div></div></article>').join('') + '</section><footer class="route-detail-actions"><button class="btn alt" data-close>返回参考路线</button><button class="btn" data-use>按这条路线继续规划</button></footer><p class="route-photo-credit">路线实景图片由 Wikimedia Commons 提供，版权归各作者所有；票价与开放时间请以出行当天官方信息为准。</p></article>';
    document.body.appendChild(overlay); document.body.classList.add('route-detail-open');
    setRoutePhoto(overlay.querySelector('.route-detail-hero img'), route.coverQuery);
    route.daysPlan.forEach(day => day.activities.forEach((activity, index) => setRoutePhoto(overlay.querySelector('[data-route-photo="' + route.id + '-' + day.dayNumber + '-' + index + '"] img'), activity.imageQuery)));
    const close = () => { overlay.remove(); document.body.classList.remove('route-detail-open'); };
    overlay.onclick = event => { if (event.target === overlay || event.target.closest('[data-close]')) close(); };
    overlay.querySelector('[data-use]').onclick = () => { close(); window.useTravelRoute(route.destination, route.days, route.tags.join('、')); };
  };
  async function loadCommunityRoutes() { const target = document.getElementById('communityRouteGrid'); if (!target) return; try { communityRoutes = await auth().request('/api/routes'); routeFavoriteIds = new Set(auth().session?.() ? await auth().request('/api/routes/favorites') : []); target.innerHTML = communityRoutes.length ? communityRoutes.map(route => { const liked = (route.route_likes || []).some(item => item.user_id === auth().session?.()?.user?.id), comments = route.route_comments || []; return '<article class="route-card">' + TravelPostUI.routeCard(route) + '<div class="route-card-top"><span class="pill">' + safe(route.owner?.display_name || '旅行者') + '</span><button class="post-map" onclick="openRouteDetail(\''+route.id+'\')">完整详情</button></div><div class="post-actions"><button onclick="toggleRouteLike(\'' + route.id + '\')">' + (liked ? '♥' : '♡') + ' ' + (route.route_likes?.length || 0) + '</button><button onclick="toggleRouteFavorite(\'' + route.id + '\')">' + (routeFavoriteIds.has(route.id) ? '★ 已收藏' : '☆ 收藏') + '</button><button onclick="commentRoute(\'' + route.id + '\')">评论 ' + comments.length + '</button></div>' + (comments.length ? '<div class="route-comments">' + comments.slice(-3).map(item => '<div>' + safe(item.author?.display_name || '旅行者') + '：' + safe(item.content) + '</div>').join('') + '</div>' : '') + '</article>'; }).join('') : '<div class="muted">还没有旅行者发布公开路线。</div>'; } catch (error) { target.innerHTML = '<div class="muted">旅行者路线暂时无法加载：' + safe(error.message) + '</div>'; } }
  window.toggleRouteLike = async id => { if (!auth().requireLogin()) return; try { await auth().request('/api/routes/' + id + '/like', { method: 'POST' }); await loadCommunityRoutes(); } catch (error) { alert(error.message); } };
  window.toggleRouteFavorite = async id => { if (!auth().requireLogin()) return; try { await auth().request('/api/routes/' + id + '/favorite', { method: 'POST' }); await loadCommunityRoutes(); } catch (error) { alert(error.message); } };
  window.commentRoute = async id => { if (!auth().requireLogin()) return; const content = prompt('写下对这条路线的评论：'); if (!content?.trim()) return; try { await auth().request('/api/routes/' + id + '/comments', { method: 'POST', body: JSON.stringify({ content: content.trim() }) }); await loadCommunityRoutes(); } catch (error) { alert(error.message); } };
  window.useTravelRoute = (destination, days, interest) => { document.getElementById('aiDest').value = destination; document.getElementById('aiDays').value = days; document.getElementById('aiInterest').value = interest; go('ai'); makePlan(); };
  window.addEventListener('tw-auth-change', loadCommunityRoutes); if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', setup); else setup();
}());
