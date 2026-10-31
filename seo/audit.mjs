/**
 * 全站 BUG 体检（每日与 generate/qa 一起跑）
 *
 * 定位：qa.mjs 只管「内容红线」（重复标题/描述、FFFD、死链），
 *      本脚本管「结构性 BUG」—— 资源 404、canonical 不指向自己、H1 数量、
 *      JSON-LD 语法、og:image 缺失、sitemap 与磁盘文件不同步、robots/护栏回退。
 *
 * 用法：
 *   node seo/audit.mjs           人读报告（有 BLOCKER 时 exit 2）
 *   node seo/audit.mjs --json    机器读，便于自动化对比
 *
 * 级别：
 *   BLOCKER 必须当天修（资源 404、canonical 错、sitemap 缺页、护栏被破坏）
 *   WARN    记入待办，按投入产出择期修
 */
import { readdir, readFile, stat } from "node:fs/promises";
import { join, dirname, resolve, relative } from "node:path";

const ROOT = resolve(".");
const JSON_OUT = process.argv.includes("--json");
const SELF = /^https?:\/\/(www\.)?lezhesoft\.cn(\/.*)?$/i;

const TOOL_PAGES = [
  "vip.html",
  "sitemap.html",
  "copyright.html",
  "preview.html",
  "query.html",
  "text1.html",
  "admin.html",
  "manager.html",
  "submanager.html",
  "all.html",
];
// 纯文本验证文件，不能加 title/description，属合理例外
const TOKEN_FILES = ["baidu_verify_codeva-Vno5IVYRh1.html", "googleda30387aa8b4d7e3.html"];

async function walk(dir, out = []) {
  for (const e of await readdir(dir, { withFileTypes: true })) {
    if ([".git", ".workbuddy", "node_modules"].includes(e.name)) continue;
    const p = join(dir, e.name);
    if (e.isDirectory()) await walk(p, out);
    else if (e.name.endsWith(".html")) out.push(p);
  }
  return out;
}

const cache = new Map();
async function exists(p) {
  if (!cache.has(p)) {
    try {
      const s = await stat(p);
      cache.set(p, s.isFile());
    } catch {
      cache.set(p, false);
    }
  }
  return cache.get(p);
}

const files = (await walk(ROOT)).map((p) => relative(ROOT, p).replace(/\\/g, "/"));
const blocker = [];
const warn = [];
const add = (list, kind, file, detail) => list.push({ kind, file, detail });

for (const f of files) {
  const html = await readFile(join(ROOT, f), "utf8");
  const isToken = TOKEN_FILES.includes(f);
  const robots = html.match(/<meta\s+name=["']robots["'][^>]*>/i)?.[0] || "";
  const noindex = /noindex/i.test(robots);

  /* 1) 站内资源引用是否真实存在（img/script/link/srcset/poster） */
  const refs = [
    ...[...html.matchAll(/<img\b[^>]*\bsrc=["']([^"']+)["']/gi)].map((m) => m[1]),
    ...[...html.matchAll(/<script\b[^>]*\bsrc=["']([^"']+)["']/gi)].map((m) => m[1]),
    ...[...html.matchAll(/<link\b[^>]*\bhref=["']([^"']+)["']/gi)].map((m) => m[1]),
    ...[...html.matchAll(/<video\b[^>]*\bposter=["']([^"']+)["']/gi)].map((m) => m[1]),
  ];
  for (let u of new Set(refs)) {
    if (!u || /^(#|data:|mailto:|tel:|javascript:)/i.test(u)) continue;
    if (/^https?:\/\//i.test(u)) {
      if (!SELF.test(u)) continue;
      u = u.replace(/^https?:\/\/(www\.)?lezhesoft\.cn/i, "") || "/";
    }
    if (u.startsWith("//")) continue;
    if (/['"+$]/.test(u)) continue; // JS 模板拼接，跳过
    u = u.split("#")[0].split("?")[0];
    if (!u) continue;
    if (/^\/(rest|auth|storage|realtime|cdn-cgi)\//.test(u)) continue; // 外部/代理路径
    const target = u.startsWith("/") ? join(ROOT, u) : join(dirname(join(ROOT, f)), u);
    if (await exists(target)) continue;
    if (!target.endsWith(".html") && ((await exists(target + ".html")) || (await exists(join(target, "index.html")))))
      continue;
    add(blocker, "资源 404", f, u);
  }

  /* 2) canonical 必须自引用（noindex 工具页允许省略，但存在就必须正确）
        all.html 是有意的跳转存根（noindex + JS 跳 sitemap.html），canonical 指向合并目标属设计，豁免 */
  const canonical = html.match(/<link\s+rel=["']canonical["']\s+href=["']([^"']+)["']/i)?.[1];
  const CANON_EXEMPT = ["all.html"];
  if (canonical && !CANON_EXEMPT.includes(f)) {
    const want = "https://www.lezhesoft.cn/" + (f === "index.html" ? "" : f);
    if (canonical.replace(/\/$/, "") !== want.replace(/\/$/, ""))
      add(blocker, "canonical 非自引用", f, `${canonical} → 期望 ${want}`);
  } else if (!noindex && !isToken) {
    add(warn, "缺 canonical", f, "");
  }

  /* 3) H1 必须恰好 1 个（验证 token 文件与后台 SPA 页豁免：
        后台按视图动态渲染 h2，noindex 且不参与搜索，补隐藏 h1 反而有隐藏文本嫌疑） */
  const H1_EXEMPT = ["admin.html", "manager.html", "submanager.html"];
  const h1n = (html.match(/<h1[\s>]/gi) || []).length;
  if (h1n !== 1 && !isToken && !H1_EXEMPT.includes(f)) add(h1n === 0 ? warn : blocker, `H1 数量=${h1n}`, f, "");

  /* 4) JSON-LD 语法 */
  for (const m of html.matchAll(/<script type="application\/ld\+json">([\s\S]*?)<\/script>/g)) {
    try {
      JSON.parse(m[1]);
    } catch (e) {
      add(blocker, "JSON-LD 语法错误", f, e.message.slice(0, 60));
    }
  }

  /* 5) og:image（可索引页必须有分享图） */
  const ogi = html.match(/<meta\s+property=["']og:image["']\s+content=["']([^"']*)["']/i)?.[1];
  if (!noindex && !isToken && !ogi) add(warn, "缺 og:image", f, "");

  /* 6) 工具页必须 noindex（防止后台/预览页被收录） */
  if (TOOL_PAGES.includes(f) && !noindex) add(blocker, "工具页未 noindex", f, "");

  /* 7) 页脚品牌回链（PLAYBOOK 红线）：找 <footer> 里指向首页且含品牌词的锚 */
  const footBlock = html.match(/<footer[\s\S]*?<\/footer>/gi)?.join(" ") ?? "";
  const hasBrand =
    /href=["'](https?:\/\/(www\.)?lezhesoft\.cn\/?|\/)["'][^>]*>[^<]*(乐哲软件|lezhesoft)/i.test(footBlock) ||
    /©[^<]{0,60}(乐哲软件|lezhesoft)/i.test(footBlock);
  if (!isToken && footBlock && !hasBrand) add(warn, "页脚缺品牌回链", f, "");
}

/* 8) sitemap 与磁盘文件必须双向一致 */
const sitemap = await readFile(join(ROOT, "sitemap.xml"), "utf8");
const locs = [...sitemap.matchAll(/<loc>([^<]+)<\/loc>/g)].map((m) => m[1].trim());
const locToFile = (u) => {
  const p = u.replace(/^https?:\/\/(www\.)?lezhesoft\.cn/i, "");
  return p === "/" || p === "" ? "index.html" : p.replace(/^\//, "");
};
const locSet = new Set(locs);
for (const u of locs) {
  const f = locToFile(u);
  if (!(await exists(join(ROOT, f)))) add(blocker, "sitemap 有页面缺失", f, u);
}
const inSitemap = (f) =>
  locSet.has(`https://www.lezhesoft.cn/${f}`) || (f === "index.html" && locSet.has("https://www.lezhesoft.cn/"));
for (const f of files) {
  if (!f.startsWith("soft/") && !f.startsWith("cat/") && !f.startsWith("tutorial/")) continue;
  if (!inSitemap(f)) add(blocker, "页面未进 sitemap", f, "");
}
const lastmods = (sitemap.match(/<lastmod>/g) || []).length;
if (lastmods < locs.length) add(warn, "sitemap lastmod 不全", "sitemap.xml", `${lastmods}/${locs.length}`);

/* 9) robots.txt 与首页静态内链 */
const robotsTxt = await readFile(join(ROOT, "robots.txt"), "utf8");
if (!/Sitemap:\s*https:\/\/www\.lezhesoft\.cn\/sitemap\.xml/i.test(robotsTxt))
  add(blocker, "robots.txt 缺 Sitemap", "robots.txt", "");
if (!/Disallow:\s*\/admin\.html/i.test(robotsTxt)) add(warn, "robots 未拦 admin.html", "robots.txt", "");
const indexHtml = await readFile(join(ROOT, "index.html"), "utf8");
const catLinks = (indexHtml.match(/href="\/cat\/[a-z0-9-]+\.html"/g) || []).length;
if (catLinks < 5) add(blocker, "首页侧栏缺 /cat/ 静态链接", "index.html", `${catLinks} 条`);

/* 10) Service Worker 是否还在被引用却没注册（半坏状态） */
if (await exists(join(ROOT, "sw.js"))) {
  let registered = false;
  for (const f of ["index.html", ...files.filter((x) => x !== "index.html")]) {
    const h = await readFile(join(ROOT, f), "utf8");
    if (/serviceWorker\s*\.\s*register/.test(h)) {
      registered = true;
      break;
    }
  }
  if (!registered) add(warn, "sw.js 无人注册", "sw.js", "已改为自注销版本，可保留或删除");
}

const report = {
  generatedAt: new Date().toISOString(),
  pages: files.length,
  sitemapUrls: locs.length,
  blockerCount: blocker.length,
  warnCount: warn.length,
  blockers: blocker.slice(0, 40),
  warnings: warn.slice(0, 40),
};

if (JSON_OUT) {
  console.log(JSON.stringify(report, null, 2));
} else {
  console.log(`页面 ${report.pages} · sitemap ${report.sitemapUrls} URL`);
  console.log(`BLOCKER ${report.blockerCount} · WARN ${report.warnCount}\n`);
  const groupBy = (arr) => {
    const m = new Map();
    for (const x of arr) {
      const k = x.kind;
      if (!m.has(k)) m.set(k, []);
      m.get(k).push(x);
    }
    return m;
  };
  for (const [kind, list] of groupBy(blocker)) {
    console.log(`✗ [BLOCKER] ${kind} ×${list.length}`);
    list.slice(0, 6).forEach((x) => console.log(`    ${x.file}${x.detail ? " — " + x.detail : ""}`));
  }
  for (const [kind, list] of groupBy(warn)) {
    console.log(`⚠ [WARN] ${kind} ×${list.length}`);
    list.slice(0, 4).forEach((x) => console.log(`    ${x.file}${x.detail ? " — " + x.detail : ""}`));
  }
  if (!blocker.length && !warn.length) console.log("全站结构体检通过，无 BUG。");
}

process.exit(blocker.length ? 2 : 0);
