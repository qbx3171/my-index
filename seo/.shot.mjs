import { chromium } from "playwright";
const pages = [
  ["file:///" + process.cwd().replace(/\\/g, "/") + "/ai/index.html", "hub"],
  ["file:///" + process.cwd().replace(/\\/g, "/") + "/ai/ai-xiezuo.html", "col"],
  ["file:///" + process.cwd().replace(/\\/g, "/") + "/ai/tool/wawa.html", "detail"],
];
const browser = await chromium.launch();
for (const [url, name] of pages) {
  const page = await browser.newPage({ viewport: { width: 1600, height: 900 } });
  await page.goto(url, { waitUntil: "networkidle" }).catch(() => {});
  await page.waitForTimeout(600);
  await page.screenshot({ path: `seo/.shot-${name}.png` });
  await page.close();
}
// 移动端
const m = await browser.newPage({ viewport: { width: 390, height: 844 } });
await m.goto(pages[0][0], { waitUntil: "networkidle" }).catch(() => {});
await m.waitForTimeout(500);
await m.screenshot({ path: "seo/.shot-mobile.png" });
await browser.close();
console.log("shots done");
