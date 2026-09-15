(function () {
  const fields = { dest: ['输入目的地，例如大理', ''], budget: ['预算（CNY）', ''], date: ['出发日期', ''], days: ['旅行天数', ''], interest: ['兴趣，例如自然、美食、摄影', ''] };
  function setup() {
    const style = document.createElement('style');
    style.textContent = '.route-filters{display:flex;flex-wrap:wrap;gap:4px;margin:12px 0}.route-grid{display:grid;grid-template-columns:1fr;gap:12px}.route-card{background:#fff;border-radius:14px;padding:15px;box-shadow:0 7px 20px #203a410c}.route-card-top{display:flex;justify-content:space-between;align-items:center}.route-card h3{margin:12px 0 4px;color:#173f4f}.route-card p{color:#53656b;line-height:1.5;font-size:14px}.route-tags{color:#477064;font-size:12px;margin-bottom:12px}.map-controls{display:flex;gap:7px;align-items:center;margin-bottom:10px}.map-controls input{flex:1;padding:10px;border:1px solid #dfe6e1;border-radius:999px;font:inherit}.leaflet-container{font-family:-apple-system,BlinkMacSystemFont,"Segoe UI","PingFang SC",sans-serif}';
    document.head.appendChild(style);
    Object.keys(fields).forEach(id => { const input = document.getElementById(id); if (input) { input.value = fields[id][1]; input.placeholder = fields[id][0]; } });
    const section = document.getElementById('discover');
    if (!section || document.getElementById('routeLibrary')) return;
    const library = document.createElement('div');
    library.id = 'routeLibrary';
    library.innerHTML = '<div class="head"><h2>参考路线</h2><span class="muted">国内 · 海外</span></div><div id="routeFilters" class="route-filters"></div><div id="routeGrid" class="route-grid"></div>';
    section.appendChild(library);
    fetch('modules/data/routes.json').then(response => response.json()).then(data => { window.travelRoutes = data.routes; renderRoutes('全部'); }).catch(() => { document.getElementById('routeGrid').textContent = '参考路线暂时无法加载，请检查网络后重试。'; });
  }
  function renderRoutes(type) {
    const routes = window.travelRoutes || [];
    const filtered = type === '全部' ? routes : routes.filter(route => route.type === type);
    document.getElementById('routeFilters').innerHTML = ['全部', '城市旅行', '自然风景', '美食旅行', '文化旅行', '独自旅行', '家庭旅行', '摄影旅行', '户外旅行'].map(item => '<button class="pill ' + (item === type ? 'active' : '') + '" onclick="filterTravelRoutes(\'' + item + '\')">' + item + '</button>').join('');
    document.getElementById('routeGrid').innerHTML = filtered.map(route => '<article class="route-card"><div class="route-card-top"><span class="pill">' + route.country + '</span><span class="muted">' + route.days + ' 天</span></div><h3>' + route.title + '</h3><div class="muted">' + route.destination + ' · ' + route.type + '</div><p>' + route.summary + '</p><div class="route-tags">' + route.tags.map(tag => '<span>#' + tag + '</span>').join(' ') + '</div><button class="btn alt small" onclick="useTravelRoute(\'' + route.destination + '\',' + route.days + ',\'' + route.tags.join('、') + '\')">用这条路线规划</button></article>').join('');
  }
  window.filterTravelRoutes = renderRoutes;
  window.useTravelRoute = (destination, days, interest) => { document.getElementById('aiDest').value = destination; document.getElementById('aiDays').value = days; document.getElementById('aiInterest').value = interest; go('ai'); makePlan(); };
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', setup); else setup();
}());
