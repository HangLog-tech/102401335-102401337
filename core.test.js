/*
 * core.test.js —— 对纯逻辑层（js/core.js）的单元测试。
 *
 * 运行方式一（Node.js，零依赖，使用内置 node:test）：
 *   node --test test/
 *
 * 运行方式二（浏览器）：用 Chrome 打开 test/runner.html，
 *   测试框架使用 test/mini-test.js（无需任何安装）。
 *
 * 测试数据构造思路：
 *   - validForm() 给出一个全合法表单，每个用例只改动一个字段制造错误（白盒覆盖每个校验分支）；
 *   - catalog 覆盖寻物/招领 × 多个分类 × 多个地点，用于验证搜索与组合筛选；
 *   - 相对时间与排序用固定时间戳，避免“现在”导致的不稳定。
 */
var test, assert, Core;
if (typeof module !== 'undefined' && module.exports) {
  test = require('node:test');
  assert = require('node:assert');
  Core = require('../js/core.js');
} else {
  test = window.miniTest;
  assert = window.miniAssert;
  Core = window.LAFCore;
}

/* ---------- 构造测试数据 ---------- */

function makeItem(overrides) {
  return Object.assign({
    id: 't1',
    type: 'lost',
    title: '校园卡',
    category: '证件卡片',
    location: '图书馆二楼',
    time: '2026-09-28',
    desc: '蓝色卡套',
    contact: '微信号：testuser',
    owner: '测试用户',
    status: 'open',
    createdAt: 1000
  }, overrides);
}

function validForm() {
  return {
    type: 'lost',
    title: '校园卡',
    category: '证件卡片',
    location: '图书馆二楼',
    time: '2026-09-28',
    desc: '蓝色卡套',
    contact: '微信号：testuser'
  };
}

/* ---------- 用例 1~6：发布表单校验（白盒：覆盖每个分支） ---------- */

test('用例1：完整合法的表单应通过校验', () => {
  const r = Core.validateItem(validForm());
  assert.strictEqual(r.ok, true);
  assert.deepStrictEqual(r.errors, {});
});

test('用例2：缺少物品名称应报错并定位到 title 字段', () => {
  const form = validForm();
  form.title = '  ';
  const r = Core.validateItem(form);
  assert.strictEqual(r.ok, false);
  assert.ok(r.errors.title);
});

test('用例3：未选择分类 / 非法分类应报错', () => {
  const form = validForm();
  form.category = '';
  assert.ok(Core.validateItem(form).errors.category);
  form.category = '不存在分类';
  assert.ok(Core.validateItem(form).errors.category);
});

test('用例4：缺少地点、未来时间、时间格式错误均应报错', () => {
  const form = validForm();
  form.location = '';
  assert.ok(Core.validateItem(form).errors.location);

  const future = validForm();
  future.time = '2999-01-01';
  assert.ok(Core.validateItem(future).errors.time);

  const badFormat = validForm();
  badFormat.time = '2026/09/28';
  assert.ok(Core.validateItem(badFormat).errors.time);
});

test('用例5：联系方式为空或过短应报错', () => {
  const form = validForm();
  form.contact = '';
  assert.ok(Core.validateItem(form).errors.contact);
  form.contact = '123';
  assert.ok(Core.validateItem(form).errors.contact);
});

test('用例6：超长字段（名称>20字、描述>200字）应报错', () => {
  const form = validForm();
  form.title = '很'.repeat(21);
  assert.ok(Core.validateItem(form).errors.title);
  form.title = '校园卡';
  form.desc = '长'.repeat(201);
  assert.ok(Core.validateItem(form).errors.desc);
});

/* ---------- 用例 7~10：搜索与筛选 ---------- */

const catalog = [
  makeItem({ id: 'a', title: '校园卡', category: '证件卡片', location: '图书馆二楼', type: 'lost', desc: '蓝色卡套' }),
  makeItem({ id: 'b', title: '黑色雨伞', category: '衣物伞具', location: '教学楼', type: 'found', desc: '伞柄贴有卡通贴纸' }),
  makeItem({ id: 'c', title: '无线耳机', category: '电子数码', location: '食堂', type: 'found', desc: '透明耳机壳' }),
  makeItem({ id: 'd', title: '高等数学教材', category: '书籍资料', location: '教学楼', type: 'lost', desc: '内有手写笔记' })
];

test('用例7：按物品名称关键词搜索，应命中且支持大小写/空白归一', () => {
  const r = Core.filterItems(catalog, { keyword: ' 校园卡 ' });
  assert.strictEqual(r.length, 1);
  assert.strictEqual(r[0].id, 'a');
  // 描述中的关键词也能命中（名称、地点、描述、分类均可检索）
  const r2 = Core.filterItems(catalog, { keyword: '蓝色' });
  assert.strictEqual(r2.length, 1);
  assert.strictEqual(r2[0].id, 'a');
});

test('用例8：无结果时应返回空数组（页面据此展示“未找到”空状态）', () => {
  const r = Core.filterItems(catalog, { keyword: '不存在的物品xyz' });
  assert.deepStrictEqual(r, []);
});

test('用例9：类型 + 分类 + 地点组合筛选应同时生效', () => {
  const r = Core.filterItems(catalog, { type: 'found', category: '电子数码' });
  assert.deepStrictEqual(r.map(i => i.id), ['c']);

  const r2 = Core.filterItems(catalog, { location: '教学楼', type: 'lost' });
  assert.deepStrictEqual(r2.map(i => i.id), ['d']);
});

test('用例10：空关键词 / 空筛选条件应返回全部条目', () => {
  const r = Core.filterItems(catalog, { keyword: '', type: '', category: '', location: '' });
  assert.strictEqual(r.length, 4);
  const r2 = Core.filterItems(catalog, {});
  assert.strictEqual(r2.length, 4);
});

/* ---------- 用例 11~13：排序、时间显示与状态流转 ---------- */

test('用例11：列表应按发布时间倒序排列（新的在前）', () => {
  const items = [
    makeItem({ id: 'old', createdAt: 100 }),
    makeItem({ id: 'new', createdAt: 300 }),
    makeItem({ id: 'mid', createdAt: 200 })
  ];
  const sorted = Core.sortByTimeDesc(items);
  assert.deepStrictEqual(sorted.map(i => i.id), ['new', 'mid', 'old']);
  // 原数组不应被修改
  assert.strictEqual(items[0].id, 'old');
});

test('用例12：相对时间格式化覆盖分钟/小时/天/日期各分支', () => {
  const now = new Date('2026-09-30T12:00:00').getTime();
  const min = 60 * 1000, hour = 60 * min, day = 24 * hour;
  assert.strictEqual(Core.formatRelativeTime(now - 30 * 1000, now), '刚刚');
  assert.strictEqual(Core.formatRelativeTime(now - 5 * min, now), '5 分钟前');
  assert.strictEqual(Core.formatRelativeTime(now - 3 * hour, now), '3 小时前');
  assert.strictEqual(Core.formatRelativeTime(now - 2 * day, now), '2 天前');
  assert.strictEqual(Core.formatRelativeTime(now - 10 * day, now), '2026-09-20');
});

test('用例13：状态流转——寻物完成叫“已找到”，招领完成叫“已归还”，完成后不可再流转', () => {
  assert.strictEqual(Core.doneLabel('lost'), '已找到');
  assert.strictEqual(Core.doneLabel('found'), '已归还');

  const openItem = makeItem({ status: 'open' });
  assert.strictEqual(Core.canMarkDone(openItem), true);
  const doneItem = makeItem({ status: 'done' });
  assert.strictEqual(Core.canMarkDone(doneItem), false);
  assert.strictEqual(Core.canMarkDone(null), false);
});
