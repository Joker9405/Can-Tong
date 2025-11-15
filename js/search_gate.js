// search_gate.js
// 让搜索“只认 crossmap 里的内容”
// 原有 app.js 保持不动；这里在捕获阶段拦截 input / keydown 事件。

(function() {
  const CROSSMAP_URL = '/data/crossmap.csv';

  function normalize(str) {
    return (str || '').trim().toLowerCase();
  }

  async function loadCrossmapSet() {
    try {
      const resp = await fetch(CROSSMAP_URL);
      if (!resp.ok) throw new Error('crossmap fetch error');
      const text = await resp.text();
      const lines = text.split(/\r?\n/);

      const set = new Set();

      for (let i = 0; i < lines.length; i++) {
        const line = lines[i];
        if (!line) continue;

        // 简单 CSV 拆分：按逗号取第 1 列作为查询词
        // 你的 crossmap 第一列就是「扔/丢东西」「Throwing things」这些 surface。
        const firstComma = line.indexOf(',');
        let surface = firstComma === -1 ? line : line.slice(0, firstComma);
        // 去掉首尾引号
        if (surface.length >= 2 && surface[0] === '"' && surface[surface.length - 1] === '"') {
          surface = surface.slice(1, -1);
        }

        const key = normalize(surface);
        if (key) set.add(key);
      }

      return set;
    } catch (err) {
      console.error('Failed to load crossmap for search gate:', err);
      return null;
    }
  }

  function setupGate(allowedSet) {
    const input = document.getElementById('q');
    if (!input) return;

    function handler(evt) {
      const value = normalize(input.value);

      // 没输东西，放行给原逻辑处理（清空等）
      if (!value) return;

      const isEnter = evt.type === 'keydown' && (evt.key === 'Enter' || evt.keyCode === 13);

      // 如果 crossmap 里没有这个词，就拦截，禁止触发原来的搜索逻辑
      if (!allowedSet || !allowedSet.has(value)) {
        // 阻止原 app.js 的监听器执行
        evt.stopPropagation();
        if (evt.stopImmediatePropagation) evt.stopImmediatePropagation();
        if (isEnter) evt.preventDefault();

        // 清空现有结果
        const grid = document.getElementById('grid');
        if (grid) grid.innerHTML = '';
        const examples = document.getElementById('examples');
        if (examples) examples.hidden = true;

        return;
      }

      // 命中 crossmap：不做任何处理，让原 app.js 正常执行
    }

    // 在捕获阶段监听，优先于 app.js
    input.addEventListener('input', handler, true);
    input.addEventListener('keydown', handler, true);
  }

  // 初始化
  document.addEventListener('DOMContentLoaded', function() {
    loadCrossmapSet().then(setupGate);
  });
})();
