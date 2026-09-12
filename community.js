console.log('community.js v6 loaded');

(function () {
  'use strict';

  function $(id) { return document.getElementById(id); }

  function esc(s) {
    if (s === null || s === undefined) return '';
    var d = document.createElement('div');
    d.textContent = String(s);
    return d.innerHTML;
  }

  function escA(s) {
    if (s === null || s === undefined) return '';
    return String(s)
      .replace(/&/g, '&amp;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;');
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

  function injectStyles() {
    if ($('rankingModuleStyles')) return;
    var st = document.createElement('style');
    st.id = 'rankingModuleStyles';
    st.textContent =
      '.ranking-item{display:flex;align-items:center;gap:12px;padding:10px 12px;' +
      'border-bottom:1px solid var(--border-glow);cursor:pointer;transition:background .2s;}' +
      '.ranking-item:last-child{border-bottom:none;}' +
      '.ranking-item:hover{background:rgba(0,119,255,0.04);}' +
      '.ranking-item .rank-num{font-size:1.1rem;font-weight:700;width:32px;' +
      'text-align:center;flex-shrink:0;}' +
      '.ranking-item .rank-info{flex:1;min-width:0;}' +
      '.ranking-item .rank-title{font-size:0.85rem;font-weight:600;' +
      'color:var(--text-primary);white-space:nowrap;overflow:hidden;text-overflow:ellipsis;}' +
      '.ranking-item .rank-meta{font-size:0.65rem;color:var(--text-dim);' +
      'display:flex;gap:8px;margin-top:2px;}' +
      '.review-star{cursor:pointer;transition:color .2s;}' +
      '.review-star.active{color:#f39c12;}';
    document.head.appendChild(st);
  }

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
      btn.title = '社区排行榜';
      btn.innerHTML = '<i class="fas fa-trophy"></i>';
    }

    if (wechat) {
      if (btn.parentNode !== box || btn.nextElementSibling !== wechat) {
        box.insertBefore(btn, wechat);
      }
    } else {
      if (btn.parentNode !== box) {
        box.insertBefore(btn, box.firstChild);
      }
    }
  }

  function ensureRankingModal() {
    var modal = $('rankingModal');
    if (modal) return modal;

    modal = document.createElement('div');
    modal.className = 'modal-overlay';
    modal.id = 'rankingModal';
    modal.innerHTML =
      '<div class="modal-box" style="max-width:520px;padding:0;overflow:hidden;">' +
        '<div style="background:var(--accent-gradient);padding:20px 24px;color:#fff;' +
        'display:flex;align-items:center;gap:10px;">' +
          '<i class="fas fa-trophy" style="font-size:1.4rem;"></i>' +
          '<h3 style="margin:0;font-size:1.2rem;font-weight:700;color:#fff;">社区排行榜</h3>' +
          '<button class="close-btn" id="rankingModalClose" style="float:none;' +
          'margin-left:auto;color:rgba(255,255,255,0.8);font-size:1.5rem;' +
          'background:none;border:none;cursor:pointer;">&times;</button>' +
        '</div>' +
        '<div id="rankingList" style="max-height:60vh;overflow-y:auto;' +
        'scrollbar-width:thin;scrollbar-color:rgba(0,119,255,0.2) transparent;' +
        'padding:4px 0;"></div>' +
        '<div class="form-actions" style="padding:12px 24px 16px;' +
        'border-top:1px solid var(--border-glow);">' +
          '<button class="btn btn-outline" id="rankingModalCloseBtn">关闭</button>' +
        '</div>' +
      '</div>';
    document.body.appendChild(modal);
    return modal;
  }

  function openRanking() {
    ensureRankingModal().classList.add('open');
    loadRanking();
  }

  function closeRanking() {
    var m = $('rankingModal');
    if (m) m.classList.remove('open');
  }

  function loadRanking() {
    var box = $('rankingList');
    if (!box) return;

    var sb = getClient();
    if (!sb) {
      box.innerHTML = '<p style="color:var(--text-dim);text-align:center;padding:24px;">服务未加载，请稍后重试</p>';
      return;
    }

    box.innerHTML = '<p style="color:var(--text-dim);text-align:center;padding:24px;">加载中...</p>';

    sb.from('software')
      .select('*')
      .order('views', { ascending: false })
      .limit(10)
      .then(function (res) {
        if (res.error) {
          box.innerHTML = '<p style="color:var(--text-dim);text-align:center;padding:24px;">加载失败，请稍后重试</p>';
          return;
        }
        var list = res.data || [];
        if (list.length === 0) {
          box.innerHTML = '<p style="color:var(--text-dim);text-align:center;padding:24px;">暂无排行数据，请先添加软件</p>';
          return;
        }
        var html = '';
        for (var i = 0; i < list.length; i++) {
          var it = list[i];
          var medal = '#' + (i + 1);
          if (i === 0) medal = '🥇';
          else if (i === 1) medal = '🥈';
          else if (i === 2) medal = '🥉';
          html +=
            '<div class="ranking-item" data-id="' + escA(it.id) + '">' +
              '<span class="rank-num">' + medal + '</span>' +
              '<div class="rank-info">' +
                '<div class="rank-title">' + esc(it.name) + '</div>' +
                '<div class="rank-meta">' +
                  '<span>' + esc(it.category) + '</span>' +
                  '<span>👁 ' + (it.views || 0) + '</span>' +
                  '<span>⬇ ' + (it.downloads || 0) + '</span>' +
                '</div>' +
              '</div>' +
            '</div>';
        }
        box.innerHTML = html;

        var items = box.querySelectorAll('.ranking-item');
        for (var j = 0; j < items.length; j++) {
          items[j].addEventListener('click', function () {
            var sid = this.getAttribute('data-id');
            closeRanking();
            if (window.Detail && typeof window.Detail.openById === 'function') {
              window.Detail.openById(sid);
            }
          });
        }
      })
      .catch(function () {
        box.innerHTML = '<p style="color:var(--text-dim);text-align:center;padding:24px;">网络异常，请稍后重试</p>';
      });
  }

  function injectReviewButton() {
    var actions = document.querySelector('.detail-actions');
    if (!actions) return;
    if (document.getElementById('softwareReviewBtn')) return;

    var btn = document.createElement('button');
    btn.className = 'btn btn-outline';
    btn.id = 'softwareReviewBtn';
    btn.innerHTML = '<i class="fas fa-star"></i> 评价';
    btn.style.marginLeft = '6px';
    btn.onclick = function () {
      var soft = window.Detail && window.Detail._currentSoft;
      if (!soft) { if (window.toast) window.toast('无法获取软件信息', 'warning'); return; }
      openReviewModal(soft);
    };
    actions.appendChild(btn);
  }

  function injectReviewSection() {
    var modalBody = document.querySelector('.detail-modal .modal-body');
    if (!modalBody) return;
    if (document.getElementById('detailReviews')) return;

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
        if (res.error) {
          container.innerHTML = '暂无评价，来写第一条吧！';
          return;
        }
        var list = res.data || [];
        if (list.length === 0) {
          container.innerHTML = '暂无评价，来写第一条吧！';
          return;
        }
        var html = '';
        for (var i = 0; i < list.length; i++) {
          var r = list[i];
          var stars = '';
          for (var s = 1; s <= 5; s++) {
            stars += s <= (r.rating || 5) ? '★' : '☆';
          }
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
      .catch(function () {
        container.innerHTML = '评价加载异常';
      });
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
    for (var i = 0; i < stars.length; i++) {
      stars[i].classList.remove('active');
    }
  }

  function closeReviewModal() {
    var modal = $('reviewModal');
    if (modal) modal.classList.remove('open');
  }

  function submitReview() {
    if (!currentReviewSoftware) return;
    var sb = getClient();
    if (!sb) { if (window.toast) window.toast('服务未加载', 'error'); return; }

    var user = window.currentUser;
    if (!user) {
      if (window.toast) window.toast('请先登录', 'warning');
      closeReviewModal();
      if ($('loginModal')) $('loginModal').classList.add('open');
      return;
    }

    var activeStar = document.querySelector('.review-star.active');
    var rating = activeStar ? parseInt(activeStar.getAttribute('data-val')) : 5;
    var content = $('reviewContent').value.trim();

    if (!content) {
      if (window.toast) window.toast('请填写评价内容', 'warning');
      return;
    }

    var userName = user.email ? user.email.split('@')[0] : '匿名用户';

    sb.from('software_reviews').insert([{
      software_id: currentReviewSoftware.id,
      user_id: user.id,
      user_name: userName,
      rating: rating,
      content: content
    }]).then(function (res) {
      if (res.error) {
        if (window.toast) window.toast('评价失败: ' + res.error.message, 'error');
        return;
      }
      if (window.toast) window.toast('评价成功！', 'success');
      closeReviewModal();
      loadReviews(currentReviewSoftware.id);
    });
  }

  function bindReviewEvents() {
    document.addEventListener('click', function (e) {
      var t = e.target;
      if (!t) return;

      if (t.closest('#reviewModalClose') || t.closest('#reviewCancel')) {
        closeReviewModal();
        return;
      }

      if (t.closest('#reviewSubmit')) {
        submitReview();
        return;
      }

      if (t.classList.contains('review-star')) {
        var val = parseInt(t.getAttribute('data-val'));
        var stars = document.querySelectorAll('.review-star');
        for (var i = 0; i < stars.length; i++) {
          if (parseInt(stars[i].getAttribute('data-val')) <= val) {
            stars[i].classList.add('active');
          } else {
            stars[i].classList.remove('active');
          }
        }
        return;
      }

      var modal = $('reviewModal');
      if (modal && modal.classList.contains('open') && t === modal) {
        closeReviewModal();
      }
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

  function onClickCapture(e) {
    var t = e.target;
    if (!t || !t.closest) return;

    if (t.closest('#rankingBtn')) {
      e.preventDefault();
      e.stopPropagation();
      openRanking();
      return;
    }

    if (t.closest('#rankingModalClose') || t.closest('#rankingModalCloseBtn')) {
      e.preventDefault();
      e.stopPropagation();
      closeRanking();
      return;
    }

    var modal = $('rankingModal');
    if (modal && modal.classList.contains('open') && t === modal) {
      closeRanking();
    }
  }

  function onKeyDown(e) {
    if (e.key !== 'Escape') return;
    var rModal = $('rankingModal');
    if (rModal && rModal.classList.contains('open')) closeRanking();
    var revModal = $('reviewModal');
    if (revModal && revModal.classList.contains('open')) closeReviewModal();
  }

  var started = false;
  function start() {
    if (started) return;
    started = true;
    try { injectStyles(); } catch (e) {}
    try { placeButton(); } catch (e) {}
    try { ensureRankingModal(); } catch (e) {}
    try { ensureReviewModal(); } catch (e) {}
    try { observeDetailModal(); } catch (e) {}
    try { bindReviewEvents(); } catch (e) {}
    document.addEventListener('click', onClickCapture, true);
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

  window.RankingModule = {
    open: openRanking,
    close: closeRanking,
    refresh: loadRanking,
    place: placeButton
  };

  window.ReviewModule = {
    open: openReviewModal,
    close: closeReviewModal,
    load: loadReviews
  };
})();
