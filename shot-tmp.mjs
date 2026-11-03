import { chromium } from 'playwright';
const browser = await chromium.launch();
const url = 'file:///C:/Users/Adminstor/Documents/GitHub/my-index/index.html';
// Desktop
const d = await browser.newPage({ viewport: { width: 1440, height: 900 } });
await d.goto(url, { waitUntil: 'domcontentloaded' });
await d.waitForTimeout(2500);
await d.screenshot({ path: 'C:/Users/Adminstor/AppData/Local/Temp/nav-desktop.png' });
const dh = await d.evaluate(() => {
  const h = document.querySelector('.header');
  const m = document.querySelector('.main-content');
  const hi = document.querySelector('.header-inner');
  const r = e => { const b = e.getBoundingClientRect(); const s = getComputedStyle(e); return { left: b.left, right: b.right, width: b.width, ml: s.marginLeft, mr: s.marginRight, pl: s.paddingLeft, max: s.maxWidth }; };
  return { header: r(h), main: r(m), headerInner: r(hi) };
});
console.log('DESKTOP', JSON.stringify(dh, null, 1));
// Mobile
const mo = await browser.newPage({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true });
await mo.goto(url, { waitUntil: 'domcontentloaded' });
await mo.waitForTimeout(2500);
await mo.screenshot({ path: 'C:/Users/Adminstor/AppData/Local/Temp/nav-mobile.png' });
const mh = await mo.evaluate(() => {
  const h = document.querySelector('.header');
  const m = document.querySelector('.main-content');
  const hi = document.querySelector('.header-inner');
  const r = e => { const b = e.getBoundingClientRect(); const s = getComputedStyle(e); return { left: b.left, right: b.right, width: b.width, ml: s.marginLeft, mr: s.marginRight, pl: s.paddingLeft, max: s.maxWidth }; };
  return { header: r(h), main: r(m), headerInner: r(hi) };
});
console.log('MOBILE', JSON.stringify(mh, null, 1));
await browser.close();
