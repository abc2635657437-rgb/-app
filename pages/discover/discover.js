const referenceRoutes = [
  { name: '北京', country: '中国', type: '文化旅行', days: 4, tag: '故宫 · 长城 · 胡同' },
  { name: '上海', country: '中国', type: '城市旅行', days: 3, tag: '外滩 · 梧桐 · 美食' },
  { name: '杭州', country: '中国', type: '自然风景', days: 3, tag: '西湖 · 茶园 · 慢行' },
  { name: '成都', country: '中国', type: '美食旅行', days: 3, tag: '火锅 · 茶馆 · 熊猫' },
  { name: '大理', country: '中国', type: '自然风景', days: 5, tag: '洱海 · 苍山 · 日落' },
  { name: '丽江', country: '中国', type: '独自旅行', days: 4, tag: '古城 · 雪山 · 小众' },
  { name: '东京', country: '日本', type: '城市旅行', days: 5, tag: '浅草 · 涩谷 · 动漫' },
  { name: '首尔', country: '韩国', type: '美食旅行', days: 4, tag: '市场 · 咖啡 · 街拍' },
  { name: '清迈', country: '泰国', type: '独自旅行', days: 4, tag: '寺庙 · 夜市 · 山野' },
  { name: '新加坡', country: '新加坡', type: '家庭旅行', days: 4, tag: '花园 · 美食 · 城市' },
  { name: '巴黎', country: '法国', type: '摄影旅行', days: 5, tag: '博物馆 · 左岸 · 咖啡' },
  { name: '罗马', country: '意大利', type: '文化旅行', days: 4, tag: '古迹 · 广场 · 意面' },
  { name: '悉尼', country: '澳大利亚', type: '户外旅行', days: 5, tag: '海岸 · 徒步 · 日落' },
  { name: '纽约', country: '美国', type: '城市旅行', days: 5, tag: '博物馆 · 建筑 · 街区' }
];
Page({
  data: { country: '全部', budget: '', days: '', date: '', destination: '', interest: '', countries: ['全部', '中国', '日本', '韩国', '泰国', '法国', '意大利', '美国'], destinations: [{ name: '大理', country: '中国', tag: '山海 · 慢生活 · 日落', image: 'https://images.unsplash.com/photo-1500534623283-312aade485b7?w=900', local: 'CNY' }, { name: '东京', country: '日本', tag: '城市 · 美食 · 摄影', image: 'https://images.unsplash.com/photo-1540959733332-eab4deabeeaf?w=900', local: 'JPY' }, { name: '巴黎', country: '法国', tag: '艺术 · 街巷 · 面包', image: 'https://images.unsplash.com/photo-1502602898657-3e91760cbb34?w=900', local: 'EUR' }], routes: referenceRoutes },
  chooseCountry(e) { this.setData({ country: e.currentTarget.dataset.value }); },
  input(e) { this.setData({ [e.currentTarget.dataset.key]: e.detail.value }); },
  generate() { wx.switchTab({ url: '/pages/ai/ai' }); },
  openDestination(e) { wx.showModal({ title: e.currentTarget.dataset.name, content: '地点详情、地图定位与参考路线将在目的地页展开。', confirmText: '知道了', showCancel: false }); }
});
