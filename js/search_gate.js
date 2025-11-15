// search_gate.js
// 让搜索“只认 crossmap 里的 term”，严格按 term → target_id → lexeme 的逻辑走。
// 这里做的事情是：如果输入的内容不在 crossmap 第一列 term 中，直接拦截事件，
// 不再让原来的 app.js 去做模糊英文搜索。
// 注意：真正的 term -> target_id -> 词条 展示，还是由你原来的 app.js 完成。

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

        // 简单 CSV 拆分：按逗号取第 1 列作为 term
        const firstComma = line.indexOf(',');
        let term = firstComma === -1 ? line : line.slice(0, firstComma);
        // 去掉首尾引号
        if (term.length >= 2 && term[0] === '"' && term[term.length - 1] === '"') {
          term = term.slice(1, -1);
        }

        const key = normalize(term);
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

      // 空值，放行给原逻辑（用于清空结果等）
      if (!value) return;

      const isEnter = evt.type === 'keydown' && (evt.key === 'Enter' || evt.keyCode === 13);

      // 如果 crossmap 里没有这个 term，就拦截，禁止触发原来的搜索逻辑
      if (!allowedSet || !allowedSet.has(value)) {
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

      // 命中 crossmap term：不处理，交给原 app.js 根据 target_id 精准取词条
    }

    // 在捕获阶段监听，优先于 app.js
    input.addEventListener('input', handler, true);
    input.addEventListener('keydown', handler, true);
  }

  document.addEventListener('DOMContentLoaded', function() {
    loadCrossmapSet().then(setupGate);
  });
})();
