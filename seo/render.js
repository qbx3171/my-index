/**
 * 乐哲软件静态 SEO 页渲染层（GitHub Pages 版）
 * 与 Worker 版的差异：所有 URL 带 .html 后缀（GitHub Pages 不支持无扩展名路由）
 */

export const SITE = "https://www.lezhesoft.cn";

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
const catUrl = (c) => `${SITE}/cat/${catSlug(c)}.html`;

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

export const platformLabel = (s) => {
  const p = Array.isArray(s?.platforms) ? s.platforms.join(",") : String(s?.platforms ?? "");
  if (/win/i.test(p)) return "Windows";
  if (/mac|os ?x|darwin|apple/i.test(p)) return "Mac";
  return p ? p.slice(0, 20) : "";
};

const head = (title, desc, canonical, extra = "") => `<!DOCTYPE html>
<html lang="zh-CN">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>${esc(title)}</title>
<meta name="description" content="${esc(desc)}">
<meta name="robots" content="index,follow,max-image-preview:large">
<link rel="canonical" href="${esc(canonical)}">
<meta property="og:type" content="article">
<meta property="og:site_name" content="乐哲软件">
<meta property="og:title" content="${esc(title)}">
<meta property="og:description" content="${esc(desc)}">
<meta property="og:url" content="${esc(canonical)}">
${extra}
<style>
body{font-family:system-ui,-apple-system,"PingFang SC","Microsoft YaHei",sans-serif;margin:0;color:#1a1a1a;line-height:1.8}
header{background:#0077ff;color:#fff;padding:14px 20px;font-size:17px;font-weight:500}
header a{color:#fff;text-decoration:none}
main{max-width:760px;margin:0 auto;padding:24px 20px}
.meta{color:#666;font-size:14px;margin:6px 0 18px}.meta span{margin-right:14px}
.btn{display:inline-block;background:#0077ff;color:#fff;padding:11px 28px;border-radius:8px;text-decoration:none;font-size:16px;margin:10px 0}
.rel{margin-top:36px;border-top:1px solid #eee;padding-top:18px}
.rel a{display:inline-block;margin:0 10px 10px 0;color:#0077ff;text-decoration:none}
article img{max-width:100%}
footer{max-width:760px;margin:0 auto;padding:20px;color:#888;font-size:13px}
footer a{color:#888}
nav.crumb{font-size:13px;color:#999;margin-bottom:12px}nav.crumb a{color:#999;text-decoration:none}
h1{font-size:24px;margin:8px 0}
</style>
</head>
<body>
<header><a href="${SITE}/">乐哲软件</a></header>`;

const foot = () => `<footer>© 乐哲软件 lezhesoft.cn · <a href="${SITE}/sitemap.html">网站地图</a> · <a href="${SITE}/copyright.html">版权声明</a></footer>
</body></html>`;

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
  const dupPlatform = opts.dupPlatform || null;
  const title = `${name}下载${version ? ` v${version}` : ""}${dupPlatform ? `（${dupPlatform}版）` : ""} - ${category} | 乐哲软件`;

  // 描述：过短则用 detail 正文补足；同名/碰撞记录强制追加尾注并预留尾部空间，
  // 保证截断到 158 字后各页描述仍然唯一
  let base = description.trim();
  let tail = "";
  if (opts.forceDescTail) {
    tail = `本页为${dupPlatform || platformLabel(soft) || "当前"}平台 v${version || "当前"} 版本下载页，其他版本请查看同分类列表。`;
  } else if (dupPlatform) {
    tail = `本页面为${dupPlatform}平台版本，其他平台版本请查看同分类列表。`;
  }
  if (base.length > 120) base = base.slice(0, 120);
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
    if (descFull.length > room) descFull = descFull.slice(0, room).replace(/[，、；\s]+$/, "");
    descFull += tail;
  }
  const metaDesc = descFull.slice(0, 158);

  const html = head(
    title,
    metaDesc,
    canonical,
    (iconUrl ? `<meta property="og:image" content="${esc(iconUrl)}">` : "") +
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
${relatedBlock("同分类软件", related)}
</main>
${foot()}`;
  return { html, title };
}

/* ---------------- 分类聚合页 ---------------- */

export function renderCategoryPage(category, rows = []) {
  const canonical = catUrl(category);
  const title = `${category}软件下载大全_共${rows.length}款 - 乐哲软件`;
  const topNames = rows.slice(0, 6).map((r) => pick(r, ["name"])).filter(Boolean);
  const desc = `乐哲软件${category}分类页，共收录${rows.length}款${category}软件，涵盖${topNames.join("、")}等常用工具，每款软件均标注最新版本号、更新日期与平台兼容性，全部提供高速免费下载与详细安装教程，列表持续更新，帮助你快速找到合适的${category}软件。`;
  const html = head(
    title,
    desc.slice(0, 158),
    canonical
  ) + `
<main>
${crumb([{ name: "首页", url: `${SITE}/` }, { name: category }])}
<h1>${esc(category)}软件下载大全</h1>
<p>共收录 ${rows.length} 款${esc(category)}类软件：</p>
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
${foot()}`;
  return { html, title };
}

/* ---------------- 教程文章页 ---------------- */

export function renderTutorialPage(t, related = []) {
  const id = pick(t, ["id"]);
  const title0 = pick(t, ["title"]);
  const category = pick(t, ["category"], "实用");
  const summary = pick(t, ["summary"], `「${title0}」- 乐哲软件图文教程。`);
  const cover = pick(t, ["cover"]);
  const createdAt = pick(t, ["created_at"]);
  const content = t.content || "";
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
<div class="meta">${createdAt ? `<span>发布：${esc(String(createdAt).slice(0, 10))}</span>` : ""}<span>分类：${esc(category)}</span></div>
<article>${content}</article>
${relatedBlock("相关教程", related)}
</main>
${foot()}`;
  return { html, title };
}

/* ---------------- Sitemap XML ---------------- */

export function renderSitemapXml(softs = [], tutorials = []) {
  const cats = [...new Set(softs.map((s) => s.category).filter(Boolean))];
  const today = new Date().toISOString().slice(0, 10);
  const entries = [
    `  <url><loc>${SITE}/</loc><lastmod>${today}</lastmod></url>`,
    `  <url><loc>${SITE}/sitemap.html</loc></url>`,
    ...cats.map((c) => `  <url><loc>${catUrl(c)}</loc></url>`),
    ...softs.map((s) => `  <url><loc>${softUrl(pick(s, ["id"]))}</loc></url>`),
    ...tutorials.map((t) => `  <url><loc>${tutUrl(pick(t, ["id"]))}</loc></url>`),
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
  const html = head(
    "网站地图 - 全部软件与教程 | 乐哲软件",
    `乐哲软件网站地图，收录全部 ${softs.length} 款软件详情页、${cats.length} 个分类聚合页与 ${tutorials.length} 篇图文教程的完整链接索引，方便搜索引擎抓取全站内容，也便于用户快速导航找到所需软件的下载页与安装教程，列表每日更新。`,
    `${SITE}/sitemap.html`
  ) + `
<main>
<h1>网站地图</h1>
<p>全部 ${softs.length} 款软件 · ${tutorials.length} 篇教程 · ${cats.length} 个分类：</p>
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
${foot()}`;
  return { html, title: "网站地图 - 全部软件与教程 | 乐哲软件" };
}
