import { chromium } from 'playwright';
const browser = await chromium.launch();
async function test(page, url, label) {
  await page.goto(url, { waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(1200);
  const links = await page.$$('.nav-links a');
  const out = [];
  for (const a of links.slice(0, 5)) {
    const name = (await a.textContent()).trim();
    await a.hover();
    await page.waitForTimeout(450);
    const r = await a.evaluate(el => {
      const s = getComputedStyle(el);
      return { color: s.color, bgSize: s.backgroundSize, bgImg: s.backgroundImage.slice(0, 40) };
    });
    out.push(`${name}: color=${r.color} bgSize=${r.bgSize}`);
  }
  console.log(`--- ${label} ---`);
  out.forEach(o => console.log(o));
}
const d = await browser.newPage({ viewport: { width: 1280, height: 800 } });
await test(d, 'file:///C:/Users/Adminstor/Documents/GitHub/my-index/index.html', '首页(桌面)');
await test(d, 'file:///C:/Users/Adminstor/Documents/GitHub/my-index/cat/meiti-gongju.html', '分类页(桌面)');
await test(d, 'file:///C:/Users/Adminstor/Documents/GitHub/my-index/ai/index.html', 'AI页(桌面)');
// 悬停截图
await d.goto('file:///C:/Users/Adminstor/Documents/GitHub/my-index/index.html', { waitUntil: 'domcontentloaded' });
await d.waitForTimeout(1200);
const btn = await d.$('.nav-links a:nth-child(2)');
await btn.hover(); await d.waitForTimeout(500);
await d.screenshot({ path: 'C:/Users/Adminstor/AppData/Local/Temp/hover-index.png', clip: { x: 0, y: 0, width: 900, height: 70 } });
const c = await browser.newPage({ viewport: { width: 1280, height: 800 } });
await c.goto('file:///C:/Users/Adminstor/Documents/GitHub/my-index/cat/meiti-gongju.html', { waitUntil: 'domcontentloaded' });
await c.waitForTimeout(1200);
const b2 = await c.$('.nav-links a:nth-child(3)');
await b2.hover(); await c.waitForTimeout(500);
await c.screenshot({ path: 'C:/Users/Adminstor/AppData/Local/Temp/hover-cat.png', clip: { x: 0, y: 0, width: 900, height: 110 } });
await browser.close();
