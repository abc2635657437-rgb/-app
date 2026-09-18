(function () {
  function currentRouteId() { try { return JSON.parse(localStorage.getItem('tw-ai-context') || '{}').routeId || localStorage.getItem('tw-map-route-id') || null; } catch (_) { return null; } }
  window.addLandmark = async landmarkId => {
    if (!window.TravelWorldAuth?.requireLogin?.()) return;
    try {
      const result = await window.TravelWorldAuth.request('/api/routes/map-place', { method: 'POST', body: JSON.stringify({ landmarkId, routeId: currentRouteId() }) });
      localStorage.setItem('tw-map-route-id', result.routeId); alert(result.added ? '已加入我的旅行路线' : '这个地点已经在路线中');
    } catch (error) { alert('加入路线失败：' + error.message); }
  };
  window.planLandmarkWithAi = landmarkId => {
    const landmark = window.currentMapLandmark;
    if (landmark) localStorage.setItem('tw-ai-pending-prompt', `我想围绕${landmark.name}规划一次旅行，请结合附近真实地点安排。`);
    go('ai');
  };
  window.generate = () => { const destination=document.getElementById('dest')?.value.trim(), days=document.getElementById('days')?.value; if(destination)localStorage.setItem('tw-ai-pending-prompt',`请为我规划${destination}${days?` ${days} 天`:''}的旅行路线。`); go('ai'); };
}());
