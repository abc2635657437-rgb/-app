# Travel World 交付审计

> 日期：2026-10-20
> 范围：当前线上站点（`https://travel-world-mwdw.onrender.com`）与其构建、测试、清理
> 原则：每条结论都有可复现的证据，没有"应该没问题"

---

## 1. 线上交付的是什么

| 路由 | 文件 | 说明 |
|---|---|---|
| `/` | `explore3d.html` | 应用外壳：首页 / 探索 / ＋发布 / 聊天 / 旅友，右上角头像进「我的」 |
| `/explore3d-explore.html` | 同名文件 | 探索页本体，被外壳以 iframe 加载（样式隔离） |
| `/index.html` | `index.html` | 旧外壳，仍可访问，用于旧链接与 SEO 落地页 |
| `/api/*` | `backend/server.mjs` | 未改动：认证、动态、聊天、地图、AI |

**为什么探索页在 iframe 里**：站点样式与探索样式都是"整页规则"（`body .x`），
同文档下会互相覆盖——实测出现过分类胶囊被染成朱砂、控件列错位。
iframe 是唯一零冲突的隔离方式，且代价只有一次文档加载。

---

## 2. 构建：确定性可复现

`explore3d.html`、`explore3d-explore.html` 由脚本生成，不手写：

```powershell
node scripts/build-shell.mjs
```

连续两次构建的输出哈希一致：

```
explore3d.html          identical: True   F5F19792A743
explore3d-explore.html  identical: True   7B8FBD778EC2
```

构建做的事（全部可读、可复查）：

1. 从 `index.html` 原样抽取五个页面区块、内联启动脚本、20 个模块 `<script>`；
2. 从 `scripts/explore-scene.html` 抽取探索页并改写链接（`target="_top"` + 消息桥）；
3. 生成五项目的地导航（顺序由 CSS `grid order` 决定，不依赖注入时序）；
4. 注入屏幕状态同步（`body[data-screen]`）与跨文档导航桥。

---

## 3. 运行时取证：页面真正请求了什么

静态分析会误判，所以让浏览器自己报告（`scripts/audit-runtime.mjs`）：
加载首页 → 遍历全部六个屏幕 → 导出资源时间线。

```
requested paths: 79
same-origin paths: 67 | external: 12
same-origin requests checked: 67, non-200: 0
```

- 67 条同源请求**全部 200**（逐个 HEAD/GET 复核，排除 favicon 后）；
- 12 条外部请求是 Unsplash 配图与 Supabase Storage 媒体，不在本站 404 口径内。

探索页实际拉取的资源（用于判断什么该删）：

```
/assets/explore3d/earth-{albedo,normal,clouds}.webp
/assets/explore3d/tex/{meadow,canopy}.webp
/assets/explore3d/spots/{leifeng-pagoda,broken-bridge,three-pools,su-causeway,quyuan-fenghe,hupanjui}.jpg
/modules/explore3d/{explore3d.js,explore3d.css,globe.js,rig.js,west-lake.js}
/modules/vendor/three/three.module.js
```

---

## 4. 清理：只删"被证明从未请求"的文件

| 删除 | 大小 | 证据 |
|---|---|---|
| `assets/explore3d/plate.webp` | 998 KB | 运行时时间线中从未出现（已废弃的贴图方案） |
| `assets/explore3d/water-mask.png` | 220 KB | 同上 |
| `assets/explore3d/tex/water-normal.webp` | 25 KB | 生成了但从未接进着色器 |
| `assets/explore3d/tex/gen-manifest.json` | 1 KB | 生成器的临时清单 |
| `assets/explore3d/spots/boat.jpg` | 95 KB | 不在任何地点的照片表里 |
| `modules/explore3d/explore3d-shell.js` | 1 KB | 场景改由 iframe 承载后失效 |
| `modules/explore3d/explore3d.scoped.css` | 31 KB | 外壳已无探索 DOM，不再需要 |
| `westlake.html` + `modules/westlake/*` | 12 KB | 弃用方案的整页实现 |
| `scripts/scope-explore-css.mjs` | 2 KB | 随 scoped CSS 一起退出 |

合计约 **1.38 MB** 从仓库与部署中移除。删除后重跑运行时取证，探索资源清单不变，
23 项交互检查全通过 —— 证明删掉的都确实不在关键路径上。

---

## 5. 验证：两层，都跑在线上

### 5.1 交互层（`npm run test:app`）

23 项，覆盖每个目的地与 iframe 内的探索页：

```
首页渲染 · 五项目的地顺序 · 探索激活 · iframe 载入 · 3D 就绪 · 画布尺寸
点湖面有反馈 · 点景点飞行并弹简介卡 · 发布/聊天/旅友/我的 逐页激活
返回首页 · iframe 存活 · 离开后画布存活 · 地图头像进我的（不刷新）
首页头像进我的 · 探索页内点标签回首页（不刷新）· 无控制台报错
```

本机与线上各跑一次，均 **23/23**。

### 5.2 代码层（仓库自带测试）

```
ℹ tests 19
ℹ pass 18
ℹ fail 1     modules/map/map-web.integration.test.mjs
```

这个失败**在本次工作开始前就存在**，且 `modules/map/map-web.js` 全程未被修改
（`git status` 可查）。失败原因是该测试的 VM 沙箱里 `renderMarkers` 未产出标记
（`0 !== 2`）——属于既有测试与实现不一致，与本轮交付无关，已在之前的评估文档中记录。

---

## 6. 已修的真实缺陷（本轮由检查发现）

| 缺陷 | 后果 | 修复 |
|---|---|---|
| 右上角头像是指向旧站点的 `<a>` | 点「我的」会离开新应用 | 改为应用内按钮 `go('profile')` |
| iframe 内点标签导航自身 | 探索页被套进自己，场景重建 | `postMessage` 通知外壳切屏 + `target="_top"` |
| 底栏聊天项靠 JS 挪位 | 生产冷启动时输掉时序竞争，位置错 | 改为 CSS `grid order`，与注入时机无关 |
| 点景点只飞行不显示信息 | 点了不知道为什么 | 补简介卡（名称/英文/标签/回全球） |
| 缺 favicon | 每次冷加载一次 404 | 新增 `favicon.svg` 并在两个页面声明 |
| Service Worker 缓存旧首页 | 老访客仍看到旧版 `/` | 缓存名升级为 `v115-explore-shell` |

---

## 7. 已知限制（如实记录，不修饰）

1. **离线打不开探索页**：Service Worker 预缓存 50 个文件里不含 `explore3d-explore.html`
   与 WebGL 资源。断网时外壳可打开、探索页不可用。
2. **首屏有一次 iframe 加载**：探索页的 1.3 MB Three.js 与 3 张地球贴图在第一次进入
   「探索」时下载，不在首页阻塞。
3. **免费实例**：Render 免费套餐会休眠，冷启动首个请求约 20–40 秒。
4. **既有测试失败**：见 5.2，未修，因为修复它需要先判断是测试还是实现更该改，
   属于独立议题。
5. **画面是程序化生成的插画地图**，与参考稿的绘画密度仍有差距；这是资产问题，
   不是工程问题。

---

## 8. 如何复验

```powershell
node scripts/build-shell.mjs          # 确定性构建（两次哈希应一致）
node scripts/audit.mjs                # 静态：断链 / 重复 id / 不可达文件
node scripts/audit-runtime.mjs        # 运行时：页面真正请求了什么
node scripts/test-app.mjs             # 交互：23 项
node --test backend/*.test.mjs modules/map/*.test.mjs   # 代码：18/19（既有 1 项）
node scripts/deploy.mjs travel-world --smoke            # 上线 + 冒烟
```
