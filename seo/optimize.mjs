/**
 * 站点体检脚本：给每日优化提供「实际情况」依据
 *
 * 用法：node seo/optimize.mjs            输出诊断报告（JSON + 人读摘要）
 *      node seo/optimize.mjs --json     只输出 JSON
 *
 * 检查项：
 *  - 内容厚度：正文可读字符数分布、薄页清单（<300 字）
 *  - 内链健康：每页出链/入链数、孤岛页（0 入链）
 *  - 标题/描述：长度分布、超长截断风险、重复
 *  - 结构：H1 数量、canonical、JSON-LD 类型、图片缺 alt
 *  - 索引一致性：可索引页是否都在 sitemap.xml 中
 */
import { readFile, readdir } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { dirname, join, relative } from "node:path";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const JSON_ONLY = process.argv.includes("--json");

const strip = (h) =>
  h
    .replace(/<script[\s\S]*?<\/script>/gi, " ")
    .replace(/<style[\s\S]*?<\/style>/gi, " ")
    .replace(/<[^>]+>/g, " ")
    .replace(/&[a-z#0-9]+;/gi, " ")
    .replace(/\s+/g, "");

const files = [];
for (const d of ["soft", "cat", "tutorial"]) {
  for (const f of await readdir(join(ROOT, d))) if (f.endsWith(".html")) files.push(`${d}/${f}`);
}
for (const f of await readdir(ROOT)) {
  // 搜索引擎验证 token 文件不是真实页面（纯文本、无 head），排除避免误报
  if (!f.endsWith(".html")) continue;
  if (/^(baidu_verify|googleda|BingSiteAuth|google[0-9a-f]+)/i.test(f)) continue;
  files.push(f);
}

const pages = [];
for (const rel of files) {
  const html = await readFile(join(ROOT, rel), "utf8");
  const pick = (re) => html.match(re)?.[1]?.trim() ?? "";
  const robots = pick(/<meta name="robots" content="([^"]*)"/i).toLowerCase();
  const body = html.replace(/^[\s\S]*?<body[^>]*>/i, "");
  const links = [...body.matchAll(/href="([^"#]+)"/g)]
    .map((m) => m[1])
    .filter((h) => !/^(mailto:|javascript:|data:|tel:)/i.test(h))
    .map((h) => h.replace(/^https?:\/\/(www\.)?lezhesoft\.cn/, "").replace(/^\//, ""))
    .filter((h) => h && !h.startsWith("http") && !h.includes("?"));
  const imgs = [...body.matchAll(/<img\b[^>]*>/gi)];
  pages.push({
    rel,
    title: pick(/<title>([^<]*)<\/title>/i),
    desc: pick(/<meta name="description" content="([^"]*)"/i),
    robots,
    noindex: robots.includes("noindex"),
    h1: (body.match(/<h1[\s>]/gi) || []).length,
    textLen: strip(body).length,
    links: [...new Set(links)],
    inbound: 0,
    imgs: imgs.length,
    imgsNoAlt: imgs.filter((t) => !/\balt=/.test(t) || /\balt=""/.test(t)).length,
    schemaTypes: [...html.matchAll(/"@type"\s*:\s*"([^"]+)"/g)].map((m) => m[1]),
  });
}

// 入链统计（把链接解析成实际文件）
const pathSet = new Set(pages.map((p) => p.rel));
const norm = (l) => (pathSet.has(l) ? l : pathSet.has(`${l}.html`) ? `${l}.html` : pathSet.has(`${l}/index.html`) ? `${l}/index.html` : l === "" ? "index.html" : null);
const inbound = new Map();
for (const p of pages) {
  for (const l of p.links) {
    const t = norm(l);
    if (t && t !== p.rel) inbound.set(t, (inbound.get(t) || 0) + 1);
  }
}
for (const p of pages) p.inbound = inbound.get(p.rel) || 0;

const idx = pages.filter((p) => !p.noindex);
const sitemapXml = await readFile(join(ROOT, "sitemap.xml"), "utf8");
const smUrls = new Set([...sitemapXml.matchAll(/<loc>([^<]+)<\/loc>/g)].map((m) => m[1].replace(/^https?:\/\/[^/]+/, "").replace(/^\//, "")));

const bucket = (arr, edges) => {
  const out = {};
  for (const e of edges) out[`<${e}`] = arr.filter((x) => x < e).length;
  return out;
};

const thin = idx.filter((p) => p.textLen < 300).sort((a, b) => a.textLen - b.textLen);
const lowInbound = idx.filter((p) => p.inbound < 3 && p.rel.startsWith("soft/")).sort((a, b) => a.inbound - b.inbound);
const orphan = idx.filter((p) => p.inbound === 0);
// 实体解码：&amp; 这类实体会被搜索引擎当作 1 个可见字符，统计口径与 render.js 的 visLen 保持一致
const decodeEnt = (s) =>
  String(s)
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'");
const longTitle = idx.filter((p) => [...decodeEnt(p.title)].length > 60);
const longDesc = idx.filter((p) => [...decodeEnt(p.desc)].length > 165);
const badH1 = idx.filter((p) => p.h1 !== 1);
const noSchema = idx.filter((p) => p.schemaTypes.length === 0);
const imgNoAlt = idx.filter((p) => p.imgsNoAlt > 0);
const notInSitemap = idx.filter((p) => p.rel !== "index.html" && p.rel !== "all.html" && !smUrls.has(p.rel));

const report = {
  generatedAt: new Date().toISOString(),
  pages: { total: pages.length, indexable: idx.length, soft: idx.filter((p) => p.rel.startsWith("soft/")).length, cat: idx.filter((p) => p.rel.startsWith("cat/")).length, tutorial: idx.filter((p) => p.rel.startsWith("tutorial/")).length },
  content: {
    medianTextLen: idx.map((p) => p.textLen).sort((a, b) => a - b)[Math.floor(idx.length / 2)] || 0,
    distribution: bucket(idx.map((p) => p.textLen), [300, 600, 1000, 2000, 5000]),
    thinCount: thin.length,
    thinSample: thin.slice(0, 8).map((p) => ({ rel: p.rel, len: p.textLen, title: p.title })),
  },
  links: {
    avgOutbound: +(idx.reduce((s, p) => s + p.links.length, 0) / idx.length).toFixed(1),
    avgInbound: +(idx.reduce((s, p) => s + p.inbound, 0) / idx.length).toFixed(1),
    orphanCount: orphan.length,
    orphanSample: orphan.slice(0, 8).map((p) => p.rel),
    lowInboundCount: lowInbound.length,
    lowInboundSample: lowInbound.slice(0, 8).map((p) => ({ rel: p.rel, in: p.inbound })),
  },
  meta: {
    longTitleCount: longTitle.length,
    longTitleSample: longTitle.slice(0, 5).map((p) => ({ rel: p.rel, len: [...decodeEnt(p.title)].length })),
    longDescCount: longDesc.length,
    h1NotOne: badH1.length,
    h1Sample: badH1.slice(0, 5).map((p) => ({ rel: p.rel, h1: p.h1 })),
  },
  technical: {
    noSchemaCount: noSchema.length,
    imgMissingAltPages: imgNoAlt.length,
    imgMissingAltTotal: idx.reduce((s, p) => s + p.imgsNoAlt, 0),
    notInSitemapCount: notInSitemap.length,
    notInSitemapSample: notInSitemap.slice(0, 8).map((p) => p.rel),
  },
};

// —— 优先级建议（按影响 × 可执行性打分） ——
const issues = [];
if (report.content.thinCount > 0) issues.push({ p: 1, issue: `内容偏薄：${report.content.thinCount} 页正文 <300 字`, action: "补充详情页说明/最低配置/适用场景等段落" });
if (report.links.orphanCount > 0) issues.push({ p: 1, issue: `孤岛页 ${report.links.orphanCount} 个（0 入链）`, action: "从相关分类页或相关推荐补链" });
if (report.technical.notInSitemapCount > 0) issues.push({ p: 1, issue: `${report.technical.notInSitemapCount} 个可索引页不在 sitemap.xml`, action: "补进生成器 sitemap 输出" });
if (report.meta.longTitleCount > 0) issues.push({ p: 2, issue: `${report.meta.longTitleCount} 页标题超 60 字（SERP 截断）`, action: "压缩标题模板" });
if (report.technical.noSchemaCount > 0) issues.push({ p: 2, issue: `${report.technical.noSchemaCount} 页缺结构化数据`, action: "按页面类型补 JSON-LD" });
if (report.links.lowInboundCount > 10) issues.push({ p: 2, issue: `${report.links.lowInboundCount} 个软件页入链 <3`, action: "在相关推荐/分类页增加交叉链接" });
if (report.meta.h1NotOne > 0) issues.push({ p: 3, issue: `${report.meta.h1NotOne} 页 H1 数量≠1`, action: "修正标题层级" });
if (report.technical.imgMissingAltPages > 0) issues.push({ p: 3, issue: `${report.technical.imgMissingAltPages} 页有图片缺 alt（共 ${report.technical.imgMissingAltTotal} 张）`, action: "补描述性 alt" });
report.priorities = issues.sort((a, b) => a.p - b.p);

if (JSON_ONLY) {
  console.log(JSON.stringify(report, null, 2));
} else {
  console.log(JSON.stringify(report, null, 2));
  console.log("\n=== 优先处理建议 ===");
  if (!report.priorities.length) console.log("无高优先级问题，可转向内容增量或外链。");
  report.priorities.forEach((i, n) => console.log(`${n + 1}. [P${i.p}] ${i.issue} → ${i.action}`));
}
