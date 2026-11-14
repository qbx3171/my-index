// AI 工具集板块（/ai/）
// 数据模型：ai_collections（工具集，每集一个独立页面）← ai_tools（集内工具）
// 数据由站长在 admin.html「AI工具集」后台上传，这里只做静态渲染。
// 排版：左侧工具集导航 + 封面卡片流（有 logo 用 logo，无 logo 自动生成渐变字母封面）。
// 表不存在或为空时优雅降级：仍生成 /ai/index.html 导航首页（导航入口的落点），其余跳过。
import { mkdir, writeFile, rm, readdir, unlink } from "node:fs/promises";
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
  const url = `${U}/rest/v1/${table}?select=*`;
  const H = { apikey: K, Authorization: `Bearer ${K}` };
  // 代理（腾讯云 CloudBase）偶发 502 Bad Gateway / timeout，实测几十秒到几分钟内自愈。
  // 这里以前不重试，一次抖动就让整站生成中断（CI 三次都撞上 = 站点 5 分钟不更新）。
  // 只对 5xx 与网络错误重试；4xx 是逻辑问题，重试无意义。
  let r = null;
  let lastErr = "";
  for (let attempt = 0; attempt < 3; attempt++) {
    try {
      r = await fetch(url, { headers: H });
    } catch (e) {
      r = null;
      lastErr = e.message;
    }
    if (r && r.ok) break;
    if (r && r.status < 500) break;
    if (r) lastErr = `HTTP ${r.status}`;
    if (attempt < 2) {
      const wait = 700 * (attempt + 1);
      console.warn(`⚠ 拉取 ${table} 第 ${attempt + 1} 次失败（${lastErr.slice(0, 60)}），${wait}ms 后重试`);
      await new Promise((s) => setTimeout(s, wait));
    }
  }
  if (!r || !r.ok) {
    if (r && r.status === 404) {
      const body = await r.text().catch(() => "");
      if (/does not exist|relation/i.test(body)) {
        console.log(`AI 板块：表 ${table} 尚未创建，跳过（请先在 Supabase 执行 seo/ai-schema.sql）`);
        return null;
      }
    }
    const detail = r && r.status >= 500 ? (await r.text().catch(() => "")).slice(0, 200) : lastErr;
    throw new Error(`拉取 ${table} 失败: ${r ? r.status : "network"} ${detail}`);
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

// —— 图标地址：logo 优先；历史数据把图床链接存在 icon 字段的，同样当图片用 ——
// 与 seo/ai-live.js 的 picUrl() 必须完全同规则，否则静态页有图、前端实时补丁会退化成字母。
function picUrlOf(item) {
  const logo = String(item.logo || "").trim();
  if (/^https?:\/\//i.test(logo)) return logo;
  const icon = String(item.icon || "").trim();
  if (/^https?:\/\//i.test(icon)) return icon;
  return "";
}

// —— 封面：有图用图（懒加载 + 失败重试一次再降级），否则按名称生成稳定的渐变字母封面 ——
// 同源图标用相对路径输出：本地可验证、线上同源少一次 DNS；og:image 仍用绝对地址
const imgSrc = (u) => (u.startsWith(SITE + "/") ? u.slice(SITE.length) : u);

function coverHtml(item, cls) {
  const src = picUrlOf(item);
  if (src) {
    const nameArg = JSON.stringify(String(item.name || "AI")).replace(/"/g, "&quot;");
    return `<img class="${cls}" src="${esc(imgSrc(src))}" alt="${esc(item.name)} 封面" loading="lazy" decoding="async" referrerpolicy="no-referrer" onerror="aiImgErr(this,${nameArg},'${cls}')">`;
  }
  return aiFallback(item.name, cls);
}
// —— 图标自托管：把图床图片下载到 /assets/ai-logos/，避免第三方图床抖动/被拦导致 logo 变字母 ——
// 文件名 = URL 的 md5 前 10 位 + 原扩展名：URL 不变则文件名不变，产物逐字节稳定（幂等）。
// 下载失败时保留外链（页面仍能显示），不会让整次生成失败。
const LOGO_EXT_RE = /\.(png|jpe?g|webp|gif|svg|ico|avif)$/i;
async function localizeLogos(ROOT, items) {
  const dir = join(ROOT, "assets", "ai-logos");
  await mkdir(dir, { recursive: true }).catch(() => {});
  const existing = new Map();
  for (const f of await readdir(dir).catch(() => [])) {
    const m = f.match(/^([0-9a-f]{10})\.([a-z0-9]+)$/i);
    if (m) existing.set(m[1].toLowerCase(), f);
  }
  const used = new Set();
  let fresh = 0, reused = 0, failed = 0;
  for (const it of items) {
    const url = picUrlOf(it);
    if (!url) continue;
    const key = createHash("md5").update(url).digest("hex").slice(0, 10);
    if (existing.has(key)) {
      const f = existing.get(key);
      used.add(f);
      it.logo = `${SITE}/assets/ai-logos/${f}`;
      reused++;
      continue;
    }
    try {
      const r = await fetch(url, {
        signal: AbortSignal.timeout(20000),
        headers: { "user-agent": "Mozilla/5.0 (compatible; lezhesoft-logo-sync)" },
      });
      if (!r.ok) throw new Error(`HTTP ${r.status}`);
      const type = (r.headers.get("content-type") || "").toLowerCase();
      if (type && !/^image\//.test(type)) throw new Error(`content-type ${type}`);
      const buf = Buffer.from(await r.arrayBuffer());
      if (!buf.length) throw new Error("空文件");
      if (buf.length > 3 * 1024 * 1024) throw new Error(`过大 ${buf.length}B`);
      const urlExt = (url.split("?")[0].match(LOGO_EXT_RE) || [])[1] || "";
      const ext = (type.includes("jpeg") ? "jpg"
        : type.includes("png") ? "png"
        : type.includes("webp") ? "webp"
        : type.includes("gif") ? "gif"
        : type.includes("svg") ? "svg"
        : type.includes("avif") ? "avif"
        : urlExt || "png").toLowerCase();
      const name = `${key}.${ext}`;
      await writeFile(join(dir, name), buf);
      existing.set(key, name);
      used.add(name);
      it.logo = `${SITE}/assets/ai-logos/${name}`;
      fresh++;
    } catch (e) {
      failed++;
      console.warn(`⚠ 图标自托管失败（保留外链）${it.name || it.id}: ${e.message}`);
    }
  }
  // 清掉换过 URL 的旧图，避免 assets 无限增长
  let pruned = 0;
  for (const f of await readdir(dir).catch(() => [])) {
    if (used.has(f) || !/^[0-9a-f]{10}\.[a-z0-9]+$/i.test(f)) continue;
    await unlink(join(dir, f)).catch(() => {});
    pruned++;
  }
  console.log(`AI 图标自托管：新下载 ${fresh} / 复用 ${reused} / 失败 ${failed} / 清理 ${pruned}`);
}

// —— 分区图标：统一线性 SVG（替代 emoji / emoji 风图片），按 slug 关键词配色 ——
const SEC_ICONS = [
  [/xiezuo|write|写作/, { c: "#0b66f0", bg: "rgba(11,102,240,.09)", d: '<path d="M12 20h9"/><path d="M16.5 3.5a2.12 2.12 0 0 1 3 3L7 19l-4 1 1-4Z"/>' }],
  [/photo|tuxiang|pic|image|huihua|图像|绘画/, { c: "#7a3ff2", bg: "rgba(122,63,242,.09)", d: '<rect x="3" y="3" width="18" height="18" rx="3"/><circle cx="8.5" cy="8.5" r="1.5"/><path d="m21 15-5-5L5 21"/>' }],
  [/shipin|video|视频/, { c: "#e74c3c", bg: "rgba(231,76,60,.09)", d: '<rect x="2" y="4" width="20" height="16" rx="3"/><path d="m10 9 5 3-5 3Z"/>' }],
  [/yinyue|yinpin|music|audio/, { c: "#e67e22", bg: "rgba(230,126,34,.10)", d: '<path d="M9 18V5l12-2v13"/><circle cx="6" cy="18" r="3"/><circle cx="18" cy="16" r="3"/>' }],
  [/duihua|chat|bot|zhushou|对话|助手/, { c: "#0a8f4d", bg: "rgba(16,163,74,.10)", d: '<path d="M21 11.5a8.38 8.38 0 0 1-.9 3.8 8.5 8.5 0 0 1-7.6 4.7 8.38 8.38 0 0 1-3.8-.9L3 21l1.9-5.7a8.38 8.38 0 0 1-.9-3.8 8.5 8.5 0 0 1 4.7-7.6 8.38 8.38 0 0 1 3.8-.9h.5a8.48 8.48 0 0 1 8 8Z"/>' }],
  [/code|dev|biancheng|kaifa|编程|开发/, { c: "#16a085", bg: "rgba(22,160,133,.10)", d: '<path d="m16 18 6-6-6-6"/><path d="m8 6-6 6 6 6"/>' }],
  [/bangong|office|xiaolv|办公|效率/, { c: "#d98b00", bg: "rgba(240,160,0,.10)", d: '<rect x="2" y="7" width="20" height="14" rx="2"/><path d="M16 21V5a2 2 0 0 0-2-2h-4a2 2 0 0 0-2 2v16"/>' }],
];
const SEC_ICON_DEFAULT = { c: "#0b66f0", bg: "rgba(11,102,240,.09)", d: '<path d="m12 3 1.9 5.8a2 2 0 0 0 1.3 1.3L21 12l-5.8 1.9a2 2 0 0 0-1.3 1.3L12 21l-1.9-5.8a2 2 0 0 0-1.3-1.3L3 12l5.8-1.9a2 2 0 0 0 1.3-1.3Z"/>' };
function secIcon(slug, lg) {
  const s = String(slug || "").toLowerCase();
  const hit = SEC_ICONS.find(([re]) => re.test(s)) || [null, SEC_ICON_DEFAULT];
  const ico = hit[1];
  return `<span class="ai-sec-ico${lg ? " lg" : ""}" style="color:${ico.c};background:${ico.bg}"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${ico.d}</svg></span>`;
}

function aiFallback(name, cls) {
  const s = String(name || "AI");
  const ch = [...s][0] || "A";
  return `<span class="${cls} ai-cover-fb" style="background:linear-gradient(135deg,#0b66f0,#6c5ce7)">${esc(ch)}</span>`;
}
// 兜底脚本注入 <head>：必须早于卡片解析，否则首屏图片先报错时 aiImgErr 还不存在，会留下破图
const FALLBACK_SNIPPET = `<script>function aiFallback(n,c){var s=String(n||'AI'),ch=[...s][0]||'A';return '<span class="'+c+' ai-cover-fb" style="background:linear-gradient(135deg,#0b66f0,#6c5ce7)">'+ch+'</span>';}function aiImgErr(el,n,c){if(el.getAttribute("data-retrying"))return;var s=el.getAttribute("src")||"";if(!s){el.outerHTML=aiFallback(n,c);return;}el.setAttribute("data-retrying","1");var im=new Image();im.className=el.className;im.alt=el.alt;im.decoding="async";im.referrerPolicy="no-referrer";im.onload=function(){if(el.isConnected)el.replaceWith(im);else el.parentNode&&el.parentNode.replaceChild(im,el);};im.onerror=function(){if(el.isConnected)el.outerHTML=aiFallback(n,c);};im.src=s+(s.indexOf("?")>-1?"&":"?")+"r="+Date.now();}</script>`;

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

// —— 详情页：左侧详细介绍大卡 + 右侧悬浮操作栏（仿 ai.bemcss.com 工具详情） ——
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
  let domain = "";
  try {
    domain = new URL(t.url).hostname.replace(/^www\./, "");
  } catch {
    domain = String(t.url || "").replace(/^https?:\/\//, "").replace(/\/.*$/, "");
  }
  const createdAt = t.created_at
    ? new Date(t.created_at).toLocaleDateString("zh-CN", { year: "numeric", month: "2-digit", day: "2-digit" })
    : "持续更新";

  const html =
    head(title4Tool(t, col), desc, canonical, `<meta property="og:image" content="${esc(logo || `${SITE}/og-cover.png`)}">` + aiCss() + FALLBACK_SNIPPET) +
    `
<main>
${crumb([
    { name: "首页", url: `${SITE}/` },
    { name: "AI 工具集", url: `${SITE}/ai/index.html` },
    { name: col.name, url: `${SITE}/ai/${esc(col.slug)}.html` },
    { name: t.name },
  ])}
<div class="ai-detail-grid">
<article class="ai-intro-card">
  <div class="ai-overline">详细介绍</div>
  <h1>${esc(t.name)}</h1>
  ${tags.length ? `<div class="ai-detail-meta">${tags.map((g) => `<span class="chip">${esc(g)}</span>`).join("")}</div>` : ""}
  ${introParas || `<p>${esc(t.summary || `${t.name} 的功能介绍整理中。`)}</p>`}
  ${shots.length ? `<div class="ai-intro-sub">产品截图</div><div class="ai-shots">${shots.map((u, i) => `<a class="ai-shot" href="${esc(u)}" target="_blank" rel="noopener" title="查看大图"><img src="${esc(u)}" alt="${esc(t.name)} 截图${i + 1}" loading="lazy" referrerpolicy="no-referrer"></a>`).join("")}</div>` : ""}
</article>
<aside class="ai-aside">
  <div class="ai-aside-card ai-detail-info">
    <div class="ai-detail-title"><h2>${esc(t.name)}</h2><span class="ai-badge ${badgeClass(t.pricing)}">${esc(t.pricing || "免费")}</span></div>
    <p class="ai-card-summary">${esc(t.summary || "")}</p>
    <a class="ai-site-btn" rel="nofollow noopener" target="_blank" href="${esc(t.url)}"><svg viewBox="0 0 24 24" width="15" height="15" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"/><path d="M15 3h6v6"/><path d="M10 14 21 3"/></svg>访问官网</a>
    <div class="ai-aside-cap">工具信息</div>
    <dl class="ai-info">
      <div class="ai-info-row"><dt>收费模式</dt><dd>${esc(t.pricing || "免费")}</dd></div>
      <div class="ai-info-row"><dt>所属工具集</dt><dd><a href="${SITE}/ai/${esc(col.slug)}.html">${esc(col.name)} ›</a></dd></div>
      <div class="ai-info-row"><dt>官网域名</dt><dd><a rel="nofollow noopener" target="_blank" href="${esc(t.url)}">${esc(domain)}</a></dd></div>
      <div class="ai-info-row"><dt>收录时间</dt><dd>${createdAt}</dd></div>
    </dl>
    <div class="ai-aside-cap">作者信息</div>
    <a class="ai-author" href="${SITE}/"><span class="ai-author-logo">乐</span><span class="ai-author-txt"><b>乐哲软件</b><i>官方收录 · 持续更新</i></span><span class="ai-side-arr">›</span></a>
    <a class="ai-author-more" href="${SITE}/ai/${esc(col.slug)}.html">查看同类工具<span class="arr">›</span></a>
  </div>
</aside>
</div>
${siblings.length ? `<section class="ai-detail-sec"><h2>同类工具推荐</h2><div class="ai-cards">${siblings.map(toolCard).join("\n")}</div></section>` : ""}
<p class="ai-back"><a href="${SITE}/ai/index.html">← 全部工具集</a></p>
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
${liveTag()}
${foot("ai-tool-" + toolSlug(t))}`;
  return { html };
}

function title4Tool(t, col) {
  // 工具集名若已以「工具」结尾（如「Ai办公工具」），再拼「工具详解」会变成「工具工具详解」
  const cat = String(col?.name || "").trim();
  const suffix = !cat ? "工具详解" : /工具$/.test(cat) ? "详解" : "工具详解";
  return `${t.name}怎么样 - ${cat}${suffix} | 乐哲软件`.slice(0, 60);
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

// —— 页面渲染 ——

// —— 页面渲染 ——
// 注意：hub 列表页不要加任何描述导语/段落（用户 2026-11-04 明确要求，靠卡片+分类页对比表保文字量）。

export function renderAiHub(collections, byCollection) {
  const title = "AI工具集 - 精选AI工具合集导航 | 乐哲软件";
  const desc =
    "乐哲软件 AI 工具集：按使用场景整理的 AI 工具合集，每个工具集独立成页，涵盖 AI 对话、写作、绘画图像、视频音频、编程开发、办公效率等方向，逐个标注收费模式与适用人群，持续增补更新，找 AI 工具收藏这一页就够了。";
  const canonical = `${SITE}/ai/index.html`;
  const hasContent = collections.length > 0;

  const sections = collections
    .map((c) => {
      const tools = byCollection[c.slug] || [];
      const CAP = 12;
      const shown = tools.slice(0, CAP);
      if (!shown.length) return "";
      return `<section class="ai-sec" id="${esc(c.slug)}">
  <div class="ai-sec-head">${secIcon(c.slug)}
  <h2>${esc(c.name)}</h2>
  <a class="ai-sec-more" href="${SITE}/ai/${esc(c.slug)}.html">查看更多 ›</a></div>
  <div class="ai-cards">${shown.map(toolCard).join("\n")}</div>
</section>`;
    })
    .filter(Boolean)
    .join("\n");

  const body = hasContent
    ? `<div id="aiHubBody">${sections || `<div class="ai-empty"><p>各工具集正在整理中，很快上线。</p></div>`}</div>`
    : `<div class="ai-empty"><p>各工具集正在整理中，很快上线。</p><p>计划方向：AI 对话助手、AI 写作、AI 绘画图像、AI 视频音频、AI 编程开发、AI 办公效率等，每个方向一个独立工具集。</p></div>`;

  const html =
    head(title, desc, canonical, `<meta property="og:image" content="${SITE}/og-cover.png">` + aiCss() + FALLBACK_SNIPPET) +
    `
<main>
<h1 class="ai-h1">AI 工具集</h1>
${body}
</main>
${jsonLd({
    "@context": "https://schema.org",
    "@type": "CollectionPage",
    name: "AI 工具集",
    description: desc,
    url: canonical,
  })}
${jsonLd({
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: [
      { "@type": "ListItem", position: 1, name: "乐哲软件官网", item: `${SITE}/` },
      { "@type": "ListItem", position: 2, name: "AI 工具集", item: canonical },
    ],
  })}
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
<p>这里将收录与「${esc(col.name)}」相关的 AI 工具：逐个标注收费模式、核心定位与适用人群，附官网入口与快速对比表。正在找这类工具的话，可以先收藏本页，上架后会第一时间出现在这里。上架节奏以实用为先：先把每个方向最常用的两三款补齐并逐一试用核对，再逐步扩充长尾工具，避免一次塞满却没有筛选。收录标准同样以日常可用性为先：注册门槛低、中文支持好、免费额度够跑通完整流程的优先收录，纯套壳或长期无法访问的不收。</p></div>`;

  const html =
    head(title, desc, canonical, `<meta property="og:image" content="${SITE}/og-cover.png">` + aiCss() + FALLBACK_SNIPPET) +
    `
<main>
${crumb([
    { name: "首页", url: `${SITE}/` },
    { name: "AI 工具集", url: `${SITE}/ai/index.html` },
    { name: col.name },
  ])}
<div class="ai-col-hero">
  ${secIcon(col.slug, true)}
  <div><h1>${esc(col.name)}</h1>
  <p class="ai-lead">${esc(col.description || `精选 ${tools.length} 款${col.name}，逐个标注收费模式，持续更新。`)}</p></div>
</div>
${toolsBlock}
${buildCompare(col, tools)}
<p class="ai-back"><a href="${SITE}/ai/index.html">← 返回全部工具集</a></p>
</main>
${jsonLd({
    "@context": "https://schema.org",
    "@type": "CollectionPage",
    name: col.name,
    description: desc,
    url: canonical,
    numberOfItems: tools.length,
  })}
${liveTag()}
${foot("ai-" + col.slug)}`;
  return { html };
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

  // AI 长文本母本兜底（2026-11-14）：Gemini/千问的 intro（约 3k 字）经代理传输会在固定字节偏移
  // 截断出 U+FFFD——重拉无效、8 副本合并无效（坏点不是随机的，是确定的）。
  // 母本由「变换 select 字段组合改变响应字节对齐 + 锚点补丁」重建，可信。
  // 命中条件 = 本次拉取值含 U+FFFD：后台日后正常编辑（无乱码）不会被母本遮蔽。
  const AI_DATA_MASTERS = [
    { id: "e5250392-a028-4434-9e69-f0b5ac19c654", field: "intro", file: "content-master-e5250392.txt" },
    { id: "04797ed9-11be-4cc1-8f2a-a87af7718fb2", field: "intro", file: "content-master-04797ed9.txt" },
  ];
  for (const m of AI_DATA_MASTERS) {
    const row = (tools || []).find((t) => t.id === m.id);
    if (!row || typeof row[m.field] !== "string" || !row[m.field].includes("\uFFFD")) continue;
    try {
      const master = readFileSync(join(ROOT, "seo", m.file), "utf8").replace(/\s+$/, "");
      if (master && !master.includes("\uFFFD")) {
        row[m.field] = master;
        console.log(`已用母本覆盖 AI 工具 ${m.id.slice(0, 8)}.${m.field}（传输乱码兜底）`);
      }
    } catch {}
  }

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

  // 图标自托管：第三方图床在部分网络下会超时/被拦，卡片就退化成一个字。下载到站内更稳。
  await localizeLogos(ROOT, [...(tools || []), ...(cols || [])]);

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

  // 清空重建 /ai/（沙箱里批量删除可能被安全守卫拦截，拦下就退化为覆盖写入）
  const aiDir = join(ROOT, "ai");
  if (existsSync(aiDir)) {
    try {
      await rm(aiDir, { recursive: true });
    } catch (e) {
      console.warn(`⚠ 未能清空 ai/（${e.code || "删除被拦截"}），改为覆盖写入`);
    }
  }
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
  // 本地图标映射：前端实时重绘时优先用站内图，避免「新工具一出现 → 老卡片又退回第三方图床」
  const logoMap = {};
  for (const t of allTools) if (t.logo && t.logo.startsWith(SITE + "/")) logoMap[t.id] = imgSrc(t.logo);
  for (const c of collections) if (c.logo && c.logo.startsWith(SITE + "/")) logoMap[c.id] = imgSrc(c.logo);
  LIVE_CFG = {
    api: U,
    key: K,
    sig: aiSig(collections, allTools),
    pages: livePages,
    tools: liveTools,
    logos: logoMap,
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
/* AI 板块专属布局：仿 tool.caie.ai 简洁风 —— 无侧栏、1200px 居中内容区、紧凑卡片网格
   注意：全站 <style> 在本文件之后加载，必须用 body 前缀提高优先级，否则 main/footer 会被全站 760px 规则覆盖 */
body{background:var(--bg-secondary,#f5f6f8)}
body main{max-width:1400px;margin:0 auto;padding:26px 40px 60px}
body footer{max-width:1400px}
body header{position:sticky;top:0;z-index:100}
/* 板块首页头部（居中大标题） */
.ai-h1{display:flex;align-items:center;justify-content:center;gap:12px;font-size:2rem;margin:14px 0 20px;text-align:center;letter-spacing:.01em}
/* 工具集头部（独立页） */
.ai-col-hero{display:flex;align-items:center;gap:16px;margin:6px 0 14px}
.ai-col-hero h1{margin:0;font-size:1.5rem}
/* 分区头（板块首页）：线性 SVG 图标 + 名称，参考 tool.caie.ai 的极简分区 */
.ai-sec{margin:30px 0}
.ai-sec-head{display:flex;align-items:center;gap:10px;margin-bottom:14px}
.ai-sec-ico{width:28px;height:28px;border-radius:8px;display:inline-flex;align-items:center;justify-content:center;flex-shrink:0}
.ai-sec-ico svg{width:15px;height:15px;display:block}
.ai-sec-ico.lg{width:60px;height:60px;border-radius:15px}
.ai-sec-ico.lg svg{width:28px;height:28px}
.ai-sec-head h2{margin:0;font-size:1.02rem;font-weight:600}
.ai-sec-more{margin-left:auto;font-size:.8rem;color:#a6adba;text-decoration:none;white-space:nowrap}
.ai-sec-more:hover{color:#0b66f0}
/* 工具集对比表（分类页）：移动端横向滚动，不挤压卡片 */
.ai-compare table{width:100%;border-collapse:collapse;margin:10px 0 14px;font-size:.88rem;display:block;overflow-x:auto;white-space:nowrap}
.ai-compare thead th{text-align:left;font-weight:600;color:var(--text-primary,#1c2333);padding:8px 12px 8px 0;border-bottom:1px solid var(--ai-border)}
.ai-compare tbody td{padding:9px 12px 9px 0;border-bottom:1px solid var(--ai-border);vertical-align:top}
.ai-compare tbody td:first-child{font-weight:600}
.ai-compare tbody tr:last-child td{border-bottom:0}
.ai-compare p{margin:6px 0 0}
/* 卡片流（tool.caie.ai 同款：圆形图标 + 名称 + 一句话简介，6 列自适应，扁卡细边框） */
.ai-cards{display:grid;grid-template-columns:repeat(auto-fill,minmax(190px,1fr));gap:16px 14px}
.ai-card{display:flex;align-items:center;gap:11px;background:var(--bg-card-solid,#fff);border:1px solid #f0f1f4;border-radius:8px;padding:14px 15px;text-decoration:none;color:inherit;transition:.15s;min-width:0;overflow:hidden}
.ai-card:hover{border-color:#5961f9;box-shadow:0 5px 16px rgba(89,97,249,.14)}
.ai-card-main{flex:1;min-width:0;display:flex;flex-direction:column;gap:3px;max-width:100%}
.ai-card-name{font-weight:700;font-size:.9rem;color:#1f2733;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;max-width:100%}
.ai-badge{margin-left:auto;font-size:.68rem;padding:2px 8px;border-radius:20px;white-space:nowrap;flex-shrink:0}
.ai-cover{width:40px;height:40px;border-radius:50%;object-fit:cover;flex-shrink:0;box-shadow:0 1px 4px rgba(20,40,80,.12)}
span.ai-cover.ai-cover-fb{display:inline-flex;align-items:center;justify-content:center;color:#fff;font-weight:800;font-size:1rem}
.ai-card-summary{margin:0;font-size:.74rem;color:#a6adba;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;max-width:100%}
.ai-badge.free{color:#0a8f4d;background:rgba(16,163,74,.1)}
.ai-badge.freemium{color:#b07000;background:rgba(240,180,0,.12)}
.ai-badge.sub{color:#0066cc;background:rgba(0,119,255,.1)}
.ai-badge.once{color:#7a3ff2;background:rgba(122,63,242,.1)}
.chip{font-size:.74rem;color:#41506b;background:#eef2f8;border-radius:6px;padding:2px 8px}
/* 其余 */
.ai-lead{color:var(--text-secondary,#5b6472);max-width:56em;margin:8px 0 0}
.ai-note{margin:30px 0 0;padding-top:18px;border-top:1px solid var(--ai-border);color:var(--ai-dim);font-size:.9rem;line-height:1.8;max-width:900px}
.ai-note h2{font-size:1.05rem;color:var(--text-primary,#1c2333)}
.ai-back{margin-top:26px;text-align:center}
body .ai-back a{display:inline-flex;align-items:center;gap:7px;padding:10px 26px;border:1px solid #e2e6ee;border-radius:50px;color:#41506b;text-decoration:none;font-size:.86rem;font-weight:600;background:var(--bg-card-solid,#fff);transition:.16s}
body .ai-back a:hover{color:#0b66f0;border-color:rgba(11,102,240,.5);box-shadow:0 3px 12px rgba(11,102,240,.12);transform:translateY(-1px)}
[data-theme="dark"] .ai-back a{border-color:rgba(255,255,255,.14);color:#b8c4d8;background:transparent}
[data-theme="dark"] .ai-back a:hover{color:#7eb8ff;border-color:rgba(94,184,255,.4)}
.ai-empty{padding:38px 20px;text-align:center;color:#5b6472;background:var(--bg-card-solid,#fff);border:1px dashed #d5dbe6;border-radius:12px;font-size:.95rem;line-height:1.8}
/* 主题适配 */
[data-theme="dark"] .ai-card,[data-theme="dark"] .ai-col-hero,[data-theme="dark"] .ai-intro-card,[data-theme="dark"] .ai-aside-card{background:rgba(255,255,255,.04)}
[data-theme="dark"] .ai-card{border-color:rgba(255,255,255,.1)}
[data-theme="dark"] .chip{background:rgba(255,255,255,.08);color:#b8c4d8}
[data-theme="glass"] .ai-card,[data-theme="glass"] .ai-intro-card,[data-theme="glass"] .ai-aside-card{background:rgba(255,255,255,.07);border-color:rgba(255,255,255,.14);box-shadow:var(--shadow-sm,none)}
/* 详情页：左介绍大卡 + 右操作栏（仿 ai.bemcss.com 工具详情） */
.ai-detail-grid{display:grid;grid-template-columns:minmax(0,1fr) 296px;gap:20px;align-items:start;margin:12px 0 18px}
/* 左：介绍大卡 */
.ai-intro-card{background:var(--bg-card-solid,#fff);border:1px solid var(--border-glow,var(--ai-border));border-radius:14px;padding:26px 28px 28px;box-shadow:0 1px 3px rgba(20,40,80,.04);min-width:0}
.ai-overline{font-size:.72rem;font-weight:600;letter-spacing:.16em;color:#9aa3b2;margin-bottom:10px}
.ai-intro-card h1{font-size:1.4rem;font-weight:800;margin:0 0 12px;letter-spacing:.01em;line-height:1.35}
.ai-intro-card>p{color:#3d4657;line-height:1.92;margin:0 0 12px;font-size:.93rem}
.ai-detail-meta{display:flex;align-items:center;flex-wrap:wrap;gap:6px;margin:0 0 16px}
.ai-intro-sub{font-size:.78rem;font-weight:600;letter-spacing:.12em;color:#9aa3b2;margin:22px 0 10px}
.ai-shots{display:grid;grid-template-columns:repeat(auto-fill,minmax(250px,1fr));gap:10px;margin:0}
.ai-shot{display:block;aspect-ratio:16/9;overflow:hidden;border-radius:10px;border:1px solid var(--ai-border);background:var(--bg-secondary,#f4f7fb)}
.ai-shot img{width:100%;height:100%;object-fit:cover;display:block;transition:transform .25s}
.ai-shot:hover img{transform:scale(1.03)}
/* 右：操作卡 */
.ai-aside{position:sticky;top:76px}
.ai-aside-card{background:var(--bg-card-solid,#fff);border:1px solid var(--border-glow,var(--ai-border));border-radius:14px;padding:22px 20px 18px;box-shadow:0 1px 3px rgba(20,40,80,.04)}
.ai-detail-title{display:flex;align-items:center;gap:8px;flex-wrap:wrap;margin-bottom:6px}
.ai-detail-title h2{margin:0;font-size:1.08rem;font-weight:700;line-height:1.3}
.ai-aside-card .ai-card-summary{white-space:normal;font-size:.82rem;line-height:1.65;color:#8a93a3;margin:0 0 16px}
.ai-site-btn{display:flex;align-items:center;justify-content:center;gap:7px;width:100%;box-sizing:border-box;background:linear-gradient(135deg,#0b66f0,#6c5ce7);color:#fff;text-decoration:none;font-weight:600;font-size:.9rem;padding:12px 16px;border-radius:10px;transition:.16s}
.ai-site-btn:hover{transform:translateY(-1px);box-shadow:0 5px 14px rgba(11,102,240,.32)}
.ai-fav-btn{display:none}
.ai-info{margin:12px 0 0;display:flex;flex-direction:column;gap:7px}
.ai-info-row{display:flex;align-items:center;justify-content:space-between;gap:12px;padding:9px 13px;background:var(--bg-secondary,#f5f7fa);border-radius:9px}
.ai-info-row dt{font-size:.76rem;color:#8a93a3;flex-shrink:0}
.ai-info-row dd{margin:0;font-size:.8rem;color:#2b3444;font-weight:600;text-align:right;min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;max-width:65%}
body .ai-info-row dd a{color:#0b66f0;text-decoration:none;font-weight:600}
body .ai-info-row dd a:hover{text-decoration:underline}
[data-theme="dark"] .ai-info-row{background:rgba(255,255,255,.05)}
[data-theme="dark"] .ai-info-row dd{color:#dbe3ef}
.ai-aside-cap{display:flex;align-items:center;gap:6px;font-size:.74rem;font-weight:600;letter-spacing:.12em;color:#9aa3b2;border-top:1px solid var(--ai-border);margin-top:18px;padding-top:16px}
.ai-author{display:flex;align-items:center;gap:10px;text-decoration:none;color:inherit;padding:12px 2px 4px}
.ai-author:hover .ai-side-arr{color:#0b66f0}
.ai-author-logo{width:38px;height:38px;border-radius:10px;background:linear-gradient(135deg,#0b66f0,#6c5ce7);color:#fff;display:inline-flex;align-items:center;justify-content:center;font-weight:700;flex-shrink:0}
.ai-author-txt{display:flex;flex-direction:column;min-width:0;flex:1}
.ai-author-txt b{font-size:.88rem;font-weight:700}
.ai-author-txt i{font-style:normal;font-size:.72rem;color:#9aa3b2;margin-top:2px}
.ai-side-arr{margin-left:auto;color:#c3cad6;font-size:1.1rem;line-height:1;flex-shrink:0;transition:.15s}
.ai-author-more{display:flex;align-items:center;justify-content:center;gap:4px;width:100%;box-sizing:border-box;margin-top:10px;border-top:1px solid var(--ai-border);padding:14px 0 2px;font-size:.83rem;color:#41506b;text-decoration:none;transition:.15s}
.ai-author-more .arr{color:#c3cad6;font-size:1rem;line-height:1}
.ai-author-more:hover{color:#0b66f0}
.ai-detail-sec{margin:22px 0}
.ai-detail-sec h2{font-size:1.15rem;margin:0 0 12px;padding-left:12px;border-left:4px solid #0077ff;line-height:1.3}
.ai-detail-sec p{color:var(--text-secondary,#41506b);line-height:1.85;margin:0 0 12px;font-size:.94rem}
/* 实时预览浮层沿用旧详情头部样式 */
.ai-detail-head{display:flex;align-items:flex-start;gap:20px;margin:8px 0 16px;padding:18px;background:var(--bg-card-solid,#fff);border:1px solid var(--border-glow,var(--ai-border));border-radius:16px;box-shadow:0 1px 4px rgba(20,40,80,.05)}
.ai-detail-head h1{margin:0 0 8px}
.ai-detail-cover{width:96px;height:96px;border-radius:18px;object-fit:cover;box-shadow:0 3px 12px rgba(20,40,80,.16);flex-shrink:0}
span.ai-detail-cover.ai-cover-fb{display:inline-flex;align-items:center;justify-content:center;color:#fff;font-weight:800;font-size:2.2rem}
.ai-detail-info .ai-card-summary{margin:0;white-space:normal;display:-webkit-box;-webkit-line-clamp:3;-webkit-box-orient:vertical}
.ai-detail-actions{display:flex;gap:10px;margin-top:12px;flex-wrap:wrap}
/* 移动端/窄屏 */
@media (max-width:960px){
.ai-detail-grid{grid-template-columns:1fr}
.ai-aside{position:static;order:-1}
}
@media (max-width:640px){
body main{padding:14px 14px 44px}
.ai-h1{font-size:1.4rem}
.ai-cards{grid-template-columns:repeat(2,1fr);gap:9px}
.ai-card{padding:10px;gap:9px;border-radius:11px}
.ai-cover{width:36px;height:36px}
.ai-card-name{font-size:.8rem}
.ai-card-summary{font-size:.66rem}
.ai-col-hero{gap:12px}
.ai-sec-ico.lg{width:48px;height:48px;border-radius:12px}
.ai-sec-ico.lg svg{width:23px;height:23px}
.ai-intro-card{padding:18px 16px}
.ai-aside-card{padding:16px}
.ai-detail-sec h2{font-size:1.05rem}
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
