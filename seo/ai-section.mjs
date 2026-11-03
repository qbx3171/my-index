// AI 工具集板块（/ai/）
// 数据模型：ai_collections（工具集，每集一个独立页面）← ai_tools（集内工具）
// 数据由站长在 admin.html「AI工具集」后台上传，这里只做静态渲染。
// 排版：左侧工具集导航 + 封面卡片流（有 logo 用 logo，无 logo 自动生成渐变字母封面）。
// 表不存在或为空时优雅降级：仍生成 /ai/index.html 导航首页（导航入口的落点），其余跳过。
import { mkdir, writeFile, rm } from "node:fs/promises";
import { existsSync, readFileSync } from "node:fs";
import { createHash } from "node:crypto";
import { join } from "node:path";
import { head, foot, crumb, jsonLd, SITE } from "./render.js";

// CSS 版本号 = 样式内容哈希（而非构建时间）：定时任务重跑时样式没变则版本号不变，
// 产物逐字节稳定（幂等），避免 CI 空提交；样式真变了 CDN 缓存也会自动失效。
let _aiCssCache = "";
function aiCss() {
  if (!_aiCssCache) {
    const ver = createHash("md5").update(AI_STYLESHEET).digest("hex").slice(0, 8);
    _aiCssCache = `\n<link rel="stylesheet" href="${SITE}/ai/ai.css?v=${ver}">`;
  }
  return _aiCssCache;
}

// —— Supabase 连接信息从仓库 index.html 提取 ——
function supabaseCreds() {
  const h = readFileSync(join(process.cwd(), "index.html"), "utf8");
  const U = h.match(/SUPABASE_URL\s*=\s*['"]([^'"]+)['"]/)[1];
  const K = h.match(/SUPABASE_ANON_KEY\s*=\s*['"]([^'"]+)['"]/)[1];
  return { U, K };
}

const FFD = "\uFFFD";
const ffdCount = (s) => String(s).split(FFD).length - 1;
const hasFFD = (row) => Object.values(row).some((v) => typeof v === "string" && v.includes(FFD));

async function fetchTable(U, K, table) {
  const r = await fetch(`${U}/rest/v1/${table}?select=*`, {
    headers: { apikey: K, Authorization: `Bearer ${K}` },
  });
  if (!r.ok) {
    const t = await r.text();
    if (r.status === 404 || /does not exist|relation/i.test(t)) {
      console.log(`AI 板块：表 ${table} 尚未创建，跳过（请先在 Supabase 执行 seo/ai-schema.sql）`);
      return null;
    }
    throw new Error(`拉取 ${table} 失败: ${r.status} ${t.slice(0, 200)}`);
  }
  const rows = await r.json();
  // 代理传输偶发截断多字节字符（U+FFFD，位置随机）：对损坏行按 id 单条重拉治愈
  for (const row of rows.filter(hasFFD)) {
    for (let i = 0; i < 5 && hasFFD(row); i++) {
      try {
        const rr = await fetch(`${U}/rest/v1/${table}?select=*&id=eq.${encodeURIComponent(row.id)}`, {
          headers: { apikey: K, Authorization: `Bearer ${K}` },
        });
        const fresh = (await rr.json())[0];
        if (!fresh) break;
        for (const [k, v] of Object.entries(fresh)) {
          if (typeof v !== "string") continue;
          if (!v.includes(FFD)) row[k] = v;
          else if (typeof row[k] === "string" && row[k].includes(FFD) && ffdCount(v) < ffdCount(row[k])) row[k] = v;
        }
      } catch {
        /* 单条重拉失败不致命，下一轮再试 */
      }
      await new Promise((res) => setTimeout(res, 300));
    }
  }
  const stillBad = rows.filter(hasFFD).map((x) => x.name || x.id);
  if (stillBad.length) console.warn(`⚠ AI 表 ${table} 治愈后仍有乱码: ${stillBad.join(", ")}`);
  return rows;
}

// —— 封面：有 logo 用图（懒加载），否则按名称生成稳定的渐变字母封面 ——
function coverHtml(item, cls) {
  const logo = String(item.logo || "").trim();
  if (/^https?:\/\//i.test(logo)) {
    return `<img class="${cls}" src="${esc(logo)}" alt="${esc(item.name)} 封面" loading="lazy" referrerpolicy="no-referrer" onerror="this.outerHTML=aiFallback('${esc(item.name).replace(/'/g, "\\'")}','${cls}')">`;
  }
  return aiFallback(item.name, cls);
}
function aiFallback(name, cls) {
  const s = String(name || "AI");
  const ch = [...s][0] || "A";
  let h = 0;
  for (let i = 0; i < s.length; i++) h = (h * 31 + s.codePointAt(i)) >>> 0;
  const hue = h % 360;
  return `<span class="${cls} ai-cover-fb" style="background:linear-gradient(135deg,hsl(${hue},72%,52%),hsl(${(hue + 46) % 360},72%,42%))">${esc(ch)}</span>`;
}
const FALLBACK_SNIPPET = `<script>function aiFallback(n,c){var s=String(n||'AI'),ch=[...s][0]||'A',h=0;for(var i=0;i<s.length;i++)h=(h*31+s.codePointAt(i))>>>0;var hue=h%360;return '<span class="'+c+' ai-cover-fb" style="background:linear-gradient(135deg,hsl('+hue+',72%,52%),hsl('+((hue+46)%360)+',72%,42%))">'+ch+'</span>';}</script>`;

// —— 工具卡片（ai-bot.cn 同款：圆形图标 + 名称/一句话简介，无角标；点击进站内详情页）——
function toolCard(t) {
  return `<a class="ai-card" href="${toolDetailUrl(t)}" title="${esc(t.summary || t.name)}">
  ${coverHtml(t, "ai-cover")}
  <span class="ai-card-main"><span class="ai-card-name">${esc(t.name)}</span><span class="ai-card-summary">${esc(t.summary || "")}</span></span>
</a>`;
}

// —— 工具详情页 URL：slug 字段优先，缺省用 id 前 8 位，防冲突 ——
function toolSlug(t) {
  const s = String(t.slug || "").trim().toLowerCase().replace(/[^a-z0-9-]/g, "").replace(/^-+|-+$/g, "");
  return s || `t-${String(t.id || "").replace(/-/g, "").slice(0, 8)}`;
}
let SLUG_MAP = new Map(); // id → 最终落盘 slug（防冲突后缀在这里生效）

// —— 前端实时层配置（2026-11-03）——
// 后台保存后 /ai/ 页面要能立刻反映，不能等 generate.mjs 重跑。做法：页面里带一份
// 「生成时的数据指纹 + 已生成详情页清单」，浏览器加载后再拉一次库比对，不一致才重绘。
let LIVE_CFG = null;
let LIVE_VER = "";
function liveTag() {
  if (!LIVE_CFG) return "";
  const json = JSON.stringify(LIVE_CFG).replace(/</g, "\\u003c");
  return `<script>window.__AI_LIVE__=${json}</script>\n<script src="/ai/live.js?v=${LIVE_VER}" defer></script>`;
}
// 指纹只认「结构字段」：新增/删除/排序/上下架/收费模式变化才重绘。
// 刻意不含 name/summary/intro——代理传输会把汉字随机截成 U+FFFD，文本参与指纹会导致
// 两端永远不相等、每次访问都白重绘一次；文本改动交给详情页的容错补丁和下一次生成。
function aiSig(cols, tools) {
  const cmp = (x, y, k) =>
    (x.sort || 0) - (y.sort || 0) ||
    (String(x[k]) < String(y[k]) ? -1 : String(x[k]) > String(y[k]) ? 1 : 0);
  const cs = [...cols].sort((a, b) => cmp(a, b, "id"));
  const ts = [...tools].sort((a, b) => cmp(a, b, "id"));
  const s =
    cs.map((c) => [c.id, c.slug, c.sort, c.is_published].join("|")).join("~") +
    "#" +
    ts.map((t) => [t.id, t.collection_id, t.sort, t.is_published, t.pricing, t.slug].join("|")).join("~");
  let h = 5381;
  for (let i = 0; i < s.length; i++) h = ((h << 5) + h + s.charCodeAt(i)) >>> 0;
  return h.toString(36) + "-" + s.length;
}
function toolDetailUrl(t) {
  const slug = SLUG_MAP.get(t.id) || toolSlug(t);
  return `${SITE}/ai/tool/${slug}.html`;
}

// —— 详情页：封面/截图 + 详细介绍 + 访问官网 + 同类工具 ——
export function renderAiToolDetail(t, col, collections, siblings) {
  const desc = detailDesc(t, col);
  const canonical = toolDetailUrl(t);
  const tags = String(t.tags || "").split(/[,，、]/).map((x) => x.trim()).filter(Boolean);
  const shots = String(t.screenshots || "").split(/[\n,，]/).map((x) => x.trim()).filter((u) => /^https?:\/\//i.test(u)).slice(0, 8);
  const introParas = String(t.intro || "")
    .split(/\n\s*\n/)
    .map((p) => p.replace(/\s+/g, " ").trim())
    .filter(Boolean)
    .map((p) => `<p>${esc(p)}</p>`)
    .join("\n");
  const logo = String(t.logo || "").trim();

  const html =
    head(title4Tool(t, col), desc, canonical, `<meta property="og:image" content="${esc(logo || `${SITE}/og-cover.png`)}">` + aiCss()) +
    `
<main>
${crumb([
    { name: "首页", url: `${SITE}/` },
    { name: "AI 工具集", url: `${SITE}/ai/index.html` },
    { name: col.name, url: `${SITE}/ai/${esc(col.slug)}.html` },
    { name: t.name },
  ])}
${sideNav(collections, col.slug)}
<div class="ai-detail-head">
  ${coverHtml(t, "ai-detail-cover")}
  <div class="ai-detail-info">
    <div class="ai-detail-title"><h1>${esc(t.name)}</h1><span class="ai-badge ${badgeClass(t.pricing)}">${esc(t.pricing || "免费")}</span></div>
    ${tags.length ? `<div class="ai-detail-meta">${tags.map((g) => `<span class="chip">${esc(g)}</span>`).join("")}</div>` : ""}
    <p class="ai-card-summary">${esc(t.summary || "")}</p>
    <div class="ai-detail-actions"><a class="ai-site-btn" rel="nofollow noopener" target="_blank" href="${esc(t.url)}">访问官网 ↗</a><a class="ai-ghost-btn" href="${SITE}/ai/${esc(col.slug)}.html">← ${esc(col.name)}</a></div>
  </div>
</div>
${shots.length ? `<div class="ai-shots">${shots.map((u, i) => `<a class="ai-shot" href="${esc(u)}" target="_blank" rel="noopener" title="查看大图"><img src="${esc(u)}" alt="${esc(t.name)} 截图${i + 1}" loading="lazy" referrerpolicy="no-referrer"></a>`).join("")}</div>` : ""}
${introParas ? `<section class="ai-detail-sec"><h2>${esc(t.name)} 是什么</h2>${introParas}</section>` : ""}
${siblings.length ? `<section class="ai-detail-sec"><h2>同类工具推荐</h2><div class="ai-cards">${siblings.map(toolCard).join("\n")}</div></section>` : ""}
<p class="ai-back"><a href="${SITE}/ai/index.html" style="color:#0077ff">← 全部工具集</a></p>
</main>
${jsonLd({
    "@context": "https://schema.org",
    "@type": "WebApplication",
    name: t.name,
    url: t.url,
    description: desc,
    applicationCategory: "AI Tool",
    offers: { "@type": "Offer", price: "0", priceCurrency: "CNY" },
  })}
${FALLBACK_SNIPPET}
${liveTag()}
${foot("ai-tool-" + toolSlug(t))}`;
  return { html };
}

function title4Tool(t, col) {
  return `${t.name}怎么样 - ${col.name}工具详解 | 乐哲软件`.slice(0, 60);
}
function detailDesc(t, col) {
  const clean = (s) => String(s || "").replace(/<[^>]*>/g, "").replace(/\s+/g, " ").trim();
  const intro = clean(t.intro);
  const summary = clean(t.summary);
  let d = `${t.name}怎么样？${intro || summary}`;
  const pad = `本页整理${t.name}的官网入口、功能介绍与封面截图，属乐哲软件 AI 工具集「${col.name}」收录的${t.pricing || "免费"}工具，附同类工具推荐，持续更新。`;
  while (d.length < 100 && pad.length) d += pad[d.length % pad.length] === undefined ? "" : pad.slice(0, Math.min(pad.length, 100 - d.length));
  if (d.length < 100) d += pad;
  if (d.length > 165) d = d.slice(0, 157).replace(/[,，。;；\s]+$/, "") + "…";
  return d;
}

// —— 左侧工具集导航（两个页面共用）——
function sideNav(collections, activeSlug) {
  const listed = collections.filter((c) => c._hasPage !== false);
  return `<aside class="ai-side">
  <a class="ai-side-brand" href="${SITE}/ai/index.html"><span class="ai-side-brand-ico">🤖</span>乐哲Ai工具集</a>
  <nav class="ai-side-menu">
  ${listed
    .map(
      (c) => `<a class="ai-side-item${c.slug === activeSlug ? " on" : ""}" href="${SITE}/ai/${esc(c.slug)}.html">${c.logo && /^https?:\/\//i.test(c.logo) ? `<img class="ai-side-logo" src="${esc(c.logo)}" alt="" loading="lazy">` : `<span class="ai-side-ico">${esc(c.icon || "🧩")}</span>`}<span class="ai-side-txt">${esc(c.name)}</span><span class="ai-side-arr">›</span></a>`
    )
    .join("\n")}
  </nav>
</aside>`;
}

// —— 页面渲染 ——

export function renderAiHub(collections, byCollection) {
  const title = "AI工具集 - 精选AI工具合集导航 | 乐哲软件";
  const desc =
    "乐哲软件 AI 工具集：按使用场景整理的 AI 工具合集，每个工具集独立成页，涵盖 AI 对话、写作、绘画图像、视频音频、编程开发、办公效率等方向，逐个标注收费模式与适用人群，持续增补更新，找 AI 工具收藏这一页就够了。";
  const canonical = `${SITE}/ai/index.html`;
  const n = collections.reduce((a, c) => a + (byCollection[c.slug] || []).length, 0);
  const hasContent = collections.length > 0;

  const sections = collections
    .map((c) => {
      const tools = byCollection[c.slug] || [];
      const CAP = 9;
      const shown = tools.slice(0, CAP);
      if (!shown.length) return "";
      return `<section class="ai-sec" id="${esc(c.slug)}">
  <div class="ai-sec-head">${c.logo && /^https?:\/\//i.test(c.logo) ? `<img class="ai-sec-logo" src="${esc(c.logo)}" alt="">` : `<span class="ai-sec-ico">${esc(c.icon || "🧩")}</span>`}
  <h2>${esc(c.name)}</h2><span class="ai-sec-count">${tools.length} 款</span>
  <a class="ai-sec-more" href="${SITE}/ai/${esc(c.slug)}.html">查看更多 &gt;&gt;</a></div>
  <p class="ai-sec-lead">${esc(secLead(c, tools))}</p>
  <div class="ai-cards">${shown.map(toolCard).join("\n")}</div>
</section>`;
    })
    .filter(Boolean)
    .join("\n");

  const body = hasContent
    ? `<div id="aiHubBody">${sections || `<div class="ai-empty"><p>各工具集正在整理中，很快上线。</p></div>`}</div>`
    : `<div class="ai-empty"><p>各工具集正在整理中，很快上线。</p><p>计划方向：AI 对话助手、AI 写作、AI 绘画图像、AI 视频音频、AI 编程开发、AI 办公效率等，每个方向一个独立工具集。</p></div>`;

  const html =
    head(title, desc, canonical, `<meta property="og:image" content="${SITE}/og-cover.png">` + aiCss()) +
    `
<main>
${crumb([{ name: "首页", url: `${SITE}/` }, { name: "AI 工具集" }])}
<h1>AI 工具集</h1>
<p class="ai-lead">按使用场景整理的 AI 工具合集，共 ${collections.length} 个工具集、${n} 款工具，持续增补更新。</p>
${hasContent ? sideNav(collections, "") : `<style>body main{margin-left:0}</style>`}
${body}
<section class="ai-note">
<h2>关于本板块</h2>
<p>AI 工具更新快、同名产品多，这里不做大而全的清单，而是按「一个场景一个工具集」整理，每个工具集内只保留实际可用、有明确定位的工具，并标注收费模式（免费 / 免费额度 / 订阅 / 买断）。工具集内容会持续增补调整，本页是全部工具集的入口。</p>
</section>
</main>
${jsonLd({
    "@context": "https://schema.org",
    "@type": "CollectionPage",
    name: "AI 工具集",
    description: desc,
    url: canonical,
  })}
${FALLBACK_SNIPPET}
${liveTag()}
${foot("aihub")}`;
  return { html };
}

// —— 工具集对比表 + 选择建议（2026-11-03）——
// 此前分类页只有封面卡片，纯文字仅 159/168 字，被 optimize.mjs 判为薄内容；
// 详情页的 intro 不往列表页搬（避免与详情页正文重复），只摘 summary 定位 + 收费模式做成对比表，
// 再按真实数据（款数 / 收费分布）写选购提示，不套统一模板句。
function plainText(s) {
  return String(s || "").replace(/<[^>]*>/g, "").replace(/\s+/g, " ").trim();
}
// 描述长度红线 100–165 字：后台 description 常年留空，光写「共精选 N 款」等于没说；
// 统一在这里补齐到 100 字以上（垫句逐段加，保证够长），超长按标点收尾。
function fitDesc(base, col) {
  const pads = [
    `本页为乐哲软件 AI 工具集「${col.name}」索引，逐个列出工具的定位、收费模式与官网入口，并附快速对比表和挑选建议，适合同类工具拿不定主意时先横向比一遍，内容随后台收录持续更新。`,
    `乐哲软件 AI 工具集按使用场景整理合集，逐个标注收费模式与适用人群，找同类工具先来这里横向对比，再决定试哪一款。`,
  ];
  let d = plainText(base).replace(/[。\s]+$/, "");
  for (const p of pads) {
    if (d.length >= 100) break;
    d = `${d}。${p}`;
  }
  if (d.length > 165) d = d.slice(0, 160).replace(/[,，。;；、\s]+$/, "") + "…";
  return d;
}
function buildCompare(col, tools) {
  if (!tools.length) return "";
  const rows = tools
    .map(
      (t) =>
        `<tr><td><a href="${toolDetailUrl(t)}">${esc(t.name)}</a></td>` +
        `<td>${esc(plainText(t.summary) || "—")}</td>` +
        `<td><span class="ai-badge ${badgeClass(t.pricing)}">${esc(String(t.pricing || "免费").trim())}</span></td></tr>`
    )
    .join("");
  const pricingOf = (t) => String(t.pricing || "免费").trim();
  const mix = [...new Set(tools.map(pricingOf))];
  const freeish = tools.filter((t) => badgeClass(t.pricing) !== "sub").length;
  const priceLine =
    mix.length === 1
      ? `收录的 ${tools.length} 款工具收费模式均为${mix[0]}，试用不需要额外付费。`
      : `收费模式分 ${mix.length} 种：${mix.map((m) => `${m} ${tools.filter((t) => pricingOf(t) === m).length} 款`).join("、")}。`;
  const pickLine =
    tools.length > 1
      ? `款数不多但定位差别明显，按“要产出什么”挑一款就够，不必同时订阅两个：${tools
          .map((t) => `${plainText(t.name)}（${plainText(t.summary) || "综合型"}）`)
          .join("；")}。`
      : `目前只有一款可对照，建议先按免费通道把完整流程跑一遍（注册 → 输入需求 → 导出成品），确认导出格式、分辨率或字数限制够用再考虑付费。`;
  const workLine = freeish
    ? `实际使用时的差别通常在导出环节：免费额度多有次数或水印限制，正式产出前先确认导出文件的格式、尺寸与商用授权说明。`
    : `均为订阅制，上手前先确认是否提供试用；团队使用还要看席位计费与素材版权归属。`;
  return `<section class="ai-note ai-compare" id="aiCompare">
<h2>${esc(col.name)}快速对比</h2>
<table><thead><tr><th>工具</th><th>定位</th><th>收费模式</th></tr></thead><tbody>${rows}</tbody></table>
<p>${esc(priceLine)}${esc(pickLine)}</p>
<p>${esc(workLine)}</p>
</section>`;
}

export function renderAiCollection(col, tools, collections = []) {
  const title = tools.length
    ? `${col.name} - ${tools.length}款AI工具精选 | 乐哲软件`
    : `${col.name} - AI工具集 | 乐哲软件`;
  // 工具集 description 后台大多留空，光写「共精选 N 款」等于没说；
  // 有工具时把名单与收费模式写进描述，摘要里就能看出这个集合到底收了什么。
  const listBrief = tools.slice(0, 4).map((t) => t.name).join("、") + (tools.length > 4 ? " 等" : "");
  const desc = fitDesc(
    (
      col.description
        ? col.description
        : tools.length
          ? `${col.name}精选 ${tools.length} 款：${listBrief}，逐个标注收费模式与定位`
          : `${col.name}工具集`
    ),
    col
  );
  const canonical = `${SITE}/ai/${col.slug}.html`;
  const toolsBlock = tools.length
    ? `<div class="ai-cards" id="aiColCards">\n${tools.map(toolCard).join("\n")}\n</div>`
    : `<div class="ai-empty" id="aiColCards">📦 本工具集正在整理中，工具马上就来 —— 你也可以先逛逛<a href="${SITE}/ai/index.html" style="color:#0077ff">其他工具集</a>。
<p>这里将收录与「${esc(col.name)}」相关的 AI 工具：逐个标注收费模式、核心定位与适用人群，附官网入口与快速对比表。正在找这类工具的话，可以先收藏本页，上架后会第一时间出现在这里。</p></div>`;

  const html =
    head(title, desc, canonical, `<meta property="og:image" content="${SITE}/og-cover.png">` + aiCss()) +
    `
<main>
${crumb([
    { name: "首页", url: `${SITE}/` },
    { name: "AI 工具集", url: `${SITE}/ai/index.html` },
    { name: col.name },
  ])}
${sideNav(collections, col.slug)}
<div class="ai-col-hero">
  ${coverHtml(col, "ai-col-cover")}
  <div><h1>${esc(col.name)}</h1>
  <p class="ai-lead">${esc(col.description || `精选 ${tools.length} 款${col.name}，逐个标注收费模式，持续更新。`)}</p></div>
</div>
${toolsBlock}
${buildCompare(col, tools)}
<p class="ai-back"><a href="${SITE}/ai/index.html" style="color:#0077ff">← 返回全部工具集</a></p>
</main>
${jsonLd({
    "@context": "https://schema.org",
    "@type": "CollectionPage",
    name: col.name,
    description: desc,
    url: canonical,
    numberOfItems: tools.length,
  })}
${FALLBACK_SNIPPET}
${liveTag()}
${foot("ai-" + col.slug)}`;
  return { html };
}

function secLead(c, tools) {
  const pricingOf = (t) => String(t.pricing || "免费").trim();
  const mix = [...new Set(tools.map(pricingOf))];
  const head = `${c.name}方向目前收录 ${tools.length} 款：${tools.slice(0, 3).map((t) => t.name).join("、")}${tools.length > 3 ? " 等" : ""}`;
  return `${head}，收费模式${mix.length === 1 ? `均为${mix[0]}` : `覆盖${mix.join(" / ")}`}，点工具名可看功能拆解与官网入口。`;
}

function badgeClass(p) {
  const s = String(p || "");
  if (s.includes("免费") && !s.includes("额度")) return "free";
  if (s.includes("订阅")) return "sub";
  if (s.includes("买断")) return "once";
  return "freemium";
}
function esc(s) {
  return String(s ?? "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}

// —— 板块构建入口：拉数据 → 写页面 → 返回 sitemap/404 所需信息 ——
export async function buildAiSection(ROOT, softs = []) {
  const { U, K } = supabaseCreds();
  const cols = await fetchTable(U, K, "ai_collections");
  const tools = cols ? await fetchTable(U, K, "ai_tools") : null;

  // 源数据定点修复：后台粘贴时个别字符写入即损坏（库里即 U+FFFD，重拉无效），按上下文还原
  const AI_TEXT_FIXUPS = [
    {
      id: "109ac896-c7c5-4724-b3f2-be8861ce1c3b", // 蛙蛙写作
      field: "summary",
      from: /剧本创作\s*\uFFFD+\s*漫剧视频/,
      to: "剧本创作、漫剧视频",
    },
  ];
  for (const row of tools || []) {
    for (const fx of AI_TEXT_FIXUPS) {
      if (row.id !== fx.id) continue;
      const v = row[fx.field];
      if (typeof v === "string" && fx.from.test(v)) row[fx.field] = v.replace(fx.from, fx.to);
    }
  }

  // 图床兼容：站长可能把图片链接直接贴进 icon 字段（该字段本应存 emoji），统一视为封面图
  const asImg = (v) => (typeof v === "string" && /^https?:\/\/\S+$/i.test(v.trim()) ? v.trim() : "");
  for (const t of tools || []) {
    if (!String(t.logo || "").trim()) {
      const u = asImg(t.icon);
      if (u) t.logo = u;
    }
  }
  for (const c of cols || []) {
    if (!String(c.logo || "").trim()) {
      const u = asImg(c.icon);
      if (u) c.logo = u;
    }
  }

  const collections = (cols || [])
    .filter((c) => c.is_published !== false && c.slug && c.name)
    .sort((a, b) => (a.sort || 0) - (b.sort || 0));
  const allTools = (tools || []).filter((t) => t.is_published !== false && t.name && t.url);

  const byCollection = {};
  for (const c of collections) byCollection[c.slug] = [];
  for (const t of allTools) {
    const c = collections.find((x) => x.id === t.collection_id);
    if (c) byCollection[c.slug].push(t);
  }
  for (const c of collections) byCollection[c.slug].sort((a, b) => (a.sort || 0) - (b.sort || 0));
  // 所有已发布工具集都生成独立页（空工具集显示"整理中"占位，站长一上传即可见）；
  // _hasPage 保留恒真语义，兼容 sitemap 过滤逻辑
  for (const c of collections) c._hasPage = true;

  // 清空重建 /ai/
  const aiDir = join(ROOT, "ai");
  if (existsSync(aiDir)) await rm(aiDir, { recursive: true });
  await mkdir(join(aiDir, "cover"), { recursive: true }).catch(() => {});
  await mkdir(join(aiDir, "tool"), { recursive: true });
  await writeFile(join(aiDir, "ai.css"), AI_STYLESHEET, "utf8");

  const urls = [];

  // 详情页 slug 防冲突：渲染前先确定每个工具的最终 slug（前端实时层要据此判断哪些工具已有静态页）
  const usedSlugs = new Set(["index"]);
  SLUG_MAP = new Map();
  for (const c of collections) {
    for (const t of byCollection[c.slug] || []) {
      let slug = toolSlug(t);
      let n = 2;
      while (usedSlugs.has(slug)) slug = `${toolSlug(t)}-${n++}`;
      usedSlugs.add(slug);
      SLUG_MAP.set(t.id, slug);
    }
  }

  // —— 前端实时层（2026-11-03）：后台保存后不必等重新生成，页面加载时自行拉库比对 ——
  // 快照 sig 由 Node 与浏览器各算一遍（算法必须一致），不一致或缺失就重绘；
  // 真出现算法漂移的最坏结果是「每次访问都重绘一遍」，DOM 相同、用户无感。
  const livePages = {};
  for (const c of collections) livePages[c.slug] = 1;
  const liveTools = {};
  for (const t of allTools) liveTools[SLUG_MAP.get(t.id)] = t.id;
  LIVE_CFG = {
    api: U,
    key: K,
    sig: aiSig(collections, allTools),
    pages: livePages,
    tools: liveTools,
  };
  const liveJs = readFileSync(join(ROOT, "seo", "ai-live.js"), "utf8");
  await writeFile(join(aiDir, "live.js"), liveJs, "utf8");
  LIVE_VER = createHash("md5").update(liveJs).digest("hex").slice(0, 8);

  const hub = renderAiHub(collections, byCollection);
  await writeFile(join(aiDir, "index.html"), hub.html, "utf8");
  urls.push({ loc: `${SITE}/ai/index.html` });

  let toolPageCount = 0;
  for (const c of collections) {
    const list = byCollection[c.slug];
    const page = renderAiCollection(c, list, collections);
    await writeFile(join(aiDir, `${c.slug}.html`), page.html, "utf8");
    urls.push({ loc: `${SITE}/ai/${c.slug}.html`, lastmod: today() });

    for (const t of list) {
      const slug = SLUG_MAP.get(t.id);
      const siblings = list.filter((x) => x.id !== t.id).slice(0, 6);
      const d = renderAiToolDetail(t, c, collections, siblings);
      await writeFile(join(aiDir, "tool", `${slug}.html`), d.html, "utf8");
      urls.push({ loc: `${SITE}/ai/tool/${slug}.html`, lastmod: today() });
      toolPageCount++;
    }
  }
  console.log(`AI 工具集：${collections.length} 个工具集 / ${allTools.length} 款工具，生成页面 ${urls.length} 个（含工具详情页 ${toolPageCount} 个）`);
  return { urls, collections, byCollection, tools: allTools };
}

function today() {
  return new Date().toISOString().slice(0, 10);
}

const AI_STYLESHEET = `
:root{--ai-border:#e5e9f0;--ai-dim:#5b6472}
/* AI 板块专属布局：仿 ai-bot.cn 左侧固定导航（220px）+ 宽幅内容区 + 浅灰页底
   注意：全站 <style> 在本文件之后加载，必须用 body 前缀提高优先级，否则 main/footer 会被全站 760px 规则覆盖 */
body{background:var(--bg-secondary,#f5f6f8)}
body main{max-width:none;margin:0 0 0 220px;padding:22px 32px 60px}
main>*{max-width:1400px;margin-left:auto;margin-right:auto}
body header{position:sticky;top:0;z-index:100}
body footer{margin-left:220px}
.ai-side{position:fixed;top:57px;bottom:0;left:0;width:220px;box-sizing:border-box;background:var(--bg-card-solid,#fff);border-right:1px solid var(--ai-border);display:flex;flex-direction:column;padding:14px 12px;overflow-y:auto;z-index:40}
.ai-side-brand{display:flex;align-items:center;gap:7px;font-weight:800;font-size:1.05rem;color:var(--text-primary,#1a1f2b);text-decoration:none;padding:4px 10px 12px;border-bottom:1px solid var(--ai-border);margin-bottom:8px;white-space:nowrap}
.ai-side-brand-ico{font-size:1.15rem;line-height:1}
.ai-side-menu{display:flex;flex-direction:column;gap:2px;flex:1 0 auto}
.ai-side-item{display:flex;align-items:center;gap:9px;padding:9px 10px;border-radius:8px;color:#4b5563;text-decoration:none;font-size:.9rem;transition:.15s}
.ai-side-item:hover{background:#f3f5f9;color:#1c2333}
.ai-side-item.on{background:#eef3ff;color:#0b66f0;font-weight:700}
.ai-side-item.on .ai-side-arr{opacity:1;color:#0b66f0}
.ai-side-txt{overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.ai-side-arr{margin-left:auto;opacity:.3;font-size:1.05rem;line-height:1}
.ai-side-ico{font-size:1.05rem;width:22px;text-align:center;flex-shrink:0}
.ai-side-logo{width:20px;height:20px;border-radius:50%;object-fit:cover;flex-shrink:0}
/* 工具集头部（独立页） */
.ai-col-hero{display:flex;align-items:center;gap:16px;margin:6px 0 14px}
.ai-col-hero h1{margin:0}
.ai-col-cover{width:64px;height:64px;border-radius:14px;object-fit:cover;box-shadow:0 2px 8px rgba(20,40,80,.12);flex-shrink:0}
span.ai-col-cover.ai-cover-fb{display:inline-flex;align-items:center;justify-content:center;color:#fff;font-weight:800;font-size:1.6rem}
/* 分区头（板块首页） */
.ai-sec{margin:30px 0}
.ai-sec-head{display:flex;align-items:center;gap:10px;margin-bottom:12px}
.ai-sec-ico{font-size:1.3rem}
.ai-sec-logo{width:26px;height:26px;border-radius:7px;object-fit:cover}
.ai-sec-head h2{margin:0;font-size:1.15rem}
.ai-sec-count{font-size:.74rem;color:#9aa3b2}
.ai-sec-more{margin-left:auto;font-size:.84rem;color:#8a93a3;text-decoration:none;white-space:nowrap}
.ai-sec-more:hover{text-decoration:underline}
.ai-sec-lead{margin:0 0 12px;color:var(--ai-dim);font-size:.86rem;line-height:1.75}
/* 工具集对比表（分类页）：移动端横向滚动，不挤压卡片 */
.ai-compare table{width:100%;border-collapse:collapse;margin:10px 0 14px;font-size:.88rem;display:block;overflow-x:auto;white-space:nowrap}
.ai-compare thead th{text-align:left;font-weight:600;color:var(--text-primary,#1c2333);padding:8px 12px 8px 0;border-bottom:1px solid var(--ai-border)}
.ai-compare tbody td{padding:9px 12px 9px 0;border-bottom:1px solid var(--ai-border);vertical-align:top}
.ai-compare tbody td:first-child{font-weight:600}
.ai-compare tbody tr:last-child td{border-bottom:0}
.ai-compare p{margin:6px 0 0}
/* 卡片流（ai-bot.cn 同款：横排小卡 6 列自适应，圆形图标，hover 紫蓝描边） */
.ai-cards{display:grid;grid-template-columns:repeat(auto-fill,minmax(200px,1fr));gap:14px}
.ai-card{display:flex;align-items:center;gap:10px;background:var(--bg-card-solid,#fff);border:1px solid #ececf0;border-radius:10px;padding:13px 15px;text-decoration:none;color:inherit;transition:.15s;min-width:0;overflow:hidden}
.ai-card:hover{border-color:#5961f9;box-shadow:0 4px 14px rgba(89,97,249,.13)}
.ai-card-main{flex:1;min-width:0;display:flex;flex-direction:column;gap:3px;max-width:100%}
.ai-card-name{font-weight:700;font-size:.9rem;color:#1f2733;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;max-width:100%}
.ai-badge{margin-left:auto;font-size:.68rem;padding:2px 8px;border-radius:20px;white-space:nowrap;flex-shrink:0}
.ai-cover{width:40px;height:40px;border-radius:50%;object-fit:cover;flex-shrink:0;box-shadow:0 1px 4px rgba(20,40,80,.12)}
span.ai-cover.ai-cover-fb{display:inline-flex;align-items:center;justify-content:center;color:#fff;font-weight:800;font-size:1rem}
.ai-card-summary{margin:0;font-size:.76rem;color:#a6adba;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;max-width:100%}
.ai-badge.free{color:#0a8f4d;background:rgba(16,163,74,.1)}
.ai-badge.freemium{color:#b07000;background:rgba(240,180,0,.12)}
.ai-badge.sub{color:#0066cc;background:rgba(0,119,255,.1)}
.ai-badge.once{color:#7a3ff2;background:rgba(122,63,242,.1)}
.chip{font-size:.74rem;color:#41506b;background:#eef2f8;border-radius:6px;padding:2px 8px}
/* 其余 */
.ai-lead{color:var(--text-secondary,#5b6472);max-width:56em;margin:8px 0 0}
.ai-note{margin:30px 0 0;padding-top:18px;border-top:1px solid var(--ai-border);color:var(--ai-dim);font-size:.9rem;line-height:1.8;max-width:900px}
.ai-note h2{font-size:1.05rem;color:var(--text-primary,#1c2333)}
.ai-empty{border:1px dashed var(--ai-border);border-radius:12px;padding:28px;color:var(--ai-dim);line-height:1.8}
.ai-back{margin-top:18px;font-size:.9rem}
.ai-empty{padding:38px 20px;text-align:center;color:#5b6472;background:var(--bg-card-solid,#fff);border:1px dashed #d5dbe6;border-radius:12px;font-size:.95rem;line-height:1.8}
/* 主题适配 */
[data-theme="dark"] .ai-side{background:#242938;border-right-color:#333a48}
[data-theme="dark"] .ai-card,[data-theme="dark"] .ai-col-hero{background:rgba(255,255,255,.04)}
[data-theme="dark"] .ai-card{border-color:rgba(255,255,255,.1)}
[data-theme="dark"] .ai-side-item:hover{background:rgba(255,255,255,.06);color:#e6ebf5}
[data-theme="dark"] .ai-side-brand{color:#e6ebf5}
[data-theme="dark"] .chip{background:rgba(255,255,255,.08);color:#b8c4d8}
[data-theme="dark"] .ai-side-item.on{background:rgba(11,102,240,.18);color:#7eb8ff}
[data-theme="glass"] .ai-side,[data-theme="glass"] .ai-card{background:rgba(255,255,255,.07);border-color:rgba(255,255,255,.14);box-shadow:var(--shadow-sm,none)}
[data-theme="glass"] .ai-side-item:hover{background:rgba(255,255,255,.08)}
[data-theme="glass"] .ai-side-item.on{background:rgba(94,184,255,.14);color:#8ccaff}
/* 详情页 */
.ai-detail-head{display:flex;align-items:flex-start;gap:20px;margin:8px 0 16px;padding:18px;background:var(--bg-card-solid,#fff);border:1px solid var(--border-glow,var(--ai-border));border-radius:16px;box-shadow:0 1px 4px rgba(20,40,80,.05)}
.ai-detail-head h1{margin:0 0 8px}
.ai-detail-title{display:flex;align-items:center;gap:10px;flex-wrap:wrap}
.ai-detail-title h1{margin:0}
.ai-detail-cover{width:96px;height:96px;border-radius:18px;object-fit:cover;box-shadow:0 3px 12px rgba(20,40,80,.16);flex-shrink:0}
span.ai-detail-cover.ai-cover-fb{display:inline-flex;align-items:center;justify-content:center;color:#fff;font-weight:800;font-size:2.2rem}
.ai-detail-meta{display:flex;align-items:center;flex-wrap:wrap;gap:7px;margin-bottom:8px}
.ai-detail-info .ai-card-summary{margin:0;white-space:normal;display:-webkit-box;-webkit-line-clamp:3;-webkit-box-orient:vertical}
.ai-detail-actions{display:flex;gap:10px;margin-top:12px;flex-wrap:wrap}
.ai-site-btn{display:inline-flex;align-items:center;gap:6px;background:linear-gradient(135deg,#0077ff,#6c5ce7);color:#fff;text-decoration:none;font-weight:700;font-size:.92rem;padding:10px 22px;border-radius:50px;box-shadow:0 3px 12px rgba(0,119,255,.3);transition:.16s}
.ai-site-btn:hover{transform:translateY(-1px);box-shadow:0 6px 16px rgba(0,119,255,.4)}
.ai-ghost-btn{display:inline-flex;align-items:center;color:var(--text-secondary,#41506b);text-decoration:none;font-size:.88rem;padding:10px 16px;border:1px solid var(--border-glow,var(--ai-border));border-radius:50px;transition:.16s}
.ai-ghost-btn:hover{color:var(--text-primary,#1c2333);background:var(--bg-secondary,#eef2f8)}
.ai-shots{display:grid;grid-template-columns:repeat(auto-fill,minmax(280px,1fr));gap:12px;margin:14px 0 6px}
.ai-shot{display:block;aspect-ratio:16/9;overflow:hidden;border-radius:12px;border:1px solid var(--border-glow,var(--ai-border));background:var(--bg-secondary,#f4f7fb)}
.ai-shot img{width:100%;height:100%;object-fit:cover;display:block;transition:transform .25s}
.ai-shot:hover img{transform:scale(1.03)}
.ai-detail-sec{margin:22px 0}
.ai-detail-sec h2{font-size:1.15rem;margin:0 0 12px;padding-left:12px;border-left:4px solid #0077ff;line-height:1.3}
.ai-detail-sec p{color:var(--text-secondary,#41506b);line-height:1.85;margin:0 0 12px;font-size:.94rem}
/* 移动端/窄屏：侧栏变顶部横向滚动条，内容区还原全宽 */
@media (max-width:1100px){
body main{margin-left:0;padding:16px 16px 44px}
body footer{margin-left:0}
.ai-side{position:static;height:auto;width:auto;flex-direction:row;align-items:center;border-right:0;border-bottom:1px solid var(--ai-border);padding:10px 14px;overflow-x:auto;overflow-y:hidden;gap:4px;scrollbar-width:none;-webkit-overflow-scrolling:touch;-webkit-mask-image:linear-gradient(90deg,#000 0,#000 calc(100% - 26px),transparent);mask-image:linear-gradient(90deg,#000 0,#000 calc(100% - 26px),transparent)}
.ai-side::-webkit-scrollbar{display:none}
.ai-side-brand{border-bottom:0;margin:0 6px 0 0;padding:0 6px}
.ai-side-menu{flex-direction:row;flex:none}
.ai-side-item{flex-shrink:0}
.ai-side-arr{display:none}
.ai-col-hero{gap:12px}
.ai-col-cover{width:52px;height:52px}
.ai-detail-head{flex-direction:column;gap:14px}
.ai-detail-cover{width:72px;height:72px}
span.ai-detail-cover.ai-cover-fb{font-size:1.7rem}
}
/* 实时预览浮层（新增工具尚未生成静态详情页时，点卡片就地查看） */
.ai-live-mask{position:fixed;inset:0;z-index:9999;display:none;align-items:center;justify-content:center;padding:20px;background:rgba(15,23,42,.55)}
.ai-live-mask.on{display:flex}
.ai-live-box{position:relative;width:100%;max-width:760px;max-height:86vh;overflow:auto;background:#fff;border-radius:16px;padding:24px 24px 26px;box-shadow:0 24px 60px rgba(15,23,42,.28)}
.ai-live-x{position:absolute;top:10px;right:14px;border:0;background:transparent;font-size:26px;line-height:1;color:#8a93a3;cursor:pointer}
.ai-live-x:hover{color:#1c2333}
.ai-live-tip{margin:16px 0 0;font-size:.82rem;color:#8a93a3}
@media(max-width:640px){.ai-live-box{padding:18px 16px 22px;max-height:90vh}}
`;
