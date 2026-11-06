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
        all.html 是有意的跳转存根（noindex + JS 跳 sitemap.html），canonical 指向合并目标属设计，豁免
        404.html 由 GitHub Pages 在任意不存在的路径上返回，不存在「自己的 URL」，
        canonical 固定指首页属设计，豁免 */
  const canonical = html.match(/<link\s+rel=["']canonical["']\s+href=["']([^"']+)["']/i)?.[1];
  const CANON_EXEMPT = ["all.html", "404.html"];
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

/* 11) 首屏静态卡片图标：不得再用「软」字占位 SVG
   这类卡片是给首屏和爬虫看的静态 HTML，占位图会让用户在 JS 拉回数据前
   看到一屏蓝底「软」方块，体感就是「网站没有图标」。 */
for (const f of ["index.html", "preview.html"]) {
  if (!(await exists(join(ROOT, f)))) continue;
  const h = await readFile(join(ROOT, f), "utf8");
  const n = (h.match(/data:image\/svg\+xml[^"]*%E8%BD%AF/g) || []).length;
  if (n) add(blocker, "首屏静态卡片仍是「软」占位图标", f, `${n} 处，图片回填未生效`);
}

/* 12) 页脚访问统计：不蒜子（busuanzi）计数接口已失效，不得再加载；
   有统计占位就必须有可用的计数实现，否则页脚会出现「总访问量  次」空壳。 */
for (const f of ["index.html", "preview.html"]) {
  if (!(await exists(join(ROOT, f)))) continue;
  const h = await readFile(join(ROOT, f), "utf8");
  if (/busuanzi\.ibruce\.info\/busuanzi\/2\.3/.test(h))
    add(blocker, "仍在加载已失效的不蒜子计数脚本", f, "接口 20s 无响应，应改用自建计数");
  if (/id="busuanzi_container_site_pv"/.test(h) && !/abacus\.jasoncameron\.dev/.test(h))
    add(warn, "统计栏有占位但没有计数脚本", f, "");
  /* 13) 统计必须带「本地缓存兜底」：第三方挂了也不能让数字消失 */
  if (/abacus\.jasoncameron\.dev/.test(h) && !/lezhe_stat_/.test(h))
    add(warn, "统计脚本缺少本地缓存兜底", f, "第三方失败时应回落到 localStorage 上次值");
  /* 14) 自建计数通道（site_hit/site_get）应已接线，等 Supabase 建表后自动启用 */
  if (/id="busuanzi_container_site_pv"/.test(h) && !/site_hit/.test(h))
    add(warn, "统计未接自建计数通道", f, "见 seo/site-stats.sql");
}

/* 15) 404 兜底页：GitHub Pages 会把任何不存在的路径交给根目录 404.html（同时保持 404 状态码）。
   缺了它，访客看到的是 GitHub 英文「Page not found」——实测该页 0 处本站链接，
   没有导航、没有回首页、没有搜索，等于把每一个死链访客全额送走。 */
if (!(await exists(join(ROOT, "404.html")))) {
  add(blocker, "缺 404.html", "404.html", "不存在的路径会回落到 GitHub 默认英文错误页");
} else {
  const h404 = await readFile(join(ROOT, "404.html"), "utf8");
  if (!/href=["'](https:\/\/www\.lezhesoft\.cn)?\/sitemap\.html["']/.test(h404))
    add(blocker, "404 页缺全站索引出口", "404.html", "访客无路可走");
  if (!/id=["']q404["']/.test(h404)) add(warn, "404 页缺搜索框", "404.html", "无法当场找回目标页");
  if (!/noindex/i.test(h404)) add(warn, "404 页未 noindex", "404.html", "不应参与索引");
}

/* 护栏：首屏静态快照（2026-11-06）——
   data/software.json 是新访客首屏唯一的快路径。它缺失/损坏时页面不会报错，只会静默退回
   经代理的 REST（慢一倍），从界面上完全看不出来，属于最难自己发现的退化。这里守三件事：
   ① 文件在、能解析、条数合理；② 前端仍优先读它；③ 前端仍保留 REST 兜底（快照挂了不许白屏）。 */
{
  try {
    const snap = JSON.parse(await readFile(join(ROOT, "data", "software.json"), "utf8"));
    const n = Array.isArray(snap.software) ? snap.software.length : 0;
    if (n < 50) add(blocker, "首屏快照条数异常", "data/software.json", `${n} 条（正常 150+），疑似抓取残缺`);
    /* build 是「这份快照代表的数据时刻」，前台靠它和后台写入的 rev 比大小决定要不要走实时接口。
       丢了 build 不会报错，只会让「后台改完刷新即见」悄悄失效，退回到等 CI 的分钟级延迟。 */
    if (!(Number(snap.build) > 0))
      add(blocker, "首屏快照缺 build 时间戳", "data/software.json", "前台无法判断快照是否落后于后台改动");
    if (!Array.isArray(snap.categories) || !snap.categories.length) add(warn, "首屏快照缺分类", "data/software.json", "categories 为空");
  } catch (e) {
    add(blocker, "首屏快照缺失/不可解析", "data/software.json", `${e.code || e.message} —— 新访客首屏会静默退化到 REST`);
  }
  const home = await readFile(join(ROOT, "index.html"), "utf8");
  if (!/SNAP_URL\s*=\s*['"]\/data\/software\.json['"]/.test(home) || !/async function fetchSnapshot\(/.test(home)) {
    add(blocker, "首屏快照优先逻辑缺失", "index.html", "fetchSnapshot/SNAP_URL 被删，首屏回到经代理的 REST");
  }
  if (!/async fetchFromRest\(/.test(home)) {
    add(blocker, "首屏 REST 兜底缺失", "index.html", "快照拉不到时没有 REST 兜底 → 白屏");
  }
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

/* 护栏：启动期导航守卫（2026-11-06 事故）——
   首页数据加载完的收尾逻辑若又变回无条件 goHome()，用户在骨架屏期间点开的板块会被弹回首页。 */
{
  const home = await readFile(join(ROOT, "index.html"), "utf8");
  if (!/function\s+_bumpNav\s*\(/.test(home) || !/function\s+_navStale\s*\(/.test(home)) {
    add(blocker, "启动期导航令牌缺失", "index.html", "_bumpNav/_navStale 被删，骨架屏期间点板块会被弹回首页");
  }
  if (!/_bootSeq\s*=\s*_navSeq/.test(home) || !/_navStale\(_bootSeq\)/.test(home)) {
    add(blocker, "启动收尾未做导航比对", "index.html", "DB.loadAll 之后的收尾必须 if(_navStale(_bootSeq))return; 后才 handleUrlParams()/goHome()");
  }
}

/* 护栏：后台即时可见（2026-11-06）——
   后台写库成功后打 rev 并广播，前台发现 rev 比快照 build 新就改走实时接口。
   这一层整条都是「看着没事、其实退化了」的类型：任一环被删，功能照常，只是后台改完
   又要等 CI 重建（几分钟），界面上完全看不出异常。所以三端都守。 */
{
  const home = await readFile(join(ROOT, "index.html"), "utf8");
  const admin = await readFile(join(ROOT, "admin.html"), "utf8");
  if (!/lezhe_data_rev/.test(home) || !/function\s+revIsNewer\s*\(/.test(home)) {
    add(blocker, "即时可见：前台 rev 判定缺失", "index.html", "getDataRev/revIsNewer 被删，后台改完刷新看不到新数据");
  }
  if (!/BroadcastChannel\(\s*["']lezhe-sync["']\s*\)/.test(home)) {
    add(blocker, "即时可见：前台广播监听缺失", "index.html", "已打开的页面不会自己换数据，必须手动刷新");
  }
  if (!/function\s+bumpDataRev\s*\(/.test(admin)) {
    add(blocker, "即时可见：后台 rev 打点缺失", "admin.html", "bumpDataRev 被删，前台永远认为快照是最新的");
  } else {
    // 定义 1 次 + 软件增删改 5 处 + 分类增删改名 3 处；掉到 6 以下说明有写操作漏接了
    const wired = (admin.match(/bumpDataRev\(\)/g) || []).length;
    if (wired < 6) add(blocker, "即时可见：写操作漏接 rev", "admin.html", `仅 ${wired} 处调用 bumpDataRev，增删改应全覆盖`);
  }
}

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
