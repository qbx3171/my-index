// 把「打赏」从 更多▾ 下拉移出，做成一级导航的红色爱心按钮（幂等）
import fs from 'fs';
const FILE = 'index.html';
let s = fs.readFileSync(FILE, 'utf8');

const donateInPanel = /<a href="#" onclick="openDonateModal\(\);return false;">\s*<i class="fas fa-heart" style="color:#e74c3c;"><\/i> 打赏<\/a>\s*/;
if (!s.includes('navDonateLi') && donateInPanel.test(s)) {
  // 1) 从下拉面板删除打赏
  s = s.replace(donateInPanel, '');
  // 2) 在登录项之前插入一级打赏按钮（红色胶囊，显眼且不挤文字导航）
  const donateLi = `<li><a href="#" id="navDonateLi" class="nav-donate-btn" onclick="openDonateModal();return false;"><i class="fas fa-heart"></i> 打赏</a></li>`;
  const anchor = `<li><a href="#" id="authNav"`;
  if (!s.includes(anchor)) { console.error('登录项锚点未找到'); process.exit(1); }
  s = s.replace(anchor, donateLi + anchor);
  // 3) 补样式（并入现有 navMoreStyle 块，避免再加 style 标签）
  const extraCss = `.nav-donate-btn{background:linear-gradient(135deg,#ff6b6b,#e74c3c);color:#fff!important;border-radius:20px;padding:6px 14px!important;margin-left:4px;box-shadow:0 2px 8px rgba(231,76,60,.35);transition:transform .15s,box-shadow .15s;}.nav-donate-btn:hover{transform:translateY(-1px);box-shadow:0 4px 12px rgba(231,76,60,.45);}.nav-donate-btn i{animation:navHeart 2.4s ease-in-out infinite;}@keyframes navHeart{0%,100%{transform:scale(1)}12%{transform:scale(1.18)}24%{transform:scale(1)}}@media(max-width:768px){.nav-donate-btn{display:inline-flex;justify-content:center;margin:4px 12px;}}`;
  const styleAnchor = '/* __NAV_MORE_CSS__ */';
  if (s.includes(styleAnchor)) {
    s = s.replace(styleAnchor, styleAnchor + extraCss);
  } else {
    // 兜底：插到 navMoreStyle 块末尾
    const m = s.match(/<style id="navMoreStyle">([\s\S]*?)<\/style>/);
    if (!m) { console.error('navMoreStyle 未找到'); process.exit(1); }
    s = s.replace(m[0], `<style id="navMoreStyle">${m[1]}${extraCss}</style>`);
  }
  fs.writeFileSync(FILE, s);
  console.log('打赏已移出下拉并设为一级红色按钮');
} else {
  console.log('无需处理（已移出或源标记缺失）');
}
