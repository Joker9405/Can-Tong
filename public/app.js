const FIELD_MAP = {
  id: 'id',
  zhh: 'zhh',
  chs: 'chs',
  en: 'en',
  aliases: 'aliases',
  variants_chs: 'variants_chs',
  variants_en: 'variants_en',
  notes: 'notes',
  examples: 'examples'
};

const PATHS = {
  lexeme: ['../data/lexeme.csv', '../data/seed.csv'],
  crossmap: ['../data/crossmap.csv'] // 如果不存在就跳过歧义功能
};

const $q = document.getElementById('q');
const $btn = document.getElementById('btnSearch');
const $results = document.getElementById('results');

let LEX = [];              // lexeme rows
let BY_ID = new Map();     // id -> row
let XMAP = new Map();      // term -> Set(ids)

function norm(s) {
  return (s || '').toLowerCase().trim().replace(/\s+/g, '');
}

function csvParse(txt) {
  // 极简 CSV 解析（不处理双引号转义场景，建议数据侧避免逗号）
  const lines = txt.split(/\r?\n/).filter(x => x.trim().length);
  if (!lines.length) return [];
  const header = lines.shift().split(',').map(h => h.trim());
  return lines.map(line => {
    const cols = line.split(',');
    const obj = {};
    header.forEach((h, i) => obj[h] = (cols[i] || '').trim());
    return obj;
  });
}

async function loadFirst(paths) {
  for (const p of paths) {
    try {
      const res = await fetch(p + '?t=' + Date.now());
      if (res.ok) {
        const txt = await res.text();
        const rows = csvParse(txt);
        if (rows && rows.length) return rows;
      }
    } catch (e) { /* try next */ }
  }
  return [];
}

function autodetectCrossmap(row) {
  // 兼容多种列名
  const term = row.term || row.key || row.query || '';
  const id = row.lexeme_id || row.id || row.dst_id || '';
  return { term, id };
}

function buildIndexes() {
  BY_ID.clear();
  LEX.forEach(r => {
    const id = (r[FIELD_MAP.id] || '').trim();
    if (id) BY_ID.set(id, r);
  });

  XMAP.clear();
  for (const [term, ids] of XMAPraw) {
    // 过滤掉不存在于 lexeme 的 id
    const set = new Set(ids.filter(id => BY_ID.has(id)));
    if (set.size) XMAP.set(term, set);
  }
}

let XMAPraw = new Map(); // term -> [ids]

async function init() {
  LEX = await loadFirst(PATHS.lexeme);
  // 预建 id map
  BY_ID = new Map();
  LEX.forEach(r => r[FIELD_MAP.id] && BY_ID.set(r[FIELD_MAP.id], r));

  // 读 crossmap（可选）
  const crossRows = await loadFirst(PATHS.crossmap);
  XMAPraw = new Map();
  if (crossRows.length) {
    for (const row of crossRows) {
      const { term, id } = autodetectCrossmap(row);
      if (!term || !id) continue;
      const key = norm(term);
      if (!XMAPraw.has(key)) XMAPraw.set(key, []);
      XMAPraw.get(key).push(id);
    }
  }
  buildIndexes();
}
init();

function speakHK(text) {
  const u = new SpeechSynthesisUtterance(text);
  u.lang = 'zh-HK';
  speechSynthesis.speak(u);
}

function includesAny(hay, needles) {
  hay = norm(hay);
  return needles.some(n => hay.includes(norm(n)));
}

// 简易评分
function scoreRow(row, q) {
  const f = ['zhh','chs','en','aliases'];
  if (f.some(k => includesAny(row[k]||'', [q]))) return 3;
  const al = (row['aliases']||'').split('|').filter(Boolean);
  if (al.some(a => includesAny(a, [q]))) return 2;
  return 0;
}

function renderLexeme(r, extras = {}) {
  const aliases = (r['aliases']||'').split('|').filter(Boolean);
  const variantsChs = (r['variants_chs']||'').split('|').filter(Boolean);
  const variantsEn = (r['variants_en']||'').split('|').filter(Boolean);
  const examples = (r['examples']||'').split('||').filter(Boolean);

  const disambig = extras.disambigHtml || '';

  $results.className = 'results';
  $results.innerHTML = `
    ${disambig}
    <div class="result-grid">
      <div class="card">
        <h3>${r['zhh'] || '(未填写粤语正字)'}</h3>
        <div class="row">
          <button class="speaker" data-say="${r['zhh'] || ''}">🔊 读粤语</button>
          ${aliases.map(a=>`<span class="badge alias">${a}</span>`).join('')}
        </div>
        <div class="kv"><span class="k">中文：</span>${r['chs'] || '-'}</div>
        <div class="kv"><span class="k">English：</span>${r['en'] || '-'}</div>
        <div class="kv"><span class="k">备注：</span>${r['notes'] || '-'}</div>
        <div class="btn-example" id="btnEx">example 扩展</div>
        <div class="examples" id="exList">
          ${examples.map(e=>`<div>· ${e}</div>`).join('') || '<div>暂无示例</div>'}
        </div>
      </div>
      <div class="card">
        <h3>变体 Variants</h3>
        <div class="row">
          ${variantsChs.map(v=>`<span class="badge variant">${v}</span>`).join('')}
          ${variantsEn.map(v=>`<span class="badge variant">${v}</span>`).join('')}
        </div>
      </div>
    </div>
  `;

  document.querySelectorAll('.speaker').forEach(btn => {
    btn.addEventListener('click', () => speakHK(btn.dataset.say || ''));
  });
  const exBtn = document.getElementById('btnEx');
  if (exBtn) exBtn.addEventListener('click', () => {
    const ex = document.getElementById('exList');
    ex.style.display = ex.style.display === 'block' ? 'none' : 'block';
  });
}

function renderDisambig(termKey, ids) {
  // 生成歧义选择卡
  const rows = Array.from(ids).map(id => BY_ID.get(id)).filter(Boolean);
  if (!rows.length) return '';
  const items = rows.map(r => `
    <div class="option" data-id="${r['id']}">${r['zhh'] || '(未命名)'} <span class="hintline">#${r['id']}</span></div>
  `).join('');
  return `
    <div class="card">
      <h3>选择：和「${termKey}」相关的 zhh</h3>
      <div class="hintline">crossmap 中该键映射到多个 ID，请选择想要的词条：</div>
      <div class="option-list">${items}</div>
    </div>
  `;
}

function attachDisambigHandlers(termKey, ids) {
  document.querySelectorAll('.option').forEach(el => {
    el.addEventListener('click', () => {
      const id = el.getAttribute('data-id');
      const r = BY_ID.get(id);
      if (r) renderLexeme(r); else searchFallback(termKey);
    });
  });
}

function searchFallback(q) {
  const ranked = LEX.map(row => ({row, score: scoreRow(row, q)}))
                    .filter(x => x.score > 0)
                    .sort((a,b)=>b.score-a.score)
                    .map(x => x.row);
  if (ranked.length) renderLexeme(ranked[0]);
  else {
    $results.className = 'results empty';
    $results.innerHTML = '<div class="placeholder">没有找到结果，换个说法再试试。</div>';
  }
}

function search() {
  const q = $q.value.trim();
  if (!q) return;
  const key = norm(q);
  if (XMAP.has(key)) {
    const ids = XMAP.get(key);
    if (ids.size > 1) {
      const html = renderDisambig(q, ids);
      // 默认也展示第一个，用户可点击切换
      const first = BY_ID.get(Array.from(ids)[0]);
      renderLexeme(first || {}, { disambigHtml: html });
      attachDisambigHandlers(q, ids);
      return;
    } else if (ids.size === 1) {
      const id = Array.from(ids)[0];
      const r = BY_ID.get(id);
      if (r) { renderLexeme(r); return; }
    }
  }
  // 没有 crossmap 或无匹配 → 原始回退
  searchFallback(q);
}

$q.addEventListener('keydown', e => { if (e.key === 'Enter') search(); });
$btn.addEventListener('click', search);