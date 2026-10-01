/*
 * core.js —— 校园失物招领小程序纯逻辑层
 * 只包含与 DOM / localStorage 无关的纯函数，便于单元测试。
 * 浏览器端挂载到 window.LAFCore，Node 端通过 module.exports 引用。
 */
(function (root, factory) {
  var lib = factory();
  if (typeof module !== 'undefined' && module.exports) {
    module.exports = lib;
  } else {
    root.LAFCore = lib;
  }
})(typeof self !== 'undefined' ? self : this, function () {
  'use strict';

  // 物品分类（与原型设计保持一致）
  var CATEGORIES = ['证件卡片', '电子数码', '书籍资料', '衣物伞具', '钥匙', '水杯餐具', '其他'];

  // 分类对应的默认展示图标（无照片时作为占位图）
  var CATEGORY_EMOJI = {
    '证件卡片': '🪪',
    '电子数码': '🎧',
    '书籍资料': '📚',
    '衣物伞具': '☂️',
    '钥匙': '🔑',
    '水杯餐具': '🥤',
    '其他': '📦'
  };

  var TYPE_LABEL = { lost: '寻物', found: '招领' };
  // 寻物信息完成后标记为“已找到”，招领信息完成后标记为“已归还”
  var DONE_LABEL = { lost: '已找到', found: '已归还' };

  /**
   * 校验发布表单。
   * @param {Object} data 表单数据
   * @returns {{ok: boolean, errors: Object<string,string>}} errors 以字段名为键
   */
  function validateItem(data) {
    var errors = {};
    data = data || {};

    if (!trim(data.title)) {
      errors.title = '请填写物品名称';
    } else if (trim(data.title).length > 20) {
      errors.title = '物品名称不能超过 20 个字';
    }

    if (!data.category || CATEGORIES.indexOf(data.category) === -1) {
      errors.category = '请选择物品分类';
    }

    if (!trim(data.location)) {
      errors.location = '请填写' + (data.type === 'found' ? '拾获' : '丢失') + '地点';
    } else if (trim(data.location).length > 30) {
      errors.location = '地点不能超过 30 个字';
    }

    if (!trim(data.time)) {
      errors.time = '请选择' + (data.type === 'found' ? '拾获' : '丢失') + '时间';
    } else if (!/^\d{4}-\d{2}-\d{2}$/.test(trim(data.time))) {
      errors.time = '时间格式不正确';
    } else if (new Date(trim(data.time) + 'T23:59:59').getTime() > Date.now()) {
      errors.time = '时间不能晚于今天';
    }

    var contact = trim(data.contact);
    if (!contact) {
      errors.contact = '请填写联系方式，方便对方与你联系';
    } else if (contact.length < 5) {
      errors.contact = '联系方式至少 5 个字符';
    } else if (contact.length > 50) {
      errors.contact = '联系方式不能超过 50 个字符';
    }

    if (data.desc && data.desc.length > 200) {
      errors.desc = '描述不能超过 200 个字';
    }

    if (data.type !== 'lost' && data.type !== 'found') {
      errors.type = '信息类型不正确';
    }

    return { ok: Object.keys(errors).length === 0, errors: errors };
  }

  /**
   * 关键词匹配：命中物品名称、地点、描述或分类即算匹配（不区分大小写）。
   */
  function matchKeyword(item, keyword) {
    keyword = normalizeKeyword(keyword);
    if (!keyword) return true;
    var haystack = [item.title, item.location, item.desc, item.category]
      .map(normalizeKeyword)
      .join(' ');
    return haystack.indexOf(keyword) !== -1;
  }

  /**
   * 组合筛选：关键词 + 类型(lost/found) + 分类 + 地点 + 状态。
   * @param {Object} [filters] 全部可选；不传则原样返回（仅按时间排序由调用方决定）
   */
  function filterItems(items, filters) {
    filters = filters || {};
    return items.filter(function (item) {
      if (filters.type && item.type !== filters.type) return false;
      if (filters.category && item.category !== filters.category) return false;
      if (filters.status && item.status !== filters.status) return false;
      if (filters.location) {
        if (normalizeKeyword(item.location).indexOf(normalizeKeyword(filters.location)) === -1) return false;
      }
      return matchKeyword(item, filters.keyword);
    });
  }

  /**
   * 按发布时间倒序（新的在前）。createdAt 为毫秒时间戳。
   */
  function sortByTimeDesc(items) {
    return items.slice().sort(function (a, b) {
      return b.createdAt - a.createdAt;
    });
  }

  /**
   * 相对时间：刚刚 / n分钟前 / n小时前 / n天前 / 具体日期。
   */
  function formatRelativeTime(ts, now) {
    now = now || Date.now();
    var diff = Math.max(0, now - ts);
    var minute = 60 * 1000;
    var hour = 60 * minute;
    var day = 24 * hour;
    if (diff < minute) return '刚刚';
    if (diff < hour) return Math.floor(diff / minute) + ' 分钟前';
    if (diff < day) return Math.floor(diff / hour) + ' 小时前';
    if (diff < 7 * day) return Math.floor(diff / day) + ' 天前';
    var d = new Date(ts);
    return d.getFullYear() + '-' + pad2(d.getMonth() + 1) + '-' + pad2(d.getDate());
  }

  /**
   * 信息完成后的状态文案：寻物 -> 已找到，招领 -> 已归还。
   */
  function doneLabel(type) {
    return DONE_LABEL[type] || '已完成';
  }

  /**
   * 状态是否可流转：仅“进行中(open)”可以标记完成，且不能回退。
   */
  function canMarkDone(item) {
    return !!item && item.status === 'open';
  }

  /**
   * 生成不重复 id（时间戳 + 随机数）。
   */
  function genId() {
    return 'item_' + Date.now().toString(36) + '_' + Math.random().toString(36).slice(2, 8);
  }

  function trim(s) {
    return (s == null ? '' : String(s)).trim();
  }

  function normalizeKeyword(s) {
    return trim(s).toLowerCase().replace(/\s+/g, ' ');
  }

  function pad2(n) {
    return n < 10 ? '0' + n : '' + n;
  }

  return {
    CATEGORIES: CATEGORIES,
    CATEGORY_EMOJI: CATEGORY_EMOJI,
    TYPE_LABEL: TYPE_LABEL,
    DONE_LABEL: DONE_LABEL,
    validateItem: validateItem,
    matchKeyword: matchKeyword,
    filterItems: filterItems,
    sortByTimeDesc: sortByTimeDesc,
    formatRelativeTime: formatRelativeTime,
    doneLabel: doneLabel,
    canMarkDone: canMarkDone,
    genId: genId
  };
});
