const app = getApp()

Page({
  data: { prompt: '', messages: [{ role: 'ai', text: '告诉我目的地、天数、预算和偏好，我会调用真实旅行规划服务。' }], plan: null, conversationId: '', loading: false },
  input(e) { this.setData({ prompt: e.detail.value }) },
  quick(e) { this.setData({ prompt: e.currentTarget.dataset.text }) },
  send() {
    const message = this.data.prompt.trim()
    if (!message || this.data.loading) return
    const apiBase = app.globalData.apiBase
    const token = wx.getStorageSync('tw-access-token')
    this.setData({ messages: this.data.messages.concat({ role: 'me', text: message }, { role: 'ai', text: '正在检索地点并规划路线…' }), prompt: '', loading: true })
    if (!apiBase || !token) {
      this.setData({ messages: this.data.messages.concat({ role: 'ai', text: '真实 AI 服务尚未配置或账号未登录，请先完成服务器地址与登录配置。' }), loading: false })
      return
    }
    wx.request({
      url: apiBase + '/api/ai/plan', method: 'POST',
      header: { Authorization: 'Bearer ' + token, 'Content-Type': 'application/json' },
      data: { request: { message }, message, conversationId: this.data.conversationId || undefined },
      success: response => {
        if (response.statusCode >= 400) return this.setData({ messages: this.data.messages.concat({ role: 'ai', text: response.data.error || 'AI 服务请求失败' }), loading: false })
        const plan = response.data.plan
        this.setData({ plan, conversationId: response.data.conversationId, messages: this.data.messages.concat({ role: 'ai', text: plan.needsClarification ? plan.clarifyingQuestion : '路线已生成并保存，可以继续告诉我怎么调整。' }), loading: false })
      },
      fail: () => this.setData({ messages: this.data.messages.concat({ role: 'ai', text: '网络连接失败，已保存的旅行资料仍可离线查看。' }), loading: false })
    })
  },
  generate() { this.send() }
})
