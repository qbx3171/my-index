// 本地渲染自测：拦截 ai.css 请求用本地最新样式，验证排版（push 前自检用）
import { chromium } from "playwright";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const css = readFileSync("ai/ai.css", "utf8");
const html = readFileSync("ai/index.html", "utf8").replaceAll(
  "https://www.lezhesoft.cn/",
  "file:///" + resolve(".").replace(/\\/g, "/") + "/"
);
const b = await chromium.launch();
const p = await b.newPage({ viewport: { width: 1600, height: 900 } });
await p.route("**/ai/ai.css*", (r) => r.fulfill({ contentType: "text/css", body: css }));
await p.route("**/ai/index.html*", (r) => r.fulfill({ contentType: "text/html", body: html }));
await p.goto("file:///" + resolve(".").replace(/\\/g, "/") + "/ai/index.html");
await p.waitForTimeout(800);
const m = await p.evaluate(() => {
  const lead = document.querySelector(".ai-lead").getBoundingClientRect();
  const h1 = document.querySelector("h1").getBoundingClientRect();
  const side = document.querySelector(".ai-side").getBoundingClientRect();
  const card = document.querySelector(".ai-card");
  return {
    leadX: Math.round(lead.x),
    h1X: Math.round(h1.x),
    sideRight: Math.round(side.right),
    sideH: Math.round(side.height),
    cardTextClip: card ? card.scrollWidth > card.clientWidth + 1 : null,
  };
});
console.log(JSON.stringify(m));
await p.screenshot({ path: "seo/.shot-hub2.png" });
await b.close();
console.log("done");
