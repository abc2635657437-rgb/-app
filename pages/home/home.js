Page({
  data: { featured: [
    { title:'京都慢行 5 日', place:'日本 · 关西', cost:'¥4,800', image:'https://images.unsplash.com/photo-1493976040374-85c8e12f0c0e?w=900' },
    { title:'清迈山野食旅', place:'泰国 · 清迈', cost:'¥2,600', image:'https://images.unsplash.com/photo-1528181304800-259b08848526?w=900' }
  ], foods:[{name:'海盐可颂',place:'巴黎 · Saint-Germain'},{name:'炭火鳗鱼饭',place:'京都 · 祇园'},{name:'冬阴功',place:'曼谷 · Ari'}] },
  onRouteTap(){ wx.switchTab({url:'/pages/discover/discover'}) },
  onAiTap(){ wx.switchTab({url:'/pages/ai/ai'}) }
})
