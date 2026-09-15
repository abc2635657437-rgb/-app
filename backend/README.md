# Travel World backend contracts

当前仓库包含 Web/微信前端、Express API 与 Supabase 数据层。未配置外部服务密钥时接口会明确失败，不会伪造 AI 或支付成功状态。

## AI
- POST /api/ai/plan：必须登录。接收自然语言、可选结构化偏好和 conversationId，调用 OpenAI-compatible 模型，返回并保存结构化路线。
- GET /api/ai/conversations：读取当前用户的旅行规划会话。
- GET /api/ai/conversations/:id：读取会话和完整消息上下文。
- 路线保存到 routes、trip_days、trip_places；地图使用返回坐标绘制路线。地点验证状态区分 verified、provider 与 unverified。

AI_PROVIDER、AI_MODEL、AI_API_KEY、AI_BASE_URL 仅配置在服务端。生产部署仍需增加按 userId/IP 限流、每日额度、token 上限、超时和审计日志。

## 用户与旅友
- /api/users/me、/api/buddies/search、/api/buddies/applications。匹配字段包括目的地、日期、兴趣、预算与同行偏好。

## 商家、订单与支付
- /api/merchants、/api/orders、/api/payments。订单状态由服务端维护：pending → paid/confirmed → refunded/cancelled。
- 线上支付仅接受 Visa、微信支付、支付宝的服务端下单与回调验签；前端不得写入 paid。
- 现金订单需商家声明 supportsCash=true，状态保持 pending/awaiting_cash，完成后由商家确认。

建议将 AI、用户、路线、商家、订单、支付拆为独立模块，后续可替换实现而不影响现有导航。
