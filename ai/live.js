/**
 * /ai/ 板块前端实时层（2026-11-03）
 *
 * 为什么需要它：AI 工具/工具集是纯静态页，后台保存后要等 generate.mjs 重跑 + Pages 构建才可见；
 * 而「上传软件」是前端直接读库、秒级生效。这里补上同样的实时性，同时不动静态页（SEO 靠它）。
 *
 * 机制：静态页里带一份「生成时的结构指纹 + 已生成详情页清单」（window.__AI_LIVE__）。
 * 页面加载后再拉一次库，指纹一致就什么都不做（正常浏览零成本）；不一致才用实时数据重绘
 * 侧栏 / 分区 / 卡片列表 / 对比表，新上传的工具立刻出现。
 * 尚未生成静态详情页的工具：卡片点开走页内浮层看完整介绍，避免 404。
 *
 * 两个坑（2026-11-03 实测）：
 * 1) CloudBase 代理对 intro 这类长文本会间歇性截断多字节汉字（返回 U+FFFD，每次坏的位置不同），
 *    所以列表查询刻意不带 intro/screenshots，只在详情页按需单独取，且取到脏数据就不上屏。
 * 2) 给 URL 加 _cb= 之类的自定义参数会被代理直接 400，不能靠它穿透缓存。
 *
 * 维护约定：卡片 / 分区 / 对比表的 class 名必须与 seo/ai-section.mjs 一致（同一套 CSS）。
 */
(function () {
  'use strict';
  var CFG = window.__AI_LIVE__;
  if (!CFG || !CFG.api || !CFG.key) return;

  var H = { apikey: CFG.key, Authorization: 'Bearer ' + CFG.key };
  var API = CFG.api.replace(/\/$/, '') + '/rest/v1/';
  var state = { cols: [], tools: [], byCol: {} };

  /* ---------------- 工具函数 ---------------- */
  function esc(s) {
    return String(s == null ? '' : s)
      .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
  }
  function plain(s) {
    return String(s == null ? '' : s).replace(/<[^>]*>/g, '').replace(/\s+/g, ' ').trim();
  }
  function badCount(s) {
    var n = 0;
    for (var i = 0; i < s.length; i++) if (s.charCodeAt(i) === 0xfffd) n++;
    return n;
  }
  // 拉 JSON：长文本可能带 U+FFFD，重试几次取「最干净」的一份；仍脏就把坏字符剔掉（宁可少字不显示乱码）
  function pull(sql, tries) {
    var best = null, bestBad = Infinity, n = tries || 3;
    function attempt(i) {
      if (i >= n) return Promise.resolve(best);
      return fetch(API + sql, { headers: H }).then(function (r) {
        if (!r.ok) throw new Error(r.status);
        return r.text();
      }).then(function (t) {
        var b = badCount(t);
        if (b < bestBad) { best = t; bestBad = b; }
        if (bestBad === 0) return best;
        return attempt(i + 1);
      }).catch(function () { return attempt(i + 1); });
    }
    return attempt(0).then(function (t) {
      if (!t) return null;
      var dirty = bestBad > 0;
      try { return { rows: JSON.parse(dirty ? t.replace(/\uFFFD+/g, '') : t), dirty: dirty }; }
      catch (e) { return null; }
    });
  }
  function slugOf(t) {
    var s = String(t.slug || '').trim().toLowerCase().replace(/[^a-z0-9-]/g, '').replace(/^-+|-+$/g, '');
    return s || 't-' + String(t.id || '').replace(/-/g, '').slice(0, 8);
  }
  // CFG.tools 里登记过的 slug 才有静态详情页，其余走页内浮层
  function detailUrl(t) {
    return CFG.tools && CFG.tools[slugOf(t)] ? '/ai/tool/' + slugOf(t) + '.html' : '';
  }
  function pricingOf(t) { return String(t.pricing || '免费').trim(); }
  function badgeClass(p) {
    var s = String(p || '');
    if (s.indexOf('免费') >= 0 && s.indexOf('额度') < 0) return 'free';
    if (s.indexOf('订阅') >= 0) return 'sub';
    if (s.indexOf('买断') >= 0) return 'once';
    return 'freemium';
  }
  function mixOf(tools) {
    var seen = {}, out = [];
    tools.forEach(function (t) { var p = pricingOf(t); if (!seen[p]) { seen[p] = 1; out.push(p); } });
    return out;
  }
  function cover(item, cls) {
    var logo = String(item.logo || '').trim();
    if (/^https?:\/\//i.test(logo)) {
      return '<img class="' + cls + '" src="' + esc(logo) + '" alt="' + esc(item.name) + ' 封面" loading="lazy" referrerpolicy="no-referrer" onerror="this.outerHTML=aiFallback(' +
        JSON.stringify(String(item.name || 'AI')).replace(/"/g, '&quot;') + ',\'' + cls + '\')">';
    }
    return window.aiFallback ? window.aiFallback(item.name, cls)
      : '<span class="' + cls + ' ai-cover-fb">' + esc(String(item.name || 'A').slice(0, 1)) + '</span>';
  }

  /* ---------------- 渲染（与静态页同结构） ---------------- */
  function card(t) {
    var href = detailUrl(t);
    var attrs = href ? ' href="' + href + '"' : ' href="#" data-ai-live="' + esc(t.id) + '"';
    return '<a class="ai-card"' + attrs + ' title="' + esc(t.summary || t.name) + '">' +
      cover(t, 'ai-cover') +
      '<span class="ai-card-main"><span class="ai-card-name">' + esc(t.name) + '</span>' +
      '<span class="ai-card-summary">' + esc(t.summary || '') + '</span></span></a>';
  }
  function secLead(c, tools) {
    var mix = mixOf(tools);
    var names = tools.slice(0, 3).map(function (t) { return t.name; }).join('、') + (tools.length > 3 ? ' 等' : '');
    return c.name + '方向目前收录 ' + tools.length + ' 款：' + names + '，收费模式' +
      (mix.length === 1 ? '均为' + mix[0] : '覆盖' + mix.join(' / ')) + '，点工具名可看功能拆解与官网入口。';
  }
  function section(c, tools) {
    if (!tools.length) return '';
    var hasPage = !!(CFG.pages && CFG.pages[c.slug]);
    var shown = hasPage ? tools.slice(0, 9) : tools;
    var logo = /^https?:\/\//i.test(String(c.logo || ''))
      ? '<img class="ai-sec-logo" src="' + esc(c.logo) + '" alt="">'
      : '<span class="ai-sec-ico">' + esc(c.icon || '🧩') + '</span>';
    return '<section class="ai-sec" id="' + esc(c.slug) + '">' +
      '<div class="ai-sec-head">' + logo + '<h2>' + esc(c.name) + '</h2>' +
      '<span class="ai-sec-count">' + tools.length + ' 款</span>' +
      (hasPage ? '<a class="ai-sec-more" href="/ai/' + esc(c.slug) + '.html">查看更多 &gt;&gt;</a>'
               : '<span class="ai-sec-count" style="margin-left:auto">独立页生成中</span>') +
      '</div><p class="ai-sec-lead">' + esc(secLead(c, tools)) + '</p>' +
      '<div class="ai-cards">' + shown.map(card).join('') + '</div></section>';
  }
  function compare(col, tools) {
    if (!tools.length) return '';
    var rows = tools.map(function (t) {
      var href = detailUrl(t);
      var name = href ? '<a href="' + href + '">' + esc(t.name) + '</a>'
                      : '<a href="#" data-ai-live="' + esc(t.id) + '">' + esc(t.name) + '</a>';
      return '<tr><td>' + name + '</td><td>' + esc(plain(t.summary) || '—') + '</td>' +
        '<td><span class="ai-badge ' + badgeClass(t.pricing) + '">' + esc(pricingOf(t)) + '</span></td></tr>';
    }).join('');
    var mix = mixOf(tools);
    var freeish = tools.filter(function (t) { return badgeClass(t.pricing) !== 'sub'; }).length;
    var priceLine = mix.length === 1
      ? '收录的 ' + tools.length + ' 款工具收费模式均为' + mix[0] + '，试用不需要额外付费。'
      : '收费模式分 ' + mix.length + ' 种：' + mix.map(function (m) {
          return m + ' ' + tools.filter(function (t) { return pricingOf(t) === m; }).length + ' 款';
        }).join('、') + '。';
    var pickLine = tools.length > 1
      ? '款数不多但定位差别明显，按「要产出什么」挑一款就够，不必同时订阅两个：' +
        tools.map(function (t) { return plain(t.name) + '（' + (plain(t.summary) || '综合型') + '）'; }).join('；') + '。'
      : '目前只有一款可对照，建议先按免费通道把完整流程跑一遍（注册 → 输入需求 → 导出成品），确认导出格式、分辨率或字数限制够用再考虑付费。';
    var workLine = freeish
      ? '实际使用时的差别通常在导出环节：免费额度多有次数或水印限制，正式产出前先确认导出文件的格式、尺寸与商用授权说明。'
      : '均为订阅制，上手前先确认是否提供试用；团队使用还要看席位计费与素材版权归属。';
    return '<section class="ai-note ai-compare" id="aiCompare"><h2>' + esc(col.name) + '快速对比</h2>' +
      '<table><thead><tr><th>工具</th><th>定位</th><th>收费模式</th></tr></thead><tbody>' + rows + '</tbody></table>' +
      '<p>' + esc(priceLine) + esc(pickLine) + '</p><p>' + esc(workLine) + '</p></section>';
  }
  function findTool(id) {
    for (var i = 0; i < state.tools.length; i++) if (state.tools[i].id === id) return state.tools[i];
    return null;
  }

  /* ---------------- 未生成静态详情页的工具：页内浮层 ---------------- */
  function openLive(id) {
    var t = findTool(id);
    if (!t) return;
    var box = document.getElementById('aiLiveModal');
    if (!box) {
      box = document.createElement('div');
      box.id = 'aiLiveModal';
      box.className = 'ai-live-mask';
      box.innerHTML = '<div class="ai-live-box" role="dialog" aria-modal="true"><button class="ai-live-x" type="button" aria-label="关闭">×</button><div class="ai-live-body"></div></div>';
      document.body.appendChild(box);
      box.addEventListener('click', function (e) {
        if (e.target === box || e.target.className === 'ai-live-x') box.classList.remove('on');
      });
      document.addEventListener('keydown', function (e) { if (e.key === 'Escape') box.classList.remove('on'); });
    }
    var body = box.querySelector('.ai-live-body');
    body.innerHTML = '<div class="ai-detail-head">' + cover(t, 'ai-detail-cover') +
      '<div class="ai-detail-info"><div class="ai-detail-title"><h2>' + esc(t.name) + '</h2>' +
      '<span class="ai-badge ' + badgeClass(t.pricing) + '">' + esc(pricingOf(t)) + '</span></div>' +
      '<p class="ai-card-summary">' + esc(t.summary || '') + '</p>' +
      '<div class="ai-detail-actions"><a class="ai-site-btn" rel="nofollow noopener" target="_blank" href="' + esc(t.url) + '">访问官网 ↗</a></div></div></div>' +
      '<p class="ai-live-tip">详情页正在生成（约 1 分钟），这里先给出录入的内容。</p>';
    box.classList.add('on');
    // 简介单独取：干净才插入，脏的就先不显示（宁缺不糊）
    pullIntro(id).then(function (r) {
      if (!r || r.dirty || !r.rows[0]) return;
      var intro = String(r.rows[0].intro || '').split(/\n\s*\n/)
        .map(function (p) { return p.replace(/\s+/g, ' ').trim(); }).filter(Boolean);
      if (!intro.length) return;
      var sec = document.createElement('section');
      sec.className = 'ai-detail-sec';
      sec.innerHTML = '<h3>' + esc(t.name) + ' 是什么</h3>' +
        intro.map(function (p) { return '<p>' + esc(p) + '</p>'; }).join('');
      body.insertBefore(sec, body.querySelector('.ai-live-tip') || null);
    });
  }

  // intro 单字段按需取。坑（2026-11-03 实测，Node/浏览器一致复现）：
  // 代理对 select=intro 这类小投影响应会「稳定」截断出 U+FFFD（重试、换参数顺序都救不回来），
  // 而 select=* 的整行响应反而干净 —— 单行详情统一拉整行，只取需要的字段。
  function pullIntro(id) {
    return pull('ai_tools?select=*&id=eq.' + encodeURIComponent(id), 2);
  }

  /* ---------------- 详情页：文案改了就地打补丁 ---------------- */
  function patchDetail(slug, onlyIfChanged) {
    var id = CFG.tools && CFG.tools[slug];
    if (!id) return;
    var t = findTool(id);
    if (!t) return;
    var sm = document.querySelector('.ai-detail-info .ai-card-summary');
    if (sm && t.summary) {
      var cur = sm.textContent.replace(/\s+/g, ' ').trim();
      var nxt = String(t.summary).replace(/\s+/g, ' ').trim();
      if (!onlyIfChanged || cur !== nxt) sm.textContent = t.summary;
    }
    var badge = document.querySelector('.ai-detail-title .ai-badge');
    if (badge) {
      var bt = pricingOf(t);
      if (!onlyIfChanged || badge.textContent.trim() !== bt) {
        badge.textContent = bt;
        badge.className = 'ai-badge ' + badgeClass(t.pricing);
      }
    }
    // 详细介绍：intro 段落直接打在左侧介绍卡里（h1/meta 之后、截图之前）
    pullIntro(id).then(function (r) {
      if (!r || r.dirty || !r.rows[0]) return;
      var intro = String(r.rows[0].intro || '').split(/\n\s*\n/)
        .map(function (p) { return p.replace(/\s+/g, ' ').trim(); }).filter(Boolean);
      var card = document.querySelector('.ai-intro-card');
      if (!card) return;
      var oldPs = [];
      for (var k = 0; k < card.children.length; k++) {
        var ch = card.children[k];
        if (ch.tagName === 'P' && !ch.className) oldPs.push(ch);
      }
      var curIntro = '';
      oldPs.forEach(function (p) { curIntro += p.textContent.replace(/\s+/g, ''); });
      var nxtIntro = intro.join('').replace(/\s+/g, '');
      if (onlyIfChanged && curIntro === nxtIntro) return;
      if (!intro.length && !oldPs.length) return;
      if (!intro.length) return;
      oldPs.forEach(function (p) { p.parentNode.removeChild(p); });
      var frag = document.createDocumentFragment();
      intro.forEach(function (p) {
        var el = document.createElement('p');
        el.textContent = p;
        frag.appendChild(el);
      });
      var anchor = card.querySelector('.ai-detail-meta, .ai-shots');
      if (anchor) card.insertBefore(frag, anchor);
      else {
        var h1 = card.querySelector('h1');
        if (h1 && h1.nextSibling) card.insertBefore(frag, h1.nextSibling);
        else card.appendChild(frag);
      }
    });
  }

  /* ---------------- 主流程 ---------------- */
  // 指纹只认结构字段（新增/删除/排序/上下架/收费模式），与 seo/ai-section.mjs 的 aiSig() 一致。
  // 刻意不含文本：传输抖动会让文本每次不一样，一旦参与指纹就永远判「变了」。
  function sig(cols, tools) {
    function cmp(x, y) {
      var a = x.sort || 0, b = y.sort || 0;
      if (a !== b) return a - b;
      return String(x.id) < String(y.id) ? -1 : String(x.id) > String(y.id) ? 1 : 0;
    }
    var s = cols.slice().sort(cmp).map(function (c) {
      return [c.id, c.slug, c.sort, c.is_published].join('|');
    }).join('~') + '#' + tools.slice().sort(cmp).map(function (t) {
      return [t.id, t.collection_id, t.sort, t.is_published, t.pricing, t.slug].join('|');
    }).join('~');
    var h = 5381;
    for (var i = 0; i < s.length; i++) h = ((h << 5) + h + s.charCodeAt(i)) >>> 0;
    return h.toString(36) + '-' + s.length;
  }

  function render() {
    var path = location.pathname;
    var m = path.match(/^\/ai\/tool\/([a-z0-9-]+)\.html$/);
    if (m) { patchDetail(m[1], false); return; }
    var active = (path.match(/^\/ai\/([a-z0-9-]+)\.html$/) || [])[1] || '';

    var hub = document.getElementById('aiHubBody');
    if (hub) hub.innerHTML = state.cols.map(function (c) { return section(c, state.byCol[c.slug] || []); }).join('');

    var cards = document.getElementById('aiColCards');
    if (cards) {
      var col = null;
      for (var i = 0; i < state.cols.length; i++) if (state.cols[i].slug === active) col = state.cols[i];
      if (col) {
        var list = state.byCol[col.slug] || [];
        if (list.length) {
          cards.className = 'ai-cards';
          cards.innerHTML = list.map(card).join('');
        }
        var cmp = document.getElementById('aiCompare');
        if (cmp && list.length) cmp.outerHTML = compare(col, list);
      }
    }
    document.addEventListener('click', function (e) {
      var a = e.target.closest ? e.target.closest('[data-ai-live]') : null;
      if (a) { e.preventDefault(); openLive(a.getAttribute('data-ai-live')); }
    });
  }

  if (CFG.sig && sessionStorage.getItem('ai-live-sig') === CFG.sig) return;

  // 列表只取卡片要用的短字段；intro/screenshots 这类长文本按需单独取（见文件头注释）
  Promise.all([
    pull('ai_collections?select=id,slug,name,description,logo,icon,sort,is_published&order=sort.asc,created_at.asc'),
    pull('ai_tools?select=id,collection_id,name,url,summary,tags,pricing,sort,slug,is_published,logo,icon&order=sort.asc,created_at.asc')
  ]).then(function (r) {
    if (!r[0] || !r[1]) return; // 拉不动就保留静态页，不影响阅读
    var cols = r[0].rows.filter(function (c) { return c.is_published !== false && c.slug && c.name; })
      .sort(function (a, b) { return (a.sort || 0) - (b.sort || 0); });
    var tools = r[1].rows.filter(function (t) { return t.is_published !== false && t.name && t.url; });
    state.cols = cols;
    state.tools = tools;
    state.byCol = {};
    cols.forEach(function (c) { state.byCol[c.slug] = []; });
    tools.forEach(function (t) {
      for (var i = 0; i < cols.length; i++) {
        if (cols[i].id === t.collection_id) { state.byCol[cols[i].slug].push(t); break; }
      }
    });
    cols.forEach(function (c) {
      state.byCol[c.slug].sort(function (a, b) { return (a.sort || 0) - (b.sort || 0); });
    });

    var now = sig(cols, tools);
    window.__AI_LIVE_SIG__ = now; // 自检：与页面 CFG.sig 相等说明静态页已是最新
    window.__AI_LIVE_CLEAN__ = !r[0].dirty && !r[1].dirty;
    if (CFG.sig && now === CFG.sig) {
      sessionStorage.setItem('ai-live-sig', now);
      var m = location.pathname.match(/^\/ai\/tool\/([a-z0-9-]+)\.html$/);
      if (m) patchDetail(m[1], true);
      return;
    }
    render();
  });
})();
