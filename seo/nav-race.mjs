/**
 * 启动期导航竞态回归（2026-11-06）
 *
 * 背景：首页冷启动要等 Supabase 数据，期间显示骨架屏；旧逻辑在数据到达后的
 * requestIdleCallback 里无条件 App.goHome()，用户点的板块会被顶回首页。
 *
 * 断言：
 *  1) 骨架屏期间点「教程」→ 数据到达后仍停在教程页（不被弹回首页）
 *  2) ?cat= 深链在无人干扰时仍然生效（修复不能牺牲深链）
 *  3) 教程页上点「首页」能正常回首页（令牌不能把正常跳转也吃了）
 *
 * 用法：
 *   node seo/nav-race.mjs                 # 打线上
 *   node seo/nav-race.mjs --local-html    # 用本地 index.html 顶替线上文档（上线前验证）
 */
import { chromium } from "playwright";
import { readFileSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const SITE = "https://www.lezhesoft.cn";
const USE_LOCAL_HTML = process.argv.includes("--local-html");
const EXE = "C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe";

let fail = 0;
const ok = (cond, msg, extra = "") => {
  console.log(`${cond ? "✅" : "❌"} ${msg}${extra ? " · " + extra : ""}`);
  if (!cond) fail++;
};

const browser = await chromium.launch({ executablePath: EXE });

async function newPage() {
  const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  const page = await ctx.newPage();
  // 拉长骨架屏窗口，稳定复现竞态
  const cdp = await ctx.newCDPSession(page);
  await cdp.send("Network.enable");
  await cdp.send("Network.emulateNetworkConditions", {
    offline: false, latency: 350,
    downloadThroughput: 400 * 1024, uploadThroughput: 400 * 1024,
  });
  if (USE_LOCAL_HTML) {
    const html = readFileSync(join(ROOT, "index.html"), "utf8");
    await page.route(SITE + "/", (r) =>
      r.fulfill({ status: 200, contentType: "text/html; charset=utf-8", body: html })
    );
  }
  return { ctx, page };
}

const state = (p) => p.evaluate(() => ({
  cur: window.App ? App.currentPage : "-",
  homeHidden: document.getElementById("pageHome")?.classList.contains("hidden"),
  tutHidden: document.getElementById("pageTutorials")?.classList.contains("hidden"),
  listHidden: document.getElementById("pageList")?.classList.contains("hidden"),
  skel: document.querySelectorAll(".skeleton-card").length,
  url: location.pathname + location.search,
}));

/* ---- 用例 1：骨架屏期间点教程 ---- */
{
  const { ctx, page } = await newPage();
  await page.goto(SITE + "/", { waitUntil: "domcontentloaded" });
  await page.waitForFunction(() => document.querySelectorAll(".skeleton-card").length > 0, { timeout: 15000 });
  const before = await state(page);
  console.log(`\n[1] 骨架屏卡片 ${before.skel} 个，此时点击「教程」`);
  await page.click('.nav-links a[data-page="tutorials"]');
  const justAfter = await state(page);
  ok(justAfter.cur === "tutorials", "点击后立即进入教程页", `currentPage=${justAfter.cur}`);
  await page.waitForTimeout(9000); // 等数据到达 + 启动收尾（旧逻辑正是在这段时间弹回首页）
  const after = await state(page);
  ok(after.cur === "tutorials", "数据加载完成后仍停在教程页", `currentPage=${after.cur}`);
  ok(after.tutHidden === false && after.homeHidden === true, "教程页可见、首页保持隐藏");

  /* ---- 用例 3：教程页点首页 ---- */
  await page.click('.nav-links a[data-page="home"]');
  await page.waitForTimeout(600);
  const home = await state(page);
  ok(home.cur === "home" && home.homeHidden === false, "教程页点「首页」可正常返回", `currentPage=${home.cur}`);
  await ctx.close();
}

/* ---- 用例 2：?cat= 深链 ---- */
{
  const { ctx, page } = await newPage();
  const cat = "shiyong-gongju";
  await page.goto(`${SITE}/?cat=${cat}`, { waitUntil: "domcontentloaded" });
  await page.waitForTimeout(9000);
  const s = await state(page);
  ok(s.cur === "list" && s.listHidden === false, `?cat=${cat} 深链落到列表页`, `currentPage=${s.cur}`);
  const curCat = await page.evaluate(() => (window.App ? App.currentCategory : "-"));
  ok(curCat === cat, "分类参数被正确应用", `currentCategory=${curCat}`);
  await ctx.close();
}

await browser.close();
console.log(fail === 0 ? "\nNAV-RACE PASS" : `\nNAV-RACE FAIL (${fail})`);
process.exit(fail === 0 ? 0 : 2);
