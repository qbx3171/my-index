(function () {
  'use strict';

  var SUPABASE_URL_FALLBACK = 'https://qqcxtfayjxyvswblmdpw.supabase.co';
  var SUPABASE_ANON_KEY_FALLBACK = 'sb_publishable__KOJGRcvoRGC3QiHNg7_qA_-9yGsnCW';

  function getSupabaseClient() {
    if (window.supabaseClient) return window.supabaseClient;
    if (typeof supabase !== 'undefined') {
      var url = window.SUPABASE_URL || SUPABASE_URL_FALLBACK;
      var key = window.SUPABASE_ANON_KEY || SUPABASE_ANON_KEY_FALLBACK;
      try {
        window.supabaseClient = supabase.createClient(url, key);
        return window.supabaseClient;
      } catch (e) {
        return null;
      }
    }
    return null;
  }

  function escapeHtml(text) {
    if (text === null || text === undefined) return '';
    var d = document.createElement('div');
    d.textContent = String(text);
    return d.innerHTML;
  }

  function escapeAttr(str) {
    if (str === null || str === undefined) return '';
    return String(str)
      .replace(/&/g, '&amp;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;');
  }

  function ensureRankingButton() {
    var shareFloat = document.getElementById('shareFloat');
    if (!shareFloat) return null;

    var wechatBtn = null;
    var allLinks = shareFloat.querySelectorAll('a');
    for (var i = 0; i < allLinks.length; i++) {
      var title = allLinks[i].getAttribute('title') || '';
      var onclick = allLinks[i].getAttribute('onclick') || '';
      if (title.indexOf('微信') !== -1 || onclick.indexOf('wechat') !== -1) {
        wechatBtn = allLinks[i];
        break;
      }
    }

    var rankingBtn = document.getElementById('rankingBtn');

    if (!rankingBtn) {
      rankingBtn = document.createElement('a');
      rankingBtn.href = '#';
      rankingBtn.id = 'rankingBtn';
      rankingBtn.title = '社区排行榜';
      rankingBtn.innerHTML = '<i class="fas fa-trophy"></i>';
    }

    if (wechatBtn && wechatBtn !== rankingBtn) {
      if (rankingBtn.parentNode !== shareFloat || rankingBtn.nextSibling !== wechatBtn) {
        shareFloat.insertBefore(rankingBtn, wechatBtn);
      }
    } else if (rankingBtn.parentNode !== shareFloat) {
      shareFloat.insertBefore(rankingBtn, shareFloat.firstChild);
    }

    return rankingBtn;
  }

  function ensureRankingModal() {
    var modal = document.getElementById('rankingModal');
    if (modal) return modal;

    modal = document.createElement('div');
    modal.className = 'modal-overlay';
    modal.id = 'rankingModal';
    modal.innerHTML =
      '<div class="modal-box" style="max-width:520px;padding:0;overflow:hidden;">' +
        '<div style="background:var(--accent-gradient);padding:20px 24px;color:#fff;display:flex;align-items:center;gap:10px;">' +
          '<i class="fas fa-trophy" style="font-size:1.4rem;"></i>' +
          '<h3 style="margin:0;font-size:1.2rem;font-weight:700;color:#fff;">社区排行榜</h3>' +
          '<button class="close-btn" id="rankingModalClose" style="float:none;margin-left:auto;color:rgba(255,255,255,0.8);font-size:1.5rem;background:none;border:none;cursor:pointer;">&times;</button>' +
        '</div>' +
        '<div id="rankingList" style="max-height:60vh;overflow-y:auto;scrollbar-width:thin;scrollbar-color:rgba(0,119,255,0.2) transparent;padding:4px 0;"></div>' +
        '<div class="form-actions" style="padding:12px 24px 16px;border-top:1px solid var(--border-glow);">' +
          '<button class="btn btn-outline" id="rankingModalCloseBtn">关闭</button>' +
        '</div>' +
      '</div>';
    document.body.appendChild(modal);
    return modal;
  }

  function openRanking() {
    var modal = ensureRankingModal();
    if (!modal) return;
    modal.classList.add('open');
    loadRankingData();
  }

  function closeRanking() {
    var modal = document.getElementById('rankingModal');
    if (modal) modal.classList.remove('open');
  }

  function loadRankingData() {
    var container = document.getElementById('rankingList');
    if (!container) return;

    var sb = getSupabaseClient();
    if (!sb) {
      container.innerHTML = '<p style="color:var(--text-dim);text-align:center;padding:24px;">服务未加载，请稍后重试</p>';
      return;
    }

    container.innerHTML = '<p style="color:var(--text-dim);text-align:center;padding:24px;">加载中...</p>';

    sb.from('questions')
      .select('*')
      .order('votes', { ascending: false })
      .limit(10)
      .then(function (res) {
        if (res.error) {
          container.innerHTML = '<p style="color:var(--text-dim);text-align:center;padding:24px;">加载失败</p>';
          return;
        }
        var data = res.data || [];
        if (data.length === 0) {
          container.innerHTML = '<p style="color:var(--text-dim);text-align:center;padding:24px;">暂无排行数据</p>';
          return;
        }
        var html = '';
        data.forEach(function (q, i) {
          var medal = '#' + (i + 1);
          if (i === 0) medal = '🥇';
          else if (i === 1) medal = '🥈';
          else if (i === 2) medal = '🥉';
          html +=
            '<div class="ranking-item" data-id="' + escapeAttr(q.id) + '">' +
              '<span class="rank-num">' + medal + '</span>' +
              '<div class="rank-info">' +
                '<div class="rank-title">' + escapeHtml(q.title) + '</div>' +
                '<div class="rank-meta">' +
                  '<span>' + escapeHtml(q.category) + '</span>' +
                  '<span>👍 ' + (q.votes || 0) + '</span>' +
                  '<span>💬 ' + (q.answers_count || 0) + '</span>' +
                '</div>' +
              '</div>' +
            '</div>';
        });
        container.innerHTML = html;

        container.querySelectorAll('.ranking-item').forEach(function (el) {
          el.addEventListener('click', function () {
            var id = this.dataset.id;
            closeRanking();
            if (window.App && typeof window.App.goQA === 'function') {
              window.App.goQA();
            }
            setTimeout(function () {
              if (typeof window.showQuestionDetail === 'function') {
                window.showQuestionDetail(id);
              }
            }, 400);
          });
        });
      })
      .catch(function () {
        container.innerHTML = '<p style="color:var(--text-dim);text-align:center;padding:24px;">网络异常，请稍后重试</p>';
      });
  }

  var bindingsInstalled = false;

  function installBindings() {
    if (bindingsInstalled) return;
    bindingsInstalled = true;

    var modal = ensureRankingModal();

    document.addEventListener('click', function (e) {
      var rankingBtn = e.target.closest && e.target.closest('#rankingBtn');
      if (rankingBtn) {
        e.preventDefault();
        e.stopPropagation();
        openRanking();
        return;
      }

      var closeBtn = e.target.closest && e.target.closest('#rankingModalClose, #rankingModalCloseBtn');
      if (closeBtn) {
        e.preventDefault();
        e.stopPropagation();
        closeRanking();
        return;
      }

      if (modal && e.target === modal) {
        closeRanking();
      }
    }, true);

    document.addEventListener('keydown', function (e) {
      if (e.key === 'Escape') {
        var m = document.getElementById('rankingModal');
        if (m && m.classList.contains('open')) {
          closeRanking();
        }
      }
    });
  }

  function init() {
    ensureRankingButton();
    ensureRankingModal();
    installBindings();
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }

  window.RankingModule = {
    open: openRanking,
    close: closeRanking,
    load: loadRankingData
  };
})();
