/*
 * mini-test.js —— 零依赖微型测试框架（浏览器端）。
 * 在 Node 环境下请使用 `node --test test/` 运行同一测试文件；
 * 在浏览器中打开 test/runner.html，本框架会收集用例并输出结果。
 */
(function (root) {
  'use strict';

  var tests = [];

  function test(name, fn) {
    tests.push({ name: name, fn: fn });
  }

  function fail(msg) {
    throw new Error(msg);
  }

  function fmt(v) {
    try { return JSON.stringify(v); } catch (e) { return String(v); }
  }

  var assert = {
    strictEqual: function (actual, expected) {
      if (actual !== expected) {
        fail('期望 ' + fmt(expected) + '，实际 ' + fmt(actual));
      }
    },
    deepStrictEqual: function (actual, expected) {
      var a = fmt(actual), e = fmt(expected);
      if (a !== e) {
        fail('深度比较失败：期望 ' + e + '，实际 ' + a);
      }
    },
    ok: function (value) {
      if (!value) fail('断言失败：值应为真，实际 ' + fmt(value));
    }
  };

  function esc(s) {
    return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
  }

  async function run() {
    var box = document.getElementById('results');
    var passed = 0, failed = 0;
    box.innerHTML = '';
    for (var i = 0; i < tests.length; i++) {
      var t = tests[i];
      var row = document.createElement('div');
      try {
        await t.fn();
        passed++;
        row.className = 'case pass';
        row.innerHTML = '✅ ' + esc(t.name);
      } catch (err) {
        failed++;
        row.className = 'case fail';
        row.innerHTML = '❌ ' + esc(t.name) + '<div class="err-detail">' + esc(err.message) + '</div>';
      }
      box.appendChild(row);
    }
    var summary = document.getElementById('summary');
    summary.textContent = '共 ' + tests.length + ' 个用例，通过 ' + passed + ' 个，失败 ' + failed + ' 个';
    summary.className = failed === 0 ? 'summary ok' : 'summary bad';
  }

  root.miniTest = test;
  root.miniAssert = assert;
  root.miniRun = run;
})(window);
