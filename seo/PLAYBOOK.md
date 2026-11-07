# 乐哲软件 · 每日优化手册（供自动化任务按序执行）

原则：**每天只做 1–2 件有数据依据的事**，做完必须过质检再推送。不做无依据的批量改动。

## 第一步：体检

```bash
node seo/audit.mjs               # 结构性 BUG 体检（每日必跑，见下方「第零步」）
node seo/optimize.mjs            # 人读报告 + 优先级建议
node seo/optimize.mjs --json     # 机器读，便于取数
node seo/qa.mjs                  # 硬性红线：重复/短描述/乱码/死链
```

`priorities` 数组即当日候选清单，按 P1 → P3 取最上面的一到两项。

## 第零步：BUG 体检（2026-10-31 新增，每日必跑）

`qa.mjs` 只管内容红线，`audit.mjs` 管结构性 BUG，两者互补、都要跑：

```bash
node seo/audit.mjs          # 有 BLOCKER 时 exit 2
node seo/audit.mjs --json   # 自动化取数用
node seo/site-check.mjs     # 逐板块静态体检（2026-11-06 新增，图片存在性/img alt/内联脚本语法）
node seo/live-assets.mjs    # 线上图片探活（2026-11-06 新增，抓「本地有、线上 404」的远程漂移）
node seo/nav-race.mjs       # 启动期导航竞态（2026-11-06 新增，骨架屏期间点板块不能被弹回首页；需线上已部署本次改动）
node seo/firstpaint.mjs     # 首屏耗时 + 取数降级（2026-11-06 新增，改加载链路时必跑）
```

`site-check.mjs` 与 `audit.mjs` 的分工：audit 偏「结构与 SEO 规则」，site-check 偏「页面上真的能不能用」——
它逐板块（站点页 / 分类页 / 软件详情 / 教程 / AI 工具集 / AI 详情）统计页面·图片·内链数，并抓：
`<img>` 指向的本地文件不存在、img 缺 alt、canonical 与路径不匹配、H1 数量异常、JSON-LD 解析失败、
内联 `<script>` 语法错误（VIP 页曾因多一个 `}` 整段脚本不执行，页面看着正常但功能全废）、U+FFFD 乱码。
exit 2 = 有 BLOCKER。

`live-assets.mjs` 补的是另一类盲区：**本地磁盘一切正常，线上却 404**（api-push 漏文件、CI 删文件都算）。
它把 `tutorial/cover/` 与 `assets/ai-logos/` 逐个 HEAD 线上，非 200 就报，并提示用 api-push 补推。

检查项：站内资源 404（img/script/link/poster）、canonical 是否自引用、H1 数量、
JSON-LD 语法、og:image 缺失、工具页是否 noindex、页脚品牌回链、sitemap 与磁盘页面双向一致、
sitemap lastmod 覆盖率、robots.txt 的 Sitemap 声明、首页 /cat/ 静态链接数、sw.js 注册状态。

判定：**BLOCKER 当天必修**，修不了要写明原因；WARN 记入待办池择期处理。

检查方法注意（2026-10-31 教训）：**FFFD/内容类检查必须先把页面落盘再读**，
不要 `curl … | node` 直接查管道——分块边界会把多字节中文字符切断，产生 U+FFFD 假阳性
（实测同页面落盘查为 0，管道查为 1）。死链/乱码以外的一致性断言同理。

数据写入权限（2026-11-02 实测）：`tutorials` 表 anon key 可 INSERT/PATCH；`software` 表 **只能 SELECT**——PATCH 返回 204 但 `Prefer: return=representation` 回 `[]`（RLS 过滤，0 行受影响）。
所以软件名/分类/描述的修正只能走 `generate.mjs` 的 `NAME_OVERRIDES` / `CATEGORY_OVERRIDES` / `DESC_OVERRIDES`，
单次读取也别直接信：传输层会随机插 U+FFFD（同一记录连读两次坏在不同位置），判断数据好坏必须看生成器 5 轮合并后的结果。

**乱码自检的覆盖范围（2026-11-06 修复的 BUG）**：`generate.mjs` 末尾自检原先只扫 `soft/ cat/ tutorial/` 与根目录，
`ai/` 和 `ai/tool/` 不在扫描列表里 —— 结果 AI 工具详情页出现 U+FFFD 时，生成器照样打印「产物自检通过」，
而 `qa.mjs` 报 fffdCount=1，两者自相矛盾、且不会触发 exit 2 重跑。现已把 `ai` 纳入扫描。
**结论：只要 qa 报 fffd>0 而生成器说通过，第一反应就是查自检的扫描目录覆盖。**

**母本（DATA_MASTERS）覆盖现状（2026-11-06）**：11 篇教程的 content 全部已登记母本（含建站期三篇 `7aa79aaa` / `91e1887a` / `ca626bf2`），
`software` 表另有 `d05e874d`（Windows 11）与 `ba652643`（693 字长描述）两条 desc 母本。
新增长教程后必须同时落 `content-master-<id前8位>.txt` 并登记，否则会出现「同一数据两次生成 md5 不同」（非幂等）。
取干净母本的办法：`?select=<字段>,id&id=eq.<id>` 单字段小响应，通常一次就干净；若反复坏，换 `?select=id,<字段>` 顺序绕开坏响应缓存。

**教程选题来源（2026-11-06 起）：`seo/XHS-PLAN.md`**
站内教程与小红书「乐哲软件库」共用一份排期表：每天一行 = 小红书笔记标题 + 类型 + 站内教程选题软件 + 教程标题预设 + 状态。
- 选题看 `node seo/tutorial-pick.mjs` 输出里的 `xhs_sync`：有值就写它指定的那款（同题同方向）；为 null 才按 `candidates` 常规挑。
- 写完必须回写该行 `已写 YYYY-MM-DD · <教程id前8位>`，同一行不得写第二篇。
- 排期用尽（剩余待写 <7 行）按表内「7 天方向轮换模板」续排 7 行；软件从「方向软件池」取同方向且未覆盖的。
- 口径与小红书一致：只写正常安装/使用/优化/卸载/免费替代，**不写激活、破解、绕过正版验证、去广告版获取、站外导流**。

已知豁免（不算 BUG，不要「修」）：
- `all.html`：有意的跳转存根（noindex + JS 跳 sitemap.html），canonical 指向 sitemap.html
- `admin/manager/submanager.html`：后台 SPA，视图内是 h2，noindex，不补隐藏 h1
- `baidu_verify_*.html` / `googleda*.html`：纯文本校验文件，不能加 head 标签
- `sitemap.html` 描述 96 字、`preview/text1/vip` 属工具页：短描述/无 H1 可接受

## 第二步：按问题类型执行（对应改法）

| 体检项 | 判定 | 改哪里 | 做法要点 |
|---|---|---|---|
| `content.thinCount` | 正文 <300 字 | `seo/render.js` 对应 render 函数 | 用真实数据拼导语（数量/最新条目/平台），禁止套同一段模板，否则 15 个分类页互相重复 |
| `links.orphanCount` / `lowInboundCount` | 入链 <3 | 分类页列表 + 相关推荐 | 优先在分类页补充；不要让每个页面都加一堆全站链接 |
| `technical.notInSitemapCount` | 可索引但不在 sitemap | `renderSitemapXml` | 确认该页确实应索引，否则改 noindex |
| `meta.longTitleCount` | 可见字符 >60 | `renderSoftPage` 的标题拼装 | 先舍版本号、再按词边界截软件名；用 `visLen` 计可见字符（实体算 1） |
| `technical.noSchemaCount` | 缺 JSON-LD | 对应 render 函数 | 软件页 SoftwareApplication、分类页 CollectionPage+ItemList、教程页 Article，均带 BreadcrumbList |
| `meta.h1NotOne` | H1≠1 | 模板 | 分类页 H1 用「X下载大全」，H2 用「X列表（N 款）」，避免「软件软件」重复 |
| `technical.imgMissingAltPages` | 图片缺 alt | 模板 | 内容图写描述性 alt，装饰图保留 `alt=""` |

## AI 工具集「保存即上屏」机制（2026-11-03 上线，commit f67cfbe2）

后台保存 AI 工具/工具集后，前端不用再等静态生成：

- **前端实时层**：`seo/ai-live.js`（构建时复制为 `ai/live.js`）在 /ai/ 页面加载后拉一次库，与页面快照 `window.__AI_LIVE__`（含结构指纹 sig、已生成详情页清单 pages/tools）比对；一致就跳过（sessionStorage 记录后同会话零请求），不一致才重绘侧栏/分区/卡片/对比表。**新增工具立刻出现**；其详情页未生成前，卡片点击走页内浮层（aiLiveModal），避免 404。
- **自动重建**：后台保存/删除后会自动 dispatch `ai-sync.yml`（需在「同步到前端」里配过一次 token；未配则跳过，仅实时层生效），详情静态页约 1 分钟到位；另有每 5 分钟的 auto-sync 守卫兜底。
- **红线**：①指纹只认结构字段（id/slug/sort/is_published/pricing），`aiSig()`（Node）与 `sig()`（浏览器）必须同步改，否则永远判「变了」；②列表查询**不许加 intro/screenshots 长文本字段**——代理对长文本会间歇性截断出 U+FFFD，且坏响应会被缓存（加 `_cb=` 自定义参数会被 400，不能穿透）；脏数据一律不上屏（详情页按需单行取 intro，脏则跳过）；③AI 页 meta 描述一律走 `fitDesc()`（垫句循环补齐到 ≥100 字）。
- **图标红线**（2026-11-06 报障修复）：卡片图标取值只有一条规则——`logo` 是 http 链接就用图，否则把 `icon` 里的 http 链接当图（后台旧版本会把图床链接存进 icon）。规则必须同时存在于 `seo/ai-section.mjs` 的 `picUrlOf()` 与 `seo/ai-live.js` 的 `picUrl()`；只改一处就会出现「静态页有图、库里一有新工具触发重绘就变字母」。
- **图标自托管**：构建时把图床图下载到 `assets/ai-logos/`，文件名 = URL 的 md5 前 10 位（URL 不变则文件名不变，保证幂等）；页面输出同源相对路径，`LIVE_CFG.logos` 把 id→本地图映射传给前端，实时重绘也走站内图。下载失败保留外链，不阻断生成。
- **加载兜底**：`aiImgErr()` 先换一个新 `<img>` 带 `?r=` 重试一次（同一张图会重复触发 error，用 `data-retrying` 忽略，否则第二次 error 直接降级）；仍失败才换成字母封面。兜底脚本必须注入 `<head>`，晚于卡片解析会 ReferenceError 留破图。
- **回归断言**：`node seo/.logo-regress.mjs`（本地脚本，需先起 8931 静态服务）——模拟「库里多一个工具触发实时重绘」与「图片首次请求失败」两种场景，断言有图工具（含蛙蛙写作）必须渲染为 `<img>`。
- 空工具集占位页有固定导语模板（防薄内容 <300 字），改文案时别删。

## 第三步：固定红线（任何改动都不能破）

- `seo/qa.mjs`：重复标题 0、重复描述 0、短描述 0、FFFD 0、死链 0
- 描述长度 100–165 字，裁切走 `clip()`（按标点边界），**不要硬 slice**
- 标题 ≤60 可见字符
- 首页 `#categoryList` 必须是带 `/cat/` 真实链接的 `<a>`（生成器自动重建，勿手改）
- 全站页脚保留「乐哲软件官网」回链首页
- 工具页（vip / sitemap / copyright / preview / query / text1 / admin / manager / submanager）保持 noindex
- 动模板前先看 `.workbuddy/memory/` 当日记录，避免重复做已完成的事

## 安全（发布前门禁，2026-11-06 新增）

**每天发之前必须先跑**：`node seo/security-check.mjs --scan`，exit 2 = 有 BLOCKER，**修完才能推送/发布**，不许先发后修。

三道防线（已实现，别拆）：

1. **正文消毒** `render.js → sanitizeHtml()`：教程 `content` 是要按 HTML 输出的，库里的内容却不可信（见下）。消毒去注释、整段删 `<script>/<style>`（连内容）、删 `iframe/object/embed/svg/form` 等危险标签、删 `on*= / srcdoc`、拦 `style` 里的 `expression()/url(javascript:)`、`href/src` 走协议白名单。
2. **JSON-LD 转义** `render.js → jsonLd()`：原来直接 `JSON.stringify()` 塞进 `<script>`，标题里写 `</script><script>…` 就能闭合标签执行脚本。现在 `< > &` 与 U+2028/2029 全部转成 `\uXXXX`（JSON 合法，Google/Bing 照常解析）。
3. **自检脚本**：构造恶意正文/标题渲染一遍，断言脚本数量不增加、正文区无可执行构造；再扫全站产物找 `onerror=/javascript:/外链 iframe`。

**已知未根治风险：`tutorials` 表对公开 anon key 开放写权限**
2026-11-06 实测：`PATCH tutorials?id=eq.<真实id>` + `Prefer:return=representation` 返回 1 行 = **匿名可改**；`software / ai_tools / ai_collections` 同法返回 0 行 = 已被 RLS 挡住。anon key 写在 index.html 里人人可见，所以「库里的内容可信」这个前提不成立 → 渲染层消毒是兜底，不是根治。

根治办法（需要 `service_role` key，只有你能从 Supabase 控制台取）：
1. Supabase → Project Settings → API → 复制 `service_role` key，存到 `seo/supabase-service-key.txt`（已在 .gitignore，不会推上仓库）。
2. 把写库的脚本改成用 service key（B1 插入教程、`ensureCovers()` 回写 cover、后台管理写操作）。
3. 然后在 SQL Editor 执行，把 anon 收紧成只读：
   ```sql
   -- 先看现有策略，确认要删的名字
   select policyname, cmd, roles from pg_policies where tablename = 'tutorials';
   -- 删掉匿名写策略（名字以实际为准），只留 select
   drop policy if exists "<匿名写策略名>" on public.tutorials;
   create policy "tutorials_public_read" on public.tutorials for select using (true);
   ```
4. 改完跑 `node seo/security-check.mjs`：`tutorials: anon 可写 ⚠` 应变成 `只读 ✓`；再跑一次 B1 写入流程确认服务端写入正常。
5. 期间**不要**只把策略改成 insert-only：每日任务的封面回写走的是 PATCH，会立刻失败。

## SEO：品牌词搜「乐哲软件」为什么首页不出现（2026-11-06 排查）

现象：Bing 搜「乐哲软件」，第 1 位是 `/ai/index.html`、第 2 位是 `/cat/shiyong-gongju.html`，**首页 `/` 不进前 10**。

根因（已修）：`index.html` 顶部「深度链接 canonical 同步」脚本里主机名写死
`location.hostname!=='lezhesoft.cn'` —— 站点实际跑在 `www.` 子域上，判断恒为真直接 `return`，
于是所有 `?soft=` / `?cat=` 深链的 canonical 都退化成默认的首页，**几千个重复变体全指回 `/`**，
Bing 眼里首页被稀释，品牌词入口落到内容干净的 AI 栏页上。
修法：改成 `!/(^|\.)lezhesoft\.cn$/.test(location.hostname)`（`preview.html`、`seo/patch-index.mjs` 同步改）。
验证：Playwright 打开 `/?soft=<id>`、`/?cat=<slug>`，读 `link[rel=canonical]`，应分别指向
`/soft/<id>.html`、`/cat/<slug>.html`，首页 `/` 指向自身。

同批改动：
- 首页 `<title>` 收敛为 `乐哲软件官网 - 软件下载与安装教程`（原来 4 段堆关键词，品牌词匹配反被摊薄）。
- 首页 h1 下方补一句「乐哲软件官网 · 精选高效工具…」，给首屏正文一个品牌话术。
- `/ai/index.html` 补 `BreadcrumbList`（乐哲软件官网 → AI 工具集），明确它是子栏目不是站点入口。

搜完别指望立刻变：Bing 重排要重抓（小时级~数天），每次改完照常
`node seo/indexnow-push.mjs --force <url>` + `node seo/bing-push.mjs` 催一次。

## 启动期导航竞态：「骨架屏期间点板块又被弹回首页」（2026-11-06）

现象：冷启动首页等数据时是骨架屏（实测 13 张卡片，冷网 2.5~4s）；此时点「教程 / 问答 / 排行榜」，
页面先正常切过去，数据一到又被弹回首页。

根因：`App.init()` 里的启动收尾是

```js
DB.loadAll(...).then(() => {
  refreshAll();
  _idle(() => {                     // requestIdleCallback —— 时机不确定
    renderTutorials(); renderQuestions();
    if (!handleUrlParams()) App.goHome();   // ← 无条件抢回首页
  });
});
```

`handleUrlParams()` 只在 URL 带 `?soft=`/`?cat=`/`page=` 时返回 true，其余一律 `goHome()`。
于是「用户在这 2~4 秒里点的任何页面」都会被这行代码覆盖。加重因素：`_idle` 是
`requestIdleCallback`，主线程一忙就往后拖，反而更容易在用户操作之后才执行。

修法（零依赖，用成熟路由库的通用模式，不引库）：
1. 加一个单调递增的导航令牌 `_navSeq`：`goHome/goList/goTutorials/goQA/goCheckin/goRanking/
   goMall/goProfile/goMyRedeems/doSearch` 在**用户主动跳转**时 `_bumpNav()`；
   `isPop=true`（深链、popstate 回放）不递增；`popstate` 本身递增。
2. 启动收尾先比对令牌：`if (_navStale(_bootSeq)) return;` —— 用户已经点走了就只补数据、不改当前页；
   无干扰时才 `handleUrlParams() || goHome(true)`（传 true 顺便避免重新写 history）。
3. `?soft=` / `#software/` 那条 200ms 后再 `Detail.open()` 的延时也纳入令牌，防止详情浮层压到用户已切走的页面上。

### 为什么是「借模式」而不是「引库」

按「先找成熟实现、不自己发明」的原则查了同领域项目（星数/许可/最近推送为 2026-11-06 实测）：

| 项目 | 星 | 许可 | 最近推送 | 定位 | 结论 |
|---|---|---|---|---|---|
| remix-run/react-router | 56.6k | MIT | 2026-11-05 | React 数据路由 | 范式来源：每次导航用 AbortController abort 上一笔 |
| barbajs/barba | 13.0k | MIT | 2024-12-02 | MPA 页面过渡 | 不适用（本站不是多页 HTML 切换） |
| visionmedia/page.js | 7.7k | 仓库无 LICENSE 文件 | 2023-06-27 | History/hash 路由 | 不引入：3 年停更 + 许可文件缺失；借鉴其 `page.stop()`「停掉未完成跳转」 |
| hotwired/turbo | 7.4k | MIT | 2026-10-30 | MPA 整页替换 | 不适用：需服务端渲染/整页 HTML 交换 |
| instantpage/instant.page | 6.2k | MIT | 2026-09-29 | 悬停预取 | 与本站 SPA 内跳无关，后续可评估 |
| swup/swup | 5.3k | MIT | 2026-11-03 | MPA 过渡 | 不适用 |
| krasimir/navigo | 2.8k | MIT | 2023-08-04 | hash 路由 | 不引入：停更 3 年；其 `resolve()` 取消语义与令牌同构 |

结论：本站是**手写 SPA**（5000+ 行内联脚本、页面切换全是 `goXxx()` 直接改 DOM），接一个路由库
等于重写全部跳转与深链逻辑，风险远大于收益；但「过期导航不得提交 UI」这条被上述库反复验证，
用 6 行令牌实现即可。**不复制任何第三方代码，只借设计。**

### 回归脚本

```bash
node seo/nav-race.mjs                # 打线上（含 CDP 限速，把骨架屏窗口拉到 4s 级）
node seo/nav-race.mjs --local-html   # 上线前用本地 index.html 顶替线上文档做 A/B
```

断言：骨架屏期间点「教程」→ 9 秒后仍停在教程页；教程页点「首页」能回；`?cat=` 深链仍生效。
**上线前必须 PASS**（旧代码实测在这条断言上 FAIL，可用来验证脚本本身没空跑）。

### 顺带修的加载问题

`<link rel="preconnect">` 一直指向 `qqcxtfayjxyvswblmdpw.supabase.co`，而线上实际请求的是
`lezhesoft-...ap-shanghai.app.tcloudbase.com/supabase-proxy` —— 预连接打在一个根本不会访问的主机上，
真正要 TLS 握手的域反而没有提示。已改为实际主机，冷启动少一次握手等待。

**注意**：HTML 走 Cloudflare，`Cache-Control: max-age=600`，发布后最长约 10 分钟才全网可见；
验证线上是否生效要先比对 `last-modified` / 文件大小，别把 CDN 缓存当成「没推上去」。

## 教程封面全 404 的事故复盘（2026-11-06）

现象：教程模块所有封面变空白，线上 `/tutorial/cover/*.png` 一律 404，页面本身 200。

根因两条，叠在一起才致命：
1. **CI 删图**：`ai-sync.yml` 每 5 分钟在 ubuntu runner 跑 `generate.mjs`，它 `rm -rf tutorial/`（含 `cover/`），
   而 `ensureCovers()` 画封面要用 Edge/Chrome —— runner 上没有（`findBrowser()` 只找 Windows 路径），
   于是「没浏览器 → 跳过生成」，随后 `git add -A` 把「封面全没了」提交上去。
2. **推送脚本漏文件**：本地 git 比远程领先几百个提交（git push 被墙，只能走 `api-push.mjs`），
   而它只按 `git status` 的变更清单发文件 —— 那些「早就 commit 过、但从没上传」的文件永远发不出去，
   于是 5 张封面本地有、远程从来没有。

修法：
- `generate.mjs` 清目录时 **`tutorial/` 只删 `*.html`，保留 `cover/`**；
- `api-push.mjs` 新增「补推本地已提交、远程缺失」步骤（`git ls-files` 与远程 tree 做差集），
  顺带把长期漂移的隐患一起堵上；
- 恢复 11 张封面并逐张验证 200。

教训：**图片 404 这类问题以前的体检项全查不出来**（qa 只查 `<a>` 死链，不查 `<img>`）。现已新增
`node seo/site-check.mjs`：逐板块扫标题/描述/canonical/H1/图片存在性/img alt/内链/JSON-LD/乱码/内联脚本语法，
exit 2 = 有 BLOCKER。**每天发之前和 security-check 一起跑。**

## 已知问题（非阻塞，记录备查）

- **首页 WebSocket 连不上**：`wss://…tcloudbase.com/supabase-proxy/realtime/…` 握手失败。
  CloudBase 代理不支持 WebSocket 升级，所以 Supabase realtime 在线上从来没通过。影响只有两处：
  站内通知实时推送、在线人数 presence；内容本身走 REST，页面数据（127 张卡片/25 条热门）正常。
  要修得改成轮询（例如 60s + 页面可见时刷新）或让 realtime 直连 Supabase 域名（国内可能被墙）。未改。
- **sw.js 无人注册**：自注销版本，留着无害，也可删。
- **tutorials 表 anon 可写**：见上「安全」段，需要 service_role key 才能真正收紧。

## 首屏提速：静态快照 data/software.json（2026-11-06）

### 改之前实测到的瓶颈

| 环节 | 实测 |
|---|---|
| 首页 HTML 首字节（CDN） | 0.28s 暖 / 0.89s 冷 |
| Supabase 查询（经 CloudBase 代理） | **1.42s TTFB**，179KB / gzip 57KB |
| 冷启动骨架屏总时长 | **2.48s**（不限速）；代理偶发 `502 Bad Gateway / timeout` |

四段是**串行**的：HTML → 解析 → init supabase-js → 才发查询。最后一段纯等待，无法与前一段并行，
而它恰恰是最慢的一段。

### 做法

`generate.mjs` 顺带把同一批数据（`select('*')` 全字段，与 REST 完全同形状）写成
`data/software.json`，于是它和 HTML 同源同 CDN，浏览器解析 HTML 时就能并行取到：

```html
<link rel="preload" as="fetch" href="/data/software.json" crossorigin="anonymous">
<script>window.__SNAP__=fetch('/data/software.json').catch(function(){return null;});</script>
```

`DB.loadAll()` 变成三级降级，任何一级挂了都不白屏：

1. `data/software.json`（同源 CDN）→ 新访客走这里
2. Supabase REST（原路径 `fetchFromRest()`）→ 快照没生成 / 被 CDN 挡掉时兜底
3. localStorage 上次结果（10 分钟内）→ 断网兜底

回访用户仍是「先用本地缓存秒开、再拿快照校准」，这条以前就有（`App.init` 里 `getCachedData(true)`），
没有改动。

### 快照生成的三道保护（宁可保留上一版，也不写坏文件）

1. 记录数 < 50（正常 159）视为抓取残缺 → 跳过，保留上一版；
2. 内容含 U+FFFD 乱码 → 跳过（渲染乱码比数据旧更糟）；
3. 先写 `.software.json.tmp` 再 `rename`，中断不会留下半截 JSON。

### 两个踩过的坑

- **preload 白预加载**：`<link rel=preload as=fetch crossorigin>` 的凭据模式是 `same-origin`，
  而 `fetch(url,{credentials:'omit'})` 是 `omit`，Chrome 判定「credentials mode 不匹配」直接丢弃 preload，
  控制台报 *A preload ... is found, but is not used*。fetch 不要显式写 credentials，同源默认就是 `same-origin`。
- **别在 loadAll 里自动打 REST 对账**：站内有个 5 分钟轮询器（`_poll` → `loadAll(true)`）和一个
  `visibilitychange` 触发点，如果 `force` 时就补一发 REST，等于每 5 分钟白等 1.4s 代理 + 全量重渲。
  时效改由快照的 `cache:'no-cache'` 条件请求保证：内容没变是 304（几十字节），变了才回 200 全量。

### 代价（2026-11-06 当天已补掉「改完要等 5 分钟」）

快照方案的固有代价是：后台改完 → CI 每 5 分钟重建 → 用户下次取数才有新版本，最坏滞后一个 CI 周期。
当天补了一层 **rev（后台数据版本戳）**，把「后台改完、前台刷新即见」做回来了：

1. `admin.html` 每次写库成功（软件增/删/改/批量、分类增/删/改名）调 `bumpDataRev()`：
   - `localStorage.lezhe_data_rev = Date.now()`
   - `BroadcastChannel('lezhe-sync')` 广播 `data-rev`
   - 顺手节流（60s）触发一次 workflow，让别的设备/访客也能在 ~3 分钟内看到
2. `index.html` 的 `loadAll` 拿快照后比较 `rev` 与 `snap.build`：`rev > build` 说明「后台改过、这版快照还没跟上」，
   直接改查 Supabase 实时数据（`fetchFromRest`），绕开整条 CI。
3. 同标签页用 `sessionStorage.lezhe_data_rev_synced` 记住已同步到哪个 rev，改完第一次刷新走实时，
   之后回到快照快路径 —— 不会每次都白等 1.4s 代理。

`data/software.json` 的 `build` 由 `generate.mjs` 写入，**内容没变就沿用上一版 build**，
否则每 5 分钟生成都会产生 diff、白提交一个 commit（这点和幂等门禁是同一条红线）。

实测证据（`seo/freshness.mjs`，本地文件 + 正式域名身份）：

| 场景 | 结果 |
| --- | --- |
| 没有 rev（普通访客） | 走静态快照，REST 请求 **0** 次 |
| rev 比 build 新（后台刚改） | 判定「后台有更新」，REST 请求 2 次（software + categories），卡片正常 |
| 已打开页面收到 data-rev 广播 | 自动重取（REST 1 次），无需手动刷新，列表不坏 |

**为什么不做「发布后清 CDN」**：本机 Cloudflare Token 只有读权限，`purge_cache` 直接 401；
且 `data/software.json` / HTML 都是 `Cache-Control: max-age=600`、`cf-cache-status: DYNAMIC`，
瓶颈根本不在 CDN 边缘，而在「CI 什么时候重新生成」。所以走的是「前台改数据源」而不是「清缓存」。

**仍然存在的边界（要知道，别误判）**：
- 只对**同一个浏览器**立刻生效。换设备（比如电脑改、手机看）靠保存后自动 dispatch 的 CI，约 3 分钟。
- 教程/软件详情这类**静态 HTML** 不在这条链上，仍需 CI 重建，约 1~3 分钟。
- 老访客浏览器里还是旧 HTML（`max-age=600`），要等一次缓存过期或硬刷，才能拿到带 rev 判定的新版。

### 回归

```bash
node seo/freshness.mjs --local . --no-throttle             # 本地：三种场景全过才算数
node seo/freshness.mjs                                     # 线上：部署后复验
node seo/firstpaint.mjs                                   # 线上：断言走快照 + 详情字段完整
node seo/firstpaint.mjs --no-snapshot                     # 拦掉 JSON：断言自动回落 REST 且不白屏
```

`freshness.mjs` 的 `--local` 是**用 `ctx.route` 把正式域名的请求原地映射到磁盘**，不是起本地服务器 +
host-resolver。原因：本机开着系统代理，Chrome 会把 `www.lezhesoft.cn` 交给代理，host-resolver 直接失效
（报 `ERR_PROXY_CONNECTION_FAILED`）；而且站点开了 Always Use HTTPS，route 若只写 `http://` 前缀，
请求 301 之后就不再被拦截，会悄悄打到真实线上，测出来的其实是旧版（这个坑实际踩过：`build` 一直读到 0）。

本地必须用正式域名：页面里的 `IS_LOCAL_PREVIEW` 会把 localhost/127.0.0.1 判成本地预览，
直接跳过快照与 REST，永远空数据。

`audit.mjs` 已加护栏：`data/software.json` 缺失/不可解析/条数异常/**缺 build**，或 `index.html` 里
`fetchSnapshot`/`fetchFromRest`/`revIsNewer`/`lezhe-sync` 广播被删、`admin.html` 的 `bumpDataRev`
调用少于 6 处（说明有写操作漏接），都直接 BLOCKER。`live-assets.mjs` 也把快照纳入线上探活
（它 404 时页面不报错，只静默退回 REST，属于最难自己发现的退化）。

## 第四步：发布与提交

0. `node seo/security-check.mjs --scan` 必须 exit 0（BLOCKER 0）才允许进入下面的发布动作
1. `node seo/generate.mjs` → `node seo/qa.mjs` → `node seo/audit.mjs` → `node seo/optimize.mjs`（对比修改前后数字）
2. `T=$(printf "protocol=https\nhost=github.com\n\n" | git credential fill | grep "^password=" | cut -d= -f2- | tr -d "\r\n") && GH_TOKEN="$T" node seo/api-push.mjs "提交信息"`（本地 push 被墙 502，必须走 API 脚本；清单自动来自 git status -uall，会话数据目录自动排除）
3. 等 40s 后 curl 验证：sitemap loc 数、抽查 2 个改过的页面 200、抽查改动点已生效
4. IndexNow 提交本次有实质变更的 URL
5. `node seo/baidu-push.mjs`：百度配额 10 条/天，脚本自动按优先级续推，remain=0 即停

## 待办池（按投入产出排序，做完即划掉）

- [x] 标题超 60 字压缩（2026-10-29，32→0）
- [x] 分类页补 CollectionPage/ItemList 结构化数据（2026-10-29）
- [x] 分类页导语（解决 11 页薄内容，11→1）（2026-10-29）
- [x] 59 个软件页入链 <3：在分类页/相关推荐增加交叉链接（2026-10-31 完成，59→1；做法：同分类相关推荐改「按热度排序 + 环形轮转取 8 条」，每页链接数不变但分布均匀，剩余 1 页为 admin.html 误报类页面）
- [x] AI 工具集页内容偏薄（2026-11-03 完成，3 页 <300 字 → 0）：工具集 description 后台留空，分类页原来只有卡片、纯文字 159/168 字。改法：`ai-section.mjs` 新增 `buildCompare()`，按真实数据输出「工具 / 定位 / 收费模式」对比表 + 按款数与收费分布生成的挑选提示（不搬详情页 intro，避免正文重复）；`fitDesc()` 把描述补齐到 100 字以上；`renderAiHub()` 每节加一行 `secLead`（款数 + 名单 + 收费模式）。现 index 283→543、ai-xiezuo 168→494、photo 159→431，shortDesc 2→0。**注意**：`fitDesc` 是描述长度红线的兜底，AI 页改文案时必须走它，别直接拼字符串。
  - **2026-11-04 回归修复**：新工具集上线后 thinCount 回升到 3（ai/index 178、ai-bangong 289、ai-shiping 295）——工作区的 ai-section.mjs 丢了 hub 的 secLead 富化（该文件只 staged 未提交，无历史可 diff），且两个**空工具集**占位导语 289/295 字刚好差一点过 300 阈值。已重写 hub 的 `secLead()` + hub 导语（真实款数/收费分布），空集占位段补「收录标准」一句。thinCount 3→0。**今后 AI 工具集增删后必须复跑 `node seo/optimize.mjs` 看 thinCount**。
- [ ] 教程页仅 3 篇：内容增量优先级最高（百度/必应都吃内容量）——已转为每日自动化新增 1 篇（2026-10-30 起，现 11 篇）
- [ ] 软件页正文深度：目前中位数 548 字，可补「最低配置/适用场景/常见问题」结构化段落（2026-10-30 已修复最后一个薄页 Keka，薄内容 1→0；optimize.mjs 标题统计已改为按解码后可见字符计数，&amp; 不再误报超长）
- [x] 同步守卫指纹不稳（2026-11-06 修复）：`auto-sync.mjs` 原来直接对「整表 JSON」做 md5，而代理传输会把汉字随机截成 U+FFFD（同一份未改动的数据连读 3 次，ai_tools 出 2 个不同哈希、tutorials 出 3 个不同哈希）→ 守卫几乎每小时都判「变了」，白跑一次生成+推送。改法：①单表读 3 次按行按字段合并取无乱码值；②仍脏的行用 `select=<字段>,id` 单字段小响应重拉（轮换 select 顺序绕开坏响应缓存）；③指纹拆两段 `{s,c}`：s=结构哈希（id + ≤200 字短字段，恒稳），c=全字段内容哈希（仅在读到干净版本时更新，否则沿用上一轮）。实测改后连跑 3 次指纹完全一致，守卫输出「数据无变更，跳过」。**已知取舍**：教程 `content` 这类超长字段始终读不干净，故 c 常为 null——正文纯文字微调由后台 dispatch 与每日巡检兜底，新增/改名/上下架/摘要改动仍即时生效。排查用 `node seo/auto-sync.mjs --dry`（只打印指纹，不生成不推送）。
- [ ] 移动端 CWV 实测（需真实设备数据，Pages 无字段数据时用 PSI API）
- [x] 图片缺 alt（2026-10-31 完成，4 页 23 张 → 1 页 2 张；教程页正文图片在 render 层补「标题 + 序号」alt，剩余 admin.html 为 JS 模板字符串误报）
- [x] 建立每日 BUG 体检（2026-10-31 新增 seo/audit.mjs，BLOCKER 0 / WARN 1）
- [x] sw.js 半坏缓存（2026-10-31：预热不存在的 ./community.js → addAll 全失败；改为自注销版本，清缓存并 unregister）
- [x] 失效资源引用（2026-10-31：preview/text1 的 /cdn-cgi/email-decode.min.js 在 Pages 上 404，已删）
- [x] preview.html canonical（2026-10-31：原来指向 https://lezhesoft.cn/ 非 www 首页，改为自引用并取消深链改写）
- [x] 分类页缺 og:image（2026-10-31：15 个分类页统一回落 og-cover.png 1200x630）
- [x] sitemap lastmod 补齐（2026-10-31：仅首页有 lastmod，现 180/180 全带）
- [x] 首屏静态卡片图标（2026-10-31：12 张卡片的 `<img>` 全写死「软」字占位 SVG，JS 拉数据前满屏蓝底「软」＝用户以为没图标。generate.mjs 按 data-id 回填真实 icon_url，audit.mjs 加永久检查）
- [x] 页脚访问统计（2026-10-31：不蒜子 JS 能 200 但计数接口 `/busuanzi?jsonpCallback=` 20s 无响应 → 改 abacus 自建计数并做「拿不到就整段隐藏」降级；「N 人在线」依赖 Supabase realtime，经腾讯 CloudBase supabase-proxy 实测 WebSocket 升级无响应（握手无 101），永久出不来 → 改展示「今日浏览」。两处均已加 audit 检查）
- [ ] 首页 HTML 604KB、内联脚本 343KB：移动端 LCP 风险，评估外链拆包（拆错会白屏，需先在灰度页验证）——2026-11-07 已把 supabase UMD 外链化，现 560,638 字节；主脚本 205KB 仍内联，见下方「首页减重·第二步」
- [x] 首页静态 /soft/ 链接（2026-10-31 完成，0 → 24 条；做法：generate.mjs `buildHotIndex()` 在 #pageHome 末尾输出「热门软件索引」块，按「浏览 + 下载×3」取前 24，同名多平台记录按去空格后名称去重；块内另有 /sitemap.html 全量索引链接。样式一次性注入 `.hotindex-*`，幂等替换靠 `<!--/hotindex-->` 标记）
- [x] 教程/软件页互链（2026-10-31 完成；做法：按「教程标题包含完整软件名」双向匹配，软件页渲染「相关教程」、教程页渲染「相关软件下载」，无命中则整块不输出；教程页「分类」改为可点链接，仅在该分类确有分类页时输出，避免造 /cat/cat-xxxx 死链。现 6 篇教程命中 2 篇，随每日新增自动变密）
- [x] 数据质量：`驱动管理` 分类仅 1 条记录，且标题是促销文案「…限时 7 折特惠快入手！」（SERP 里会当标题展示，属低质信号）。**2026-11-02 已处理**：软件表对 anon key 只有 SELECT（PATCH 返回 204 但 0 行受影响），改不动数据库，改为在 generate.mjs 加 `NAME_OVERRIDES` / `CATEGORY_OVERRIDES` 定点重写——名称改为「Driver Booster 13 Pro 驱动更新工具」、分类并入「实用工具」、描述改事实性文案；1 条目的薄分类页 /cat/qudong-guanli.html 随之消失（cat 15→14），该页入链 2→10+（lowInboundCount 1→0）。**待有服务端权限时改数据库并删掉这两张覆盖表**，否则站内 SPA 仍显示旧名称。
- [x] 404 兜底页（2026-10-31 完成；此前线上 404 是 GitHub 英文默认页、整页 0 处本站链接。做法：render.js `render404()` + generate.mjs 落盘 404.html，GitHub Pages 原生接管且保持 404 状态码；页面自带 164 条搜索索引（158 软件 + 6 教程，含 URL 中文关键词预填）+ 热门 12 + 分类 15 + 全站索引出口，noindex。audit.mjs 第 15 项永久检查。产物 22.5KB / gzip 8.3KB）
- [ ] 教程封面 PNG→WebP：6 张各 294KB 共 1.76MB，但 cover 由 `ensureCovers()` 远端拉取重建、路径存数据库 `tutorials.cover`，且该 URL 兼作 og:image（微信对 webp 分享卡兼容存疑），改造需动 ensureCovers + render 双通道（img 用 webp、og:image 留 png），有设计成本，暂缓
- [ ] 站内搜索（全站级）：404 页已验证「自带索引 JSON + 前端子串匹配」模式可行，可平移到 sitemap.html / 首页；158 软件索引 JSON 仅 ~11KB
- [x] 首页减重·第一步：supabase UMD 改外链（2026-11-07 完成）。原来 102KB 的 UMD 以 `<script type="text/plain" id="lezheSupabaseBundle">` 内联在首页、再用 Blob 注入执行；根目录 `supabase.umd.js`（同版本 2.39.3，仅打包链一处 `typeof module` 判断写法不同，浏览器分支一致）一直没被引用。改法：删掉内联块，loader 改为 `document.createElement('script').src='/supabase.umd.js'`（`async`，失败重试 1 次）。安全性依据：`initSupabase()` 有 30 次重试轮询全局 `supabase`，`_cdnLoadStatus.supabase` 也靠 200ms 轮询判定，加载时机与原先 Blob 注入同构。实测 index.html **663,168 → 560,638 字节（−15.5%，−102.5KB）**；改前/改后同一视口 `body.innerText` 逐字比对，仅「每日一句」随机文案不同，其余完全一致，UMD 请求 200、无新增 pageerror。剩余：主脚本 205KB + DOMPurify 21KB 仍内联。
- [ ] 首页减重·第二步：主脚本 205KB 内联，评估外链 defer（拆错会白屏，需先在灰度页验证）
- [ ] 软件页内容深化：158 页均只有 1 个 H1、0 个 H2、正文中位 553 字，缺「适用场景/最低配置/常见问题」结构化段落（长尾词 + FAQ 富摘要资格）
- [x] 统计「零第三方」（2026-10-31：前端已改成三层取值 —— ①自家 Supabase `site_hit/site_get` ②abacus 兜底 ③localStorage 上次值；自家通道探测失败后本会话不再重试。SQL 见 `seo/site-stats.sql`）
- [x] Supabase 建表 + RPC（2026-10-31 已执行：`site_stats` 表 + `site_hit/site_get`；表无 policy、anon 直接 select 返回空数组，只能走函数。实测预检 200、自增正常、非法 key 返回 P0001。线上端到端验证：3 个请求全打自家 RPC，abacus 零调用。自检命令 `node seo/stat-check.mjs`）
- [x] AI 工具集板块（/ai/）上线收尾（2026-11-02 已上线，commit aeebb22e）：站长需执行 seo/ai-schema.sql 末尾的升级段（logo/slug/intro/screenshots 五个 ALTER），再到 admin.html「🤖AI工具集」上传工具集与工具（支持封面图URL、详细介绍、多张截图；无封面自动生成字母封面）

## ⛔ 用户明确禁改项（2026-11-04，优化时不得违反）
- AI 工具集列表页（/ai/ 首页与所有页面）**禁止出现任何描述导语/段落**：hub 标题下不加 lead 段、每个分区标题下不加「本方向共收录…」之类导语。薄内容问题靠分类页的对比表与选择建议解决，不要往列表页加字。
- AI 板块内禁止使用 emoji 图标（标题、分区、按钮一律用内联 SVG 或纯文字）。
- 详情页右卡不放「收藏工具」「举报工具」按钮（已按用户要求移除，勿加回）。
- 违反以上任一项 = 用户投诉级别 BUG，上线前自检时发现必须回退。
- **后果确认（2026-11-05）**：遵守禁改项后 `optimize.mjs` 的 thinCount 恒为 1（ai/index.html 229 字）——这是用户批准的设计现状，**不算 BUG、不要往列表页加字去「修」**；P3 缺 alt（admin.html 2 张）为 noindex 后台 SPA 的 JS 模板字符串误报，同样不要修。

## 后台仪表盘慢 + 教程管理乱码（2026-11-06 修复，commit 260f2fe）

### 仪表盘慢的根因

`renderDash` 原来是 **9 个串行 await**（soft/cats/tut/q/an/cm/sub/pf 再 redeems），
每个都走 CloudBase 代理（单次 TTFB ~1.4s），串行 12 秒起步。改成 `Promise.all` 并发，
总耗时=最慢那一个（~2s）。**这类「看着没问题其实串行」的写法是后台所有页面共通的风险**，
排查同类问题先看是不是 `await a(),await b()` 连排。

### 教程乱码的根因（比想象中难缠）

后台读库走同一代理，长中文正文偶发被截断成 U+FFFD，且**坏的位置每次随机**。静态页生成器
早有「多取几份按字段合并」治愈，后台此前是单次请求拿到什么显示什么。

实测数据（不要想当然，多份合并不是万能的）：
- 全量拉 4 份按字段合并：11 篇里仍剩 5 篇带乱码；拉 8 份剩 6 篇；
- 对脏记录**逐条重拉**（小 payload）4 份：也只能再救 2 篇；
- 结论：有部分教程**每次传输都坏**（数据库源内容在代理这一层稳定损坏），合并治不了。
  这和 `DATA_MASTERS` 母本名单高度重合（11 篇教程几乎全在里面）。

### 最终方案：三层治愈

1. `DB._heal(mk, copies)`：首次结果含 FFFD 才追加并发请求（默认 4 份），按记录 id 逐字段
   挑乱码更少的版本。正常情况零额外开销，代理挂了也不会更糟。
2. `generate.mjs` 顺带产出 `data/tutorials.json`（治愈+母本后的干净正文，37KB）。
3. `DB._healRowWithMasters()`：合并后仍脏的记录，用静态干净数据按字段修复。
   **安全阀**：只替换「库里含 FFFD 且静态版不含」的字段；记录 `updated_at` 晚于静态数据
   `build` 时整条跳过——用户刚改完的正文绝不回退成旧版。

软件详情走同一条链（`softOne` 用已有的 `data/software.json` 兜底，它本来就带 `detail`/`description`）。

### 注意

- `admin.html` 是生成器的扫描对象：注释里**不要出现真实的 U+FFFD 字符**（示例请写
  「U+FFFD 替换符」或 `\uFFFD` 转义），否则末尾自检 exit 2 会让整次生成失败。
- `data/tutorials.json` 与静态站同批生成、同批上线，天然不会比库里的旧太多；
  真正的用户新改动由 `updated_at` 保护阀兜住。

### 回归

```bash
node seo/audit.mjs                       # 护栏：rev wiring、快照 build 等
# 真实链路（无需登录）：打开 admin → DB.tut(true) 应返回 0 条含 FFFD
```
