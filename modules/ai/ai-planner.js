(function () {
  let context = JSON.parse(localStorage.getItem('tw-ai-context') || '{}');
  let conversationId = localStorage.getItem('tw-ai-conversation-id') || '';
  const safe = value => String(value ?? '').replace(/[&<>"']/g, ch => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[ch]));
  const chat = message => { const box = document.getElementById('chat'); if (box) box.insertAdjacentHTML('beforeend', '<div class="bubble ai">' + safe(message) + '</div>'); };
  const field = id => document.getElementById(id)?.value?.trim() || '';

  function requestFromForm(message = '') {
    return { message, destination: field('aiDest'), startDate: field('aiDate'), days: field('aiDays') ? Number(field('aiDays')) : null, budget: field('aiBudget') ? Number(field('aiBudget')) : null, currency: window.state?.currency || 'CNY', travelers: field('aiTravelers'), interests: field('aiInterest') ? field('aiInterest').split(/[、,，]+/).map(value => value.trim()).filter(Boolean) : [], diet: field('aiDiet'), accommodation: field('aiStay'), transport: field('aiTransport') };
  }

  function routePoints(plan) {
    return (plan.daysPlan || []).flatMap(day => (day.slots || []).map(slot => ({ latitude: Number(slot.latitude), longitude: Number(slot.longitude), name: slot.place, day: day.day, time: slot.time })).filter(point => Number.isFinite(point.latitude) && Number.isFinite(point.longitude)));
  }
  function syncPlanToMap(plan) { const points = routePoints(plan); localStorage.setItem('tw-map-route', JSON.stringify(points)); if (window.showTravelRoute && points.length > 1) window.showTravelRoute(points); }
  function mapButton(name) { return '<button class="btn alt small" onclick="openAiPlaceOnMap(\'' + encodeURIComponent(name) + '\')">在地图查看</button>'; }

  function render(plan) {
    const currency = safe(plan.currency || 'CNY');
    const dayHtml = (plan.daysPlan || []).map(day => '<div class="plan-item ai-day"><div class="row"><b>Day ' + day.day + ' · ' + safe(day.title) + '</b><span class="muted">约 ' + currency + ' ' + Number(day.estimatedCost || 0) + '</span></div>' + (day.slots || []).map(slot => '<div class="ai-slot"><span>' + safe(slot.time || slot.period) + '</span><div><strong>' + safe(slot.place) + '</strong><div class="muted">' + safe(slot.duration) + ' · ' + safe(slot.transport) + ' · 约 ' + currency + ' ' + Number(slot.cost || 0) + '</div><div class="muted">' + safe(slot.reason) + '</div><div class="muted">' + (slot.verificationStatus === 'verified' ? '地点已由目录校验' : '实时资料出发前需再次确认') + '</div>' + mapButton(slot.place) + '</div></div>').join('') + '<div class="muted">' + safe(day.note) + '</div></div>').join('');
    const warnings = (plan.warnings || []).map(item => '<div class="muted">· ' + safe(item) + '</div>').join('');
    document.getElementById('planBox').innerHTML = '<div class="card"><div class="row"><b>' + safe(plan.tripTitle || (plan.destination + '旅行路线')) + '</b><span class="pill">云端 AI · 已保存</span></div><div class="muted">预算 ' + currency + ' ' + (plan.budget || '未设置') + ' · 预计 ' + currency + ' ' + Number(plan.estimated || 0) + ' · 余额 ' + currency + ' ' + Number(plan.remainingBudget || 0) + '</div>' + dayHtml + '<div class="plan-item"><b>注意事项</b><div class="muted">' + safe(plan.season) + '</div>' + warnings + '</div><div class="row"><button class="btn alt small" onclick="showAiPlanOnMap()">查看完整地图</button><button class="btn alt small" onclick="replanTravel()">重新规划</button></div></div>';
  }

  async function run(request, message) {
    if (!navigator.onLine) return chat('当前没有网络。已保存的路线和地点仍可离线查看，但生成或修改路线需要连接真实云端模型。');
    if (!window.TravelWorldAuth?.session?.()) { window.TravelWorldAuth?.showLogin?.(); return chat('请先登录，AI 路线才能安全调用云端模型并保存到你的账号。'); }
    chat(message ? '正在根据你的新要求调整路线…' : '正在检索可用地点并规划路线…');
    try {
      const result = await window.TravelWorldAuth.request('/api/ai/plan', { method: 'POST', body: JSON.stringify({ request, context, conversationId: conversationId || undefined, message: message || request.message }) });
      conversationId = result.conversationId || conversationId; localStorage.setItem('tw-ai-conversation-id', conversationId);
      if (result.plan?.needsClarification) return chat(result.plan.clarifyingQuestion || '还需要补充目的地和旅行天数。');
      if (result.plan?.answer) chat(result.plan.answer);
      if (!result.plan?.daysPlan?.length) return;
      context = { ...request, plan: result.plan, routeId: result.routeId }; localStorage.setItem('tw-ai-context', JSON.stringify(context));
      render(result.plan); syncPlanToMap(result.plan); chat(message ? '路线已根据你的要求更新，并同步保存。' : '路线已经生成并保存，可以继续告诉我怎么调整。');
    } catch (error) { chat('真实 AI 服务暂时不可用：' + error.message); }
  }

  async function createFromInputs() { const natural = field('aiRequest'); if (!natural && !field('aiDest')) return chat('告诉我想去哪里，或直接用一句话描述这次旅行。'); await run(requestFromForm(natural)); }
  async function continueChat() { const input = document.getElementById('ask'), message = input?.value.trim(); if (!message) return; document.getElementById('chat').insertAdjacentHTML('beforeend', '<div class="bubble me">' + safe(message) + '</div>'); input.value = ''; await run(requestFromForm(message), message); }

  window.showAiPlanOnMap = () => { if (!context.plan) return; syncPlanToMap(context.plan); go('map'); setTimeout(() => { window.initTravelMap?.(); setTimeout(() => window.showTravelRoute?.(routePoints(context.plan)), 250); }, 0); };
  window.openAiPlaceOnMap = encodedName => { const name = decodeURIComponent(encodedName); go('map'); window.loadMap?.(); setTimeout(() => { const input = document.getElementById('mapSearch'); if (input) input.value = name; window.searchTravelMap?.(name); }, 350); };
  window.replanTravel = createFromInputs;
  function setup() {
    const card = document.querySelector('#ai .card');
    if (card && !document.getElementById('aiRequest')) { const input = document.createElement('textarea'); input.id = 'aiRequest'; input.className = 'input'; input.placeholder = '例如：我想去大理，预算两千以内，玩两天，主要想拍照。'; input.style.minHeight = '78px'; card.insertBefore(input, card.querySelector('.grid')); }
    const style = document.createElement('style'); style.textContent = '.ai-day{padding:14px 0}.ai-slot{display:grid;grid-template-columns:52px 1fr;gap:8px;padding:9px 0;border-top:1px solid #edf0ec}.ai-slot>span{color:#d17d57;font-size:12px;padding-top:3px}.ai-slot .btn{margin-top:7px}.ai-day .row{margin-bottom:7px}'; document.head.appendChild(style);
    window.makePlan = createFromInputs; window.send = continueChat;
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', setup); else setup();
}());
