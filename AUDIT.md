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
6. **生产环境出网受限（既有问题，非本轮改动）**：
   线上三个依赖外部服务的接口表现不一致，证据如下
   ```
   /api/weather      → 502   （本机 200，Open-Meteo 从本机 200）
   /api/map/search   → 502   （Nominatim）
   /api/map/reverse  → 200 但 country/city 为空（其 catch 吞掉上游错误后返回空值）
   /api/health       → 200
   ```
   三个接口在本次改动前就存在且未被修改；判定为部署实例的出网问题。
   对本轮交付的影响：探索页气温显示降级为「西湖 · 实时」，页面其余功能不受影响
   （搜索是本地数据，不走该接口）。

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

---

## 9. 实机测量（2026-10-20）

无头 + SwiftShader 只能回答"渲染得对不对"，不回答"跑起来怎么样"。
所以用真实 GPU 的非无头浏览器跑线上站点（430×900 窗口，`outputs/real-device-check.mjs`）。

环境：`ANGLE (NVIDIA GeForce GTX 1650 Ti, Direct3D11)`

| 指标 | 实测值 |
|---|---|
| 空闲平均帧时间 | **16.8 ms（59.4 fps）** |
| p95 帧时间 | 16.9 ms |
| 最差单帧 | 50 ms（进入场景后一次） |
| 探索页到可交互 | **4.1 s**（冷启动，含 1.3 MB Three.js 与 3 张地球贴图） |
| 绘制调用 | **173** |
| 三角面 | 239,520 |
| 几何体 / 纹理 / 着色器程序 | 173 / 7 / 15 |
| JS 堆 | 12.8 MB |
| 卡片照片 | 6 / 6 加载完成 |

### 9.1 一处必须更正的旧数字

`EXPLORE3D-PLAN.md` §6 记录的是"37 draw call / 158,820 三角面"。
那是早期场景状态的测量值；此后加入了湖岸建筑环、游船尾流、飞鸟与桃花树，
**当前实测为 173 draw call / 239,520 三角面**。以本节为准。

### 9.2 下一步的性能动作（有明确收益）

173 次绘制里，大部分来自地标：雷峰塔约 20 个独立网格、断桥约 40 个石块、
三潭印月 3×8、四座厅堂各 2。它们材质相同、位置静态，**应该合并**：

- 按材质合并静态地标 → 预计 173 → 约 45 draw call；
- 树木/建筑已是 InstancedMesh，保持；
- 合并不改变画面，只减少提交次数，是手机上最值钱的一项。

---

## 10. 等待时间（2026-10-20 第二轮）

### 10.1 点开「探索」的等待从数秒降到个位数毫秒

根因：探索页的 iframe 带着 `loading="lazy"`，所以在按下「探索」之前
**一个字节都没有下载**，1.3 MB 的 Three.js 与建场全部发生在点击之后。

改为：首页可交互后，在浏览器空闲时加载该文档并建场；场景在显示前保持暂停。

| 场景 | 改前 | 改后 |
|---|---|---|
| 点「探索」→ 可交互（本机） | 3.1–5.2 s | **172 ms**（首次）／108 ms |
| 点「探索」→ 可交互（线上） | 4.1 s | **4–7 ms**（预热后） |
| 再次进入探索 | 重建 | **3 ms** |

场景自身的构建耗时（性能标记实测）：`boot=15ms · lake=252ms · first-frame=900ms`。

### 10.2 两个 Service Worker 缺陷（都已修）

1. **我引入的**：给预缓存列表加条目时漏了一个逗号，`sw.js` 求值失败，
   Worker 完全无法安装。所有既有检查都通过了——因为它们验证的是"列表里的 URL 能访问"，
   而不是"这个文件能不能跑"。
2. **既有的**：`cache.addAll()` 是原子的，48 个文件共 13.4 MB，任何一个失败或超时
   就会丢弃整个安装。实测线上**从未安装成功过**（缓存名存在但注册被移除）。

修法：
- 新增 `scripts/check-syntax.mjs`，构建前解析所有将被发布的脚本，失败即中止；
- 安装改为逐文件 `cache.add` + `allSettled`，单个失败不再连坐；
- 三个 7.5 MB 装饰性背景图移出安装路径，改由运行时按需缓存：安装体积 13.4 MB → 2.8 MB。

线上复核：`active: "activated"`，`navigator.serviceWorker.controller === true`，
二次访问点「探索」**4 ms** 就绪。

### 10.3 仍未解决的一项

冷启动首次安装时，48 个文件里实际缓存成功 19 个（免费实例并发 48 个请求被限流）。
由于安装不再失败，其余文件会在首次实际请求时由 fetch 处理器补进缓存，
但这意味着"第一次离线"并不完整。若要彻底解决，应把安装改成小批并发（每批 4–6 个）。

---

## 11. 切换流畅度（2026-10-20 第三轮）

在真实 GPU（GTX 1650 Ti / ANGLE D3D11）上逐次切换，采样每次切换后 450 ms 的帧间隔：

| 切换 | 平均帧 | p95 | 长帧(>32ms) |
|---|---|---|---|
| 首次 → 探索 | 161 ms | 400 ms | 2 |
| 探索 → 首页 | **16.7 ms** | 16.9 ms | **0** |
| → 聊天 | 17.3 ms | 16.9 ms | 1 |
| → 旅友 | 16.6 ms | 17.0 ms | 0 |
| → 我的 | 16.7 ms | 17.1 ms | 0 |
| → 探索（第二次） | **16.7 ms** | 16.9 ms | **0** |
| → 首页 | **16.7 ms** | 16.9 ms | **0** |

### 11.1 已修的一项

探索页原本用 `display:none` 藏起来，iframe 内部视口是 0×0，画布要等显示那一刻才分配。
改成 `visibility:hidden`（保持占位与布局）后：
**探索 → 首页 从 466 ms 长帧降到 16.7 ms、0 长帧**。

### 11.2 仍未解决的一项（如实记录）

**首次**进入探索仍有约 400 ms 的一次性卡顿，第二次起完全消失。
已排除的假设（逐个实测，均无改善，改动已回滚）：

- 画布 CSS `filter: saturate/contrast` 与 10 处 `backdrop-filter`：禁用后不变；
- 隐藏 `.app` 造成的整页重绘：去掉该规则后不变；
- 着色器首次编译：加了隐藏期 `renderer.compile()` 预热后不变；
- 卡片照片首次解码：改为预热期 `decode()`（该补丁未生效，因此未验证）。

结论：这是一次性合成/光栅化代价，尚未定位到具体环节。
影响面：只在"当天第一次点探索"时出现一次，之后所有切换稳定 60 fps。
