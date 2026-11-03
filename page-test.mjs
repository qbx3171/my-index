import { chromium } from 'playwright';
import { readdirSync } from 'fs';
const browser = await chromium.launch();
const softs = readdirSync('soft').filter(f => f.endsWith('.html'));
const targets = ['cat/meiti-gongju.html', 'all.html', 'ai/index.html', 'soft/' + softs[0], 'soft/' + softs[1]];
for (const t of targets) {
  const p = await browser.newPage({ viewport: { width: 390, height: 800 }, deviceScaleFactor: 1 });
  try {
    await p.goto('file:///C:/Users/Adminstor/Documents/GitHub/my-index/' + t, { waitUntil: 'domcontentloaded' });
    await p.waitForTimeout(1200);
    const m = await p.evaluate(() => {
      const cand = document.querySelector('.header, header, .topbar, .navbar, nav');
      let info = 'none';
      if (cand) { const b = cand.getBoundingClientRect(); const s = getComputedStyle(cand); info = `left=${Math.round(b.left)} right=${Math.round(b.right)} w=${Math.round(b.width)} ml=${s.marginLeft} pl=${s.paddingLeft}`; }
      const firstText = document.querySelector('body > *:not(script):not(style)');
      return { nav: cand ? cand.className || cand.tagName : 'none', info, scrollW: document.documentElement.scrollWidth, bodyW: document.body.clientWidth };
    });
    console.log(t, JSON.stringify(m));
    await p.screenshot({ path: 'C:/Users/Adminstor/AppData/Local/Temp/' + t.replace(/[\/\.]/g, '_') + '.png', clip: { x: 0, y: 0, width: 390, height: 200 } });
  } catch (e) { console.log(t, 'ERR', e.message.slice(0,80)); }
  await p.close();
}
await browser.close();
