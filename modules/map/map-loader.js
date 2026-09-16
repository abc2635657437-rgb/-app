(function () {
  if ('serviceWorker' in navigator && location.protocol !== 'file:') navigator.serviceWorker.register('sw.js').catch(() => {});
  window.loadMap = function () { if (window.initTravelMap) window.initTravelMap(); else { const status = document.getElementById('mapStatus'); if (status) status.textContent = '正在加载在线地图…'; } };
  const css = document.createElement('link');
  css.rel = 'stylesheet';
  css.href = '/vendor/leaflet/leaflet.css';
  document.head.appendChild(css);
  const style = document.createElement('style');
  style.textContent = '.tw-q-pin,.tw-route-pin,.tw-user-pin{background:transparent;border:0}.tw-q-pin__body{display:flex;align-items:center;gap:5px;width:max-content;max-width:130px;background:#fff;border:2px solid #173f4f;border-radius:18px;padding:4px 8px 4px 5px;box-shadow:0 5px 12px #173f4f38;transform:translate(-8px,-8px)}.tw-q-pin__icon{display:grid;place-items:center;width:26px;height:26px;border-radius:50%;background:#f6dfbf;font-size:17px}.tw-q-pin__label{font-size:11px;font-weight:800;color:#173f4f;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}.tw-route-pin__body{display:grid;place-items:center;width:28px;height:28px;border:2px solid #fff;border-radius:50%;background:#d17d57;color:#fff;font-size:12px;font-weight:800;box-shadow:0 4px 10px #173f4f45}.tw-user-pin__arrow{position:relative;z-index:2;display:grid;place-items:center;width:28px;height:28px;border:3px solid #fff;border-radius:50%;background:#1f7a8c;color:#fff;font-size:16px;transform:rotate(-45deg);box-shadow:0 4px 12px #173f4f66}.tw-user-pin__pulse{position:absolute;inset:0;border-radius:50%;background:#1f7a8c44;animation:twPulse 1.8s infinite}@keyframes twPulse{50%{transform:scale(1.65);opacity:0}}.map-controls{display:grid;grid-template-columns:1fr auto auto;gap:7px;margin-bottom:10px}.map-controls input{min-width:0;border:1px solid #dfe6e1;border-radius:9px;padding:9px}.leaflet-popup-content button{border:0;background:#173f4f;color:#fff;border-radius:12px;padding:6px 9px;margin-top:7px}';
  document.head.appendChild(style);
  const provider = document.createElement('script');
  provider.src = 'modules/map/map-provider.js?v=3';
  provider.onload = () => {
    const leaflet = document.createElement('script');
    leaflet.src = '/vendor/leaflet/leaflet.js';
    const loadRuntime = () => {
      const runtime = document.createElement('script');
      runtime.src = 'modules/map/map-web.js?v=3';
      runtime.onload = () => { window.loadMap = window.initTravelMap; };
      document.body.appendChild(runtime);
    };
    leaflet.onload = loadRuntime;
    leaflet.onerror = loadRuntime;
    document.body.appendChild(leaflet);
  };
  document.body.appendChild(provider);
  window.addEventListener('DOMContentLoaded', () => {
    const card = document.querySelector('.map-card');
    if (!card || document.getElementById('mapSearch')) return;
    const controls = document.createElement('div');
    controls.className = 'map-controls';
    controls.innerHTML = '<input id="mapSearch" placeholder="搜索城市或地标"><button class="btn alt small" onclick="searchTravelMap()">搜索</button><button class="btn alt small" onclick="locateTravelMap()">定位</button>';
    card.insertBefore(controls, card.firstChild);
    const presence = document.createElement('div');
    presence.className = 'row';
    presence.style.cssText = 'margin:0 0 10px;align-items:center';
    presence.innerHTML = '<label class="muted" style="font-size:12px"><input id="mapShareLocation" type="checkbox" onchange="toggleMapLocationSharing(this.checked)"> 共享我的位置</label><input id="mapOnlineCountry" aria-label="在线用户国家筛选" placeholder="国家筛选" style="width:84px;border:1px solid #dfe6e1;border-radius:8px;padding:7px"><button class="btn alt small" onclick="loadMapOnlineUsers()">在线用户</button>';
    card.insertBefore(presence, controls.nextSibling);
  });
}());
