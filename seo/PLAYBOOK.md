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
```

检查项：站内资源 404（img/script/link/poster）、canonical 是否自引用、H1 数量、
JSON-LD 语法、og:image 缺失、工具页是否 noindex、页脚品牌回链、sitemap 与磁盘页面双向一致、
sitemap lastmod 覆盖率、robots.txt 的 Sitemap 声明、首页 /cat/ 静态链接数、sw.js 注册状态。

判定：**BLOCKER 当天必修**，修不了要写明原因；WARN 记入待办池择期处理。

检查方法注意（2026-10-31 教训）：**FFFD/内容类检查必须先把页面落盘再读**，
不要 `curl … | node` 直接查管道——分块边界会把多字节中文字符切断，产生 U+FFFD 假阳性
（实测同页面落盘查为 0，管道查为 1）。死链/乱码以外的一致性断言同理。

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

## 第三步：固定红线（任何改动都不能破）

- `seo/qa.mjs`：重复标题 0、重复描述 0、短描述 0、FFFD 0、死链 0
- 描述长度 100–165 字，裁切走 `clip()`（按标点边界），**不要硬 slice**
- 标题 ≤60 可见字符
- 首页 `#categoryList` 必须是带 `/cat/` 真实链接的 `<a>`（生成器自动重建，勿手改）
- 全站页脚保留「乐哲软件官网」回链首页
- 工具页（vip / sitemap / copyright / preview / query / text1 / admin / manager / submanager）保持 noindex
- 动模板前先看 `.workbuddy/memory/` 当日记录，避免重复做已完成的事

## 第四步：发布与提交

1. `node seo/generate.mjs` → `node seo/qa.mjs` → `node seo/audit.mjs` → `node seo/optimize.mjs`（对比修改前后数字）
2. `node ".../api-push.mjs" "SEO每日优化: ... YYYY-MM-DD"`（本地 push 被墙，必须走 API 脚本）
3. 等 40s 后 curl 验证：sitemap loc 数、抽查 2 个改过的页面 200、抽查改动点已生效
4. IndexNow 提交本次有实质变更的 URL
5. `node seo/baidu-push.mjs`：百度配额 10 条/天，脚本自动按优先级续推，remain=0 即停

## 待办池（按投入产出排序，做完即划掉）

- [x] 标题超 60 字压缩（2026-10-29，32→0）
- [x] 分类页补 CollectionPage/ItemList 结构化数据（2026-10-29）
- [x] 分类页导语（解决 11 页薄内容，11→1）（2026-10-29）
- [x] 59 个软件页入链 <3：在分类页/相关推荐增加交叉链接（2026-10-31 完成，59→1；做法：同分类相关推荐改「按热度排序 + 环形轮转取 8 条」，每页链接数不变但分布均匀，剩余 1 页为 admin.html 误报类页面）
- [ ] 教程页仅 3 篇：内容增量优先级最高（百度/必应都吃内容量）——已转为每日自动化新增 1 篇（2026-10-30 起，现 6 篇）
- [ ] 软件页正文深度：目前中位数 548 字，可补「最低配置/适用场景/常见问题」结构化段落（2026-10-30 已修复最后一个薄页 Keka，薄内容 1→0；optimize.mjs 标题统计已改为按解码后可见字符计数，&amp; 不再误报超长）
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
- [ ] 首页 HTML 604KB、内联脚本 343KB：移动端 LCP 风险，评估外链拆包（拆错会白屏，需先在灰度页验证）
- [x] 首页静态 /soft/ 链接（2026-10-31 完成，0 → 24 条；做法：generate.mjs `buildHotIndex()` 在 #pageHome 末尾输出「热门软件索引」块，按「浏览 + 下载×3」取前 24，同名多平台记录按去空格后名称去重；块内另有 /sitemap.html 全量索引链接。样式一次性注入 `.hotindex-*`，幂等替换靠 `<!--/hotindex-->` 标记）
- [x] 教程/软件页互链（2026-10-31 完成；做法：按「教程标题包含完整软件名」双向匹配，软件页渲染「相关教程」、教程页渲染「相关软件下载」，无命中则整块不输出；教程页「分类」改为可点链接，仅在该分类确有分类页时输出，避免造 /cat/cat-xxxx 死链。现 6 篇教程命中 2 篇，随每日新增自动变密）
- [ ] 数据质量：`驱动管理` 分类仅 1 条记录，且标题是促销文案「…限时 7 折特惠快入手！」（SERP 里会当标题展示，属低质信号）。建议后台改名为「Driver Booster 13 Pro」并归入 系统工具/实用工具，改名后自动获得同分类内链，该页入链 2→3 以上
- [ ] 首页 604KB / 内联 343KB 拆分（同上，需灰度验证）
- [x] 统计「零第三方」（2026-10-31：前端已改成三层取值 —— ①自家 Supabase `site_hit/site_get` ②abacus 兜底 ③localStorage 上次值；自家通道探测失败后本会话不再重试。SQL 见 `seo/site-stats.sql`）
- [x] Supabase 建表 + RPC（2026-10-31 已执行：`site_stats` 表 + `site_hit/site_get`；表无 policy、anon 直接 select 返回空数组，只能走函数。实测预检 200、自增正常、非法 key 返回 P0001。线上端到端验证：3 个请求全打自家 RPC，abacus 零调用。自检命令 `node seo/stat-check.mjs`）
