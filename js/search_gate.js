// search_gate.js
// 只允许搜索 crossmap 第一列里存在的内容；否则清空结果。
// 不改动 app.js，只在“事后”做二次过滤。

(function() {
  const CROSSMAP_URL = '/data/crossmap.csv';

  function normalize(str) {
    return (str || '').trim().toLowerCase();
  }

  async function loadCrossmapSet() {
    try {
      const resp = await fetch(CROSSMAP_URL);
      if (!resp.ok) throw new Error('crossmap fetch error: ' + resp.status);
      const text = await resp.text();
      const lines = text.split(/\r?\n/);

      const set = new Set();

      for (let i = 0; i < lines.length; i++) {
        const line = lines[i].trim();
        if (!line) continue;

        // 拿第一列作为可搜索词
        let firstComma = line.indexOf(',');
        let surface = firstComma === -1 ? line : line.slice(0, firstComma);

        // 去掉包裹引号
        if (surface.length >= 2 && surface[0] === '"' && surface[surface.length - 1] === '"') {
          surface = surface.slice(1, -1);
        }

        const key = normalize(surface);
        if (key) set.add(key);
      }

      console.log('[search_gate] crossmap loaded, size =', set.size);
      return set;
    } catch (err) {
      console.error('[search_gate] failed to load crossmap:', err);
      return null;
    }
  }

  function applyFilter(allowedSet) {
    const input = document.getElementById('q');
    const grid = document.getElementById('grid');
    const examples = document.getElementById('examples');

    if (!input || !grid) {
      console.warn('[search_gate] missing #q or #grid');
      return;
    }

    function filterNow() {
      const q = normalize(input.value);

      // 为空时交给原逻辑处理（清空/初始状态），这里不干预
      if (!q) return;

      // 如果 crossmap 文件没加载成功，保守起见：直接清空，避免乱匹配
      if (!allowedSet) {
        grid.innerHTML = '';
        if (examples) examples.hidden = true;
        return;
      }

      // 如果当前查询词不在 crossmap 里：清空结果
      if (!allowedSet.has(q)) {
        grid.innerHTML = '';
        if (examples) examples.hidden = true;
      }
      // 在 crossmap 里就不管，让 app.js 渲染的内容保留
    }

    // 在冒泡阶段监听，而且是“后挂载”，保证在 app.js 的监听之后触发
    input.addEventListener('input', filterNow, false);
    input.addEventListener('keydown', function(e) {
      if (e.key === 'Enter' || e.keyCode === 13) {
        // 让 app.js 先跑完，再过滤
        setTimeout(filterNow, 0);
      }
    }, false);
  }

  document.addEventListener('DOMContentLoaded', function() {
    loadCrossmapSet().then(applyFilter);
  });
})();
