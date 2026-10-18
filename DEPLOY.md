# 部署 / Deploy

线上服务在 Render 上跑：服务名 `travel-world`（id `srv-dak39euk1f9s73arb650`），正式站 https://travel-world-mwdw.onrender.com ，代码从 GitHub 的 `main` 分支拉取。2026-10-19 已通过 Render API 打开自动部署（`autoDeploy=yes`、`autoDeployTrigger=commit`），并实测发布一次：deploy `dep-dbaivve1egvs73at5f90` → `live`，8 条关键路由 + 51 个预缓存资源全部通过。此后 push 到 `main` 即自动上线。

## 一键上线（本机）

```
node scripts/deploy.mjs --list                                  # 有哪些项目、hook 是否就位
node scripts/deploy.mjs travel-world --wait 180 --smoke         # 触发 → 等起来 → 健康检查 → 冒烟
```

- 触发地址取 Render 面板 → `travel-world` → Settings → Deploy Hook，存进 `deploy.hooks.json`（已 gitignore），或环境变量 `DEPLOY_HOOK_TRAVEL_WORLD`，或临时 `--hook "https://api.render.com/deploy/srv-…"`；
- `--wait` 秒数按实际部署耗时给，然后做 `/api/health` 检查；`--smoke` 再跑 `scripts/smoke-prod.mjs`；
- 加一个项目 = 在 `deploy.config.json` 里加一条 + 给它配一个 hook，命令不变。

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
