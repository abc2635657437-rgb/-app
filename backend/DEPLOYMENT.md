# Travel World 上线说明

项目现在由一个 Express 服务同时提供 Web 前端和 API，Supabase 提供认证、Postgres 与 Storage。根目录 `render.yaml` 可部署为单个 Render Web Service。

## 已接通

- Supabase 用户、资料、帖子、媒体、互动、收藏、旅行、同行、聊天、通知与 AI 路线表。
- OpenStreetMap/Leaflet 在线地图。
- 服务端 Nominatim 地点搜索、OSRM 道路路线和 Open-Meteo 天气代理，均有缓存和超时。
- OpenAI-compatible AI Provider 接口；未配置密钥时明确返回 503。
- `/api/health` 部署健康检查。

## Render 环境变量

复制 `.env.example` 中的名称，在 Render Dashboard 设置真实值。`SUPABASE_SERVICE_ROLE_KEY`、`AI_API_KEY` 只能放在服务器 Secret 中。

`PUBLIC_APP_URL` 设置为最终 HTTPS 地址，`CORS_ORIGINS` 使用英文逗号列出允许访问 API 的其他正式域名。

## 数据库

新项目先执行 `schema.sql`。已有项目按顺序执行 `migrations/` 下尚未执行的脚本。迁移只应在 Supabase SQL Editor 或受控 CI 中执行。

## 地图供应商说明

默认公共 Nominatim 和 OSRM 适合开发与小规模验证，不提供正式 SLA。生产访问增长前，应将 `NOMINATIM_BASE_URL` 和 `OSRM_BASE_URL` 切换为自托管或商业授权实例；中国大陆正式运营可切换高德官方 SDK/API。不要抓取或打包未经授权的地图瓦片。

## 上线验收

运行 `node backend/smoke-test.mjs` 会创建两个临时测试用户，验证核心数据库链路，并在结束时删除测试账号和文件。随后分别以 390x844 和桌面尺寸验证首页、AI、地图、旅友、我的页面。

云端 AI 最终验收必须在配置真实模型密钥后进行，覆盖首次生成、连续修改、预算控制、地点验证、数据库保存与地图同步。
