import { chromium } from 'playwright';
const run = async (vp, label) => {
  const b = await chromium.launch();
  const ctx = await b.newContext({ viewport: vp, userAgent: vp.width < 500 ? 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1' : undefined });
  const page = await ctx.newPage();
  const errs = [];
  page.on('pageerror', e => errs.push('pageerror: ' + e.message));
  page.on('console', m => { if (m.type() === 'error') errs.push('console: ' + m.text()); });
  await page.goto('https://www.lezhesoft.cn/', { waitUntil: 'networkidle', timeout: 60000 });
  await page.waitForTimeout(3000);
  const r = await page.evaluate(() => {
    const c = document.getElementById('todayStackContainer');
    const cnt = document.getElementById('todayCount');
    const cards = document.querySelectorAll('.stack-card');
    const first = document.querySelector('.stack-card .name');
    const sec = document.querySelector('.today-section');
    const secVisible = sec ? !!(sec.offsetWidth || sec.offsetHeight) : false;
    const secTop = sec ? sec.getBoundingClientRect().top : -1;
    return {
      countText: cnt ? cnt.textContent : null,
      cardCount: cards.length,
      firstCard: first ? first.textContent : null,
      containerHTMLLen: c ? c.innerHTML.length : -1,
      emptyText: c && c.querySelector('.stack-empty') ? c.querySelector('.empty-text').textContent : null,
      secVisible, secTop,
      softwareLen: window.DB && window.DB.getSoftware ? window.DB.getSoftware().length : -1,
      hasNew: window.DB && window.DB.getSoftware ? window.DB.getSoftware().some(s => String(s.id).startsWith('fb3f650456')) : null,
      todayLen: window.DB && window.DB.getSoftware ? window.DB.getSoftware().filter(s => { if(!s.created_at) return false; const t=new Date(s.created_at), n=new Date(); return t.getFullYear()===n.getFullYear()&&t.getMonth()===n.getMonth()&&t.getDate()===n.getDate(); }).length : -1,
    };
  });
  console.log('==== ' + label + ' ====');
  console.log(JSON.stringify(r, null, 1));
  console.log('errors:', errs.length ? errs.slice(0,5) : 'none');
  await b.close();
};
await run({ width: 390, height: 844 }, '手机视口 390 (iPhone UA)');
await run({ width: 1366, height: 900 }, '桌面视口 1366');
