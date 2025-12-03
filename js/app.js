const PATH = '/data/';
let CROSS = [], LEX = {}, EXMAP = {};
let TERMS = []; // ✅ 新增：term 索引数组

// ... 上面 parseCSV / loadCSV / 语音部分保持不变 ...

// 载入 crossmap / lexeme / examples
async function boot() {
  const [cm, lx, ex] = await Promise.all([
    loadCSV('crossmap.csv'),
    loadCSV('lexeme.csv'),
    loadCSV('examples.csv'),
  ]);
  CROSS = cm;

  // 建 lexeme 索引
  lx.forEach(r => LEX[r.id] = r);

  // 建 examples 索引
  EXMAP = ex.reduce((m, r) => {
    (m[r.lexeme_id] || (m[r.lexeme_id] = [])).push(r);
    return m;
  }, {});

  // ✅ 新增：基于 crossmap.term 建 term 索引（拆分 / 分号）
  TERMS = [];
  CROSS.forEach(r => {
    const id = (r.target_id || '').trim();
    if (!id) return;
    const rawTerm = (r.term || '').trim();
    if (!rawTerm) return;

    rawTerm
      .split('/')
      .map(s => s.trim())
      .filter(Boolean)
      .forEach(term => {
        TERMS.push({
          term,
          norm: term.toLowerCase(), // 用于大小写不敏感
          id,
        });
      });
  });
}

// ⭐⭐ 核心：只按 crossmap.term 精确匹配（忽略大小写），不做模糊搜索 ⭐⭐
function findLexemeIds(q) {
  const query = (q || '').trim();
  if (!query) return [];

  const qLower = query.toLowerCase();

  // 只保留 term 完全等于输入（忽略大小写）的条目
  const hits = TERMS.filter(t => t.norm === qLower);

  if (!hits.length) return [];

  // 去重后返回 target_id 列表
  const set = new Set();
  hits.forEach(h => set.add(h.id));
  return Array.from(set);
}

// ===== 下面 UI / 渲染部分保持原样 =====

const grid = document.getElementById('grid');
const examples = document.getElementById('examples');
const examplesList = document.getElementById('examples-list');

// ... resetUI / pairedVariants / renderPhased / toggleExamples 保持不动 ...

document.getElementById('q').addEventListener('input', e => {
  const q = e.target.value;
  if (!q) { renderEmpty(); return; }
  const ids = findLexemeIds(q);
  if (!ids.length) { renderEmpty(); return; }
  const lex = LEX[ids[0]];
  renderPhased(lex);
});

boot();
