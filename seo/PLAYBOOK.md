# 乐哲软件 · 每日优化手册（供自动化任务按序执行）

原则：**每天只做 1–2 件有数据依据的事**，做完必须过质检再推送。不做无依据的批量改动。

## 第一步：体检

```bash
node seo/optimize.mjs            # 人读报告 + 优先级建议
node seo/optimize.mjs --json     # 机器读，便于取数
node seo/qa.mjs                  # 硬性红线：重复/短描述/乱码/死链
```

`priorities` 数组即当日候选清单，按 P1 → P3 取最上面的一到两项。

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

1. `node seo/generate.mjs` → `node seo/qa.mjs` → `node seo/optimize.mjs`（对比修改前后数字）
2. `node ".../api-push.mjs" "SEO每日优化: ... YYYY-MM-DD"`（本地 push 被墙，必须走 API 脚本）
3. 等 40s 后 curl 验证：sitemap loc 数、抽查 2 个改过的页面 200、抽查改动点已生效
4. IndexNow 提交本次有实质变更的 URL
5. `node seo/baidu-push.mjs`：百度配额 10 条/天，脚本自动按优先级续推，remain=0 即停

## 待办池（按投入产出排序，做完即划掉）

- [x] 标题超 60 字压缩（2026-10-29，32→0）
- [x] 分类页补 CollectionPage/ItemList 结构化数据（2026-10-29）
- [x] 分类页导语（解决 11 页薄内容，11→1）（2026-10-29）
- [ ] 59 个软件页入链 <3：在分类页/相关推荐增加交叉链接
- [ ] 教程页仅 3 篇：内容增量优先级最高（百度/必应都吃内容量）
- [ ] 软件页正文深度：目前中位数 532 字，可补「最低配置/适用场景/常见问题」结构化段落
- [ ] 移动端 CWV 实测（需真实设备数据，Pages 无字段数据时用 PSI API）
