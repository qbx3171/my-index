(function(){
var Community={};
window.Community=Community;
Community.currentSoft=null;
Community.init=function(){
if(typeof supabaseClient==='undefined'||!supabaseClient){setTimeout(Community.init,500);return;}
Community.hijackLoadUser();
Community.hijackDetailOpen();
Community.hijackGoProfile();
Community.addNotificationBell();
Community.addRandomButton();
Community.initEasterEggs();
Community.initThemes();
Community.initPWA();
Community.addLeaderboard();
if(window.currentUser){Community.onLogin();}else{Community.onLogout();}
};
Community.hijackLoadUser=function(){
var orig=window.loadUser;
window.loadUser=async function(){
if(orig)await orig();
if(window.currentUser){await Community.onLogin();}else{Community.onLogout();}
};
};
Community.hijackDetailOpen=function(){
if(!window.Detail)return;
var orig=Detail.open;
Detail.open=function(soft){
orig.call(Detail,soft);
Community.currentSoft=soft;
Community.injectDetail(soft);
};
};
Community.hijackGoProfile=function(){
if(!window.App)return;
var orig=App.goProfile;
App.goProfile=function(){
orig.call(App);
Community.injectProfile();
};
};
Community.onLogin=async function(){
await Community.syncFavorites();
await Community.syncHistory();
await Community.loadPoints();
await Community.loadNotifications();
Community.updateAvatarLevel();
};
Community.onLogout=function(){
var bell=document.getElementById('communityBell');
if(bell)bell.style.display='none';
};
Community.syncFavorites=async function(){
if(!currentUser)return;
var res=await supabaseClient.from('favorites').select('software_id').eq('user_id',currentUser.id);
if(res.error)return;
var ids=res.data.map(function(x){return x.software_id;});
localStorage.setItem('lezhe_favorites',JSON.stringify(ids));
};
Community.syncHistory=async function(){
if(!currentUser)return;
var res=await supabaseClient.from('view_history').select('software_id').eq('user_id',currentUser.id).order('viewed_at',{ascending:false}).limit(6);
if(res.error)return;
var ids=res.data.map(function(x){return x.software_id;});
localStorage.setItem('lezhe_view_history',JSON.stringify(ids));
};
Community.addFavoriteCloud=async function(softwareId){
if(!currentUser)return;
await supabaseClient.from('favorites').upsert({user_id:currentUser.id,software_id:softwareId},{onConflict:'user_id,software_id'});
};
Community.removeFavoriteCloud=async function(softwareId){
if(!currentUser)return;
await supabaseClient.from('favorites').delete().eq('user_id',currentUser.id).eq('software_id',softwareId);
};
Community.addHistoryCloud=async function(softwareId){
if(!currentUser)return;
await supabaseClient.from('view_history').upsert({user_id:currentUser.id,software_id:softwareId,viewed_at:new Date().toISOString()},{onConflict:'user_id,software_id'});
};
Community.loadPoints=async function(){
if(!currentUser)return;
var res=await supabaseClient.from('profiles').select('points,level,streak,last_checkin').eq('id',currentUser.id).maybeSingle();
if(res.data){
window.userPoints=res.data.points||0;
window.userLevel=res.data.level||1;
window.userStreak=res.data.streak||0;
window.userLastCheckin=res.data.last_checkin;
}
};
Community.updateAvatarLevel=function(){
var level=window.userLevel||1;
var badge=document.getElementById('communityLevelBadge');
if(!badge){
badge=document.createElement('span');
badge.id='communityLevelBadge';
badge.style.cssText='font-size:0.6rem;background:var(--accent-gradient);color:#fff;padding:0 6px;border-radius:20px;margin-left:4px;';
var authNav=document.getElementById('authNav');
if(authNav)authNav.appendChild(badge);
}
badge.textContent='Lv'+level;
};
Community.addNotificationBell=function(){
if(document.getElementById('communityBell'))return;
var header=document.querySelector('.header-inner');
if(!header)return;
var bell=document.createElement('button');
bell.id='communityBell';
bell.className='header-theme-btn';
bell.style.cssText='position:relative;display:none;';
bell.innerHTML='<i class="fas fa-bell"></i><span id="communityBellDot" style="position:absolute;top:2px;right:2px;width:8px;height:8px;border-radius:50%;background:#e74c3c;display:none;"></span>';
bell.addEventListener('click',Community.showNotifications);
header.insertBefore(bell,header.lastElementChild);
};
Community.loadNotifications=async function(){
if(!currentUser)return;
var bell=document.getElementById('communityBell');
if(bell)bell.style.display='flex';
var res=await supabaseClient.from('notifications').select('id').eq('user_id',currentUser.id).eq('is_read',false);
var dot=document.getElementById('communityBellDot');
if(dot)dot.style.display=(res.data&&res.data.length>0)?'block':'none';
};
Community.showNotifications=async function(){
if(!currentUser)return;
var res=await supabaseClient.from('notifications').select('*').eq('user_id',currentUser.id).order('created_at',{ascending:false}).limit(30);
var html='<div style="position:fixed;top:70px;right:20px;width:320px;max-height:400px;overflow-y:auto;background:var(--bg-card-solid);border:1px solid var(--border-glow);border-radius:12px;box-shadow:0 8px 32px rgba(0,0,0,0.15);z-index:9999;padding:12px;">';
html+='<div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:8px;"><strong>通知</strong><button onclick="this.parentElement.parentElement.remove()" style="background:none;border:none;font-size:1.2rem;cursor:pointer;">&times;</button></div>';
if(!res.data||res.data.length===0){html+='<p style="color:var(--text-dim);font-size:0.8rem;">暂无通知</p>';}
else{
for(var i=0;i<res.data.length;i++){
var n=res.data[i];
html+='<div style="padding:6px 0;border-bottom:1px solid var(--border-glow);font-size:0.8rem;'+(n.is_read?'opacity:0.6':'')+'">'+Community.escapeHTML(n.content||'')+'<div style="font-size:0.6rem;color:var(--text-dim);">'+timeAgo(n.created_at)+'</div></div>';
}
await supabaseClient.from('notifications').update({is_read:true}).eq('user_id',currentUser.id).eq('is_read',false);
var dot=document.getElementById('communityBellDot');
if(dot)dot.style.display='none';
}
html+='</div>';
var div=document.createElement('div');
div.innerHTML=html;
document.body.appendChild(div.firstChild);
};
Community.escapeHTML=function(str){
if(str===null||str===undefined)return '';
var d=document.createElement('div');
d.textContent=String(str);
return d.innerHTML;
};
Community.injectDetail=function(soft){
if(!soft)return;
var modalBody=document.getElementById('modalBody');
if(!modalBody)return;
var old=document.getElementById('communityDetailSection');
if(old)old.remove();
var section=document.createElement('div');
section.id='communityDetailSection';
section.style.cssText='margin-top:16px;border-top:1px solid var(--border-glow);padding-top:12px;';
section.innerHTML='<h4 style="font-size:0.9rem;margin-bottom:8px;"><i class="fas fa-star"></i> 评分与评论</h4>'+
'<div id="communityRatingBox" style="margin-bottom:10px;"></div>'+
'<div id="communityReviewList"></div>'+
'<div style="margin-top:10px;"><textarea id="communityReviewContent" placeholder="写下你的评价..." style="width:100%;padding:8px;border:1px solid var(--border-glow);border-radius:8px;background:var(--bg-primary);color:var(--text-primary);font-size:0.8rem;min-height:60px;"></textarea>'+
'<div style="display:flex;gap:8px;margin-top:6px;align-items:center;"><select id="communityRatingSelect" style="padding:4px 8px;border-radius:6px;border:1px solid var(--border-glow);background:var(--bg-primary);color:var(--text-primary);font-size:0.8rem;"><option value="5">5星</option><option value="4">4星</option><option value="3">3星</option><option value="2">2星</option><option value="1">1星</option></select><button class="btn btn-sm btn-primary" id="communitySubmitReview">发表评价</button></div></div>'+
'<h4 style="font-size:0.9rem;margin:16px 0 8px;"><i class="fas fa-comments"></i> 讨论区</h4>'+
'<div id="communityDiscussionList"></div>'+
'<div style="margin-top:10px;"><textarea id="communityDiscussionContent" placeholder="参与讨论..." style="width:100%;padding:8px;border:1px solid var(--border-glow);border-radius:8px;background:var(--bg-primary);color:var(--text-primary);font-size:0.8rem;min-height:60px;"></textarea>'+
'<button class="btn btn-sm btn-primary" id="communitySubmitDiscussion" style="margin-top:6px;">发表讨论</button></div>';
modalBody.appendChild(section);
Community.loadReviews(soft.id);
Community.loadDiscussions(soft.id);
document.getElementById('communitySubmitReview').onclick=function(){Community.submitReview(soft.id);};
document.getElementById('communitySubmitDiscussion').onclick=function(){Community.submitDiscussion(soft.id);};
};
Community.loadReviews=async function(softwareId){
var list=document.getElementById('communityReviewList');
if(!list)return;
var res=await supabaseClient.from('software_reviews').select('*').eq('software_id',softwareId).order('created_at',{ascending:false});
if(res.error){list.innerHTML='<p style="color:var(--text-dim);font-size:0.8rem;">暂无评价</p>';return;}
var data=res.data||[];
if(data.length===0){list.innerHTML='<p style="color:var(--text-dim);font-size:0.8rem;">暂无评价，来写第一条吧</p>';return;}
var avg=0;
var html='';
for(var i=0;i<data.length;i++){
var r=data[i];
avg+=r.rating;
var stars='';
for(var j=1;j<=5;j++){stars+=j<=r.rating?'★':'☆';}
html+='<div style="padding:8px 0;border-bottom:1px solid var(--border-glow);"><div style="display:flex;justify-content:space-between;font-size:0.75rem;"><span style="color:var(--accent-cyan);">'+stars+'</span><span style="color:var(--text-dim);">'+timeAgo(r.created_at)+'</span></div><div style="font-size:0.8rem;margin-top:2px;">'+Community.escapeHTML(r.content||'')+'</div></div>';
}
avg=(avg/data.length).toFixed(1);
var ratingBox=document.getElementById('communityRatingBox');
if(ratingBox)ratingBox.innerHTML='<div style="font-size:1.2rem;font-weight:700;color:var(--accent-cyan);">'+avg+' 分</div><div style="font-size:0.7rem;color:var(--text-dim);">共 '+data.length+' 条评价</div>';
list.innerHTML=html;
};
Community.submitReview=async function(softwareId){
if(!currentUser){toast('请先登录','warning');return;}
var content=document.getElementById('communityReviewContent').value.trim();
var rating=parseInt(document.getElementById('communityRatingSelect').value);
if(!content){toast('请填写评价内容','warning');return;}
var res=await supabaseClient.from('software_reviews').upsert({user_id:currentUser.id,software_id:softwareId,rating:rating,content:content},{onConflict:'user_id,software_id'});
if(res.error){toast('评价失败','error');return;}
toast('评价成功','success');
document.getElementById('communityReviewContent').value='';
Community.loadReviews(softwareId);
};
Community.loadDiscussions=async function(softwareId){
var list=document.getElementById('communityDiscussionList');
if(!list)return;
var res=await supabaseClient.from('software_discussions').select('*').eq('software_id',softwareId).is('parent_id',null).order('created_at',{ascending:false});
if(res.error){list.innerHTML='<p style="color:var(--text-dim);font-size:0.8rem;">暂无讨论</p>';return;}
var data=res.data||[];
if(data.length===0){list.innerHTML='<p style="color:var(--text-dim);font-size:0.8rem;">暂无讨论，来发表第一条吧</p>';return;}
var html='';
for(var i=0;i<data.length;i++){
var d=data[i];
html+='<div style="padding:8px 0;border-bottom:1px solid var(--border-glow);"><div style="font-size:0.7rem;color:var(--text-dim);">'+timeAgo(d.created_at)+'</div><div style="font-size:0.8rem;margin-top:2px;">'+Community.escapeHTML(d.content)+'</div></div>';
}
list.innerHTML=html;
};
Community.submitDiscussion=async function(softwareId){
if(!currentUser){toast('请先登录','warning');return;}
var content=document.getElementById('communityDiscussionContent').value.trim();
if(!content){toast('请填写讨论内容','warning');return;}
var res=await supabaseClient.from('software_discussions').insert({user_id:currentUser.id,software_id:softwareId,content:content});
if(res.error){toast('发表失败','error');return;}
toast('发表成功','success');
document.getElementById('communityDiscussionContent').value='';
Community.loadDiscussions(softwareId);
};
Community.injectProfile=function(){
var container=document.getElementById('profileContent');
if(!container)return;
var old=document.getElementById('communityProfileSection');
if(old)old.remove();
var section=document.createElement('div');
section.id='communityProfileSection';
section.style.cssText='margin-top:16px;';
section.innerHTML='<div style="display:grid;grid-template-columns:1fr 1fr;gap:12px;">'+
'<div style="background:var(--bg-card);border-radius:12px;padding:16px;border:1px solid var(--border-glow);text-align:center;">'+
'<div style="font-size:1.5rem;font-weight:700;color:var(--accent-cyan);" id="communityPoints">0</div>'+
'<div style="font-size:0.75rem;color:var(--text-dim);">积分</div>'+
'<button class="btn btn-sm btn-primary" id="communityCheckinBtn" style="margin-top:8px;">每日签到</button></div>'+
'<div style="background:var(--bg-card);border-radius:12px;padding:16px;border:1px solid var(--border-glow);text-align:center;">'+
'<div style="font-size:1.5rem;font-weight:700;color:var(--accent-cyan);" id="communityLevel">Lv1</div>'+
'<div style="font-size:0.75rem;color:var(--text-dim);">等级</div>'+
'<div style="font-size:0.7rem;color:var(--text-dim);margin-top:4px;">连续签到 <span id="communityStreak">0</span> 天</div></div>'+
'</div>';
container.appendChild(section);
Community.updateProfileStats();
document.getElementById('communityCheckinBtn').onclick=Community.doCheckin;
};
Community.updateProfileStats=function(){
var p=document.getElementById('communityPoints');
var l=document.getElementById('communityLevel');
var s=document.getElementById('communityStreak');
if(p)p.textContent=window.userPoints||0;
if(l)l.textContent='Lv'+(window.userLevel||1);
if(s)s.textContent=window.userStreak||0;
};
Community.doCheckin=async function(){
if(!currentUser){toast('请先登录','warning');return;}
var today=new Date().toISOString().slice(0,10);
var res=await supabaseClient.from('checkins').select('id').eq('user_id',currentUser.id).eq('checkin_date',today).maybeSingle();
if(res.data){toast('今天已经签到过了','warning');return;}
var points=10;
var streak=(window.userStreak||0)+1;
if(streak>1){
var last=window.userLastCheckin;
if(last){
var diff=(new Date(today)-new Date(last))/86400000;
if(diff>1)streak=1;
}
}
var newPoints=(window.userPoints||0)+points;
var level=Math.floor(newPoints/100)+1;
await supabaseClient.from('checkins').insert({user_id:currentUser.id,checkin_date:today,points:points});
await supabaseClient.from('profiles').update({points:newPoints,level:level,streak:streak,last_checkin:today}).eq('id',currentUser.id);
window.userPoints=newPoints;
window.userLevel=level;
window.userStreak=streak;
window.userLastCheckin=today;
Community.updateProfileStats();
Community.updateAvatarLevel();
toast('签到成功 +'+points+' 积分','success');
};
Community.addRandomButton=function(){
var hero=document.querySelector('.hero');
if(!hero||document.getElementById('communityRandomBtn'))return;
var btn=document.createElement('button');
btn.id='communityRandomBtn';
btn.className='btn btn-outline';
btn.style.cssText='margin-top:10px;';
btn.innerHTML='<i class="fas fa-dice"></i> 手气不错';
btn.onclick=function(){
var all=DB.getSoftware();
if(!all.length)return;
var s=all[Math.floor(Math.random()*all.length)];
Detail.open(s);
};
hero.appendChild(btn);
};
Community.addLeaderboard=function(){
var home=document.getElementById('pageHome');
if(!home||document.getElementById('communityLeaderboard'))return;
var div=document.createElement('div');
div.id='communityLeaderboard';
div.style.cssText='margin-top:24px;';
div.innerHTML='<h2 class="section-title">🏆 社区排行榜</h2><div id="communityLeaderboardContent" style="background:var(--bg-card);border-radius:12px;padding:16px;border:1px solid var(--border-glow);margin-top:8px;">加载中...</div>';
home.appendChild(div);
Community.loadLeaderboard();
};
Community.loadLeaderboard=async function(){
var el=document.getElementById('communityLeaderboardContent');
if(!el)return;
var res=await supabaseClient.from('profiles').select('username,points,level').order('points',{ascending:false}).limit(10);
if(res.error){el.innerHTML='<p style="color:var(--text-dim);">暂无数据</p>';return;}
var html='<ol style="padding-left:20px;font-size:0.85rem;">';
for(var i=0;i<res.data.length;i++){
var u=res.data[i];
html+='<li style="padding:4px 0;"><span style="font-weight:600;">'+(u.username||'匿名')+'</span> <span style="color:var(--accent-cyan);">'+u.points+' 积分</span> <span style="color:var(--text-dim);">Lv'+u.level+'</span></li>';
}
html+='</ol>';
el.innerHTML=html;
};
Community.initEasterEggs=function(){
var logo=document.getElementById('logoHome');
if(logo){
var count=0;
logo.addEventListener('click',function(){
count++;
if(count>=5){
count=0;
toast('🎉 彩蛋触发！','success');
document.documentElement.style.setProperty('--accent-cyan','#ff00ff');
setTimeout(function(){document.documentElement.style.setProperty('--accent-cyan','#0077ff');},3000);
}
});
}
var konami=[38,38,40,40,37,39,37,39,66,65];
var pos=0;
document.addEventListener('keydown',function(e){
if(e.keyCode===konami[pos]){
pos++;
if(pos===konami.length){
pos=0;
toast('🎮 Konami 彩蛋！','success');
document.body.style.transform='rotate(360deg)';
setTimeout(function(){document.body.style.transform='';},1000);
}
}else{pos=0;}
});
};
Community.initThemes=function(){
var themes=['light','dark','cyber','purple'];
var current=localStorage.getItem('theme')||'light';
if(current==='cyber'){document.documentElement.setAttribute('data-theme','dark');document.documentElement.style.setProperty('--accent-cyan','#00ffcc');document.documentElement.style.setProperty('--accent-purple','#ff00ff');}
if(current==='purple'){document.documentElement.setAttribute('data-theme','dark');document.documentElement.style.setProperty('--accent-cyan','#a855f7');document.documentElement.style.setProperty('--accent-purple','#ec4899');}
};
Community.initPWA=function(){
if(document.querySelector('link[rel="manifest"]'))return;
var manifest={name:'乐哲软件',short_name:'乐哲',start_url:'/',display:'standalone',background_color:'#f0f4fa',theme_color:'#0077ff',icons:[{src:'./icon-192.png',sizes:'192x192',type:'image/png'},{src:'./icon-512.png',sizes:'512x512',type:'image/png'}]};
var blob=new Blob([JSON.stringify(manifest)],{type:'application/json'});
var url=URL.createObjectURL(blob);
var link=document.createElement('link');
link.rel='manifest';
link.href=url;
document.head.appendChild(link);
if('serviceWorker' in navigator){
navigator.serviceWorker.register('./sw.js').catch(function(){});
}
};
if(document.readyState==='loading'){document.addEventListener('DOMContentLoaded',Community.init);}else{Community.init();}
})();