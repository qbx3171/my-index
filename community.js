(function(){
var C={};window.Community=C;C.currentSoft=null;
C.esc=function(s){if(s===null||s===undefined)return '';var d=document.createElement('div');d.textContent=String(s);return d.innerHTML;};
C.tip=function(m,t){if(typeof toast==='function')toast(m,t||'success');};
C.needLogin=function(){C.tip('请先登录','warning');var lm=document.getElementById('loginModal');if(lm)lm.classList.add('open');};
C.init=function(){if(typeof supabaseClient==='undefined'||!supabaseClient){setTimeout(C.init,500);return;}C.run();C.retry();};
C.run=function(){var fns=[C.hijackDetail,C.hijackProfile,C.hijackFav,C.hijackHist,C.addBell,C.addBoard,C.egg,C.pwa,C.bindAuth];for(var i=0;i<fns.length;i++){try{fns[i]();}catch(e){console.warn('init err',e);}}};
C.retry=function(){if(C._rt)return;var n=0;C._rt=setInterval(function(){n++;if(n>60){clearInterval(C._rt);C._rt=null;return;}try{
if(!document.getElementById('communityLeaderboard'))C.addBoard();
if(!document.getElementById('communityBell'))C.addBell();
if(window.App&&!App._ch)C.hijackProfile();
if(window.Detail&&!Detail._ch)C.hijackDetail();
if(typeof toggleFavorite==='function'&&!toggleFavorite._ch)C.hijackFav();
if(typeof addViewHistory==='function'&&!addViewHistory._ch)C.hijackHist();
var pp=document.getElementById('pageProfile');if(pp&&!pp.classList.contains('hidden'))C.injectProfile();
}catch(e){}},1000);};

C.adjustBoardPos=function(){};

C.bindAuth=function(){if(C._ab)return;C._ab=true;try{supabaseClient.auth.onAuthStateChange(function(e,s){if(s&&s.user){window.currentUser=s.user;C.onLogin();}else{window.currentUser=null;C.onLogout();}});}catch(e){}setTimeout(function(){if(window.currentUser)C.onLogin();},1500);};
C.onLogin=async function(){C.refreshProfile();try{await C.ensureProfile();}catch(e){}await Promise.all([C.syncFav(),C.syncHist(),C.loadPoints(),C.loadNotifs()].map(function(p){return p.catch(function(){});}));C.updateLv();C.refreshProfile();};
C.onLogout=function(){var b=document.getElementById('communityBell');if(b)b.style.display='none';var lv=document.getElementById('communityLevelBadge');if(lv)lv.remove();window.userPoints=0;window.userLevel=1;window.userStreak=0;window.userLastCheckin=null;C.refreshProfile();};
C.ensureProfile=async function(){if(!window.currentUser)return;var r=await supabaseClient.from('profiles').select('id').eq('id',window.currentUser.id).maybeSingle();if(r.error||r.data)return;await supabaseClient.from('profiles').insert({id:window.currentUser.id,points:0,level:1,streak:0,updated_at:new Date().toISOString()});};
C.syncFav=async function(){if(!window.currentUser)return;var r=await supabaseClient.from('favorites').select('software_id').eq('user_id',window.currentUser.id);if(r.error)return;var ids=(r.data||[]).map(function(x){return x.software_id;});localStorage.setItem('lezhe_favorites',JSON.stringify(ids));};
C.syncHist=async function(){if(!window.currentUser)return;var r=await supabaseClient.from('view_history').select('software_id').eq('user_id',window.currentUser.id).order('viewed_at',{ascending:false}).limit(6);if(r.error)return;var ids=(r.data||[]).map(function(x){return x.software_id;});localStorage.setItem('lezhe_view_history',JSON.stringify(ids));if(typeof renderRecentHistory==='function')renderRecentHistory();};
C.addFavCloud=async function(id){if(!window.currentUser)return;await supabaseClient.from('favorites').upsert({user_id:window.currentUser.id,software_id:String(id)},{onConflict:'user_id,software_id'});};
C.rmFavCloud=async function(id){if(!window.currentUser)return;await supabaseClient.from('favorites').delete().eq('user_id',window.currentUser.id).eq('software_id',String(id));};
C.addHistCloud=async function(id){if(!window.currentUser)return;await supabaseClient.from('view_history').upsert({user_id:window.currentUser.id,software_id:String(id),viewed_at:new Date().toISOString()},{onConflict:'user_id,software_id'});};
C.loadPoints=async function(){if(!window.currentUser)return;var r=await supabaseClient.from('profiles').select('points,level,streak,last_checkin').eq('id',window.currentUser.id).maybeSingle();if(r.error)return;if(r.data){window.userPoints=r.data.points||0;window.userLevel=r.data.level||1;window.userStreak=r.data.streak||0;window.userLastCheckin=r.data.last_checkin||null;}else{window.userPoints=0;window.userLevel=1;window.userStreak=0;window.userLastCheckin=null;}};
C.addPoints=async function(p){if(!window.currentUser)return;var pr=await supabaseClient.from('profiles').select('points').eq('id',window.currentUser.id).maybeSingle();var cur=(pr.data&&pr.data.points)||0;var np=cur+p;var lv=Math.floor(np/100)+1;var r=await supabaseClient.from('profiles').upsert({id:window.currentUser.id,points:np,level:lv,updated_at:new Date().toISOString()},{onConflict:'id'});if(r.error){C.tip('积分保存失败','error');return;}await C.loadPoints();C.updateLv();C.refreshProfile();C.tip('积分 +'+p,'success');};
C.updateLv=function(){var lv=window.userLevel||1;var b=document.getElementById('communityLevelBadge');if(!b){var an=document.getElementById('authNav');if(!an)return;b=document.createElement('span');b.id='communityLevelBadge';b.style.cssText='font-size:0.6rem;background:var(--accent-gradient);color:#fff;padding:1px 6px;border-radius:20px;margin-left:4px;line-height:1.4;';an.appendChild(b);}b.textContent='Lv'+lv;};

C.addBell=function(){if(document.getElementById('communityBell'))return;var hi=document.querySelector('.header-inner');if(!hi)return;var b=document.createElement('button');b.id='communityBell';b.className='header-theme-btn';b.style.cssText='position:relative;display:none;';b.innerHTML='<i class="fas fa-bell"></i><span id="communityBellDot" style="position:absolute;top:2px;right:2px;width:8px;height:8px;border-radius:50%;background:#e74c3c;display:none;"></span>';b.addEventListener('click',C.showNotifs);var last=hi.lastElementChild;hi.insertBefore(b,last);};
C.loadNotifs=async function(){if(!window.currentUser)return;var b=document.getElementById('communityBell');if(b)b.style.display='flex';var r=await supabaseClient.from('notifications').select('id').eq('user_id',window.currentUser.id).eq('is_read',false);var d=document.getElementById('communityBellDot');if(d)d.style.display=(r.data&&r.data.length>0)?'block':'none';};
C.showNotifs=async function(){if(!window.currentUser)return;var ex=document.getElementById('communityNotifPanel');if(ex){ex.remove();return;}var r=await supabaseClient.from('notifications').select('*').eq('user_id',window.currentUser.id).order('created_at',{ascending:false}).limit(30);var data=r.data||[];var ur=data.filter(function(n){return !n.is_read;}).length;var p=document.createElement('div');p.id='communityNotifPanel';p.style.cssText='position:fixed;top:70px;right:16px;width:380px;max-width:calc(100vw - 32px);max-height:520px;background:var(--bg-card-solid);border:1px solid var(--border-glow-strong);border-radius:18px;box-shadow:0 20px 56px rgba(0,0,0,0.18);z-index:9999;overflow:hidden;display:flex;flex-direction:column;';var hd=document.createElement('div');hd.style.cssText='display:flex;justify-content:space-between;align-items:center;padding:16px 20px 14px;border-bottom:1px solid var(--border-glow);';hd.innerHTML='<div style="display:flex;align-items:center;gap:10px;"><div style="width:32px;height:32px;border-radius:10px;background:var(--accent-gradient);color:#fff;display:flex;align-items:center;justify-content:center;"><i class="fas fa-bell"></i></div><div><div style="font-size:0.95rem;font-weight:700;">消息通知</div><div style="font-size:0.68rem;color:var(--text-dim);margin-top:2px;">'+(ur>0?('<span style="color:#0077ff;font-weight:600;">'+ur+'</span> 条未读'):'全部已读')+'</div></div></div>';var cb=document.createElement('button');cb.innerHTML='&times;';cb.style.cssText='background:rgba(0,0,0,0.04);border:none;width:30px;height:30px;border-radius:50%;color:var(--text-dim);font-size:1.2rem;cursor:pointer;';hd.appendChild(cb);p.appendChild(hd);var bd=document.createElement('div');bd.style.cssText='flex:1;overflow-y:auto;padding:10px;background:var(--bg-primary);';if(data.length===0){bd.innerHTML='<div style="text-align:center;padding:56px 20px;"><div style="font-size:2.8rem;opacity:0.25;">📭</div><div style="font-size:0.88rem;color:var(--text-secondary);margin-top:8px;">暂无新消息</div></div>';}else{data.forEach(function(n){var cd=document.createElement('div');cd.style.cssText='background:var(--bg-card-solid);border-radius:12px;padding:14px 16px;margin-bottom:8px;border:1px solid var(--border-glow);position:relative;';var tt=String(n.content||'');var m=tt.match(/^【([^】]+)】([\s\S]+)$/);var title=m?m[1]:'系统通知';var body=m?m[2]:tt;cd.innerHTML='<div style="display:flex;align-items:center;gap:8px;margin-bottom:8px;"><span style="font-size:0.85rem;font-weight:700;color:var(--text-primary);">'+C.esc(title)+'</span><span style="font-size:0.65rem;color:var(--text-dim);margin-left:auto;">'+(typeof timeAgo==='function'?timeAgo(n.created_at):'')+'</span><button class="ndel" data-id="'+n.id+'" style="background:transparent;border:none;color:var(--text-dim);font-size:1rem;cursor:pointer;opacity:0.5;">&times;</button></div><div style="font-size:0.8rem;color:var(--text-secondary);line-height:1.6;word-break:break-word;">'+C.esc(body)+'</div>';bd.appendChild(cd);});}p.appendChild(bd);document.body.appendChild(p);var cp=function(){if(p.parentNode)p.remove();document.removeEventListener('click',oc);};cb.onclick=cp;var oc=function(e){if(!p.contains(e.target)&&!e.target.closest('#communityBell')){cp();}};setTimeout(function(){document.addEventListener('click',oc);},10);bd.querySelectorAll('.ndel').forEach(function(b){b.addEventListener('click',async function(e){e.stopPropagation();if(!confirm('删除这条通知？'))return;var id=this.dataset.id;var r=await supabaseClient.from('notifications').delete().eq('id',id);if(r.error){C.tip('删除失败','error');return;}this.closest('div[style]').remove();});});if(ur>0){await supabaseClient.from('notifications').update({is_read:true}).eq('user_id',window.currentUser.id).eq('is_read',false);var d=document.getElementById('communityBellDot');if(d)d.style.display='none';}};

C.hijackDetail=function(){if(!window.Detail||Detail._ch)return;if(typeof Detail.open!=='function')return;Detail._ch=true;var o=Detail.open;Detail.open=function(s){o.call(Detail,s);C.currentSoft=s;C.addHistCloud(s.id);C.injectDetail(s);};};
C.hijackProfile=function(){if(!window.App||App._ch)return;if(typeof App.goProfile!=='function')return;App._ch=true;var o=App.goProfile;App.goProfile=function(){o.call(App);C.injectProfile();setTimeout(function(){C.loadPoints().then(C.injectProfile);if(typeof renderRecentHistory==='function')renderRecentHistory();},100);};};
C.hijackFav=function(){if(typeof toggleFavorite!=='function'||toggleFavorite._ch)return;toggleFavorite._ch=true;var o=toggleFavorite;window.toggleFavorite=function(id){var r=o(id);if(r)C.addFavCloud(id);else C.rmFavCloud(id);return r;};};
C.hijackHist=function(){if(typeof addViewHistory!=='function'||addViewHistory._ch)return;addViewHistory._ch=true;var o=addViewHistory;window.addViewHistory=function(id){o(id);C.addHistCloud(id);if(typeof renderRecentHistory==='function'){var pp=document.getElementById('pageProfile');if(pp&&!pp.classList.contains('hidden'))renderRecentHistory();}};};

C.injectDetail=function(s){if(!s)return;var mb=document.getElementById('modalBody');if(!mb)return;var old=document.getElementById('communityDetailSection');if(old)old.remove();var sec=document.createElement('div');sec.id='communityDetailSection';sec.style.cssText='margin-top:16px;border-top:1px solid var(--border-glow);padding-top:12px;';sec.innerHTML='<h4 style="font-size:0.9rem;margin-bottom:8px;"><i class="fas fa-star"></i> 评分与评论</h4><div id="communityRatingBox"></div><div id="communityReviewList"></div><div style="margin-top:10px;"><textarea id="communityReviewContent" placeholder="写下你的评价..." style="width:100%;padding:8px;border:1px solid var(--border-glow);border-radius:8px;background:var(--bg-primary);color:var(--text-primary);font-size:0.8rem;min-height:60px;"></textarea><div style="display:flex;gap:8px;margin-top:6px;align-items:center;"><select id="communityRatingSelect" style="padding:4px 8px;border-radius:6px;border:1px solid var(--border-glow);background:var(--bg-primary);color:var(--text-primary);font-size:0.8rem;"><option value="5">5星</option><option value="4">4星</option><option value="3">3星</option><option value="2">2星</option><option value="1">1星</option></select><button class="btn btn-sm btn-primary" id="communitySubmitReview">发表评价</button></div></div><h4 style="font-size:0.9rem;margin:16px 0 8px;"><i class="fas fa-comments"></i> 讨论区</h4><div id="communityDiscussionList"></div><div style="margin-top:10px;"><textarea id="communityDiscussionContent" placeholder="参与讨论..." style="width:100%;padding:8px;border:1px solid var(--border-glow);border-radius:8px;background:var(--bg-primary);color:var(--text-primary);font-size:0.8rem;min-height:60px;"></textarea><button class="btn btn-sm btn-primary" id="communitySubmitDiscussion" style="margin-top:6px;">发表讨论</button></div>';mb.appendChild(sec);C.loadReviews(s.id);C.loadDiscussions(s.id);document.getElementById('communitySubmitReview').onclick=function(){C.submitReview(s.id);};document.getElementById('communitySubmitDiscussion').onclick=function(){C.submitDiscussion(s.id);};};
C.loadReviews=async function(id){var list=document.getElementById('communityReviewList');if(!list)return;var r=await supabaseClient.from('software_reviews').select('*').eq('software_id',String(id)).order('created_at',{ascending:false});if(r.error){list.innerHTML='<p style="color:var(--text-dim);font-size:0.8rem;">暂无评价</p>';return;}var d=r.data||[];if(d.length===0){list.innerHTML='<p style="color:var(--text-dim);font-size:0.8rem;">暂无评价，来写第一条吧</p>';return;}var avg=0,h='';for(var i=0;i<d.length;i++){var x=d[i];avg+=x.rating;var st='';for(var j=1;j<=5;j++){st+=j<=x.rating?'★':'☆';}h+='<div style="padding:8px 0;border-bottom:1px solid var(--border-glow);"><div style="display:flex;justify-content:space-between;font-size:0.75rem;"><span style="color:var(--accent-cyan);">'+st+'</span><span style="color:var(--text-dim);">'+(typeof timeAgo==='function'?timeAgo(x.created_at):'')+'</span></div><div style="font-size:0.8rem;margin-top:2px;">'+C.esc(x.content||'')+'</div></div>';}avg=(avg/d.length).toFixed(1);var rb=document.getElementById('communityRatingBox');if(rb)rb.innerHTML='<div style="font-size:1.2rem;font-weight:700;color:var(--accent-cyan);">'+avg+' 分</div><div style="font-size:0.7rem;color:var(--text-dim);">共 '+d.length+' 条评价</div>';list.innerHTML=h;};
C.submitReview=async function(id){if(!window.currentUser){C.needLogin();return;}var ce=document.getElementById('communityReviewContent');var re=document.getElementById('communityRatingSelect');if(!ce||!re)return;var c=ce.value.trim();var r=parseInt(re.value);if(!c){C.tip('请填写评价内容','warning');return;}var res=await supabaseClient.from('software_reviews').upsert({user_id:window.currentUser.id,software_id:String(id),rating:r,content:c},{onConflict:'user_id,software_id'});if(res.error){C.tip('评价失败: '+res.error.message,'error');return;}C.tip('评价成功','success');ce.value='';C.loadReviews(id);await C.addPoints(5);};
C.loadDiscussions=async function(id){var list=document.getElementById('communityDiscussionList');if(!list)return;var r=await supabaseClient.from('software_discussions').select('*').eq('software_id',String(id)).is('parent_id',null).order('created_at',{ascending:false});if(r.error){list.innerHTML='<p style="color:var(--text-dim);font-size:0.8rem;">暂无讨论</p>';return;}var d=r.data||[];if(d.length===0){list.innerHTML='<p style="color:var(--text-dim);font-size:0.8rem;">暂无讨论，来发表第一条吧</p>';return;}var h='';for(var i=0;i<d.length;i++){var x=d[i];h+='<div style="padding:8px 0;border-bottom:1px solid var(--border-glow);"><div style="font-size:0.7rem;color:var(--text-dim);">'+(typeof timeAgo==='function'?timeAgo(x.created_at):'')+'</div><div style="font-size:0.8rem;margin-top:2px;">'+C.esc(x.content)+'</div></div>';}list.innerHTML=h;};
C.submitDiscussion=async function(id){if(!window.currentUser){C.needLogin();return;}var ce=document.getElementById('communityDiscussionContent');if(!ce)return;var c=ce.value.trim();if(!c){C.tip('请填写讨论内容','warning');return;}var r=await supabaseClient.from('software_discussions').insert({user_id:window.currentUser.id,software_id:String(id),content:c});if(r.error){C.tip('发表失败','error');return;}C.tip('发表成功','success');ce.value='';C.loadDiscussions(id);await C.addPoints(3);};

C.getToday=function(){var d=new Date(Date.now()+8*3600*1000);return d.toISOString().slice(0,10);};

C.injectProfile=function(){
if(C._ip)return;
C._ip=true;
setTimeout(function(){C._ip=false;},200);
var ct=document.getElementById('profileContent');
if(!ct)return;
var old=document.getElementById('communityProfileSection');
if(old)old.remove();
var p=window.userPoints||0;
var lv=window.userLevel||1;
var sk=window.userStreak||0;
var td=C.getToday();
var ck=!!(window.userLastCheckin&&window.userLastCheckin===td);
var bt=ck?'<i class="fas fa-check"></i> 已签到':'<i class="fas fa-gift"></i> 签到 +10';
var bg=ck?'background:#0b9e5a;border-color:#0b9e5a;cursor:default;opacity:.85;':'';
var sec=document.createElement('div');
sec.id='communityProfileSection';
sec.className='profile-card';
sec.style.cssText='margin-top:16px;padding:16px 20px;background:var(--bg-card);border:1px solid var(--border-glow);border-radius:var(--radius-md);';
sec.innerHTML=
'<div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:12px;gap:10px;">'+
'<h4 style="font-size:.9rem;margin:0;display:flex;align-items:center;gap:8px;font-weight:700;">'+
'<i class="fas fa-gift" style="color:var(--accent-cyan);"></i> 我的积分'+
'</h4>'+
'<button class="btn btn-sm btn-primary" id="communityCheckinBtn" style="font-size:.72rem;padding:5px 14px;border-radius:50px;'+bg+'" '+(ck?'disabled':'')+'>'+bt+'</button>'+
'</div>'+
'<div style="display:grid;grid-template-columns:1fr 1fr 1fr;gap:10px;">'+
'<div style="text-align:center;padding:12px 6px;background:linear-gradient(135deg,rgba(0,119,255,0.06),rgba(108,92,231,0.08));border-radius:12px;border:1px solid var(--border-glow);">'+
'<div style="font-size:1.5rem;font-weight:800;color:var(--accent-cyan);line-height:1.1;letter-spacing:-0.5px;">'+p+'</div>'+
'<div style="font-size:0.68rem;color:var(--text-dim);margin-top:4px;">积分</div>'+
'</div>'+
'<div style="text-align:center;padding:12px 6px;background:linear-gradient(135deg,rgba(108,92,231,0.06),rgba(0,119,255,0.08));border-radius:12px;border:1px solid var(--border-glow);">'+
'<div style="font-size:1.5rem;font-weight:800;color:var(--accent-purple);line-height:1.1;letter-spacing:-0.5px;">'+lv+'</div>'+
'<div style="font-size:0.68rem;color:var(--text-dim);margin-top:4px;">等级</div>'+
'</div>'+
'<div style="text-align:center;padding:12px 6px;background:linear-gradient(135deg,rgba(243,156,18,0.06),rgba(231,76,60,0.08));border-radius:12px;border:1px solid var(--border-glow);">'+
'<div style="font-size:1.5rem;font-weight:800;color:#f39c12;line-height:1.1;letter-spacing:-0.5px;">'+sk+'</div>'+
'<div style="font-size:0.68rem;color:var(--text-dim);margin-top:4px;">连续(天)</div>'+
'</div>'+
'</div>';
var rs=document.getElementById('profileRecentSection');
if(rs&&rs.parentNode===ct){ct.insertBefore(sec,rs);}
else{ct.appendChild(sec);}
var b=document.getElementById('communityCheckinBtn');
if(b&&!ck)b.onclick=C.doCheckin;
};

C.refreshProfile=function(){var pp=document.getElementById('pageProfile');if(pp&&!pp.classList.contains('hidden')){C.injectProfile();if(typeof renderRecentHistory==='function')renderRecentHistory();}};
C.doCheckin=async function(){if(!window.currentUser){C.tip('请先登录','warning');return;}var b=document.getElementById('communityCheckinBtn');if(b){b.disabled=true;b.textContent='签到中...';}try{var td=C.getToday();var ex=await supabaseClient.from('checkins').select('id').eq('user_id',window.currentUser.id).eq('checkin_date',td).maybeSingle();if(ex.error){C.tip('查询失败','error');if(b){b.disabled=false;b.textContent='每日签到';}return;}if(ex.data){C.tip('今天已经签到过了','warning');window.userLastCheckin=td;await C.loadPoints();C.injectProfile();C.updateLv();return;}var pr=await supabaseClient.from('profiles').select('points,streak,last_checkin').eq('id',window.currentUser.id).maybeSingle();var cp=0,cs=0,lc=null;if(pr.data){cp=pr.data.points||0;cs=pr.data.streak||0;lc=pr.data.last_checkin||null;}var st=cs+1;if(st>1&&lc){var df=(new Date(td)-new Date(lc))/86400000;if(df>1)st=1;}var np=cp+10;var lv=Math.floor(np/100)+1;var ir=await supabaseClient.from('checkins').insert({user_id:window.currentUser.id,checkin_date:td,points:10});if(ir.error){C.tip('签到失败','error');if(b){b.disabled=false;b.textContent='每日签到';}return;}var ur=await supabaseClient.from('profiles').upsert({id:window.currentUser.id,points:np,level:lv,streak:st,last_checkin:td,updated_at:new Date().toISOString()},{onConflict:'id'});if(ur.error){C.tip('积分保存失败','error');if(b){b.disabled=false;b.textContent='每日签到';}return;}await C.loadPoints();C.injectProfile();C.updateLv();C.tip('签到成功 +10 积分','success');}catch(e){C.tip('签到异常','error');if(b){b.disabled=false;b.textContent='每日签到';}}};

C.addBoard=function(){
if(document.getElementById('communityLeaderboard'))return;
if(document.getElementById('communityRankGlassStyle')){}else{
var sty=document.createElement('style');
sty.id='communityRankGlassStyle';
sty.textContent='@keyframes rankGlassIn{0%{opacity:0;transform:translateX(-12px) scale(0.94);backdrop-filter:blur(0px);}100%{opacity:1;transform:translateX(0) scale(1);backdrop-filter:blur(24px);}}@keyframes rankGlassGlow{0%,100%{box-shadow:0 12px 40px rgba(0,122,255,0.18),inset 0 1px 0 rgba(255,255,255,0.6),inset 0 -1px 0 rgba(255,255,255,0.15);}50%{box-shadow:0 18px 50px rgba(0,122,255,0.28),inset 0 1px 0 rgba(255,255,255,0.7),inset 0 -1px 0 rgba(255,255,255,0.2);}}';
document.head.appendChild(sty);
}
var sf=document.getElementById('shareFloat');
if(!sf){setTimeout(C.addBoard,500);return;}
var wechat=null;
var as=sf.getElementsByTagName('a');
for(var i=0;i<as.length;i++){
var ti=as[i].getAttribute('title')||'';
var oc=as[i].getAttribute('onclick')||'';
if(ti.indexOf('微信')!==-1||oc.indexOf('wechat')!==-1){wechat=as[i];break;}
}
var wrap=document.createElement('div');
wrap.id='communityLeaderboard';
wrap.style.cssText='position:relative;';
var btn=document.createElement('a');
btn.id='communityLeaderboardToggle';
btn.href='#';
btn.title='社区排行榜';
btn.innerHTML='<i class="fas fa-trophy"></i>';
btn.style.cssText='display:flex;align-items:center;justify-content:center;width:42px;height:42px;border-radius:50%;background:var(--bg-card-solid);box-shadow:var(--shadow-card);border:1px solid var(--border-glow);color:var(--text-secondary);font-size:1.1rem;transition:all .3s;text-decoration:none;cursor:pointer;';
btn.onmouseenter=function(){btn.style.background='var(--accent-gradient)';btn.style.color='#fff';btn.style.transform='scale(1.08)';btn.style.borderColor='transparent';};
btn.onmouseleave=function(){btn.style.background='var(--bg-card-solid)';btn.style.color='var(--text-secondary)';btn.style.transform='';btn.style.borderColor='var(--border-glow)';};
wrap.appendChild(btn);
var panel=document.createElement('div');
panel.id='communityLeaderboardPanel';
panel.style.cssText='display:none;position:fixed;width:280px;max-height:60vh;border-radius:20px;padding:16px;overflow:hidden;z-index:200;background:linear-gradient(135deg,rgba(255,255,255,0.72) 0%,rgba(255,255,255,0.55) 50%,rgba(240,246,255,0.65) 100%);backdrop-filter:blur(24px) saturate(180%);-webkit-backdrop-filter:blur(24px) saturate(180%);border:1px solid rgba(255,255,255,0.65);box-shadow:0 12px 40px rgba(0,122,255,0.18),inset 0 1px 0 rgba(255,255,255,0.6),inset 0 -1px 0 rgba(255,255,255,0.15);animation:rankGlassIn .35s cubic-bezier(0.2,0,0,1) forwards;';
panel.innerHTML='<div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:12px;"><span style="font-size:0.9rem;font-weight:700;color:#0f1a2e;letter-spacing:.3px;">🏆 社区排行榜</span><button id="communityLeaderboardClose" style="background:rgba(255,255,255,0.5);border:1px solid rgba(255,255,255,0.6);width:26px;height:26px;border-radius:50%;font-size:0.85rem;cursor:pointer;color:#3d5068;display:flex;align-items:center;justify-content:center;transition:all .2s;">&times;</button></div><div id="communityLeaderboardContent" style="font-size:0.78rem;color:#3d5068;max-height:50vh;overflow-y:auto;scrollbar-width:none;-ms-overflow-style:none;">点击加载...</div><style>#communityLeaderboardContent::-webkit-scrollbar{display:none;}</style>';
document.body.appendChild(panel);
if(wechat&&wechat.parentNode===sf){sf.insertBefore(wrap,wechat);}else{sf.insertBefore(wrap,sf.firstChild);}
var isOpen=false;
var placePanel=function(){var r=btn.getBoundingClientRect();var pw=280;var ph=panel.offsetHeight||420;var left=r.left-pw-12;var top=r.top+r.height/2-ph/2;if(left<10)left=r.right+12;if(top<10)top=10;var maxTop=window.innerHeight-ph-10;if(top>maxTop)top=maxTop;panel.style.left=left+'px';panel.style.top=top+'px';};
var open=function(){placePanel();panel.style.display='block';isOpen=true;C.loadBoard();};
var close=function(){panel.style.display='none';isOpen=false;};
btn.addEventListener('click',function(e){e.preventDefault();e.stopPropagation();if(isOpen)close();else open();});
var cb=document.getElementById('communityLeaderboardClose');
if(cb)cb.addEventListener('click',function(e){e.stopPropagation();close();});
panel.addEventListener('click',function(e){e.stopPropagation();});
document.addEventListener('click',function(e){if(isOpen&&!wrap.contains(e.target)&&!panel.contains(e.target))close();});
window.addEventListener('resize',function(){if(isOpen)placePanel();});
window.addEventListener('scroll',function(){if(isOpen)placePanel();},true);
};

C.loadBoard=async function(){var el=document.getElementById('communityLeaderboardContent');if(!el)return;el.innerHTML='加载中...';var r=await supabaseClient.from('profiles').select('username,points,level').order('points',{ascending:false}).limit(10);if(r.error){el.innerHTML='<p style="color:var(--text-dim);">加载失败</p>';return;}var d=r.data||[];if(d.length===0){el.innerHTML='<p style="color:var(--text-dim);">暂无数据</p>';return;}var h='';for(var i=0;i<d.length;i++){var u=d[i];var rc=i===0?'#f39c12':i===1?'#95a5a6':i===2?'#cd7f32':'#7a8ca3';var md=i===0?'🥇':i===1?'🥈':i===2?'🥉':(i+1);h+='<div style="display:flex;align-items:center;gap:8px;padding:8px 10px;margin-bottom:4px;border-radius:10px;background:rgba(255,255,255,0.45);border:1px solid rgba(255,255,255,0.5);"><span style="width:22px;text-align:center;font-weight:700;color:'+rc+';flex-shrink:0;font-size:0.85rem;">'+md+'</span><span style="flex:1;font-weight:500;color:#0f1a2e;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;">'+C.esc(u.username||'匿名')+'</span><span style="font-size:0.75rem;color:#0077ff;font-weight:700;flex-shrink:0;">'+(u.points||0)+'</span><span style="font-size:0.6rem;color:#7a8ca3;flex-shrink:0;">Lv'+(u.level||1)+'</span></div>';}el.innerHTML=h;};

C.egg=function(){var lg=document.getElementById('logoHome');if(lg&&!lg._ee){lg._ee=true;var n=0;lg.addEventListener('click',function(){n++;if(n>=5){n=0;C.tip('🎉 彩蛋触发！','success');var r=document.documentElement;r.style.setProperty('--accent-cyan','#ff00ff');setTimeout(function(){r.style.setProperty('--accent-cyan','#0077ff');},3000);}});}};
C.pwa=function(){if(!document.querySelector('link[rel="manifest"]')){var m={name:'乐哲软件',short_name:'乐哲',start_url:'./',display:'standalone',background_color:'#f0f4fa',theme_color:'#0077ff',icons:[{src:'./icon-192.png',sizes:'192x192',type:'image/png'},{src:'./icon-512.png',sizes:'512x512',type:'image/png'}]};var b=new Blob([JSON.stringify(m)],{type:'application/json'});var l=document.createElement('link');l.rel='manifest';l.href=URL.createObjectURL(b);document.head.appendChild(l);}if('serviceWorker' in navigator){navigator.serviceWorker.register('./sw.js').then(function(reg){if(reg&&reg.update)reg.update();}).catch(function(){});}};

if(document.readyState==='loading'){document.addEventListener('DOMContentLoaded',C.init);}
else{C.init();}
})();
