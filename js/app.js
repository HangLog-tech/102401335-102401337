/*
 * app.js —— 界面层：hash 路由 + 页面渲染 + 事件绑定
 * 页面结构严格对照结对作业① Figma 原型（蓝色主题）：
 *   首页 / 发布信息 / 搜索结果(含空状态) / 物品详情 / 我的发布
 * 依赖 core.js (LAFCore) 与 data.js (LAFData)。
 */
(function () {
  'use strict';

  var Core = window.LAFCore;
  var Data = window.LAFData;

  var app = document.getElementById('app');
  var items = Data.loadItems();
  var user = Data.loadUser();
  var pendingImage = null; // 发布页暂存的照片 dataURL

  /* ---------------- 工具 ---------------- */

  function esc(s) {
    return String(s == null ? '' : s)
      .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;').replace(/'/g, '&#39;');
  }

  function highlight(text, keyword) {
    var t = esc(text);
    var k = (keyword || '').trim();
    if (!k) return t;
    var idx = text.toLowerCase().indexOf(k.toLowerCase());
    if (idx === -1) return t;
    return esc(text.slice(0, idx)) + '<mark>' + esc(text.slice(idx, idx + k.length)) + '</mark>' + esc(text.slice(idx + k.length));
  }

  function pad2(n) { return n < 10 ? '0' + n : '' + n; }

  function fmtDateTime(ts) {
    var d = new Date(ts);
    return d.getFullYear() + '-' + pad2(d.getMonth() + 1) + '-' + pad2(d.getDate()) +
      ' ' + pad2(d.getHours()) + ':' + pad2(d.getMinutes());
  }

  function toast(msg) {
    var el = document.getElementById('toast');
    el.textContent = msg;
    el.classList.add('show');
    clearTimeout(el._timer);
    el._timer = setTimeout(function () { el.classList.remove('show'); }, 2000);
  }

  function copyText(text) {
    if (navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard.writeText(text).then(function () {
        toast('联系方式已复制：' + text);
      }, function () { legacyCopy(text); });
    } else {
      legacyCopy(text);
    }
  }

  function legacyCopy(text) {
    var ta = document.createElement('textarea');
    ta.value = text;
    ta.style.position = 'fixed';
    ta.style.opacity = '0';
    document.body.appendChild(ta);
    ta.select();
    try { document.execCommand('copy'); toast('联系方式已复制：' + text); }
    catch (e) { toast('复制失败，请手动记录：' + text); }
    document.body.removeChild(ta);
  }

  function findItem(id) {
    for (var i = 0; i < items.length; i++) if (items[i].id === id) return items[i];
    return null;
  }

  function save() { Data.saveItems(items); }

  function isMine(item) { return item.owner === user.name; }

  /* ---------------- 路由 ---------------- */

  function route() {
    var hash = location.hash || '#/home';
    var parts = hash.replace(/^#\//, '').split('/');
    var page = parts[0] || 'home';
    window.scrollTo(0, 0);
    if (page !== 'publish') pendingImage = null;

    if (page === 'home') renderHome();
    else if (page === 'search') renderSearch();
    else if (page === 'publish') renderPublish();
    else if (page === 'success') renderSuccess(parts[1]);
    else if (page === 'detail') renderDetail(parts[1]);
    else if (page === 'mine') renderMine();
    else renderHome();
  }

  /* ---------------- 公共片段（与原型一致） ---------------- */

  function navHTML(title, backHref) {
    return '<div class="nav">' +
      '<a class="nav-back" href="' + backHref + '">‹</a>' +
      '<div class="nav-title">' + esc(title) + '</div>' +
      '<div class="capsule"><span>•••</span><span class="sep"></span><span>◉</span></div>' +
    '</div>';
  }

  function typeLabel(item) {
    return '<span class="type-label ' + item.type + '">' +
      (item.type === 'lost' ? '寻物启事' : '招领') + '</span>';
  }

  function statusPill(item) {
    if (item.status === 'done') {
      return '<span class="status-pill done">' + Core.doneLabel(item.type) + '</span>';
    }
    return '<span class="status-pill open">' + (item.type === 'lost' ? '寻找中' : '待认领') + '</span>';
  }

  function thumbHTML(item) {
    return '<div class="thumb-box">' +
      (item.image ? '<img src="' + item.image + '" alt="">' : (Core.CATEGORY_EMOJI[item.category] || '📦')) +
    '</div>';
  }

  function metaLines(item, keyword) {
    var locLabel = item.type === 'found' ? '拾获地点' : '丢失地点';
    return '<div class="card-meta"><span class="mk">📍</span>' + locLabel + '：' + highlight(item.location, keyword) + '</div>' +
      '<div class="card-meta"><span class="mk">🕒</span>发布时间：' + fmtDateTime(item.createdAt) + '</div>';
  }

  function cardHTML(item, keyword) {
    return '<div class="info-card" data-id="' + item.id + '">' +
      thumbHTML(item) +
      '<div class="card-main">' +
        '<div class="card-head">' + typeLabel(item) + statusPill(item) + '</div>' +
        '<div class="card-name">' + highlight(item.title, keyword) + '</div>' +
        metaLines(item, keyword) +
      '</div>' +
    '</div>';
  }

  function emptyHTML(icon, text, sub, withPublishBtn) {
    return '<div class="empty"><div class="empty-icon">' + icon + '</div>' +
      '<div class="empty-text">' + esc(text) + '</div>' +
      (sub ? '<div class="empty-sub">' + esc(sub) + '</div>' : '') +
      (withPublishBtn ? '<a class="btn-primary" href="#/publish">去发布</a>' : '') +
    '</div>';
  }

  function bindCards(container) {
    var cards = container.querySelectorAll('.info-card');
    Array.prototype.forEach.call(cards, function (c) {
      c.addEventListener('click', function () {
        location.hash = '#/detail/' + c.getAttribute('data-id');
      });
    });
  }

  function tabbarHTML(active) {
    return '<div class="tabbar">' +
      '<a class="tabbar-item' + (active === 'home' ? ' active' : '') + '" href="#/home"><span class="tabbar-icon">🏠</span>首页</a>' +
      '<a class="tabbar-item" href="#/publish"><span class="tabbar-plus">＋</span><span>发布</span></a>' +
      '<a class="tabbar-item' + (active === 'mine' ? ' active' : '') + '" href="#/mine"><span class="tabbar-icon">👤</span>我的发布</a>' +
    '</div>';
  }

  /* ---------------- 首页 ---------------- */

  function renderHome() {
    var tab = sessionStorage.getItem('laf_tab') || 'lost'; // 原型默认“寻物启事”
    var cat = sessionStorage.getItem('laf_home_cat') || '';
    var filtered = Core.filterItems(items, { type: tab, category: cat });
    filtered = Core.sortByTimeDesc(filtered);

    var listHTML = filtered.length
      ? filtered.map(function (i) { return cardHTML(i); }).join('')
      : emptyHTML('🗂️', '这里还没有信息', '点击底部“发布”写下第一条吧');

    app.innerHTML =
      navHTML('校园失物招领', '#/home') +
      '<div class="search-wrap"><div class="search-bar" id="searchEntry">' +
        '<span class="icon">🔍</span><span style="color:#999;font-size:14px;flex:1">请输入物品名称、地点</span>' +
      '</div></div>' +
      '<div class="type-tabs">' +
        '<button class="type-tab' + (tab === 'lost' ? ' active' : '') + '" data-tab="lost">寻物启事</button>' +
        '<button class="type-tab' + (tab === 'found' ? ' active' : '') + '" data-tab="found">招领信息</button>' +
      '</div>' +
      '<div class="chips" id="catChips">' +
        '<button class="chip' + (cat === '' ? ' active' : '') + '" data-cat="">全部</button>' +
        Core.CATEGORIES.map(function (c) {
          return '<button class="chip' + (cat === c ? ' active' : '') + '" data-cat="' + c + '">' + c + '</button>';
        }).join('') +
      '</div>' +
      '<div class="list" id="homeList">' + listHTML + '</div>' +
      tabbarHTML('home');

    document.getElementById('searchEntry').addEventListener('click', function () {
      location.hash = '#/search';
    });
    Array.prototype.forEach.call(app.querySelectorAll('.type-tab'), function (t) {
      t.addEventListener('click', function () {
        sessionStorage.setItem('laf_tab', t.getAttribute('data-tab'));
        renderHome();
      });
    });
    Array.prototype.forEach.call(app.querySelectorAll('#catChips .chip'), function (chip) {
      chip.addEventListener('click', function () {
        sessionStorage.setItem('laf_home_cat', chip.getAttribute('data-cat'));
        renderHome();
      });
    });
    bindCards(document.getElementById('homeList'));
  }

  /* ---------------- 搜索页 ---------------- */

  var lastSearch = { keyword: '', type: '', category: '' };

  function renderSearch() {
    app.innerHTML =
      navHTML('校园失物招领', '#/home') +
      '<div class="search-wrap"><div class="search-bar">' +
        '<span class="icon">🔍</span>' +
        '<input id="kwInput" type="text" placeholder="请输入物品名称、地点" value="' + esc(lastSearch.keyword) + '">' +
        '<span class="search-clear" id="kwClear"' + (lastSearch.keyword ? '' : ' style="display:none"') + '>✕</span>' +
      '</div></div>' +
      '<div class="chips" id="filterChips">' +
        chip('type', '', '全部', lastSearch.type) +
        chip('type', 'lost', '寻物', lastSearch.type) +
        chip('type', 'found', '招领', lastSearch.type) +
        chip('category', '', '全部分类', lastSearch.category) +
        Core.CATEGORIES.map(function (c) { return chip('category', c, c, lastSearch.category); }).join('') +
      '</div>' +
      '<div class="list" id="searchList"></div>' +
      tabbarHTML('home');

    function chip(kind, value, label, activeVal) {
      return '<button class="chip' + (activeVal === value ? ' active' : '') + '" data-kind="' + kind + '" data-val="' + value + '">' + label + '</button>';
    }

    function doSearch() {
      lastSearch.keyword = document.getElementById('kwInput').value;
      var filtered = Core.filterItems(items, {
        keyword: lastSearch.keyword,
        type: lastSearch.type,
        category: lastSearch.category
      });
      filtered = Core.sortByTimeDesc(filtered);
      var box = document.getElementById('searchList');
      box.innerHTML = filtered.length
        ? '<div class="result-count">找到了 ' + filtered.length + ' 条相关信息</div>' +
          filtered.map(function (i) { return cardHTML(i, lastSearch.keyword); }).join('')
        : emptyHTML('📄🔍', '暂未找到相关物品', '可以发布一条寻物信息', true);
      document.getElementById('kwClear').style.display = lastSearch.keyword ? '' : 'none';
      bindCards(box);
    }

    document.getElementById('kwInput').addEventListener('keydown', function (e) {
      if (e.key === 'Enter') doSearch();
    });
    document.getElementById('kwClear').addEventListener('click', function () {
      document.getElementById('kwInput').value = '';
      doSearch();
    });
    Array.prototype.forEach.call(app.querySelectorAll('.chip'), function (c) {
      c.addEventListener('click', function () {
        var kind = c.getAttribute('data-kind');
        lastSearch[kind] = c.getAttribute('data-val');
        Array.prototype.forEach.call(app.querySelectorAll('.chip[data-kind="' + kind + '"]'), function (x) {
          x.classList.toggle('active', x === c);
        });
        doSearch();
      });
    });
    doSearch();
  }

  /* ---------------- 发布页 ---------------- */

  function renderPublish() {
    var pubType = sessionStorage.getItem('laf_pub_type') || 'lost';
    var locLabel = pubType === 'found' ? '拾获地点' : '丢失地点';
    var timeLabel = pubType === 'found' ? '拾获时间' : '丢失时间';

    app.innerHTML =
      navHTML('发布信息', '#/home') +
      '<form class="form" id="pubForm" novalidate>' +
        '<div class="form-item"><label>信息类型</label>' +
          '<div class="radio-row">' +
            '<label class="radio-item"><input type="radio" name="ptype" value="lost"' + (pubType === 'lost' ? ' checked' : '') + '>寻物</label>' +
            '<label class="radio-item"><input type="radio" name="ptype" value="found"' + (pubType === 'found' ? ' checked' : '') + '>招领</label>' +
          '</div>' +
        '</div>' +
        formItem('物品名称', '<input id="fTitle" type="text" maxlength="20" placeholder="请输入物品名称，例如：校园卡、雨伞、耳机…">', false) +
        formItem('物品类别', '<select id="fCat"><option value="">请选择物品类别</option>' +
          Core.CATEGORIES.map(function (c) { return '<option>' + c + '</option>'; }).join('') + '</select>', false) +
        formItem(locLabel, '<input id="fLoc" type="text" maxlength="30" placeholder="请输入' + locLabel + '">', false) +
        formItem(timeLabel, '<input id="fTime" type="date" max="' + today() + '">', false) +
        '<div class="form-item"><label>详细描述<span class="opt">（选填）</span></label>' +
          '<textarea id="fDesc" rows="3" maxlength="200" placeholder="请详细描述物品的特征、颜色、品牌等信息"></textarea>' +
          '<div class="counter"><span id="descCount">0</span>/200</div>' +
          '<div class="err"></div>' +
        '</div>' +
        formItem('联系方式', '<input id="fContact" type="text" maxlength="50" placeholder="请输入您的手机号或微信号">', false) +
        '<div class="form-item"><label>图片上传<span class="opt">（选填）</span></label>' +
          '<div class="photo-box" id="photoBox"><div class="photo-add"><div class="big">📷</div>点击上传图片</div><input id="fPhoto" type="file" accept="image/*"></div>' +
          '<div class="upload-note">支持 jpg、png 格式，单张不超过 1.5MB</div>' +
        '</div>' +
        '<button type="submit" class="btn-primary">发布</button>' +
      '</form>' +
      tabbarHTML('');

    function formItem(label, control, optional) {
      return '<div class="form-item"><label>' + (optional ? '' : '<span class="req">*</span>') + label + '</label>' +
        control + '<div class="err"></div></div>';
    }

    var errIds = { title: 'fTitle', category: 'fCat', location: 'fLoc', time: 'fTime', contact: 'fContact', desc: 'fDesc' };

    Array.prototype.forEach.call(app.querySelectorAll('input[name="ptype"]'), function (r) {
      r.addEventListener('change', function () {
        sessionStorage.setItem('laf_pub_type', r.value);
        renderPublish();
      });
    });

    var descEl = document.getElementById('fDesc');
    descEl.addEventListener('input', function () {
      document.getElementById('descCount').textContent = descEl.value.length;
    });

    var photoInput = document.getElementById('fPhoto');
    photoInput.addEventListener('change', function () {
      var file = photoInput.files && photoInput.files[0];
      if (!file) return;
      if (file.size > 1.5 * 1024 * 1024) {
        toast('图片不能超过 1.5MB，请压缩后上传');
        photoInput.value = '';
        return;
      }
      var reader = new FileReader();
      reader.onload = function () {
        pendingImage = reader.result;
        document.getElementById('photoBox').innerHTML =
          '<img class="photo-preview" src="' + pendingImage + '"><button type="button" class="photo-del" id="photoDel">✕ 移除</button>';
        document.getElementById('photoDel').addEventListener('click', function () {
          pendingImage = null;
          renderPublish();
        });
      };
      reader.readAsDataURL(file);
    });

    document.getElementById('pubForm').addEventListener('submit', function (e) {
      e.preventDefault();
      var formData = {
        type: sessionStorage.getItem('laf_pub_type') || 'lost',
        title: document.getElementById('fTitle').value,
        category: document.getElementById('fCat').value,
        location: document.getElementById('fLoc').value,
        time: document.getElementById('fTime').value,
        desc: descEl.value,
        contact: document.getElementById('fContact').value
      };
      var result = Core.validateItem(formData);
      Array.prototype.forEach.call(app.querySelectorAll('.err'), function (el) { el.textContent = ''; });
      Array.prototype.forEach.call(app.querySelectorAll('.invalid'), function (el) { el.classList.remove('invalid'); });

      if (!result.ok) {
        Object.keys(result.errors).forEach(function (key) {
          var input = document.getElementById(errIds[key]);
          if (input) {
            input.classList.add('invalid');
            var errEl = input.closest('.form-item').querySelector('.err');
            if (errEl) errEl.textContent = result.errors[key];
          }
        });
        var firstBad = app.querySelector('.invalid');
        if (firstBad) firstBad.scrollIntoView({ behavior: 'smooth', block: 'center' });
        toast('信息填写不完整，请检查标红项');
        return;
      }

      var item = {
        id: Core.genId(),
        type: formData.type,
        title: formData.title.trim(),
        category: formData.category,
        location: formData.location.trim(),
        time: formData.time,
        desc: formData.desc.trim(),
        contact: formData.contact.trim(),
        owner: user.name,
        status: 'open',
        image: pendingImage,
        createdAt: Date.now()
      };
      items.push(item);
      save();
      pendingImage = null;
      location.hash = '#/success/' + item.id;
    });
  }

  function today() {
    var d = new Date();
    return d.getFullYear() + '-' + pad2(d.getMonth() + 1) + '-' + pad2(d.getDate());
  }

  /* ---------------- 发布成功页 ---------------- */

  function renderSuccess(id) {
    var item = findItem(id);
    app.innerHTML =
      '<div class="success-page">' +
        '<div class="success-icon">✓</div>' +
        '<div class="success-title">发布成功！</div>' +
        '<div class="success-sub">你的' + (item ? Core.TYPE_LABEL[item.type] : '') + '信息「' + esc(item ? item.title : '') + '」已展示在首页，对方可通过你留下的联系方式与你联系。</div>' +
        '<a class="btn-primary" href="#/mine">查看我的发布</a>' +
        '<a class="btn-secondary" href="#/home">返回首页</a>' +
      '</div>';
  }

  /* ---------------- 详情页 ---------------- */

  function renderDetail(id) {
    var item = findItem(id);
    if (!item) {
      app.innerHTML = navHTML('物品详情', '#/home') +
        emptyHTML('😵', '这条信息不存在或已被删除') +
        '<div style="text-align:center"><a class="btn-secondary" href="#/home">返回首页</a></div>';
      return;
    }

    var mine = isMine(item);
    var locLabel = item.type === 'found' ? '拾获地点' : '丢失地点';
    var timeLabel = item.type === 'found' ? '拾获时间' : '丢失时间';

    var infoRows =
      detailRow('物品类别', item.category) +
      detailRow(locLabel, item.location) +
      detailRow(timeLabel, item.time) +
      detailRow('物品描述', item.desc || '无') +
      (item.status === 'done'
        ? detailRow('联系方式', '已隐藏')
        : detailRow('联系方式', item.contact));

    var photoSec = '<div class="detail-photo">' +
      (item.image
        ? '<img src="' + item.image + '" alt="">'
        : '<div class="photo-fallback">' + (Core.CATEGORY_EMOJI[item.category] || '📦') + '</div>') +
    '</div>';

    var actions = '';
    if (mine) {
      if (Core.canMarkDone(item)) {
        actions = '<div class="detail-actions">' +
          '<button class="btn-primary" id="contactFake">💬 联系发布者</button>' +
          '<div class="row2">' +
            '<button class="btn-outline-blue" id="doneBtn">✓ 标记' + Core.doneLabel(item.type) + '</button>' +
            '<button class="btn-outline-red" id="delBtn">🗑 删除</button>' +
          '</div>' +
        '</div>';
      } else {
        actions = '<div class="done-banner">✅ 该信息已' + Core.doneLabel(item.type) + '</div>' +
          '<div class="detail-actions"><div class="row2">' +
            '<button class="btn-outline-red" id="delBtn">🗑 删除</button>' +
          '</div></div>';
      }
    } else {
      actions = item.status === 'done'
        ? '<div class="done-tip">该信息已' + Core.doneLabel(item.type) + '，感谢你的热心！</div>'
        : '<div class="detail-actions"><button class="btn-primary" id="contactBtn">💬 联系发布者</button></div>';
    }

    app.innerHTML =
      navHTML('物品详情', 'javascript:history.back()') +
      '<div class="detail">' +
        '<div class="detail-card">' +
          '<div class="detail-top">' +
            '<div class="detail-thumb">' +
              (item.image ? '<img src="' + item.image + '" alt="">' : (Core.CATEGORY_EMOJI[item.category] || '📦')) +
            '</div>' +
            '<div class="detail-main">' +
              '<div class="detail-head">' + typeLabel(item) + statusPill(item) + '</div>' +
              '<div class="detail-name">' + esc(item.title) + '</div>' +
              metaLines(item) +
            '</div>' +
          '</div>' +
          '<div class="detail-rows">' + infoRows + '</div>' +
          photoSec +
        '</div>' +
        actions +
      '</div>';

    function detailRow(k, v) { return '<div class="detail-row"><span class="dk">' + k + '</span><span class="dv">' + esc(v) + '</span></div>'; }

    var contactBtn = document.getElementById('contactBtn');
    if (contactBtn) contactBtn.addEventListener('click', function () { copyText(item.contact); });
    var contactFake = document.getElementById('contactFake');
    if (contactFake) contactFake.addEventListener('click', function () { copyText(item.contact); });
    var doneBtn = document.getElementById('doneBtn');
    if (doneBtn) doneBtn.addEventListener('click', function () {
      if (confirm('确认将这条信息标记为「' + Core.doneLabel(item.type) + '」吗？标记后联系方式将不再展示。')) {
        item.status = 'done';
        save();
        renderDetail(id);
      }
    });
    var delBtn = document.getElementById('delBtn');
    if (delBtn) delBtn.addEventListener('click', function () {
      if (confirm('确认删除这条信息吗？删除后不可恢复。')) {
        items = items.filter(function (i) { return i.id !== id; });
        save();
        toast('已删除');
        location.hash = '#/mine';
      }
    });
  }

  /* ---------------- 我的发布 ---------------- */

  function renderMine() {
    var mineItems = Core.sortByTimeDesc(items.filter(function (i) { return isMine(i); }));

    var listHTML = mineItems.length
      ? mineItems.map(function (item) {
          var actions;
          if (item.status === 'open') {
            actions = '<button class="btn-outline-blue" data-act="done" data-id="' + item.id + '">✏️ 修改状态</button>' +
              '<button class="btn-outline-red" data-act="del" data-id="' + item.id + '">🗑 删除</button>';
          } else {
            actions = '<span class="state-done">✓ 已' + Core.doneLabel(item.type) + '</span>' +
              '<button class="btn-outline-red" data-act="del" data-id="' + item.id + '">🗑 删除</button>';
          }
          return '<div class="info-card" data-id="' + item.id + '">' +
            thumbHTML(item) +
            '<div class="card-main">' +
              '<div class="card-head">' + typeLabel(item) + statusPill(item) + '</div>' +
              '<div class="card-name">' + esc(item.title) + '</div>' +
              metaLines(item) +
              '<div class="my-actions">' + actions + '</div>' +
            '</div>' +
          '</div>';
        }).join('')
      : emptyHTML('📭', '你还没有发布过信息', '点击底部中间的“发布”按钮开始吧');

    app.innerHTML =
      navHTML('我的发布', '#/home') +
      '<div class="list" id="mineList" style="padding-top:14px">' + listHTML + '</div>' +
      '<div class="mine-footer">' +
        '<button class="btn-link" id="resetBtn">↺ 重置演示数据</button>' +
        '<div class="footer-note">数据保存在本机浏览器（localStorage），清除浏览器数据会恢复演示数据。</div>' +
      '</div>' +
      tabbarHTML('mine');

    bindCards(document.getElementById('mineList'));
    Array.prototype.forEach.call(app.querySelectorAll('[data-act="done"]'), function (btn) {
      btn.addEventListener('click', function (e) {
        e.stopPropagation();
        var item = findItem(btn.getAttribute('data-id'));
        if (item && confirm('确认标记为「' + Core.doneLabel(item.type) + '」吗？标记后联系方式将不再展示。')) {
          item.status = 'done';
          save();
          renderMine();
        }
      });
    });
    Array.prototype.forEach.call(app.querySelectorAll('[data-act="del"]'), function (btn) {
      btn.addEventListener('click', function (e) {
        e.stopPropagation();
        if (confirm('确认删除这条信息吗？')) {
          items = items.filter(function (i) { return i.id !== btn.getAttribute('data-id'); });
          save();
          renderMine();
        }
      });
    });
    document.getElementById('resetBtn').addEventListener('click', function () {
      if (confirm('将清空本地数据并恢复初始演示数据，确认吗？')) {
        items = Data.resetDemo();
        toast('已重置为演示数据');
        renderMine();
      }
    });
  }

  /* ---------------- 启动 ---------------- */

  window.addEventListener('hashchange', route);
  route();
})();
