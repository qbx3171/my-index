// 方案B「胶囊分段」导航落地（幂等）：分段胶囊 ul + AI渐变文字 + 更多▾主题化下拉 + 打赏/登录移出容器
import fs from 'fs';
const FILE = 'index.html';
let s = fs.readFileSync(FILE, 'utf8');
if (s.includes('navseg-v2')) { console.log('已注入过，跳过'); process.exit(0); }

// —— 1) AI 链接加类名 ——
const aiLi = '<li><a href="/ai/index.html"><i class="fas fa-robot"></i> AI工具集</a></li>';
if (!s.includes(aiLi)) { console.error('AI 链接锚点未找到'); process.exit(1); }
s = s.replace(aiLi, '<li><a href="/ai/index.html" class="nav-ai"><i class="fas fa-robot"></i> AI工具集</a></li>');

// —— 2) 打赏/登录移出 ul ——
const donateLi = '<li><a href="#" id="navDonateLi" class="nav-donate-btn" onclick="openDonateModal();return false;"><i class="fas fa-heart"></i> 打赏</a></li>';
const loginLiRe = /<li><a href="#" id="authNav"[^>]*><span id="authAvatar"[^>]*><\/span><span id="authNavText">[^<]*<\/span><\/a><\/li>/;
const loginLi = s.match(loginLiRe);
if (!s.includes(donateLi) || !loginLi) { console.error('打赏/登录锚点未找到', !!s.includes(donateLi), !!loginLi); process.exit(1); }
const loginInner = loginLi[0].replace(/^<li>/, '').replace(/<\/li>$/, '');
s = s.replace(donateLi, '').replace(loginLiRe, '');
// 在 navLinks 的 </ul> 后插入操作区
const ulStart = s.indexOf('id="navLinks"');
const ulEnd = s.indexOf('</ul>', ulStart);
s = s.slice(0, ulEnd) + '</ul><div class="nav-actions"><a href="#" id="navDonateLi" class="nav-donate-btn" title="打赏支持" onclick="openDonateModal();return false;"><i class="fas fa-heart"></i><span class="nav-donate-text">打赏</span></a>' + loginInner + '</div>' + s.slice(ulEnd + 5);

// —— 3) 重写 navMoreStyle 样式块 ——
const CSS = `<style id="navMoreStyle">
/* ===== 导航 方案B 胶囊分段 (navseg-v2) ===== */
.nav-links{display:flex;align-items:center;gap:2px;list-style:none;background:var(--bg-secondary);border:1px solid var(--border-glow);border-radius:50px;padding:4px}
.nav-links a{font-size:.9rem;font-weight:500;color:var(--text-secondary);transition:var(--transition);padding:8px 17px;border-radius:50px;display:inline-flex;align-items:center;gap:6px;white-space:nowrap}
.nav-links a:hover{color:var(--text-primary)}
.nav-links a.active{background:var(--bg-card-solid);color:var(--accent-cyan);font-weight:700;box-shadow:0 2px 8px rgba(15,26,46,.10)}
.nav-links a.nav-ai{background:var(--accent-gradient);-webkit-background-clip:text;background-clip:text;color:transparent;font-weight:700}
.nav-links a.nav-ai:hover{opacity:.8}
.nav-links a.nav-ai.active{background:var(--bg-card-solid);-webkit-background-clip:padding-box;background-clip:padding-box;color:var(--accent-cyan);box-shadow:0 2px 8px rgba(15,26,46,.10)}
/* 更多▾ 下拉 */
.nav-more{position:relative}
.nav-caret{font-size:.6rem;transition:transform .2s}
.nav-more.open .nav-caret{transform:rotate(180deg)}
.nav-more-panel{position:absolute;top:calc(100% + 10px);right:0;min-width:136px;background:var(--bg-card-solid);border:1px solid var(--border-glow);border-radius:14px;box-shadow:var(--shadow-card-hover);padding:6px;opacity:0;visibility:hidden;transform:translateY(6px);transition:.18s;z-index:60}
.nav-more.open .nav-more-panel{opacity:1;visibility:visible;transform:none}
.nav-more-panel a{display:flex;align-items:center;gap:9px;font-size:.86rem;font-weight:500;color:var(--text-secondary);text-decoration:none;padding:9px 12px;border-radius:9px}
.nav-more-panel a:hover{background:var(--bg-secondary);color:var(--text-primary)}
/* 操作区：打赏 + 登录 */
.nav-actions{display:flex;align-items:center;gap:10px}
.nav-donate-btn{display:inline-flex;align-items:center;gap:7px;font-size:.88rem;font-weight:700;color:#e74c3c;background:rgba(231,76,60,.09);border:1px solid rgba(231,76,60,.30);border-radius:50px;padding:9px 17px;text-decoration:none;transition:var(--transition);white-space:nowrap}
.nav-donate-btn:hover{background:rgba(231,76,60,.16);transform:translateY(-1px);box-shadow:0 4px 12px rgba(231,76,60,.25)}
.nav-donate-btn .fa-heart{animation:navHeart 2.6s ease-in-out infinite}
@keyframes navHeart{0%,100%{transform:scale(1)}10%{transform:scale(1.22)}20%{transform:scale(1)}}
.nav-actions #authNav{font-size:.88rem;font-weight:600;color:var(--text-secondary);text-decoration:none;padding:9px 19px;border-radius:50px;border:1px solid var(--border-glow);background:var(--bg-card-solid);transition:var(--transition);display:inline-flex;align-items:center;gap:6px;white-space:nowrap}
.nav-actions #authNav:hover{color:var(--text-primary);transform:translateY(-1px)}
.nav-actions #authNav.active{background:var(--accent-gradient);color:#fff;border-color:transparent;box-shadow:0 2px 10px rgba(0,119,255,.28)}
/* 中屏紧凑 */
@media (max-width:1100px) and (min-width:769px){
.nav-links{padding:3px}.nav-links a{padding:6px 12px!important;font-size:.78rem!important}
.nav-actions{gap:7px}.nav-donate-btn{padding:7px 13px;font-size:.82rem}.nav-actions #authNav{padding:7px 14px}
}
/* 移动端：竖排面板还原为全宽菜单；顶栏打赏收紧防溢出 */
@media (max-width:768px){
.nav-actions{margin-left:auto}
.nav-donate-btn{padding:8px 13px;font-size:.84rem}
.nav-actions #authNav{padding:8px 14px;font-size:.84rem}
.nav-links{background:rgba(246,248,252,.97);border-radius:0;border:none;padding:16px 24px;gap:8px;box-shadow:var(--shadow-card)}
[data-theme="dark"] .nav-links{background:rgba(13,20,36,.97)}
[data-theme="glass"] .nav-links{background:rgba(18,26,44,.92)}
.nav-links a{padding:10px 14px;border-radius:12px;font-size:.9rem}
.nav-links a.active{background:var(--accent-gradient);color:#fff;box-shadow:none}
.nav-links a.nav-ai.active{background:var(--accent-gradient);color:#fff;-webkit-background-clip:border-box;background-clip:border-box}
.nav-more-panel{position:static;opacity:1;visibility:visible;transform:none;display:none;box-shadow:none;border:none;background:transparent;padding:2px 0 2px 14px}
.nav-more.open .nav-more-panel{display:block}
}
@media (max-width:520px){
.nav-donate-btn .nav-donate-text{display:none}
.nav-donate-btn{width:36px;height:36px;padding:0;justify-content:center;border-radius:50%}
.nav-actions{gap:8px}
.nav-actions #authNav{padding:7px 12px;font-size:.8rem}
}
@media (max-width:380px){
.nav-actions #authNav .auth-avatar{display:none!important}
.nav-actions{gap:6px}
}
</style>`;
s = s.replace(/<style id="navMoreStyle">[\s\S]*?<\/style>/, CSS);
if (!s.includes('navseg-v2')) { console.error('样式块替换失败'); process.exit(1); }

fs.writeFileSync(FILE, s);
console.log('方案B 注入完成，新大小', s.length);
