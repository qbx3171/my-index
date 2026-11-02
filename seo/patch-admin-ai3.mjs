// admin.html AI 模块升级③：图床 URL 字段加实时预览缩略图（幂等，标记 AI_PREV3）
import { readFileSync, writeFileSync } from "node:fs";
const F = new URL("../admin.html", import.meta.url).pathname.replace(/^\/([A-Za-z]):/, "$1:");
let s = readFileSync(F, "utf8");
const MARK = "AI_PREV3";
if (s.includes(MARK)) { console.log("已打过补丁，跳过"); process.exit(0); }

// 1. 工具集封面 URL → 加预览容器
const c1o = `h+='<div class="form-group"><label>封面图 URL（选填，侧栏/卡片展示；留空用 emoji）</label><input id="aiColLogo" value="'+(e?escapeHTML(e.logo||''):'')+'" placeholder="https://…/logo.png" /></div>';`;
const c1n = `h+='<div class="form-group"><label>封面图标 URL（图床链接，选填；留空用 emoji）</label><input id="aiColLogo" value="'+(e?escapeHTML(e.logo||''):'')+'" placeholder="https://…/logo.png" /><div class="ai-url-prev" id="prev-aiColLogo"></div></div>';`;
if (!s.includes(c1o)) { console.error("锚点1未命中"); process.exit(1); }
s = s.replace(c1o, c1n);

// 2. 工具图标 URL → 加预览容器
const c2o = `h+='<div class="form-group"><label>封面图 URL（选填，卡片/详情页展示；留空自动生成字母封面）</label><input id="aiToolLogo" value="'+(e?escapeHTML(e.logo||''):'')+'" placeholder="https://…/logo.png" /></div></div>';`;
const c2n = `h+='<div class="form-group"><label>工具图标 URL（图床链接，选填；卡片/详情页展示，留空自动生成字母封面）</label><input id="aiToolLogo" value="'+(e?escapeHTML(e.logo||''):'')+'" placeholder="https://…/logo.png" /><div class="ai-url-prev" id="prev-aiToolLogo"></div></div></div>';`;
if (!s.includes(c2o)) { console.error("锚点2未命中"); process.exit(1); }
s = s.replace(c2o, c2n);

// 3. 截图 URL textarea → 加预览容器（多张）
const c3o = `h+='<div class="form-group"><label>封面截图 URL（选填，多张用换行分隔，详情页展示）</label><textarea id="aiToolShots" style="min-height:60px;">'+(e?escapeHTML(e.screenshots||''):'')+'</textarea></div>';`;
const c3n = `h+='<div class="form-group"><label>封面截图 URL（图床链接，选填，每行一张，详情页展示）</label><textarea id="aiToolShots" style="min-height:60px;">'+(e?escapeHTML(e.screenshots||''):'')+'</textarea><div class="ai-url-prev" id="prev-aiToolShots"></div></div>';`;
if (!s.includes(c3o)) { console.error("锚点3未命中"); process.exit(1); }
s = s.replace(c3o, c3n);

// 4. 编辑已有工具集时回填预览
const c4o = `document.getElementById('aiColSave').addEventListener('click',function(){self.aiColSave();});`;
const c4n = c4o + `\n if(document.getElementById('prev-aiColLogo'))aiPrev('prev-aiColLogo',document.getElementById('aiColLogo').value);`;
if (!s.includes(c4o)) { console.error("锚点4未命中"); process.exit(1); }
s = s.replace(c4o, c4n);

// 5. 编辑已有工具时回填预览
const c5o = `document.getElementById('aiToolSave').addEventListener('click',function(){self.aiToolSave();});`;
const c5n = c5o + `\n if(document.getElementById('prev-aiToolLogo')){aiPrev('prev-aiToolLogo',document.getElementById('aiToolLogo').value);aiPrev('prev-aiToolShots',document.getElementById('aiToolShots').value);}`;
if (!s.includes(c5o)) { console.error("锚点5未命中"); process.exit(1); }
s = s.replace(c5o, c5n);

// 6. 全局脚本：aiPrev 助手 + input 事件委托 + 样式（</body> 前注入）
const inject = `<!-- ${MARK} -->
<style>
.ai-url-prev{display:none;gap:8px;flex-wrap:wrap;margin-top:8px}
.ai-url-prev.on{display:flex}
.ai-url-prev .aipv{display:block;width:64px;height:64px;border-radius:10px;overflow:hidden;border:1px solid rgba(120,140,170,.35);background:#f4f7fb;position:relative}
.ai-url-prev .aipv img{width:100%;height:100%;object-fit:cover;display:block}
.ai-url-prev .aipv.bad{display:flex;align-items:center;justify-content:center;font-size:11px;color:#c0392b}
</style>
<script>
function aiPrev(boxId,val){
 var box=document.getElementById(boxId);if(!box)return;
 var urls=String(val||'').split(/[\\n,，]/).map(function(x){return x.trim();}).filter(function(u){return /^https?:\\/\\/\\S+$/i.test(u);}).slice(0,8);
 if(!urls.length){box.innerHTML='';box.classList.remove('on');return;}
 box.classList.add('on');
 box.innerHTML=urls.map(function(u){return '<a class="aipv" href="'+u+'" target="_blank" rel="noopener" title="点击查看原图"><img src="'+u+'" loading="lazy" referrerpolicy="no-referrer" onerror="this.parentNode.classList.add(\'bad\');this.parentNode.innerHTML=\\u5931\\u8d25;"></a>';}).join('');
}
document.addEventListener('input',function(ev){
 var id=ev.target&&ev.target.id;
 if(id==='aiColLogo')aiPrev('prev-aiColLogo',ev.target.value);
 else if(id==='aiToolLogo')aiPrev('prev-aiToolLogo',ev.target.value);
 else if(id==='aiToolShots')aiPrev('prev-aiToolShots',ev.target.value);
});
</script>`;
s = s.replace("</body>", inject + "\n</body>");
writeFileSync(F, s);
console.log("✅ AI_PREV3 补丁完成：3 个图床字段加预览");
