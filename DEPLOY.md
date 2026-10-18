# 部署 / Deploy

线上服务在 Render 上跑：服务名 `travel-world`（id `srv-dak39euk1f9s73arb650`），正式站 https://travel-world-mwdw.onrender.com ，代码从 GitHub 的 `main` 分支拉取。

⚠️ 这个服务的 Auto-Deploy 开关虽然已通过 API 打开（`autoDeploy=yes`、`autoDeployTrigger=commit`），但实测 **push 之后不会自动部署**——推完 5 分钟，`/v1/services/{id}/deploys` 里没有任何新记录，`last-modified` 也没变。所以发布请走下面的一键上线命令，别等自动部署。

## 一键上线（本机）

```
node scripts/deploy.mjs --list                                    # 项目 + 凭据状态
node scripts/deploy.mjs travel-world --smoke                      # API 触发 → 轮询到 live → 健康检查 → 冒烟
```

- 优先走 Render API：`deploy.config.json` 里的 `render.serviceId` + 凭据（环境变量 `RENDER_API_KEY`，或本机 `deploy.local.json` 的 `renderApiKey`，该文件已 gitignore）。这种方式能拿到部署状态，确认 `live`，而不只是"服务活着"。
- 没有 API 凭据时退回 Deploy Hook：`--hook` 参数 > 环境变量 `DEPLOY_HOOK_TRAVEL_WORLD` > `deploy.hooks.json`。hook 只能触发、拿不到状态，所以要配 `--wait` 秒数。
- `--smoke` 会再跑 `scripts/smoke-prod.mjs`（8 条关键路由 + Service Worker 预缓存）。
- 加一个项目 = 在 `deploy.config.json` 里加一条 + 配 `render.serviceId`（或 hook），命令不变。

## 这台机器上已经验证过的部分

```
NODE_ENV=production PORT=8787 node backend/server.mjs
```

`node scripts/smoke-prod.mjs https://<域名>` 会检查 8 个关键路由和 Service Worker 预缓存的 51 个文件：

- `/api/health`、`/`、`/sw.js`、`/api/ai/assistant/health`、`/api/ai/place?name=…` 全部 200；
- `ai-chat.js?v=17-travel-desk`、`ai-chat.css?v=17-travel-desk`、`ai-voice.js?v=1` 全部 200；
- 预缓存 51 个资源，缺失 0。预缓存少一个文件，Service Worker 就会安装失败，所以这一项必须先过。

## 上线步骤

1. 推代码（需要一台有 git、并且已登录 GitHub 的机器）：

   ```
   git add -A
   git commit -m "Travel desk: compact photo plan, booking/transit links, voice, place details"
   git push origin main
   ```

2. Render 面板 → `travel-world` → **Manual Deploy** → Deploy latest commit。

3. 环境变量（Render → Environment）。除了原有的 `SUPABASE_*`、`QQ_*`，这次新增两个真正影响体验的：

   - `AI_BASE_URL`：OpenAI 兼容端点。留空 = 现在的免费 `text.pollinations.ai`，对「排日程」这类请求经常返回空、并且要二十多秒。**建议**换成稳定供应商（DeepSeek 等），只改这一行就能生效。
   - `AI_MODEL`：模型名，留空默认 `openai-fast`。

4. 发布后确认三件事：

   - `https://<域名>/api/health` 返回 `{"ok":true,...}`；
   - 打开页面 → 悬浮球进顾问台 → 问一句「帮我排一版京都三天日程」，五秒内应看到回复（半成品会带「先给你这一版」）；
   - Service Worker 缓存名已升到 `travel-world-offline-v105-travel-desk`，老用户刷新一次就换新。

## 还需要什么才能由我直接发

这台机器上**没有 git、没有 GitHub token、没有 Render API key**。部署脚本（`scripts/deploy.mjs`）已经就位，现在只差一条**部署触发地址**：Render Deploy Hook（`https://api.render.com/deploy/srv-…`）。给到这条地址，我就能直接发，并且发完自动做健康检查 + 冒烟。

- 一个 Render Deploy Hook URL（最快，一条地址即可），或
- 一个 GitHub Personal Access Token（能推这个仓库，推完仍需 Deploy Hook 或 Auto-Deploy），或
- 在 Render 打开 Auto-Deploy 后由别人推代码。

另外 `--tunnel` 选项：用仓库里的 `cloudflared.exe` 起一个临时公网地址给外部看，但不是正式部署（地址随机、关掉就失效），需要你同意才会跑。
