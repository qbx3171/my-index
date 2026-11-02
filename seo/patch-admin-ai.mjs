// 将 AI 工具集管理模块注入 admin.html（幂等：已注入则跳过）
import fs from 'fs';
const FILE = 'admin.html';
let s = fs.readFileSync(FILE, 'utf8');

function run() {
let changed = 0;

if (s.includes('data-tab="ai"') || s.includes('renderAI:function')) { console.log('已注入过，跳过'); process.exit(0); }

// 1) 侧栏导航项：分类管理之后
const navAnchor = '<div class="nav-item" data-tab="categories"><span class="icon">⌗</span><span>分类管理</span></div>';
if (!s.includes(navAnchor)) throw new Error('nav anchor not found');
s = s.replace(navAnchor, navAnchor + ' <div class="nav-item" data-tab="ai"><span class="icon">🤖</span><span>AI工具集</span></div>');
changed++;

// 2) ALL_TABS 数组：categories 之后
const tabsAnchor = "{id:'categories',label:'分类管理',icon:'⌗'},";
if (!s.includes(tabsAnchor)) throw new Error('tabs anchor not found');
s = s.replace(tabsAnchor, tabsAnchor + " {id:'ai',label:'AI工具集',icon:'🤖'},");
changed++;

// 3) renderTab 分支
const rtAnchor = "if(t==='settings'){this.renderSettings(m);return;}";
if (!s.includes(rtAnchor)) throw new Error('renderTab anchor not found');
s = s.replace(rtAnchor, "if(t==='ai'){this.renderAI(m);return;} " + rtAnchor);
changed++;

// 4) 模块方法：插在 renderMessages 之前
const modAnchor = 'renderMessages:function(c){';
if (!s.includes(modAnchor)) throw new Error('module anchor not found');
s = s.replace(modAnchor, MOD + modAnchor);
changed++;

fs.writeFileSync(FILE, s);
console.log('注入完成，改动点', changed, '，新大小', s.length);
}


// ============ 模块代码（ES5 风格，与 admin.html 其余部分一致） ============
const MOD = [
"renderAI:function(c){var self=this;",
" c.innerHTML='<h2 class=\"page-title\">🤖 AI 工具集管理</h2><p class=\"page-sub\">管理 /ai/ 工具集板块：先建工具集（每个工具集上线后是一个独立页面），再往里添加 AI 工具。保存后等每日静态生成（或手动运行 generate.mjs）更新线上页面。</p>'",
" +'<div style=\"display:flex;gap:8px;margin:0 0 16px;\">'",
" +'<button id=\"aiTabCol\" class=\"btn btn-sm btn-primary\" type=\"button\">工具集管理</button>'",
" +'<button id=\"aiTabTool\" class=\"btn btn-sm btn-outline\" type=\"button\">工具管理</button></div>'",
" +'<div id=\"aiPaneCol\"></div><div id=\"aiPaneTool\" class=\"hidden\"></div>';",
" document.getElementById('aiTabCol').addEventListener('click',function(){self.aiSwitch('col');});",
" document.getElementById('aiTabTool').addEventListener('click',function(){self.aiSwitch('tool');});",
" self.aiLoadCols().then(function(){self.aiSwitch(self._aiTab||'col');});",
"},",
"aiSwitch:function(t){this._aiTab=t;",
" document.getElementById('aiTabCol').className='btn btn-sm '+(t==='col'?'btn-primary':'btn-outline');",
" document.getElementById('aiTabTool').className='btn btn-sm '+(t==='tool'?'btn-primary':'btn-outline');",
" document.getElementById('aiPaneCol').classList.toggle('hidden',t!=='col');",
" document.getElementById('aiPaneTool').classList.toggle('hidden',t!=='tool');",
" if(t==='col')this.aiRenderCols();else this.aiRenderTools();",
"},",
"aiLoadCols:function(){var self=this;",
" return supabaseClient.from('ai_collections').select('*').order('sort',{ascending:true}).order('created_at',{ascending:true}).then(function(r){",
"  if(r.error){self._aiCols=[];self._aiErr=r.error.message;return;}",
"  self._aiCols=r.data||[];self._aiErr=null;",
"  return supabaseClient.from('ai_tools').select('id,collection_id,is_published').then(function(r2){",
"   self._aiToolCnt={};self._aiToolAll=r2.data||[];",
"   self._aiToolAll.forEach(function(t){if(t.is_published!==false)self._aiToolCnt[t.collection_id]=(self._aiToolCnt[t.collection_id]||0)+1;});",
"  });",
" });",
"},",
"aiRlsHint:function(msg){return '<div class=\"rls-hint\" style=\"margin:12px 0;\"><div class=\"title\">⚠️ 读取失败：'+escapeHTML(msg||'')+'</div><div>通常是数据库表还没建。请在 <b>Supabase 控制台 → SQL Editor</b> 执行仓库里的 <b>seo/ai-schema.sql</b>（建 ai_collections / ai_tools 两张表与权限），执行完刷新本页重试。</div></div>';},",
"aiRenderCols:function(){var self=this,p=document.getElementById('aiPaneCol');if(!p)return;",
" var e=this._aiEditCol||null;",
" var h='';",
" if(this._aiErr){p.innerHTML=this.aiRlsHint(this._aiErr);return;}",
" h+='<div class=\"admin-form\" style=\"max-width:820px;\">';",
" h+='<h3 style=\"margin:0 0 10px;font-size:1rem;\">'+(e?'✏ 编辑工具集：'+escapeHTML(e.name):'＋ 新增工具集')+'</h3>';",
" h+='<input type=\"hidden\" id=\"aiColId\" value=\"'+(e?escapeHTML(e.id):'')+'\" />';",
" h+='<div class=\"form-row\"><div class=\"form-group\"><label>名称 <span class=\"required\">*</span></label><input id=\"aiColName\" value=\"'+(e?escapeHTML(e.name):'')+'\" placeholder=\"如：AI 绘画工具集\" /></div>';",
" h+='<div class=\"form-group\"><label>URL 标识（slug，英文/数字/横线）<span class=\"required\">*</span></label><input id=\"aiColSlug\" value=\"'+(e?escapeHTML(e.slug):'')+'\" placeholder=\"如：ai-huihua\" /></div></div>';",
" h+='<div class=\"form-group\"><label>一句话介绍（页面导语 + 搜索引擎描述）</label><textarea id=\"aiColDesc\" style=\"min-height:60px;\">'+(e?escapeHTML(e.description||''):'')+'</textarea></div>';",
" h+='<div class=\"form-row\"><div class=\"form-group\"><label>图标（emoji）</label><input id=\"aiColIcon\" value=\"'+(e?escapeHTML(e.icon||'🧩'):'🧩')+'\" /></div>';",
" h+='<div class=\"form-group\"><label>排序（小的在前）</label><input id=\"aiColSort\" type=\"number\" value=\"'+(e?(e.sort||0):0)+'\" /></div>';",
" h+='<div class=\"form-group\"><label>状态</label><select id=\"aiColPub\"><option value=\"true\"'+(e&&e.is_published===false?'':' selected')+'>已发布</option><option value=\"false\"'+(e&&e.is_published===false?' selected':'')+'>下架</option></select></div></div>';",
" h+='<div style=\"display:flex;gap:8px;margin-top:8px;\"><button id=\"aiColSave\" class=\"btn btn-primary btn-sm\" type=\"button\">保存工具集</button>'+(e?'<button id=\"aiColCancel\" class=\"btn btn-outline btn-sm\" type=\"button\">取消编辑</button>':'')+'</div>';",
" h+='</div>';",
" h+='<div style=\"margin-top:18px;overflow-x:auto;\"><table class=\"tbl-software\"><thead><tr><th>图标</th><th>名称</th><th>slug</th><th>工具数</th><th>排序</th><th>状态</th><th>操作</th></tr></thead><tbody>';",
" if(!this._aiCols.length)h+='<tr><td colspan=\"7\" style=\"text-align:center;color:var(--dim);padding:20px 0;\">还没有工具集，先在上面新增一个</td></tr>';",
" this._aiCols.forEach(function(x){",
"  h+='<tr><td>'+escapeHTML(x.icon||'🧩')+'</td><td><b>'+escapeHTML(x.name)+'</b></td><td>'+escapeHTML(x.slug)+'</td><td>'+(self._aiToolCnt[x.id]||0)+'</td><td>'+(x.sort||0)+'</td>'",
"   +'<td>'+(x.is_published!==false?'<span style=\"color:#0a8f4d;\">已发布</span>':'<span style=\"color:#c0392b;\">下架</span>')+'</td>'",
"   +'<td><button class=\"btn btn-outline btn-sm ai-col-edit\" data-id=\"'+x.id+'\" type=\"button\">编辑</button> <button class=\"btn btn-danger btn-sm ai-col-del\" data-id=\"'+x.id+'\" type=\"button\">删除</button></td></tr>';",
" });",
" h+='</tbody></table></div>';",
" p.innerHTML=h;",
" document.getElementById('aiColSave').addEventListener('click',function(){self.aiColSave();});",
" if(e)document.getElementById('aiColCancel').addEventListener('click',function(){self._aiEditCol=null;self.aiRenderCols();});",
" p.querySelectorAll('.ai-col-edit').forEach(function(b){b.addEventListener('click',function(){var id=this.dataset.id;self._aiEditCol=self._aiCols.find(function(x){return x.id===id;})||null;self.aiRenderCols();window.scrollTo({top:0,behavior:'smooth'});});});",
" p.querySelectorAll('.ai-col-del').forEach(function(b){b.addEventListener('click',function(){self.aiColDel(this.dataset.id);});});",
"},",
"aiColSave:function(){var self=this;",
" var id=document.getElementById('aiColId').value;",
" var payload={name:document.getElementById('aiColName').value.trim(),slug:document.getElementById('aiColSlug').value.trim().toLowerCase(),description:document.getElementById('aiColDesc').value.trim(),icon:document.getElementById('aiColIcon').value.trim()||'🧩',sort:parseInt(document.getElementById('aiColSort').value,10)||0,is_published:document.getElementById('aiColPub').value==='true'};",
" if(!payload.name||!payload.slug){toast('名称和 slug 必填','warning');return;}",
" if(!/^[a-z0-9][a-z0-9-]*$/.test(payload.slug)){toast('slug 只能用小写英文、数字和横线','warning');return;}",
" var q=id?supabaseClient.from('ai_collections').update(payload).eq('id',id):supabaseClient.from('ai_collections').insert(payload);",
" q.then(function(r){if(r.error){toast('保存失败：'+r.error.message,'error');return;}toast('已保存 ✓');self._aiEditCol=null;return self.aiLoadCols().then(function(){self.aiRenderCols();});});",
"},",
"aiColDel:function(id){var self=this;var c=this._aiCols.find(function(x){return x.id===id;});if(!c)return;",
" uiConfirm('删除工具集「'+c.name+'」？其下所有工具会一并删除，对应页面下次生成时移除。',{title:'删除工具集',icon:'🗑',danger:true,okText:'删除'}).then(function(ok){",
"  if(!ok)return;",
"  supabaseClient.from('ai_collections').delete().eq('id',id).then(function(r){",
"   if(r.error){toast('删除失败：'+r.error.message,'error');return;}",
"   toast('已删除');if(self._aiEditCol&&self._aiEditCol.id===id)self._aiEditCol=null;",
"   self.aiLoadCols().then(function(){self.aiRenderCols();});",
"  });",
" });",
"},",
"aiRenderTools:function(){var self=this,p=document.getElementById('aiPaneTool');if(!p)return;",
" if(this._aiErr){p.innerHTML=this.aiRlsHint(this._aiErr);return;}",
" if(!this._aiCols.length){p.innerHTML='<div class=\"empty-state\"><div class=\"icon\">📭</div><h3>还没有工具集</h3><p>先到「工具集管理」创建一个工具集，再往里添加工具。</p></div>';return;}",
" var curSel=document.getElementById('aiToolColSel');",
" var cur=curSel?curSel.value:(this._aiCols[0].id);",
" var h='';",
" h+='<div class=\"form-group\" style=\"max-width:420px;\"><label>当前工具集</label><select id=\"aiToolColSel\">';",
" this._aiCols.forEach(function(x){h+='<option value=\"'+x.id+'\"'+(x.id===cur?' selected':'')+'>'+escapeHTML(x.icon||'🧩')+' '+escapeHTML(x.name)+(x.is_published===false?'（已下架）':'')+'</option>';});",
" h+='</select></div>';",
" var e=this._aiEditTool||null;",
" h+='<div class=\"admin-form\" style=\"max-width:820px;\">';",
" h+='<h3 style=\"margin:0 0 10px;font-size:1rem;\">'+(e?'✏ 编辑工具：'+escapeHTML(e.name):'＋ 新增工具')+'</h3>';",
" h+='<input type=\"hidden\" id=\"aiToolId\" value=\"'+(e?escapeHTML(e.id):'')+'\" />';",
" h+='<div class=\"form-row\"><div class=\"form-group\"><label>工具名 <span class=\"required\">*</span></label><input id=\"aiToolName\" value=\"'+(e?escapeHTML(e.name):'')+'\" placeholder=\"如：豆包\" /></div>';",
" h+='<div class=\"form-group\"><label>官网地址 <span class=\"required\">*</span></label><input id=\"aiToolUrl\" value=\"'+(e?escapeHTML(e.url||''):'')+'\" placeholder=\"https://…\" /></div></div>';",
" h+='<div class=\"form-group\"><label>一句话简介（卡片展示，建议 40–80 字）</label><textarea id=\"aiToolSummary\" style=\"min-height:60px;\">'+(e?escapeHTML(e.summary||''):'')+'</textarea></div>';",
" h+='<div class=\"form-row\"><div class=\"form-group\"><label>标签（逗号分隔）</label><input id=\"aiToolTags\" value=\"'+(e?escapeHTML(e.tags||''):'')+'\" placeholder=\"图像生成,中文\" /></div>';",
" h+='<div class=\"form-group\"><label>收费模式</label><select id=\"aiToolPricing\">';",
" ['免费','免费额度','订阅','买断'].forEach(function(o){h+='<option'+(e&&e.pricing===o?' selected':'')+'>'+o+'</option>';});",
" h+='</select></div>';",
" h+='<div class=\"form-group\"><label>图标（emoji）</label><input id=\"aiToolIcon\" value=\"'+(e?escapeHTML(e.icon||'🤖'):'🤖')+'\" /></div></div>';",
" h+='<div class=\"form-row\"><div class=\"form-group\"><label>排序（小的在前）</label><input id=\"aiToolSort\" type=\"number\" value=\"'+(e?(e.sort||0):0)+'\" /></div>';",
" h+='<div class=\"form-group\"><label>状态</label><select id=\"aiToolPub\"><option value=\"true\"'+(e&&e.is_published===false?'':' selected')+'>上架</option><option value=\"false\"'+(e&&e.is_published===false?' selected':'')+'>下架</option></select></div></div>';",
" h+='<div style=\"display:flex;gap:8px;margin-top:8px;\"><button id=\"aiToolSave\" class=\"btn btn-primary btn-sm\" type=\"button\">保存工具</button>'+(e?'<button id=\"aiToolCancel\" class=\"btn btn-outline btn-sm\" type=\"button\">取消编辑</button>':'')+'</div>';",
" h+='</div>';",
" h+='<div style=\"margin-top:18px;overflow-x:auto;\"><table class=\"tbl-software\"><thead><tr><th>图标</th><th>名称</th><th>简介</th><th>收费</th><th>排序</th><th>状态</th><th>操作</th></tr></thead><tbody id=\"aiToolRows\"><tr><td colspan=\"7\" style=\"text-align:center;color:var(--dim);padding:20px 0;\">加载中…</td></tr></tbody></table></div>';",
" p.innerHTML=h;",
" document.getElementById('aiToolColSel').addEventListener('change',function(){self._aiEditTool=null;self.aiToolLoad(this.value);});",
" document.getElementById('aiToolSave').addEventListener('click',function(){self.aiToolSave();});",
" if(e)document.getElementById('aiToolCancel').addEventListener('click',function(){self._aiEditTool=null;self.aiRenderTools();});",
" this.aiToolLoad(cur);",
"},",
"aiToolLoad:function(cid){var self=this,rows=document.getElementById('aiToolRows');if(!rows)return;",
" supabaseClient.from('ai_tools').select('*').eq('collection_id',cid).order('sort',{ascending:true}).order('created_at',{ascending:true}).then(function(r){",
"  if(r.error){rows.innerHTML='<tr><td colspan=\"7\" style=\"color:#c0392b;padding:14px;\">读取失败：'+escapeHTML(r.error.message)+'</td></tr>';return;}",
"  var list=r.data||[];",
"  if(!list.length){rows.innerHTML='<tr><td colspan=\"7\" style=\"text-align:center;color:var(--dim);padding:20px 0;\">该工具集下还没有工具</td></tr>';return;}",
"  rows.innerHTML=list.map(function(t){",
"   return '<tr><td>'+escapeHTML(t.icon||'🤖')+'</td><td><b>'+escapeHTML(t.name)+'</b></td>'",
"    +'<td style=\"max-width:280px;color:var(--dim);\">'+escapeHTML((t.summary||'').slice(0,40))+((t.summary||'').length>40?'…':'')+'</td>'",
"    +'<td>'+escapeHTML(t.pricing||'免费')+'</td><td>'+(t.sort||0)+'</td>'",
"    +'<td>'+(t.is_published!==false?'<span style=\"color:#0a8f4d;\">上架</span>':'<span style=\"color:#c0392b;\">下架</span>')+'</td>'",
"    +'<td><button class=\"btn btn-outline btn-sm ai-tool-edit\" data-id=\"'+t.id+'\" type=\"button\">编辑</button> <button class=\"btn btn-danger btn-sm ai-tool-del\" data-id=\"'+t.id+'\" type=\"button\">删除</button></td></tr>';",
"  }).join('');",
"  rows.querySelectorAll('.ai-tool-edit').forEach(function(b){b.addEventListener('click',function(){var id=this.dataset.id;self._aiEditTool=list.find(function(x){return x.id===id;})||null;self.aiRenderTools();window.scrollTo({top:0,behavior:'smooth'});});});",
"  rows.querySelectorAll('.ai-tool-del').forEach(function(b){b.addEventListener('click',function(){self.aiToolDel(this.dataset.id,cid);});});",
" });",
"},",
"aiToolSave:function(){var self=this;",
" var cid=document.getElementById('aiToolColSel').value;",
" var id=document.getElementById('aiToolId').value;",
" var payload={collection_id:cid,name:document.getElementById('aiToolName').value.trim(),url:document.getElementById('aiToolUrl').value.trim(),summary:document.getElementById('aiToolSummary').value.trim(),tags:document.getElementById('aiToolTags').value.trim(),icon:document.getElementById('aiToolIcon').value.trim()||'🤖',pricing:document.getElementById('aiToolPricing').value,sort:parseInt(document.getElementById('aiToolSort').value,10)||0,is_published:document.getElementById('aiToolPub').value==='true'};",
" if(!payload.name||!payload.url){toast('工具名和官网地址必填','warning');return;}",
" if(!/^https?:\\/\\//i.test(payload.url)){toast('官网地址需以 http(s):// 开头','warning');return;}",
" var q=id?supabaseClient.from('ai_tools').update(payload).eq('id',id):supabaseClient.from('ai_tools').insert(payload);",
" q.then(function(r){if(r.error){toast('保存失败：'+r.error.message,'error');return;}toast('已保存 ✓');self._aiEditTool=null;self.aiToolLoad(cid);});",
"},",
"aiToolDel:function(id,cid){var self=this;",
" uiConfirm('确定删除这个工具吗？删除后不可恢复。',{title:'删除工具',icon:'🗑',danger:true,okText:'删除'}).then(function(ok){",
"  if(!ok)return;",
"  supabaseClient.from('ai_tools').delete().eq('id',id).then(function(r){",
"   if(r.error){toast('删除失败：'+r.error.message,'error');return;}",
"   toast('已删除');self._aiEditTool=null;self.aiToolLoad(cid);",
"  });",
" });",
"},",
].join('\n');
run();
