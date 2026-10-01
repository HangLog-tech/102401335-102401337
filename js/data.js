/*
 * data.js —— 数据层：演示数据 + localStorage 持久化
 * 仅在浏览器端使用（依赖 window.localStorage）。
 */
(function () {
  'use strict';

  var LS_ITEMS = 'laf_items_v1';
  var LS_USER = 'laf_user_v1';

  // 当前登录用户（原型中的“我”）。作业不要求实名认证，这里用固定演示身份模拟。
  var DEMO_USER = { name: '吴昊阳', contact: '微信号：wuhaoyang_fzu' };

  // 演示数据：覆盖寻物/招领、各分类、各状态，便于助教直接体验全部流程
  function seedItems() {
    var day = 24 * 60 * 60 * 1000;
    var now = Date.now();
    return [
      {
        id: 'seed_1', type: 'lost', title: '校园卡', category: '证件卡片',
        location: '图书馆二楼自习区', time: '2026-09-28', desc: '卡套是蓝色的，上面挂着一个小熊挂件，姓名吴昊阳。',
        contact: DEMO_USER.contact, owner: DEMO_USER.name, status: 'open',
        image: null, createdAt: now - 2 * 60 * 60 * 1000
      },
      {
        id: 'seed_2', type: 'found', title: '黑色长柄雨伞', category: '衣物伞具',
        location: '教学楼东3-105', time: '2026-09-29', desc: '下课后在教室后排捡到，伞柄上贴了一个卡通贴纸。',
        contact: 'QQ：204801234', owner: '郭航铭', status: 'open',
        image: null, createdAt: now - 5 * 60 * 60 * 1000
      },
      {
        id: 'seed_3', type: 'found', title: '白色无线耳机', category: '电子数码',
        location: '食堂二楼靠窗座位', time: '2026-09-27', desc: '装在一个透明耳机壳里，充电仓背面有划痕。',
        contact: '手机：138****6621', owner: '李思远', status: 'open',
        image: null, createdAt: now - 1 * day
      },
      {
        id: 'seed_4', type: 'lost', title: '高等数学教材', category: '书籍资料',
        location: '教学楼西1-208', time: '2026-09-25', desc: '书里有手写笔记，封底写着名字，对我很重要。',
        contact: DEMO_USER.contact, owner: DEMO_USER.name, status: 'open',
        image: null, createdAt: now - 1 * day - 3 * 60 * 60 * 1000
      },
      {
        id: 'seed_5', type: 'found', title: '校园卡（刘一）', category: '证件卡片',
        location: '东区田径场看台', time: '2026-09-26', desc: '晚上跑步时捡到，已交给看台值班同学，请联系我确认。',
        contact: 'QQ：207705566', owner: '赵梓涵', status: 'done',
        image: null, createdAt: now - 2 * day
      },
      {
        id: 'seed_6', type: 'lost', title: '宿舍钥匙（带门禁卡）', category: '钥匙',
        location: '生活区四号楼附近', time: '2026-09-29', desc: '钥匙串上有三把钥匙和一张蓝色门禁卡。',
        contact: '手机：159****8830', owner: '陈立群', status: 'open',
        image: null, createdAt: now - 30 * 60 * 1000
      },
      {
        id: 'seed_7', type: 'found', title: '保温杯（米色）', category: '水杯餐具',
        location: '图书馆三层茶水间', time: '2026-09-28', desc: '杯身贴了一张卡通贴纸，杯盖有轻微磨损。',
        contact: '微信：guo-hangming', owner: '郭航铭', status: 'open',
        image: null, createdAt: now - 2 * day - 6 * 60 * 60 * 1000
      },
      {
        id: 'seed_8', type: 'lost', title: '32G U盘', category: '电子数码',
        location: '实验楼机房', time: '2026-09-24', desc: '银色金属外壳，里面有课程设计资料，拾到请联系，重谢！',
        contact: '手机：136****0092', owner: '刘一鸣', status: 'done',
        image: null, createdAt: now - 4 * day
      },
      {
        id: 'seed_9', type: 'found', title: '英语四六级资料', category: '书籍资料',
        location: '食堂一楼', time: '2026-09-30', desc: '一摞真题卷，用黑色文件袋装着。',
        contact: 'QQ：209912345', owner: '孙可', status: 'open',
        image: null, createdAt: now - 8 * 60 * 1000
      }
    ];
  }

  function loadItems() {
    try {
      var raw = localStorage.getItem(LS_ITEMS);
      if (raw) return JSON.parse(raw);
    } catch (e) { /* 数据损坏时回落到演示数据 */ }
    var seeds = seedItems();
    saveItems(seeds);
    return seeds;
  }

  function saveItems(items) {
    localStorage.setItem(LS_ITEMS, JSON.stringify(items));
  }

  function loadUser() {
    try {
      var raw = localStorage.getItem(LS_USER);
      if (raw) return JSON.parse(raw);
    } catch (e) { /* ignore */ }
    return DEMO_USER;
  }

  function resetDemo() {
    var seeds = seedItems();
    saveItems(seeds);
    return seeds;
  }

  window.LAFData = {
    loadItems: loadItems,
    saveItems: saveItems,
    loadUser: loadUser,
    resetDemo: resetDemo,
    DEMO_USER: DEMO_USER
  };
})();
