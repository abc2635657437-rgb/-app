Page({
  data: { landmarks: [], query: '', status: '正在加载本地地图数据…' },
  onLoad() { wx.request({ url: '/modules/data/landmarks.json', success: res => this.setData({ landmarks: res.data.landmarks || [], status: '已加载本地地标，可离线查看' }), fail: () => this.setData({ status: '当前小程序使用本地数据包；联网地图 Provider 待配置' }) }); },
  input(e) { this.setData({ query: e.detail.value }); },
  search() { const q = this.data.query.trim(); if (!q) return; const item = this.data.landmarks.find(x => x.name.indexOf(q) > -1 || x.city.indexOf(q) > -1 || x.country.indexOf(q) > -1); wx.showModal({ title: item ? item.name : '没有找到地点', content: item ? `${item.country} · ${item.city}\n${item.description}` : '可以尝试搜索城市、国家或地标名称。', showCancel: false }); }
});
