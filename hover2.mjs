import { chromium } from 'playwright';
const browser = await chromium.launch();
const d = await browser.newPage({ viewport: { width: 1280, height: 800 } });
await d.goto('file:///C:/Users/Adminstor/Documents/GitHub/my-index/index.html', { waitUntil: 'domcontentloaded' });
await d.waitForTimeout(1500);
const links = await d.$$('.nav-links a');
for (const a of links.slice(0, 5)) {
  const name = (await a.textContent()).trim();
  await a.hover();
  await d.waitForTimeout(420);
  const r = await a.evaluate(el => { const s = getComputedStyle(el); return { color: s.color, bgSize: s.backgroundSize }; });
  console.log(`${name}: color=${r.color} bgSize=${r.bgSize}`);
}
// 悬停截图（软件库按钮）
const btn = await d.$('.nav-links a:nth-child(2)');
await btn.hover(); await d.waitForTimeout(500);
await d.screenshot({ path: 'C:/Users/Adminstor/AppData/Local/Temp/hover-index.png', clip: { x: 0, y: 0, width: 900, height: 70 } });
await browser.close();
