(function () {
  const providers = {
    osm: { id: 'osm', label: 'OpenStreetMap', tile: 'https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', attribution: '&copy; OpenStreetMap contributors' },
    google: { id: 'google', label: 'Google Maps', requiresKey: true },
    amap: { id: 'amap', label: '高德地图', requiresKey: true }
  };
  window.TravelMapProviders = { providers, defaultProvider: 'osm', get(id) { return providers[id] || providers.osm; } };
}());
