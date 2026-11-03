import { chromium } from 'playwright';
const browser = await chromium.launch();
const url = 'file:///C:/Users/Adminstor/Documents/GitHub/my-index/index.html';
const widths = [320,360,390,412,430,480,500,600,768,800,820,821,900,1024,1280];
for (const w of widths) {
  const p = await browser.newPage({ viewport: { width: w, height: 800 } });
  await p.goto(url, { waitUntil: 'domcontentloaded' });
  await p.waitForTimeout(600);
  const m = await p.evaluate(() => {
    const h = document.querySelector('.header').getBoundingClientRect();
    const inner = document.querySelector('.header-inner').getBoundingClientRect();
    return { hl: Math.round(h.left), hr: Math.round(h.right), il: Math.round(inner.left), docW: document.documentElement.scrollWidth };
  });
  console.log(`w=${w} header.left=${m.hl} header.right=${m.hr} inner.left=${m.il} scrollW=${m.docW}`);
  await p.close();
}
await browser.close();
