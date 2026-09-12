/* ============ 站内信详情弹层 ============ */
C.showNotifDetail=function(title,body,timeStr){
  var ex=document.getElementById('communityNotifDetail');
  if(ex)ex.remove();
  var ov=document.createElement('div');
  ov.id='communityNotifDetail';
  ov.style.cssText='position:fixed;inset:0;z-index:10001;background:rgba(0,0,0,0.35);backdrop-filter:blur(8px);-webkit-backdrop-filter:blur(8px);display:flex;align-items:center;justify-content:center;padding:20px;';
  var box=document.createElement('div');
  box.style.cssText='width:100%;max-width:560px;max-height:80vh;background:var(--bg-card-solid);border:1px solid var(--border-glow-strong);border-radius:18px;box-shadow:0 24px 64px rgba(0,0,0,0.2);display:flex;flex-direction:column;overflow:hidden;transform:scale(0.96);transition:transform .25s cubic-bezier(0.2,0,0,1);';
  var hd=document.createElement('div');
  hd.style.cssText='display:flex;align-items:center;gap:10px;padding:18px 22px 14px;border-bottom:1px solid var(--border-glow);flex-shrink:0;';
  hd.innerHTML='<div style="width:34px;height:34px;border-radius:10px;background:var(--accent-gradient);color:#fff;display:flex;align-items:center;justify-content:center;flex-shrink:0;"><i class="fas fa-bell"></i></div>'+
    '<div style="flex:1;min-width:0;">'+
    '<div style="font-size:1rem;font-weight:700;color:var(--text-primary);word-break:break-word;">'+C.esc(title)+'</div>'+
    '<div style="font-size:0.68rem;color:var(--text-dim);margin-top:2px;">'+C.esc(timeStr||'')+'</div>'+
    '</div>';
  var cb=document.createElement('button');
  cb.innerHTML='&times;';
  cb.style.cssText='background:rgba(0,0,0,0.04);border:none;width:30px;height:30px;border-radius:50%;color:var(--text-dim);font-size:1.2rem;cursor:pointer;flex-shrink:0;line-height:1;';
  hd.appendChild(cb);
  box.appendChild(hd);
  var bd=document.createElement('div');
  bd.style.cssText='padding:18px 22px 22px;overflow-y:auto;font-size:0.88rem;line-height:1.8;color:var(--text-secondary);word-break:break-word;white-space:pre-wrap;';
  bd.textContent=body;
  box.appendChild(bd);
  ov.appendChild(box);
  document.body.appendChild(ov);
  requestAnimationFrame(function(){box.style.transform='scale(1)';});
  var onKey=function(e){if(e.key==='Escape')close();};
  var close=function(){ov.remove();document.removeEventListener('keydown',onKey);};
  cb.onclick=close;
  ov.addEventListener('click',function(e){
    e.stopPropagation();
    if(e.target===ov)close();
  });
  document.addEventListener('keydown',onKey);
};

/* ============ 通知面板（长内容折叠） ============ */
C.showNotifs=async function(){
  if(!window.currentUser)return;
  var ex=document.getElementById('communityNotifPanel');
  if(ex){ex.remove();return;}
  var r=await supabaseClient.from('notifications').select('*').eq('user_id',window.currentUser.id).order('created_at',{ascending:false}).limit(30);
  var data=r.data||[];
  var ur=data.filter(function(n){return !n.is_read;}).length;
  var p=document.createElement('div');
  p.id='communityNotifPanel';
  p.style.cssText='position:fixed;top:70px;right:16px;width:380px;max-width:calc(100vw - 32px);max-height:520px;background:var(--bg-card-solid);border:1px solid var(--border-glow-strong);border-radius:18px;box-shadow:0 20px 56px rgba(0,0,0,0.18);z-index:9999;overflow:hidden;display:flex;flex-direction:column;';
  var hd=document.createElement('div');
  hd.style.cssText='display:flex;justify-content:space-between;align-items:center;padding:16px 20px 14px;border-bottom:1px solid var(--border-glow);flex-shrink:0;';
  hd.innerHTML='<div style="display:flex;align-items:center;gap:10px;"><div style="width:32px;height:32px;border-radius:10px;background:var(--accent-gradient);color:#fff;display:flex;align-items:center;justify-content:center;"><i class="fas fa-bell"></i></div><div><div style="font-size:0.95rem;font-weight:700;">消息通知</div><div style="font-size:0.68rem;color:var(--text-dim);margin-top:2px;">'+(ur>0?('<span style="color:#0077ff;font-weight:600;">'+ur+'</span> 条未读'):'全部已读')+'</div></div></div>';
  var cb=document.createElement('button');
  cb.innerHTML='&times;';
  cb.style.cssText='background:rgba(0,0,0,0.04);border:none;width:30px;height:30px;border-radius:50%;color:var(--text-dim);font-size:1.2rem;cursor:pointer;flex-shrink:0;line-height:1;';
  hd.appendChild(cb);
  p.appendChild(hd);
  var bd=document.createElement('div');
  bd.style.cssText='flex:1;overflow-y:auto;padding:10px;background:var(--bg-primary);';
  if(data.length===0){
    bd.innerHTML='<div style="text-align:center;padding:56px 20px;"><div style="font-size:2.8rem;opacity:0.25;">📭</div><div style="font-size:0.88rem;color:var(--text-secondary);margin-top:8px;">暂无新消息</div></div>';
  }else{
    data.forEach(function(n){
      var cd=document.createElement('div');
      cd.className='notif-item';
      cd.style.cssText='background:var(--bg-card-solid);border-radius:12px;padding:14px 16px;margin-bottom:8px;border:1px solid var(--border-glow);position:relative;transition:border-color .2s;';
      var tt=String(n.content||'');
      var m=tt.match(/^【([^】]+)】([\s\S]+)$/);
      var title=m?m[1]:'系统通知';
      var body=m?m[2]:tt;
      var timeStr=(typeof timeAgo==='function')?timeAgo(n.created_at):'';
      var isLong=body.length>80||body.split('\n').length>4;
      var bstyle='font-size:0.8rem;color:var(--text-secondary);line-height:1.65;word-break:break-word;';
      if(isLong){
        bstyle+='display:-webkit-box;-webkit-line-clamp:3;-webkit-box-orient:vertical;overflow:hidden;';
        cd.style.cursor='pointer';
      }else{
        bstyle+='white-space:pre-wrap;';
      }
      cd.innerHTML='<div style="display:flex;align-items:center;gap:8px;margin-bottom:8px;">'+
        '<span style="font-size:0.85rem;font-weight:700;color:var(--text-primary);">'+C.esc(title)+'</span>'+
        '<span style="font-size:0.65rem;color:var(--text-dim);margin-left:auto;">'+timeStr+'</span>'+
        '<button class="ndel" data-id="'+n.id+'" style="background:transparent;border:none;color:var(--text-dim);font-size:1rem;cursor:pointer;opacity:0.5;flex-shrink:0;line-height:1;">&times;</button>'+
        '</div>'+
        '<div style="'+bstyle+'">'+C.esc(body)+'</div>'+
        (isLong?'<div style="font-size:0.68rem;color:var(--accent-cyan);margin-top:8px;font-weight:600;display:flex;align-items:center;gap:4px;"><i class="fas fa-expand-alt"></i> 点击查看全文</div>':'');
      if(isLong){
        cd.addEventListener('click',function(e){
          if(e.target.closest('.ndel'))return;
          C.showNotifDetail(title,body,timeStr);
        });
      }
      bd.appendChild(cd);
    });
  }
  p.appendChild(bd);
  document.body.appendChild(p);
  var cp=function(){if(p.parentNode)p.remove();document.removeEventListener('click',oc);};
  cb.onclick=cp;
  var oc=function(e){if(!p.contains(e.target)&&!e.target.closest('#communityBell')){cp();}};
  setTimeout(function(){document.addEventListener('click',oc);},10);
  bd.querySelectorAll('.ndel').forEach(function(b){
    b.addEventListener('click',async function(e){
      e.stopPropagation();
      if(!confirm('删除这条通知？'))return;
      var id=this.dataset.id;
      var r=await supabaseClient.from('notifications').delete().eq('id',id);
      if(r.error){C.tip('删除失败','error');return;}
      var item=this.closest('.notif-item');
      if(item)item.remove();
    });
  });
  if(ur>0){
    await supabaseClient.from('notifications').update({is_read:true}).eq('user_id',window.currentUser.id).eq('is_read',false);
    var d=document.getElementById('communityBellDot');
    if(d)d.style.display='none';
  }
};
