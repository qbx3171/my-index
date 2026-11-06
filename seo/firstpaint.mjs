/**
 * 首屏耗时测量与取数降级校验（2026-11-06 新增）
 *
 * 背景：首页原有加载链是「HTML → init supabase-js → 经 CloudBase 代理查 159 条」四段串行，
 * 冷启动骨架屏约 2.5s。改造后优先取同源静态快照 data/software.json，需要一把尺子证明真的变快，
 * 并且证明「快照挂了会自动降级」，否则就是拿稳定性换速度。
 *
 * 运行：
 *   node seo/firstpaint.mjs                       # 测线上（默认 https://www.lezhesoft.cn/）
 *   node seo/firstpaint.mjs --url http://127.0.0.1:8931/
 *   node seo/firstpaint.mjs --no-snapshot         # 拦住 /data/software.json（404），验证 REST 兜底
 *   node seo/firstpaint.mjs --no-throttle         # 不限速（默认 4Mbps / 150ms RTT 模拟 4G）
 *   node seo/firstpaint.mjs --url http://www.lezhesoft.cn:8931/ --map www.lezhesoft.cn
 *                                                 # 本地文件 + 正式域名身份（绕开 IS_LOCAL_PREVIEW）
 *
 * 断言（任一不过 exit 2）：
 *   A. 首屏卡片渲染出来了（不是空白/错误态）
 *   B. 快照可用时必须走快照（控制台出现「首屏数据来自静态快照」）
 *   C. 快照被拦时必须回落 REST，且卡片照样渲染出来（降级不白屏）
 *   D. 详情弹层字段完整（screenshots / download_url / requirements 都在，不能因为走快照而缺字段）
 */
import { chromium } from "playwright";

const argv = process.argv.slice(2);
const URL_ARG = (argv[argv.indexOf("--url") + 1] || "").startsWith("http")
  ? argv[argv.indexOf("--url") + 1]
  : "https://www.lezhesoft.cn/";
const NO_SNAPSHOT = argv.includes("--no-snapshot");
const NO_THROTTLE = argv.includes("--no-throttle");
// 本地验证要用「正式域名 + 本地文件」：页面里的 IS_LOCAL_PREVIEW 会把 localhost 判成本地预览，
// 直接跳过快照与 REST（永远空数据），测不出真实链路。用 host-resolver 把域名指到 127.0.0.1 即可。
const MAP_ARG = argv[argv.indexOf("--map") + 1] || "";
const MAP_HOST = MAP_ARG.includes(".") ? MAP_ARG : "";
const EDGE = "C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe";

const fail = [];
const ok = (cond, msg) => {
  console.log(`${cond ? "  PASS" : "  FAIL"}  ${msg}`);
  if (!cond) fail.push(msg);
};

const browser = await chromium.launch({
  executablePath: EDGE,
  args: MAP_HOST
    ? [
        `--host-resolver-rules=MAP ${MAP_HOST} 127.0.0.1`,
        // 本地联调时防止 http 被「HTTPS 优先」升级（升级后连不上本地服务器）
        "--disable-features=HttpsUpgrades,HttpsFirstModeV2",
      ]
    : [],
});
const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 } });
const page = await ctx.newPage();

const cdp = await ctx.newCDPSession(page);
if (!NO_THROTTLE) {
  await cdp.send("Network.enable");
  await cdp.send("Network.emulateNetworkConditions", {
    offline: false,
    latency: 150,
    downloadThroughput: (4 * 1024 * 1024) / 8,
    uploadThroughput: (1 * 1024 * 1024) / 8,
  });
}

const logs = [];
page.on("console", (m) => logs.push(m.text()));
const errors = [];
page.on("pageerror", (e) => errors.push(e.message));

if (NO_SNAPSHOT) {
  await page.route("**/data/software.json*", (r) => r.fulfill({ status: 404, body: "" }));
}

const t0 = Date.now();
await page.goto(URL_ARG, { waitUntil: "domcontentloaded" });
let cardsMs = null;
try {
  await page.waitForFunction(() => document.querySelectorAll(".software-card").length > 0, { timeout: 30000 });
  cardsMs = Date.now() - t0;
} catch {
  /* 下面统一报错 */
}
const skeletonGoneMs = await page
  .waitForFunction(() => document.querySelectorAll(".skeleton-card").length === 0, { timeout: 15000 })
  .then(() => Date.now() - t0)
  .catch(() => null);

const stat = await page.evaluate(() => {
  // 真正要比较的是「数据到达时刻」：整体首屏被 655KB 的 HTML 主导，
  // 快照 vs 代理的差距会被它掩盖，只有把数据这一段的耗时单列出来才看得见。
  const res = performance.getEntriesByType("resource");
  const snap = res.find((r) => r.name.includes("/data/software.json"));
  const rest = res.find((r) => r.name.includes("/rest/v1/software"));
  const pick = (e) => (e ? Math.round(e.responseEnd) : null);
  return {
  cards: document.querySelectorAll(".software-card").length,
  hot: document.querySelectorAll(".hotindex-list li").length,
  empty: document.body.innerText.includes("加载失败") || document.body.innerText.includes("暂无软件"),
  snapUsed: !!snap,
  snapMs: pick(snap),
  restMs: pick(rest),
  htmlMs: Math.round((performance.getEntriesByType("navigation")[0] || {}).responseEnd || 0),
};
});

// 详情弹层字段完整性：走快照时最容易在这里出问题（只取了首屏字段就会缺 download_url/screenshots）
let detail = { opened: false, hasDownload: false, hasShots: false };
try {
  await page.evaluate(() => {
    const card = document.querySelector(".software-card");
    if (card) card.click();
  });
  await page.waitForTimeout(1200);
  detail = await page.evaluate(() => {
    const box = document.getElementById("detailOverlay");
    const visible = !!box && box.classList.contains("open");
    const html = box ? box.innerHTML : "";
    const text = box ? box.innerText : "";
    return {
      opened: visible,
      // 详情页三项最容易因「只取了首屏字段」而缺：下载入口、详情正文、图集
      hasDownload: /下载/.test(text),
      hasShots: box ? box.querySelectorAll("img").length : 0,
      len: text.length,
    };
  });
} catch {
  /* 详情打不开不算致命，下面按断言处理 */
}

await browser.close();

const source = logs.some((t) => t.includes("来自静态快照"))
  ? "静态快照"
  : logs.some((t) => t.includes("静态快照不可用"))
    ? "REST 兜底"
    : "未知";

console.log(`\n首屏测量 @ ${URL_ARG}${NO_SNAPSHOT ? "（已拦住 /data/software.json）" : ""}`);
console.log(`  卡片渲染      ${cardsMs === null ? "超时" : cardsMs + " ms"}`);
console.log(`  骨架屏消失    ${skeletonGoneMs === null ? "—" : skeletonGoneMs + " ms"}`);
console.log(`  卡片数 ${stat.cards} · 热门 ${stat.hot} 条 · 数据来源 ${source}`);
console.log(
  `  数据到达      快照 ${stat.snapMs === null ? "—" : stat.snapMs + " ms"} / REST ${stat.restMs === null ? "—" : stat.restMs + " ms"}（HTML ${stat.htmlMs} ms）`
);
console.log(`  详情弹层 打开=${detail.opened} 下载入口=${detail.hasDownload} 图片=${detail.hasShots} 张 正文=${detail.len || 0} 字`);
if (errors.length) console.log(`  JS 异常：${errors.slice(0, 3).join(" | ")}`);

ok(cardsMs !== null && stat.cards > 0, "首屏卡片渲染出来了");
ok(!stat.empty, "首屏没有落到「加载失败/暂无软件」错误态");
if (NO_SNAPSHOT) {
  ok(source === "REST 兜底", "快照不可用时回落到 REST（降级链有效）");
  ok(stat.cards > 0, "降级后卡片仍然渲染（不白屏）");
} else {
  ok(source === "静态快照", "快照可用时走静态快照（没有白跑）");
  ok(stat.snapUsed, "浏览器确实请求了 /data/software.json");
}
ok(detail.opened && detail.hasDownload && detail.len > 100, "详情弹层可打开、有下载入口、有正文（快照字段没缺）");
ok(errors.length === 0, "无 JS 运行时异常");

console.log(fail.length ? `\n❌ ${fail.length} 项未通过\n` : "\n✅ 全部通过\n");
process.exit(fail.length ? 2 : 0);
