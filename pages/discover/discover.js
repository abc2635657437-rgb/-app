Page({
  data:{ country:'全部', budget:'8000', days:'5', date:'2026-10-01', countries:['全部','日本','泰国','法国','意大利'], destinations:[{name:'京都',country:'日本',tag:'古城 · 美食 · 秋色',image:'https://images.unsplash.com/photo-1493976040374-85c8e12f0c0e?w=900',local:'JPY'},{name:'清迈',country:'泰国',tag:'山野 · 慢生活 · 夜市',image:'https://images.unsplash.com/photo-1528181304800-259b08848526?w=900',local:'THB'},{name:'巴黎',country:'法国',tag:'艺术 · 街巷 · 面包',image:'https://images.unsplash.com/photo-1502602898657-3e91760cbb34?w=900',local:'EUR'}]},
  chooseCountry(e){this.setData({country:e.currentTarget.dataset.value})},
  input(e){this.setData({[e.currentTarget.dataset.key]:e.detail.value})},
  generate(){wx.showModal({title:'路线已生成',content:`根据 ¥${this.data.budget}、${this.data.days} 天和 ${this.data.date} 出发，为你匹配了 3 个目的地。`,confirmText:'查看路线',success:()=>wx.switchTab({url:'/pages/ai/ai'})})},
  openDestination(e){wx.showModal({title:e.currentTarget.dataset.name,content:'真实内容、商户支付方式与当地结算货币将在目的地详情中展开。'})}
})
