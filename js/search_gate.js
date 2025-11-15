// search_gate.js v2
// 只允许 crossmap 里的 term 触发「最终搜索」（Enter），不改动原有 app.js 其它逻辑。

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

        const firstComma = line.indexOf(',');
        let surface = firstComma === -1 ? line : line.slice(0, firstComma);

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

    // 如果 crossmap 没加载成功，就什么都不拦截，恢复原逻辑
    if (!allowedSet) {
      console.warn('search_gate: crossmap set is empty, gate disabled.');
      return;
    }

    input.addEventListener('keydown', function(evt) {
      if (evt.key !== 'Enter' && evt.keyCode !== 13) return;

      const value = normalize(input.value);
      if (!value) return;

      // 只允许 crossmap 里的 term 触发搜索
      if (!allowedSet.has(value)) {
        evt.stopPropagation();
        evt.preventDefault();

        // 清空现有结果
        const grid = document.getElementById('grid');
        if (grid) grid.innerHTML = '';
        const examples = document.getElementById('examples');
        if (examples) examples.hidden = true;
      }
    }, true); // capture
  }

  document.addEventListener('DOMContentLoaded', function() {
    loadCrossmapSet().then(setupGate);
  });
})();
