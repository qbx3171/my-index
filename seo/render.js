/**
 * 乐哲软件静态 SEO 页渲染层（GitHub Pages 版）
 * 与 Worker 版的差异：所有 URL 带 .html 后缀（GitHub Pages 不支持无扩展名路由）
 */

export const SITE = "https://www.lezhesoft.cn";

// 全站兜底分享图（1200x630）。分类页没有专属封面、部分软件页没有 icon，
// 缺 og:image 时在微信/Bing 分享卡片里会显示纯文字，统一回落到这张。
const OG_FALLBACK = `${SITE}/og-cover.png`;

export const pick = (row, keys, dflt = "") => {
  for (const k of keys) if (row?.[k] != null && row[k] !== "") return row[k];
  return dflt;
};

export const esc = (s) =>
  String(s ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");

const softUrl = (id) => `${SITE}/soft/${encodeURIComponent(id)}.html`;
const tutUrl = (id) => `${SITE}/tutorial/${encodeURIComponent(id)}.html`;

// 分类 ASCII slug：彻底规避 GitHub Pages / git / API 对非 ASCII 文件名的编码问题
const CAT_SLUGS = {
  "Adobe系列": "adobe",
  "三维设计": "sanwei-sheji",
  "办公软件": "bangong-ruanjian",
  "压缩工具": "yasuo-gongju",
  "图像处理": "tuxiang-chuli",
  "图像设计": "tuxiang-sheji",
  "媒体工具": "meiti-gongju",
  "安卓软件": "anzhuo-ruanjian",
  "实用工具": "shiyong-gongju",
  "开发工具": "kaifa-gongju",
  "插件管理": "chajian-guanli",
  "模型制作": "moxing-zhizuo",
  "系统镜像": "xitong-jingxiang",
  "虚拟机模拟器": "xuniji-moniqi",
  "驱动管理": "qudong-guanli",
};
const catHash = (s) => {
  let h = 0;
  for (const ch of String(s)) h = (h * 31 + ch.codePointAt(0)) >>> 0;
  return h.toString(36);
};
export const catSlug = (c) => CAT_SLUGS[c] || `cat-${catHash(c)}`;
export const catUrl = (c) => `${SITE}/cat/${catSlug(c)}.html`;

// —— SEO 文案辅助 ——
const stripHtml = (s) =>
  String(s ?? "")
    .replace(/<[^>]*>/g, " ")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/\s+/g, " ")
    .trim();

// meta description 目标长度：过短会被 Bing 判为「too short」
const MIN_DESC = 100;

// 按标点边界裁剪，避免描述断在半句/词中间（如「…屏幕检测、电池信」）
const clip = (s, max) => {
  if (s.length <= max) return s;
  const head = s.slice(0, max);
  const m = head.match(/^[\s\S]*[，。；：！？、,.;:!?]/);
  if (m && m[0].length >= Math.floor(max * 0.6)) return m[0].replace(/[，。；：、,.;:!?\s]+$/, "");
  return head.replace(/[，。；：、,.;:!?\s]+$/, "");
};

// 软件名按空格/中点边界裁剪，绝不截出半个词（标题用）
const clipName = (s, max) => {
  if (max <= 4) return "";
  const chars = [...s];
  if (chars.length <= max) return s;
  const head = chars.slice(0, max).join("");
  const cut = head.replace(/[\s·、|/（(《【\-—,，.。:：]+[^\s·、|/（(《【\-—,，.。:：]*$/, "");
  return (cut.length >= Math.max(6, max * 0.55) ? cut : head).trim();
};

export const platformLabel = (s) => {
  const p = Array.isArray(s?.platforms) ? s.platforms.join(",") : String(s?.platforms ?? "");
  if (/win/i.test(p)) return "Windows";
  if (/mac|os ?x|darwin|apple/i.test(p)) return "Mac";
  return p ? p.slice(0, 20) : "";
};

const head = (title, desc, canonical, extra = "", robots = "index,follow,max-image-preview:large") => `<!DOCTYPE html>
<html lang="zh-CN">
<head>
<meta charset="UTF-8">
<script>if(location.protocol==="http:"&&/(^|\\.)lezhesoft\\.cn$/.test(location.hostname))location.replace("https://"+location.host+location.pathname+location.search+location.hash);</script>
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<meta name="applicable-device" content="pc,mobile">
<title>${esc(title)}</title>
<meta name="description" content="${esc(desc)}">
<meta name="robots" content="${robots}">
<link rel="canonical" href="${esc(canonical)}">
<meta property="og:type" content="article">
<meta property="og:site_name" content="乐哲软件">
<meta property="og:title" content="${esc(title)}">
<meta property="og:description" content="${esc(desc)}">
<meta property="og:url" content="${esc(canonical)}">
${extra}
<style>
body{font-family:system-ui,-apple-system,"PingFang SC","Microsoft YaHei",sans-serif;margin:0;color:#1a1a1a;line-height:1.8}
header{background:#0077ff;color:#fff;padding:14px 20px;font-size:17px;font-weight:500;display:flex;align-items:center;gap:14px}
header a{color:#fff;text-decoration:none;flex:0 0 auto}
header form{margin:0 0 0 auto;display:flex;gap:6px}
header input{width:150px;padding:6px 10px;border:0;border-radius:6px;font-size:14px;background:rgba(255,255,255,.95);color:#1a1a1a;outline:none;font-family:inherit}
header button{padding:6px 12px;border:0;border-radius:6px;background:rgba(255,255,255,.22);color:#fff;font-size:14px;cursor:pointer;font-family:inherit}
header button:hover{background:rgba(255,255,255,.34)}
@media(max-width:480px){header input{width:96px}}
main{max-width:760px;margin:0 auto;padding:24px 20px}
.meta{color:#666;font-size:14px;margin:6px 0 18px}.meta span{margin-right:14px}
.btn{display:inline-block;background:#0077ff;color:#fff;padding:11px 28px;border-radius:8px;text-decoration:none;font-size:16px;margin:10px 0}
.rel{margin-top:36px;border-top:1px solid #eee;padding-top:18px}
.cta{margin-top:26px;padding:13px 16px;background:#f0f6ff;border:1px solid #d8e6ff;border-radius:9px;font-size:14px;line-height:1.9;color:#333}
.cta a{color:#0077ff;text-decoration:none;font-weight:500}
.rel a{display:inline-block;margin:0 10px 10px 0;color:#0077ff;text-decoration:none}
article img{max-width:100%}
footer{max-width:760px;margin:0 auto;padding:20px;color:#888;font-size:13px}
footer a{color:#888}
nav.crumb{font-size:13px;color:#999;margin-bottom:12px}nav.crumb a{color:#999;text-decoration:none}
h1{font-size:24px;margin:8px 0}
</style>
</head>
<body>
<header><a href="${SITE}/">乐哲软件</a><form action="${SITE}/sitemap.html" method="get" role="search"><input type="search" name="q" placeholder="搜索软件" aria-label="搜索软件" autocomplete="off"><button type="submit">搜索</button></form></header>`;

// 品牌锚文本轮换：按页面 URL 的稳定 hash 分配，覆盖「官网词 / 精确品牌词 / 域名」三种变体，
// 避免 177 个页面页脚清一色同一个锚文本（机械感强，且只覆盖单一变体）
const BRAND_ANCHORS = ["乐哲软件官网", "乐哲软件", "乐哲软件官网", "lezhesoft.cn"];
let footSeq = 0;
export const resetFootSeq = () => {
  footSeq = 0;
};
const foot = (seed) => {
  let n;
  if (seed) {
    n = 0;
    for (const ch of String(seed)) n = (n * 31 + ch.codePointAt(0)) % 100003;
  } else {
    n = footSeq++;
  }
  const anchor = BRAND_ANCHORS[n % BRAND_ANCHORS.length];
  return `<footer><a href="${SITE}/">${esc(anchor)}</a> · © 2026 乐哲软件 lezhesoft.cn · <a href="${SITE}/sitemap.html">网站地图</a> · <a href="${SITE}/copyright.html">版权声明</a></footer>
</body></html>`;
};

const crumb = (items) =>
  `<nav class="crumb">${items
    .map((it, i) =>
      it.url ? `<a href="${esc(it.url)}">${esc(it.name)}</a>${i < items.length - 1 ? " / " : ""}` : esc(it.name)
    )
    .join("")}</nav>`;

const relatedBlock = (title, list) =>
  list && list.length
    ? `<div class="rel"><strong>${esc(title)}：</strong><br>${list
        .map((r) => {
          const id = pick(r, ["id"]);
          const name = pick(r, ["name", "title"], id);
          return r.title
            ? `<a href="${tutUrl(id)}">${esc(name)}</a>`
            : `<a href="${softUrl(id)}">${esc(name)}</a>`;
        })
        .join("")}</div>`
    : "";

const jsonLd = (obj) =>
  `<script type="application/ld+json">${JSON.stringify(obj)}</script>`;

/* 教程正文里的图片多为采集来的截图，普遍没有 alt。
   在渲染层统一补上「标题 + 序号」的描述性 alt，避免无障碍/图片搜索扣分。 */
const addImgAlt = (html, base) => {
  let n = 0;
  return String(html || "").replace(/<img\b([^>]*)>/gi, (m, attrs) => {
    if (/\balt\s*=/.test(attrs)) return m;
    n += 1;
    return `<img alt="${esc(base)} 教程配图${n}"${attrs}>`;
  });
};

/* ---------------- 软件详情页 ---------------- */

export function renderSoftPage(soft, related = [], opts = {}) {
  const id = pick(soft, ["id"]);
  const name = pick(soft, ["name"], id);
  const category = pick(soft, ["category"], "软件库");
  const version = pick(soft, ["version"]);
  const description = pick(soft, ["description"], `${name}免费下载，附安装教程。`);
  const downloadUrl = pick(soft, ["download_url", "free_link"]);
  const iconUrl = pick(soft, ["icon_url"]);
  const platforms = Array.isArray(soft.platforms) ? soft.platforms.join(" / ") : pick(soft, ["platforms"]);
  const date = pick(soft, ["date", "created_at"], "");
  const price = Number(soft.price) || 0;
  const canonical = softUrl(id);

  // 标题：同名同版本的多平台记录（Windows/Mac 各一条）用平台后缀区分，避免重复标题
  // 控制在 60 字以内，超出时按词边界截断软件名（SERP 超长会被截断，浪费品牌词）
  const dupPlatform = opts.dupPlatform || null;
  const platPart = dupPlatform ? `（${dupPlatform}版）` : "";
  const catSuffix = `${platPart} - ${category} | 乐哲软件`;
  // 以「渲染后可见字符数」计量，&amp; 这类实体会被搜索引擎当作 1 个字符
  const visLen = (s) =>
    [...String(s).replace(/&amp;/g, "&").replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&quot;/g, '"')].length;
  const nameHasVersion = version && name.includes(version);
  let verPart = version && !nameHasVersion ? ` v${version}` : "";
  const fits = (n) => visLen(n) + 2 + visLen(verPart) + visLen(catSuffix) <= 60;
  let baseName = name;
  if (!fits(baseName)) {
    if (verPart) verPart = ""; // 先牺牲版本号，保软件名
    if (!fits(baseName)) baseName = clipName(baseName, 60 - visLen(catSuffix) - 2);
  }
  const title = `${baseName}下载${verPart}${catSuffix}`;

  // 描述：过短则用 detail 正文补足；同名/碰撞记录强制追加尾注并预留尾部空间，
  // 保证截断到 158 字后各页描述仍然唯一
  let base = description.trim();
  let tail = "";
  if (opts.forceDescTail) {
    tail = `本页为${dupPlatform || platformLabel(soft) || "当前"}平台 v${version || "当前"} 版本下载页，其他版本请查看同分类列表。`;
  } else if (dupPlatform) {
    tail = `本页面为${dupPlatform}平台版本，其他平台版本请查看同分类列表。`;
  }
  let descFull = base;
  if (descFull.length < MIN_DESC) {
    const detailText = stripHtml(soft.detail);
    if (detailText) descFull += `软件详情：${detailText}`;
  }
  if (descFull.length < MIN_DESC) {
    descFull += `${name}${version ? ` v${version}` : ""}已由乐哲软件完整收录，提供高速免费下载通道，页面附版本号、更新日期、文件大小与平台兼容性等参数信息，安装或使用中遇到问题可查阅站内图文教程，下载前请确认系统环境满足软件运行要求。`;
  }
  if (tail) {
    const room = 158 - tail.length;
    descFull = clip(descFull, room) + tail;
  }
  const metaDesc = clip(descFull, 158);

  const html = head(
    title,
    metaDesc,
    canonical,
    `<meta property="og:image" content="${esc(iconUrl || OG_FALLBACK)}">` +
      jsonLd({
        "@context": "https://schema.org",
        "@type": "SoftwareApplication",
        name,
        operatingSystem: platforms || "Windows, macOS",
        applicationCategory: category,
        softwareVersion: version || undefined,
        description: metaDesc,
        image: iconUrl || undefined,
        dateModified: date || undefined,
        offers: { "@type": "Offer", price: String(price), priceCurrency: "CNY" },
        author: { "@type": "Organization", name: "乐哲软件", url: `${SITE}/` },
      }) +
      jsonLd({
        "@context": "https://schema.org",
        "@type": "BreadcrumbList",
        itemListElement: [
          { "@type": "ListItem", position: 1, name: "首页", item: `${SITE}/` },
          { "@type": "ListItem", position: 2, name: category, item: catUrl(category) },
          { "@type": "ListItem", position: 3, name },
        ],
      })
  ) + `
<main>
${crumb([
  { name: "首页", url: `${SITE}/` },
  { name: category, url: catUrl(category) },
  { name },
])}
<h1>${esc(name)}下载</h1>
<div class="meta">
${version ? `<span>版本：${esc(version)}</span>` : ""}
${platforms ? `<span>平台：${esc(platforms)}</span>` : ""}
<span>分类：${esc(category)}</span>
${date ? `<span>更新：${esc(String(date).slice(0, 10))}</span>` : ""}
<span>价格：${price > 0 ? `¥${price}` : "免费"}</span>
</div>
<p>${esc(description)}</p>
${downloadUrl ? `<a class="btn" href="${esc(downloadUrl)}" rel="nofollow">立即下载 ${esc(name)}</a>` : ""}
<p>${esc(name)}由乐哲软件收录整理。下载前请阅读软件许可协议；安装中如遇缺少运行库、报错代码等问题，请参考站内相关教程。</p>
<div class="cta"><strong>本站软件全部免费下载。</strong>注册登录后可解锁更高速通道与更高的每日下载次数，完全免费，无需付费开通。<a href="${SITE}/">免费注册 →</a></div>
${relatedBlock(opts.mixedRelated ? "同类与热门软件" : "同分类软件", related)}${relatedBlock("相关教程", opts.tutorials || [])}
</main>
${foot(canonical)}`;
  return { html, title };
}

/* ---------------- 分类聚合页 ---------------- */

export function renderCategoryPage(category, rows = []) {
  const canonical = catUrl(category);
  // 「办公软件」这类本身已含“软件”的分类，避免出现「办公软件软件下载大全」
  const label = /(软件|工具|系列)$/.test(category) ? `${category}下载大全` : `${category}软件下载大全`;
  const title = `${label}_共${rows.length}款 - 乐哲软件`;
  const topNames = rows.slice(0, 6).map((r) => pick(r, ["name"])).filter(Boolean);
  const desc = `乐哲软件${category}分类页，共收录${rows.length}款${category}软件，涵盖${topNames.join("、")}等常用工具，每款软件均标注最新版本号、更新日期与平台兼容性，全部提供高速免费下载与详细安装教程，列表持续更新，帮助你快速找到合适的${category}软件。`;
  // 分类导语：用真实数据拼，避免与其他分类页雷同（同时解决小分类正文过薄）
  const newest = rows[0] || {};
  const newestName = pick(newest, ["name"]);
  const newestVer = pick(newest, ["version"]);
  const newestDate = pick(newest, ["date", "created_at"]);
  const newestPlatform = platformLabel(newest);
  const intro = [
    `${category}分类目前收录 ${rows.length} 款软件${topNames.length ? `，包括 ${topNames.slice(0, 3).join("、")}` : ""}${
      rows.length > 3 ? " 等" : ""
    }。`,
    newestName
      ? `最近更新的是 ${newestName}${newestVer ? ` v${newestVer}` : ""}${newestDate ? `（${String(newestDate).slice(0, 10)}）` : ""}${
          newestPlatform ? `，适用于 ${newestPlatform}` : ""
        }。`
      : "",
    `每款软件都标注了版本号、更新时间与支持平台，点开即可查看功能介绍、安装步骤与下载入口。`,
    rows.length >= 2 ? `列表按最近更新排序，方便你判断版本新旧。` : "该分类下目前只有一款软件，后续会随资源更新持续补充。",
  ]
    .filter(Boolean)
    .join("");
  const html = head(
    title,
    desc.slice(0, 158),
    canonical,
    `<meta property="og:image" content="${esc(OG_FALLBACK)}">` +
      jsonLd({
      "@context": "https://schema.org",
      "@type": "CollectionPage",
      name: title,
      description: desc.slice(0, 158),
      url: canonical,
      isPartOf: { "@type": "WebSite", name: "乐哲软件", url: `${SITE}/` },
      mainEntity: {
        "@type": "ItemList",
        numberOfItems: rows.length,
        itemListElement: rows.slice(0, 20).map((r, i) => ({
          "@type": "ListItem",
          position: i + 1,
          name: pick(r, ["name"]),
          url: softUrl(pick(r, ["id"])),
        })),
      },
    }) +
      jsonLd({
        "@context": "https://schema.org",
        "@type": "BreadcrumbList",
        itemListElement: [
          { "@type": "ListItem", position: 1, name: "首页", item: `${SITE}/` },
          { "@type": "ListItem", position: 2, name: category, item: canonical },
        ],
      })
  ) + `
<main>
${crumb([{ name: "首页", url: `${SITE}/` }, { name: category }])}
<h1>${esc(label)}</h1>
<p>${esc(intro)}</p>
<h2>${esc(/软件$/.test(category) ? `${category}列表` : `${category}软件列表`)}（${rows.length} 款）</h2>
<ul>
${rows
  .map((r) => {
    const rid = pick(r, ["id"]);
    return `<li><a href="${softUrl(rid)}">${esc(pick(r, ["name"]))}</a>${
      pick(r, ["version"]) ? `（${esc(pick(r, ["version"]))}）` : ""
    }</li>`;
  })
  .join("")}
</ul>
</main>
${foot(canonical)}`;
  return { html, title };
}

/* ---------------- 教程文章页 ---------------- */

export function renderTutorialPage(t, related = [], opts = {}) {
  const id = pick(t, ["id"]);
  const title0 = pick(t, ["title"]);
  const category = pick(t, ["category"], "实用");
  const summary = pick(t, ["summary"], `「${title0}」- 乐哲软件图文教程。`);
  const cover = pick(t, ["cover"]);
  const createdAt = pick(t, ["created_at"]);
  const content = addImgAlt(t.content || "", title0);
  const canonical = tutUrl(id);
  const title = `${title0}_乐哲软件教程`;

  // 描述：summary 过短时补足，避免被 Bing 判为 too short
  let descFull = summary.trim();
  if (descFull.length < MIN_DESC) {
    const contentText = stripHtml(content);
    if (contentText) descFull += `教程正文节选：${contentText}`;
  }
  if (descFull.length < MIN_DESC) {
    descFull += `本教程由乐哲软件整理发布，通过图文分步演示完整操作流程，新手也能快速跟随完成配置，教程涉及的相关软件均可在站内对应分类免费下载使用。`;
  }
  const metaDesc = descFull.slice(0, 158);

  const html = head(
    title,
    metaDesc,
    canonical,
    (cover ? `<meta property="og:image" content="${esc(cover)}">` : "") +
      jsonLd({
        "@context": "https://schema.org",
        "@type": "Article",
        headline: title0,
        image: cover || undefined,
        datePublished: createdAt || undefined,
        dateModified: createdAt || undefined,
        author: { "@type": "Organization", name: "乐哲软件", url: `${SITE}/` },
        publisher: { "@type": "Organization", name: "乐哲软件", url: `${SITE}/` },
      })
  ) + `
<main>
${crumb([{ name: "首页", url: `${SITE}/` }, { name: `${category}教程` }])}
<h1>${esc(title0)}</h1>
<div class="meta">${createdAt ? `<span>发布：${esc(String(createdAt).slice(0, 10))}</span>` : ""}<span>分类：${opts.catLink ? `<a href="${esc(opts.catLink)}">${esc(category)}</a>` : esc(category)}</span></div>
${cover ? `<img src="${esc(cover)}" alt="${esc(title0)}封面图" width="1200" height="630" loading="eager" style="width:100%;max-width:760px;height:auto;border-radius:10px;margin:14px 0;box-shadow:0 2px 10px rgba(0,0,0,.08)">` : ""}
<article>${content}</article>
<div class="cta"><strong>教程里的软件去哪下载？</strong>本站全部软件免费下载，注册登录后即可获取下载地址，完全免费，无需付费开通。<a href="${SITE}/">免费注册 →</a></div>
${relatedBlock("相关软件下载", opts.softs || [])}${relatedBlock("相关教程", related)}
</main>
${foot(canonical)}`;
  return { html, title };
}

/* ---------------- Sitemap XML ---------------- */

export function renderSitemapXml(softs = [], tutorials = []) {
  const cats = [...new Set(softs.map((s) => s.category).filter(Boolean))];
  const today = new Date().toISOString().slice(0, 10);
  // lastmod：只有首页带 lastmod 时，搜索引擎无法判断其他页面的更新频率，
  // 这里按各自数据日期补齐（缺失/格式异常的回落为生成日期）。
  const ymd = (v) => {
    const m = String(v ?? "").match(/(\d{4})-(\d{2})-(\d{2})/);
    return m ? `${m[1]}-${m[2]}-${m[3]}` : "";
  };
  const softDate = (s) => ymd(pick(s, ["date", "updated_at", "created_at"])) || today;
  const catDate = (c) => {
    const ds = softs.filter((s) => s.category === c).map(softDate).sort();
    return ds.length ? ds[ds.length - 1] : today;
  };
  const url = (loc, lastmod) => `  <url><loc>${loc}</loc><lastmod>${lastmod}</lastmod></url>`;
  const entries = [
    url(`${SITE}/`, today),
    ...cats.map((c) => url(catUrl(c), catDate(c))),
    ...softs.map((s) => url(softUrl(pick(s, ["id"])), softDate(s))),
    ...tutorials.map((t) => url(tutUrl(pick(t, ["id"])), ymd(pick(t, ["created_at"])) || today)),
  ];
  return `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${entries.join(
    "\n"
  )}\n</urlset>`;
}

/* ---------------- HTML 网站地图（全量内链，蜘蛛可抓） ---------------- */

export function renderSitemapHtml(softs = [], tutorials = []) {
  const cats = [...new Set(softs.map((s) => s.category).filter(Boolean))].sort();
  const byCat = {};
  for (const s of softs) {
    (byCat[s.category || "其他"] = byCat[s.category || "其他"] || []).push(s);
  }
  // 前端筛选：只操作已渲染的 DOM，不请求任何数据，也不依赖首页那套有状态搜索。
  // 静态页 header 的搜索框把 ?q= 带到这里，落地即筛出结果。
  const filterJs = `<script>
(function(){
var inp=document.getElementById('sf'),cnt=document.getElementById('sfc');
if(!inp)return;
function isItem(a){var h=a.getAttribute('href')||'';return h.indexOf('/soft/')>=0||h.indexOf('/tutorial/')>=0;}
var links=[].slice.call(document.querySelectorAll('main a')).filter(isItem);
var paras=[].slice.call(document.querySelectorAll('main p')).filter(function(p){return [].some.call(p.querySelectorAll('a'),isItem);});
var heads=[].slice.call(document.querySelectorAll('main h2'));
function norm(s){return String(s).toLowerCase().replace(/\\s+/g,'');}
function run(){
var k=norm(inp.value);
if(!k){links.forEach(function(a){a.style.display='';});paras.forEach(function(p){p.style.display='';});heads.forEach(function(h){h.style.display='';});cnt.textContent='';return;}
var hit=0;
links.forEach(function(a){var ok=norm(a.textContent).indexOf(k)>=0;a.style.display=ok?'':'none';if(ok)hit++;});
paras.forEach(function(p){var vis=[].some.call(p.querySelectorAll('a'),function(a){return isItem(a)&&a.style.display!=='none';});p.style.display=vis?'':'none';});
heads.forEach(function(h){var n=h.nextElementSibling;h.style.display=(n&&n.style.display!=='none')?'':'none';});
cnt.textContent=hit?('命中 '+hit+' 条'):'没有匹配的内容，换个关键词试试';
}
inp.addEventListener('input',run);
try{var q=new URLSearchParams(location.search).get('q');if(q){inp.value=q;run();}}catch(e){}
})();
</script>`;

  const html = head(
    "网站地图 - 全部软件与教程 | 乐哲软件",
    `乐哲软件网站地图，收录全部 ${softs.length} 款软件详情页、${cats.length} 个分类聚合页与 ${tutorials.length} 篇图文教程的完整链接索引，方便搜索引擎抓取全站内容，也便于用户快速导航找到所需软件的下载页与安装教程，列表每日更新。`,
    `${SITE}/sitemap.html`,
    "",
    "noindex,follow"
  ) + `
<main>
<h1>网站地图</h1>
<p>全部 ${softs.length} 款软件 · ${tutorials.length} 篇教程 · ${cats.length} 个分类：</p>
<div style="margin:16px 0 4px"><input id="sf" type="search" placeholder="输入软件名或教程标题筛选…" aria-label="筛选全站内容" autocomplete="off" style="width:100%;box-sizing:border-box;padding:11px 14px;font-size:15px;border:1px solid #d5dbe5;border-radius:9px;outline:none;font-family:inherit;color:#1a1a1a"><div id="sfc" style="color:#888;font-size:13px;margin-top:6px;min-height:18px"></div></div>
${cats
  .map(
    (c) => `<h2><a href="${catUrl(c)}" style="color:#0077ff;text-decoration:none">${esc(c)}</a>（${(byCat[c] || []).length}）</h2>
<p>${(byCat[c] || [])
      .map((s) => `<a href="${softUrl(pick(s, ["id"]))}" style="color:#0077ff;margin-right:12px">${esc(pick(s, ["name"]))}</a>`)
      .join("")}</p>`
  )
  .join("")}
${tutorials.length
  ? `<h2>教程文章</h2><p>${tutorials
      .map((t) => `<a href="${tutUrl(pick(t, ["id"]))}" style="color:#0077ff;margin-right:12px">${esc(pick(t, ["title"]))}</a>`)
      .join("")}</p>`
  : ""}
</main>
${filterJs}
${foot("sitemap")}`;
  return { html, title: "网站地图 - 全部软件与教程 | 乐哲软件" };
}

/* ---------------- 404 页（GitHub Pages 认根目录 404.html） ----------------
 * 背景（2026-10-31）：此前 404 落到 GitHub 默认英文页，页面内 0 处本站链接，
 * 无导航无回首页，等于把每一个死链访客全额送走。GitHub Pages 会自动用
 * 根目录 404.html 兜底（同时保持 HTTP 404 状态码），是零成本止损项。
 * 设计目标：① 自带搜索，能当场找到目标页；② 热门+分类双出口；
 * ③ 仍返回 404 且 noindex，绝不参与索引。
 */

export function render404(softs = [], tutorials = []) {
  const score = (s) => (Number(s.views) || 0) + (Number(s.downloads) || 0) * 3;
  const seen = new Set();
  const hot = [];
  for (const s of [...softs].sort((a, b) => score(b) - score(a))) {
    const name = String(pick(s, ["name"]) || "").trim();
    if (!name) continue;
    const key = name.replace(/\s+/g, "").toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    hot.push(`<a href="${softUrl(pick(s, ["id"]))}">${esc(name)}</a>`);
    if (hot.length >= 12) break;
  }

  const cats = [...new Set(softs.map((s) => s.category).filter(Boolean))].sort();
  const catLinks = cats.map((c) => `<a href="${catUrl(c)}">${esc(c)}</a>`).join("");

  // 搜索索引：[名称, 链接]，软件 + 教程一起收录（教程 URL 失效同样能当场找回）。
  // 158 软件 + 6 教程约 11KB，gzip 后约 4KB。
  // 404 是一次性落地页，访客唯一诉求是「找到正确那个页面」，
  // 所以索引必须随页面自带，不能再发一次请求等接口。
  const index = [
    ...softs
      .filter((s) => String(pick(s, ["name"]) || "").trim())
      .map((s) => [String(pick(s, ["name"])).trim(), softUrl(pick(s, ["id"]))]),
    ...tutorials
      .filter((t) => String(pick(t, ["title"]) || "").trim())
      .map((t) => [String(pick(t, ["title"])).trim(), tutUrl(pick(t, ["id"]))]),
  ];
  // 名称里可能有 </script> 之类的字符，把 < 转成 \u003c 防止提前闭合脚本
  const idxJson = JSON.stringify(index).replace(/</g, "\\u003c");

  const css = `<meta property="og:image" content="${OG_FALLBACK}">
<style>
h1{font-size:26px;margin:6px 0 6px}
.lead{color:#666;margin:0 0 20px;font-size:15px}
.searchbox input{width:100%;box-sizing:border-box;padding:13px 16px;font-size:16px;border:1px solid #d5dbe5;border-radius:10px;outline:none;color:#1a1a1a;background:#fff;font-family:inherit}
.searchbox input:focus{border-color:#0077ff;box-shadow:0 0 0 3px rgba(0,119,255,.12)}
.res{display:flex;flex-wrap:wrap;gap:8px;margin:12px 0 0}
.res a{display:inline-block;padding:7px 14px;border-radius:999px;background:#f0f5ff;color:#0077ff;text-decoration:none;font-size:14px}
.res a:hover{background:#0077ff;color:#fff}
.res .none{color:#888;font-size:14px;margin:0}
.res .none a{background:none;padding:0;border-radius:0;color:#0077ff;text-decoration:underline}
h2{font-size:17px;margin:32px 0 12px;padding-left:9px;border-left:3px solid #0077ff;line-height:1.3}
.tags a{display:inline-block;padding:6px 13px;margin:0 8px 8px 0;border-radius:6px;background:#f5f6f8;color:#333;text-decoration:none;font-size:14px}
.tags a:hover{background:#e8edf7;color:#0077ff}
</style>`;

  const js = `<script>
(function(){
  var IDX = ${idxJson};
  var S = ${JSON.stringify(SITE)};
  var el = document.getElementById("q404"), box = document.getElementById("r404");
  var N = IDX.map(function(x){ return [x[0].toLowerCase().replace(/\\s+/g,""), x[1], x[0]]; });
  function e(s){ return String(s).replace(/[&<>"]/g, function(c){ return c==="&"?"&amp;":c==="<"?"&lt;":c===">"?"&gt;":"&quot;"; }); }
  function show(v){
    var k = String(v || "").toLowerCase().replace(/\\s+/g, "");
    if (!k) { box.innerHTML = ""; return; }
    var hit = N.filter(function(x){ return x[0].indexOf(k) >= 0; });
    if (!hit.length) { box.innerHTML = '<p class="none">没有匹配的软件，试试 <a href="' + S + '/sitemap.html">全站索引</a></p>'; return; }
    box.innerHTML = hit.slice(0, 10).map(function(x){ return '<a href="' + x[1] + '">' + e(x[2]) + "</a>"; }).join("");
  }
  el.addEventListener("input", function(){ show(el.value); });
  // 从错误地址里猜关键词：/tutorial/中文标题.html 这类能直接预填搜索
  try {
    var p = decodeURIComponent(location.pathname).split("/").pop().replace(/\\.html?$/i, "");
    if (p && /[\\u4e00-\\u9fa5]/.test(p)) { el.value = p; show(p); }
  } catch (err) {}
})();
</script>`;

  const html = `${head(
    "页面未找到 - 乐哲软件",
    "你访问的页面不存在，可能是软件已下架或链接已失效。可在页面内直接搜索软件名，或从热门推荐与分类目录继续浏览乐哲软件的全部内容。",
    `${SITE}/`,
    css,
    "noindex,follow"
  )}
<main>
<h1>这个页面走丢了</h1>
<p class="lead">地址可能已失效、软件已下架，或输入有误。搜一下你要找的软件：</p>
<div class="searchbox"><input id="q404" type="search" placeholder="输入软件名，如 Photoshop、压缩、系统…" aria-label="搜索软件" autocomplete="off"></div>
<div class="res" id="r404" aria-live="polite"></div>

<h2>🔥 热门软件</h2>
<div class="tags">${hot.join("")}</div>

<h2>按分类浏览</h2>
<div class="tags">${catLinks}</div>

<h2>全部内容</h2>
<div class="tags"><a href="${SITE}/sitemap.html">全站索引（${softs.length} 款软件 · ${tutorials.length} 篇教程）</a><a href="${SITE}/">返回首页</a></div>
</main>
${js}
${foot("404")}`;
  return { html, title: "页面未找到 - 乐哲软件" };
}
