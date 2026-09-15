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
    go('ai'); setTimeout(() => { const natural = document.getElementById('aiRequest'), destination = document.getElementById('aiDest'); if (destination && landmark) destination.value = landmark.city || landmark.country || ''; if (natural && landmark) natural.value = `我想围绕${landmark.name}规划一次旅行，请结合附近真实地点安排。`; }, 0);
  };
}());
