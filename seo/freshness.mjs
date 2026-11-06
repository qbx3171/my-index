/**
 * 后台「即时可见」链路校验（2026-11-06 新增）
 *
 * 背景：后台写 Supabase，首页读的是 CI 定时重建的静态快照，中间隔着几分钟。
 * 现在加了一层 rev：后台写库成功就在 localStorage 打时间戳并广播，前台发现
 * rev 比快照的 build 新就改走实时接口。本脚本证明三件事都真成立，且不影响普通访客：
 *
 *   A. 没有 rev 时，首页仍旧走静态快照（提速没有回退）
 *   B. 有更新的 rev 时，首页改走实时数据，且卡片照常渲染
 *   C. 后台广播 data-rev 后，已经打开着的首页会自己换数据（不用刷新）
 *
 * 运行：
 *   node seo/freshness.mjs                        # 线上
 *   node seo/freshness.mjs --local . --url http://www.lezhesoft.cn/
 *                                                 # 本地文件 + 正式域名身份（不依赖本机 hosts/代理）
 *   node seo/freshness.mjs --no-throttle
 */
import { chromium } from "playwright";

const argv = process.argv.slice(2);
const LOCAL_ROOT = (argv[argv.indexOf("--local") + 1] || "").startsWith("-") ? "" : argv[argv.indexOf("--local") + 1] || "";
const URL_ARG = (argv[argv.indexOf("--url") + 1] || "").startsWith("http")
  ? argv[argv.indexOf("--url") + 1]
  : LOCAL_ROOT
    ? "http://www.lezhesoft.cn/"
    : "https://www.lezhesoft.cn/";
const NO_THROTTLE = argv.includes("--no-throttle");
const EDGE = "C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe";

const fail = [];
const ok = (cond, msg) => {
  console.log(`${cond ? "  PASS" : "  FAIL"}  ${msg}`);
  if (!cond) fail.push(msg);
};

const browser = await chromium.launch({ executablePath: EDGE });
const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 } });

/* 本地联调：用 route 把正式域名的请求原地映射到磁盘。
   为什么不走 host-resolver：本机开着系统代理，Chrome 会把 www 域名交给代理，
   映射失效且报 ERR_PROXY_CONNECTION_FAILED；route 在浏览器内部完成，稳定得多。 */
if (LOCAL_ROOT) {
  const { readFileSync } = await import("node:fs");
  const { join, extname } = await import("node:path");
  const MIME = {
    ".html": "text/html; charset=utf-8",
    ".json": "application/json; charset=utf-8",
    ".js": "text/javascript; charset=utf-8",
    ".css": "text/css; charset=utf-8",
    ".png": "image/png",
    ".jpg": "image/jpeg",
    ".jpeg": "image/jpeg",
    ".svg": "image/svg+xml",
    ".webmanifest": "application/manifest+json",
    ".xml": "application/xml",
    ".ico": "image/x-icon",
    ".woff2": "font/woff2",
    ".txt": "text/plain; charset=utf-8",
  };
  /* 只按 host 匹配、不按协议：站点开了 Always Use HTTPS，请求 http 会被 301 到 https，
     若 route 只写 http:// 前缀就会漏掉重定向后的全部请求，进而打到真实线上。 */
  await ctx.route("**/*", async (route) => {
    const u = new URL(route.request().url());
    if (u.hostname !== "www.lezhesoft.cn") return route.continue();
    let p = decodeURIComponent(u.pathname);
    if (p.endsWith("/")) p += "index.html";
    try {
      const buf = readFileSync(join(LOCAL_ROOT, p));
      await route.fulfill({
        status: 200,
        headers: {
          "content-type": MIME[extname(p).toLowerCase()] || "application/octet-stream",
          // 不设 no-store 时 Chrome 会把同一 URL 的首次响应缓存在内存里，
          // 后续 fetch 拿到的是旧内容，测出来的 build 永远是 0
          "cache-control": "no-store",
        },
        body: buf,
      });
    } catch {
      await route.fulfill({ status: 404, body: "not found" });
    }
  });
}

const page = await ctx.newPage();

if (!NO_THROTTLE) {
  const cdp = await ctx.newCDPSession(page);
  await cdp.send("Network.enable");
  await cdp.send("Network.emulateNetworkConditions", {
    offline: false,
    latency: 150,
    downloadThroughput: (4 * 1024 * 1024) / 8,
    uploadThroughput: (1 * 1024 * 1024) / 8,
  });
}

let logs = [];
let restHits = 0;
const errors = [];
page.on("console", (m) => logs.push(m.text()));
page.on("pageerror", (e) => errors.push(e.message));
page.on("request", (r) => {
  if (r.url().includes("/rest/v1/software")) restHits++;
});

const waitCards = () =>
  page.waitForFunction(() => document.querySelectorAll(".software-card").length > 0, { timeout: 30000 });

console.log(`\n后台即时可见校验 @ ${URL_ARG}`);

/* ── A. 普通访客：没有 rev，必须走静态快照 ─────────────────────────────── */
await page.goto(URL_ARG, { waitUntil: "domcontentloaded" });
await waitCards().catch(() => {});
const snapSrc = logs.some((t) => t.includes("来自静态快照"));
const revFirstHits = restHits;
ok(snapSrc, "无 rev 时走静态快照（普通访客路径未受影响）");
ok(revFirstHits === 0, `无 rev 时没有多余打实时接口（REST 请求 ${revFirstHits} 次）`);

const build = await page.evaluate(async () => {
  const r = await fetch("/data/software.json", { cache: "no-cache" });
  if (!r.ok) return 0;
  const d = await r.json();
  return Number(d.build) || 0;
});
ok(build > 0, `快照带 build 时间戳（${build || "缺失"}）`);

/* ── B. 后台刚改过：rev 比 build 新，必须走实时数据 ─────────────────────── */
logs = [];
restHits = 0;
await page.evaluate((b) => {
  localStorage.setItem("lezhe_data_rev", String(b + 3600000));
  sessionStorage.removeItem("lezhe_data_rev_synced");
}, build);
await page.reload({ waitUntil: "domcontentloaded" });
await waitCards().catch(() => {});
const freshLog = logs.some((t) => t.includes("后台有更新"));
const cardsAfter = await page.evaluate(() => document.querySelectorAll(".software-card").length);
ok(freshLog, "rev 比 build 新时，前台判定「后台有更新」");
ok(restHits > 0, `确实改走了实时接口（REST 请求 ${restHits} 次）`);
ok(cardsAfter > 0, `实时数据渲染出了卡片（${cardsAfter} 张）`);

/* ── C. 已经开着的页面：收到广播自己换数据 ─────────────────────────────── */
logs = [];
restHits = 0;
await page.evaluate((b) => {
  // 模拟后台保存：先落 rev，再广播（BroadcastChannel 不会回投给发送方自身，
  // 页面里那个监听通道能收到）
  localStorage.setItem("lezhe_data_rev", String(b + 7200000));
  const bc = new BroadcastChannel("lezhe-sync");
  bc.postMessage({ type: "data-rev", at: b + 7200000 });
  setTimeout(() => bc.close(), 500);
}, build);
await page.waitForTimeout(4000);
ok(restHits > 0, `收到 data-rev 广播后自动重取数据（REST 请求 ${restHits} 次，无需手动刷新）`);

const stillCards = await page.evaluate(() => document.querySelectorAll(".software-card").length);
ok(stillCards > 0, `广播刷新后列表仍然正常（${stillCards} 张卡片）`);
ok(errors.length === 0, `无 JS 运行时异常${errors.length ? "：" + errors.slice(0, 2).join(" | ") : ""}`);

await browser.close();
console.log(fail.length ? `\n❌ ${fail.length} 项未通过\n` : "\n✅ 全部通过\n");
process.exit(fail.length ? 2 : 0);
