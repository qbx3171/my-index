console.log('community.js v12 loaded');

(function () {
  'use strict';

  function $(id) { return document.getElementById(id); }

  function esc(s) {
    if (s === null || s === undefined) return '';
    var d = document.createElement('div');
    d.textContent = String(s);
    return d.innerHTML;
  }

  function getClient() {
    if (window.supabaseClient) return window.supabaseClient;
    if (typeof window.supabase === 'undefined') return null;
    try {
      var url = window.SUPABASE_URL || 'https://qqcxtfayjxyvswblmdpw.supabase.co';
      var key = window.SUPABASE_ANON_KEY || 'sb_publishable__KOJGRcvoRGC3QiHNg7_qA_-9yGsnCW';
      window.supabaseClient = window.supabase.createClient(url, key);
      return window.supabaseClient;
    } catch (e) { return null; }
  }

  function toast(msg, type) {
    if (typeof window.toast === 'function') window.toast(msg, type);
    else alert(msg);
  }

  function todayStr() {
    var d = new Date();
    var y = d.getFullYear();
    var m = ('0' + (d.getMonth() + 1)).slice(-2);
    var day = ('0' + d.getDate()).slice(-2);
    return y + '-' + m + '-' + day;
  }

  var POINT_FIELDS = ['checkin_points', 'points', 'total_points', 'score', 'credits', 'sign_points', 'integral'];
  var NAME_FIELDS = ['username', 'nickname', 'display_name', 'name', 'full_name'];

  function getProfilePoints(p) {
    if (!p) return { field: POINT_FIELDS[0], value: 0 };
    for (var i = 0; i < POINT_FIELDS.length; i++) {
      if (p[POINT_FIELDS[i]] !== undefined && p[POINT_FIELDS[i]] !== null) {
        return { field: POINT_FIELDS[i], value: Number(p[POINT_FIELDS[i]]) || 0 };
      }
    }
    return { field: POINT_FIELDS[0], value: 0 };
  }

  function getName(p) {
    if (!p) return '匿名用户';
    for (var i = 0; i < NAME_FIELDS.length; i++) {
      if (p[NAME_FIELDS[i]]) return p[NAME_FIELDS[i]];
    }
    if (p.email) return p.email.split('@')[0];
    return '匿名用户';
  }

  /* ========== 样式 ========== */
  function injectStyles() {
    if ($('communityModuleStyles')) return;
    var st = document.createElement('style');
    st.id = 'communityModuleStyles';
    st.textContent =
      '.rank-popover{position:fixed;bottom:90px;right:70px;width:260px;' +
      'max-height:400px;background:var(--bg-card-solid,#fff);' +
      'border:1px solid var(--border-glow,rgba(0,120,255,0.18));border-radius:14px;' +
      'box-shadow:0 12px 40px rgba(0,0,0,0.14);z-index:300;' +
      'display:flex;flex-direction:column;overflow:hidden;' +
      'opacity:0;visibility:hidden;transform:translateY(12px) scale(0.94);' +
      'transition:opacity .22s ease,transform .22s ease,visibility .22s;}' +
      '.rank-popover.open{opacity:1;visibility:visible;transform:translateY(0) scale(1);}' +
      '.rank-popover .rank-head{padding:12px 14px;display:flex;align-items:center;gap:8px;' +
      'background:linear-gradient(135deg,#0077ff,#6c5ce7);' +
      'color:#fff;font-size:0.85rem;font-weight:700;letter-spacing:.3px;}' +
      '.rank-popover .rank-head i{font-size:0.95rem;}' +
      '.rank-popover .rank-head .close{margin-left:auto;background:none;border:none;' +
      'color:rgba(255,255,255,0.85);font-size:1.15rem;cursor:pointer;line-height:1;padding:0 2px;}' +
      '.rank-popover .rank-body{overflow-y:auto;max-height:340px;padding:4px 0;' +
      'scrollbar-width:thin;}' +
      '.rank-popover .rank-body::-webkit-scrollbar{width:4px;}' +
      '.rank-popover .rank-body::-webkit-scrollbar-thumb{background:rgba(0,119,255,0.2);border-radius:4px;}' +
      '.rank-popover .rank-item{display:flex;align-items:center;gap:8px;padding:7px 12px;' +
      'border-bottom:1px solid var(--border-glow,rgba(0,120,255,0.12));font-size:0.78rem;}' +
      '.rank-popover .rank-item:last-child{border-bottom:none;}' +
      '.rank-popover .rank-item .n{width:22px;text-align:center;font-weight:700;' +
      'color:var(--text-secondary,#3d5068);flex-shrink:0;}' +
      '.rank-popover .rank-item .nm{flex:1;min-width:0;white-space:nowrap;overflow:hidden;' +
      'text-overflow:ellipsis;color:var(--text-primary,#0f1a2e);}' +
      '.rank-popover .rank-item .pt{font-size:0.72rem;color:#f39c12;font-weight:600;' +
      'flex-shrink:0;white-space:nowrap;}' +
      '.rank-popover .rank-item .pt i{margin-right:2px;}' +
      '.rank-popover .rank-empty{padding:24px 12px;text-align:center;' +
      'color:var(--text-dim,#7a8ca3);font-size:0.78rem;}' +
      '.checkin-card{margin-top:16px;padding:18px 20px;background:var(--bg-card,#fff);' +
      'border:1px solid var(--border-glow,rgba(0,120,255,0.18));border-radius:12px;' +
      'display:flex;align-items:center;gap:16px;flex-wrap:wrap;}' +
      '.checkin-card .checkin-icon{width:52px;height:52px;border-radius:50%;' +
      'background:linear-gradient(135deg,#0077ff,#6c5ce7);color:#fff;' +
      'display:flex;align-items:center;justify-content:center;font-size:1.5rem;flex-shrink:0;}' +
      '.checkin-card .checkin-info{flex:1;min-width:140px;}' +
      '.checkin-card .checkin-info .t{font-size:1rem;font-weight:700;color:var(--text-primary,#0f1a2e);}' +
      '.checkin-card .checkin-info .s{font-size:0.75rem;color:var(--text-dim,#7a8ca3);margin-top:2px;}' +
      '.checkin-card .checkin-btn{padding:10px 22px;border-radius:50px;font-weight:700;' +
      'font-size:0.85rem;background:linear-gradient(135deg,#0077ff,#6c5ce7);color:#fff;' +
      'border:none;cursor:pointer;transition:transform .15s;}' +
      '.checkin-card .checkin-btn:hover{transform:translateY(-2px);}' +
      '.checkin-card .checkin-btn:disabled{opacity:.5;cursor:not-allowed;transform:none;}' +
      '.review-star{cursor:pointer;transition:color .2s;}' +
      '.review-star.active{color:#f39c12;}';
    document.head.appendChild(st);
  }

  /* ========== 奖杯按钮 ========== */
  function placeButton() {
    var box = $('shareFloat');
    if (!box) return;
    var wechat = null;
    var anchors = box.getElementsByTagName('a');
    for (var i = 0; i < anchors.length; i++) {
      var title = anchors[i].getAttribute('title') || '';
      var onclick = anchors[i].getAttribute('onclick') || '';
      if (title.indexOf('微信') !== -1 || onclick.indexOf('wechat') !== -1) {
        wechat = anchors[i];
        break;
      }
    }
    var btn = $('rankingBtn');
    if (!btn) {
      btn = document.createElement('a');
      btn.id = 'rankingBtn';
      btn.href = '#';
      btn.title = '签到积分榜';
      btn.innerHTML = '<i class="fas fa-trophy"></i>';
    }
    if (wechat) {
      if (btn.parentNode !== box || btn.nextElementSibling !== wechat) {
        box.insertBefore(btn, wechat);
      }
    } else if (btn.parentNode !== box) {
      box.insertBefore(btn, box.firstChild);
    }
  }

  /* ========== 排行榜浮层 ========== */
  function ensurePopover() {
    var p = $('rankPopover');
    if (p) return p;
    p = document.createElement('div');
    p.className = 'rank-popover';
    p.id = 'rankPopover';
    p.innerHTML =
      '<div class="rank-head">' +
        '<i class="fas fa-trophy"></i>' +
        '<span>签到积分榜</span>' +
        '<button class="close" id="rankPopoverClose" type="button">✕</button>' +
      '</div>' +
      '<div class="rank-body" id="rankBody">' +
        '<div class="rank-empty">加载中...</div>' +
      '</div>';
    document.body.appendChild(p);
    return p;
  }

  function openRanking() {
    ensurePopover().classList.add('open');
    loadRanking();
  }

  function closeRanking() {
    var p = $('rankPopover');
    if (p) p.classList.remove('open');
  }

  /* ========== 排行榜：前端排序，不依赖数据库字段 ========== */
  function loadRanking() {
    var body = $('rankBody');
    if (!body) return;
    var sb = getClient();
    if (!sb) {
      body.innerHTML = '<div class="rank-empty">服务未加载</div>';
      return;
    }
    body.innerHTML = '<div class="rank-empty">加载中...</div>';

    sb.from('profiles').select('*').limit(200).then(function (res) {
      if (res.error) {
        body.innerHTML = '<div class="rank-empty">加载失败: ' + esc(res.error.message) + '</div>';
        return;
      }
      var list = res.data || [];
      if (list.length === 0) {
        body.innerHTML = '<div class="rank-empty">暂无用户数据</div>';
        return;
      }

      /* 找出真实存在的积分字段：取第一条有非零值的字段 */
      var realField = null;
      for (var f = 0; f < POINT_FIELDS.length; f++) {
        for (var k = 0; k < list.length; k++) {
          if (list[k][POINT_FIELDS[f]] !== undefined && list[k][POINT_FIELDS[f]] !== null) {
            realField = POINT_FIELDS[f];
            break;
          }
        }
        if (realField) break;
      }
      if (!realField) {
        /* 若全表都没有积分字段，默认用第一个字段名展示 */
        realField = POINT_FIELDS[0];
      }

      /* 前端排序 */
      var sorted = list.slice().sort(function (a, b) {
        var av = Number(a[realField]) || 0;
        var bv = Number(b[realField]) || 0;
        return bv - av;
      }).slice(0, 10);

      var html = '';
      for (var i = 0; i < sorted.length; i++) {
        var it = sorted[i];
        var medal = (i + 1) + '';
        if (i === 0) medal = '🥇';
        else if (i === 1) medal = '🥈';
        else if (i === 2) medal = '🥉';
        var nm = getName(it);
        var pt = Number(it[realField]) || 0;
        html +=
          '<div class="rank-item">' +
            '<span class="n">' + medal + '</span>' +
            '<span class="nm">' + esc(nm) + '</span>' +
            '<span class="pt"><i class="fas fa-coins"></i>' + pt + '</span>' +
          '</div>';
      }
      body.innerHTML = html;
    }).catch(function (err) {
      body.innerHTML = '<div class="rank-empty">网络异常: ' + esc(err.message || '') + '</div>';
    });
  }

  /* ========== 签到卡片 ========== */
  var checkinState = { loading: false, cardRendered: false, cardSignInToday: false };

  function ensureCheckinCard() {
    if (checkinState.cardRendered) return;
    var container = $('profileContent');
    if (!container) return;

    var sb = getClient();
    if (!sb || !window.currentUser) return;

    checkinState.cardRendered = true;

    var renderCard = function (profile) {
      /* 清理旧的卡片（保险） */
      var old = $('checkinCard');
      if (old) old.parentNode.removeChild(old);

      var pts = getProfilePoints(profile);
      var card = document.createElement('div');
      card.className = 'checkin-card';
      card.id = 'checkinCard';
      card.innerHTML =
        '<div class="checkin-icon"><i class="fas fa-calendar-check"></i></div>' +
        '<div class="checkin-info">' +
          '<div class="t">每日签到</div>' +
          '<div class="s">当前积分：<span id="checkinPointsVal">' + esc(pts.value) + '</span> 分</div>' +
        '</div>' +
        '<button class="checkin-btn" id="checkinBtn"><i class="fas fa-check-circle"></i> 立即签到</button>';

      var c2 = $('profileContent');
      if (!c2) return;
      c2.insertBefore(card, c2.firstChild);

      var btn = $('checkinBtn');
      if (btn) {
        btn.addEventListener('click', function () { doCheckin(profile); });
      }

      /* 检查今天是否已签到（失败不阻塞，默认允许签到） */
      var today = todayStr();
      sb.from('checkins')
        .select('id')
        .eq('user_id', window.currentUser.id)
        .eq('checkin_date', today)
        .limit(1)
        .then(function (res) {
          if (res.data && res.data.length > 0) {
            checkinState.cardSignInToday = true;
            var b = $('checkinBtn');
            if (b) {
              b.disabled = true;
              b.innerHTML = '<i class="fas fa-check"></i> 今日已签到';
            }
          }
        })
        .catch(function () {
          /* checkins 表可能不存在，忽略错误，允许用户尝试签到 */
        });
    };

    if (window.userProfile) {
      renderCard(window.userProfile);
    } else {
      sb.from('profiles').select('*').eq('id', window.currentUser.id).maybeSingle()
        .then(function (r) {
          var p = r.data || {};
          window.userProfile = p;
          renderCard(p);
        })
        .catch(function () {
          renderCard({});
        });
    }
  }

  function doCheckin(profile) {
    if (checkinState.loading) return;
    var sb = getClient();
    if (!sb) { toast('服务未加载', 'error'); return; }
    var user = window.currentUser;
    if (!user) { toast('请先登录', 'warning'); return; }

    checkinState.loading = true;
    var btn = $('checkinBtn');
    if (btn) { btn.disabled = true; btn.innerHTML = '签到中...'; }

    var today = todayStr();

    /* 先尝试写入签到记录 */
    sb.from('checkins')
      .insert([{ user_id: user.id, checkin_date: today, points: 1 }])
      .then(function (insRes) {
        if (insRes.error) {
          /* 唯一键冲突代表今天已签到，其余错误也提示 */
          if (insRes.error.code === '23505' || (insRes.error.message || '').indexOf('duplicate') !== -1) {
            toast('今天已经签到过啦～', 'warning');
          } else {
            /* checkins 表可能不存在，直接加积分兜底 */
            toast('签到表异常，尝试直接加积分...', 'warning');
          }
          addPoints(sb, user.id, 1, profile, btn, insRes.error.code === '23505');
          return;
        }
        addPoints(sb, user.id, 1, profile, btn, false);
      })
      .catch(function () {
        /* 网络错误，也尝试直接加积分 */
        addPoints(sb, user.id, 1, profile, btn, false);
      });
  }

  function addPoints(sb, userId, delta, profile, btn, isDuplicate) {
    var pts = getProfilePoints(profile);
    var field = pts.field;
    var newVal = (pts.value || 0) + delta;
    var update = {};
    update[field] = newVal;

    sb.from('profiles')
      .update(update)
      .eq('id', userId)
      .then(function (res) {
        if (res.error) {
          if (!isDuplicate) {
            toast('签到成功，但积分更新失败：' + res.error.message, 'warning');
          }
        } else if (!isDuplicate) {
          toast('签到成功！+' + delta + ' 积分', 'success');
          var ptsEl = $('checkinPointsVal');
          if (ptsEl) ptsEl.textContent = newVal;
        }
        if (btn) {
          btn.disabled = true;
          btn.innerHTML = '<i class="fas fa-check"></i> 今日已签到';
        }
        checkinState.loading = false;
        checkinState.cardSignInToday = true;
        if (window.userProfile) {
          try { window.userProfile[field] = newVal; } catch (e) {}
        }
      })
      .catch(function () {
        toast('签到成功，积分同步异常', 'warning');
        if (btn) { btn.disabled = true; btn.innerHTML = '<i class="fas fa-check"></i> 今日已签到'; }
        checkinState.loading = false;
        checkinState.cardSignInToday = true;
      });
  }

  /* ========== 轮询：进入个人中心插入卡片 ========== */
  function startProfileWatch() {
    setInterval(function () {
      var pageProfile = $('pageProfile');
      if (!pageProfile) return;
      if (pageProfile.classList.contains('hidden')) {
        /* 离开个人中心时重置标记，方便下次进入重建 */
        if (checkinState.cardRendered && !$('checkinCard')) {
          checkinState.cardRendered = false;
        }
        return;
      }
      if (!$('checkinCard')) {
        checkinState.cardRendered = false;
        ensureCheckinCard();
      }
    }, 800);
  }

  /* ========== 软件评价 ========== */
  function injectReviewButton() {
    var actions = document.querySelector('.detail-actions');
    if (!actions) return;
    if ($('softwareReviewBtn')) return;
    var btn = document.createElement('button');
    btn.className = 'btn btn-outline';
    btn.id = 'softwareReviewBtn';
    btn.innerHTML = '<i class="fas fa-star"></i> 评价';
    btn.style.marginLeft = '6px';
    btn.onclick = function () {
      var soft = window.Detail && window.Detail._currentSoft;
      if (!soft) { toast('无法获取软件信息', 'warning'); return; }
      openReviewModal(soft);
    };
    actions.appendChild(btn);
  }

  function injectReviewSection() {
    var modalBody = document.querySelector('.detail-modal .modal-body');
    if (!modalBody) return;
    if ($('detailReviews')) return;
    var section = document.createElement('div');
    section.id = 'detailReviews';
    section.style.marginTop = '14px';
    section.style.borderTop = '1px solid var(--border-glow)';
    section.style.paddingTop = '12px';
    section.innerHTML = '<h4 style="font-size:0.85rem;font-weight:600;margin-bottom:10px;">' +
      '<i class="fas fa-comments"></i> 用户评价</h4>' +
      '<div id="reviewListContainer" style="font-size:0.8rem;color:var(--text-secondary);">加载中...</div>';
    modalBody.appendChild(section);
  }

  function loadReviews(softwareId) {
    var container = $('reviewListContainer');
    if (!container) return;
    var sb = getClient();
    if (!sb) { container.innerHTML = '服务未加载'; return; }
    sb.from('software_reviews')
      .select('*')
      .eq('software_id', softwareId)
      .order('created_at', { ascending: false })
      .then(function (res) {
        if (res.error) { container.innerHTML = '暂无评价，来写第一条吧！'; return; }
        var list = res.data || [];
        if (list.length === 0) { container.innerHTML = '暂无评价，来写第一条吧！'; return; }
        var html = '';
        for (var i = 0; i < list.length; i++) {
          var r = list[i];
          var stars = '';
          for (var s = 1; s <= 5; s++) stars += s <= (r.rating || 5) ? '★' : '☆';
          html +=
            '<div style="padding:8px 0;border-bottom:1px solid var(--border-glow);">' +
              '<div style="display:flex;justify-content:space-between;margin-bottom:2px;">' +
                '<span style="font-weight:600;color:var(--text-primary);">' + esc(r.user_name || '匿名用户') + '</span>' +
                '<span style="color:#f39c12;">' + stars + '</span>' +
              '</div>' +
              '<div style="line-height:1.5;">' + esc(r.content) + '</div>' +
            '</div>';
        }
        container.innerHTML = html;
      })
      .catch(function () { container.innerHTML = '评价加载异常'; });
  }

  function ensureReviewModal() {
    var modal = $('reviewModal');
    if (modal) return modal;
    modal = document.createElement('div');
    modal.className = 'modal-overlay';
    modal.id = 'reviewModal';
    modal.innerHTML =
      '<div class="modal-box" style="max-width:420px;">' +
        '<button class="close-btn" id="reviewModalClose">&times;</button>' +
        '<h3><i class="fas fa-star"></i> 评价软件</h3>' +
        '<div id="reviewStars" style="font-size:2rem;color:#ccc;margin-bottom:12px;">' +
          '<span class="review-star" data-val="1">★</span>' +
          '<span class="review-star" data-val="2">★</span>' +
          '<span class="review-star" data-val="3">★</span>' +
          '<span class="review-star" data-val="4">★</span>' +
          '<span class="review-star" data-val="5">★</span>' +
        '</div>' +
        '<div class="form-group">' +
          '<textarea id="reviewContent" rows="4" placeholder="写下你的评价..."></textarea>' +
        '</div>' +
        '<div class="form-actions">' +
          '<button class="btn btn-outline" id="reviewCancel">取消</button>' +
          '<button class="btn btn-primary" id="reviewSubmit">提交评价</button>' +
        '</div>' +
      '</div>';
    document.body.appendChild(modal);
    return modal;
  }

  var currentReviewSoftware = null;

  function openReviewModal(soft) {
    currentReviewSoftware = soft;
    var modal = ensureReviewModal();
    modal.classList.add('open');
    $('reviewContent').value = '';
    var stars = modal.querySelectorAll('.review-star');
    for (var i = 0; i < stars.length; i++) stars[i].classList.remove('active');
  }

  function closeReviewModal() {
    var modal = $('reviewModal');
    if (modal) modal.classList.remove('open');
  }

  function submitReview() {
    if (!currentReviewSoftware) return;
    var sb = getClient();
    if (!sb) { toast('服务未加载', 'error'); return; }
    var user = window.currentUser;
    if (!user) {
      toast('请先登录', 'warning');
      closeReviewModal();
      if ($('loginModal')) $('loginModal').classList.add('open');
      return;
    }
    var activeStar = document.querySelector('.review-star.active');
    var rating = activeStar ? parseInt(activeStar.getAttribute('data-val')) : 5;
    var content = $('reviewContent').value.trim();
    if (!content) { toast('请填写评价内容', 'warning'); return; }
    var userName = user.email ? user.email.split('@')[0] : '匿名用户';
    sb.from('software_reviews').insert([{
      software_id: currentReviewSoftware.id,
      user_id: user.id,
      user_name: userName,
      rating: rating,
      content: content
    }]).then(function (res) {
      if (res.error) { toast('评价失败：' + res.error.message, 'error'); return; }
      toast('评价成功！', 'success');
      closeReviewModal();
      loadReviews(currentReviewSoftware.id);
    });
  }

  function bindReviewEvents() {
    document.addEventListener('click', function (e) {
      var t = e.target;
      if (!t) return;
      if (t.closest('#reviewModalClose') || t.closest('#reviewCancel')) { closeReviewModal(); return; }
      if (t.closest('#reviewSubmit')) { submitReview(); return; }
      if (t.classList.contains('review-star')) {
        var val = parseInt(t.getAttribute('data-val'));
        var stars = document.querySelectorAll('.review-star');
        for (var i = 0; i < stars.length; i++) {
          if (parseInt(stars[i].getAttribute('data-val')) <= val) stars[i].classList.add('active');
          else stars[i].classList.remove('active');
        }
        return;
      }
      var modal = $('reviewModal');
      if (modal && modal.classList.contains('open') && t === modal) closeReviewModal();
    });
  }

  function observeDetailModal() {
    var overlay = $('detailOverlay');
    if (!overlay) return;
    var observer = new MutationObserver(function (mutations) {
      mutations.forEach(function (mutation) {
        if (mutation.attributeName === 'class') {
          if (overlay.classList.contains('open')) {
            setTimeout(function () {
              injectReviewButton();
              injectReviewSection();
              var soft = window.Detail && window.Detail._currentSoft;
              if (soft) loadReviews(soft.id);
            }, 200);
          }
        }
      });
    });
    observer.observe(overlay, { attributes: true });
  }

  /* ========== 全局点击：点击空白处收回排行榜 ========== */
  function onDocClick(e) {
    var t = e.target;
    if (!t) return;

    var rankBtn = t.closest ? t.closest('#rankingBtn') : null;
    if (rankBtn) {
      e.preventDefault();
      e.stopPropagation();
      var pop = $('rankPopover');
      if (pop && pop.classList.contains('open')) closeRanking();
      else openRanking();
      return;
    }

    var closeBtn = t.closest ? t.closest('#rankPopoverClose') : null;
    if (closeBtn) {
      e.preventDefault();
      e.stopPropagation();
      closeRanking();
      return;
    }

    var pop2 = $('rankPopover');
    if (pop2 && pop2.classList.contains('open')) {
      if (t.closest && t.closest('#rankPopover')) return;
      closeRanking();
    }
  }

  function onKeyDown(e) {
    if (e.key !== 'Escape') return;
    var pop = $('rankPopover');
    if (pop && pop.classList.contains('open')) closeRanking();
    var revModal = $('reviewModal');
    if (revModal && revModal.classList.contains('open')) closeReviewModal();
  }

  /* ========== 启动 ========== */
  var started = false;
  function start() {
    if (started) return;
    started = true;
    try { injectStyles(); } catch (e) {}
    try { placeButton(); } catch (e) {}
    try { ensurePopover(); } catch (e) {}
    try { ensureReviewModal(); } catch (e) {}
    try { observeDetailModal(); } catch (e) {}
    try { startProfileWatch(); } catch (e) {}
    try { bindReviewEvents(); } catch (e) {}
    document.addEventListener('click', onDocClick, true);
    document.addEventListener('keydown', onKeyDown, false);
  }

  function boot() {
    start();
    setTimeout(placeButton, 300);
    setTimeout(placeButton, 1200);
    setTimeout(placeButton, 2500);
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', boot);
  } else {
    boot();
  }

  window.RankingModule = { open: openRanking, close: closeRanking, refresh: loadRanking, place: placeButton };
  window.ReviewModule = { open: openReviewModal, close: closeReviewModal, load: loadReviews };
  window.CheckinModule = { doCheckin: doCheckin };
})();
