App({
  globalData: {
    brand: 'Travel World',
    currency: 'CNY',
    exchangeRates: { CNY: 1, USD: 0.138, EUR: 0.127, JPY: 20.4, THB: 4.92 },
    paymentMethods: [
      { id: 'visa', label: 'Visa', icon: 'V', enabled: true },
      { id: 'wechat', label: '微信支付', icon: '微', enabled: true },
      { id: 'alipay', label: '支付宝', icon: '支', enabled: true },
      { id: 'cash', label: '现金', icon: '现', enabled: true }
    ]
  }
})
