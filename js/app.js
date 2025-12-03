const PATH = '/data/';
let CROSS = [], LEX = {}, EXMAP = {};

// =================== CSV 解析（支持换行 & 引号） ===================
// 注意：这里是重新实现的解析器，可以正确处理含换行的 note / variants
function parseCSV(text) {
  const rows = [];
  let curField = '';
  let curRow = [];
  let inQuotes = false;

  for (let i = 0; i < text.length; i++) {
    const ch = text[i];

    if (ch === '"') {
      // 处理转义的引号 ""
      if (inQuotes && text[i + 1] === '"') {
        curField += '"';
        i++;
      } else {
        inQuotes = !inQuotes;
      }
      continue;
    }

    // 逗号分隔字段（不在引号内）
    if (ch === ',' && !inQuotes) {
      curRow.push(curField);
      curField = '';
      continue;
    }

    // 换行分隔行（不在引号内）
    if ((ch === '\n' || ch === '\r') && !inQuotes) {
      // 兼容 \r\n
      if (ch === '\r' && text[i + 1] === '\n') i++;
      curRow.push(curField);
      curField = '';
      // 行非全空才 push
      if (curRow.some(c => c.trim() !== '')) {
        rows.push(curRow);
      }
      curRow = [];
      continue;
    }

    curField += ch;
  }

  // 末尾最后一行
  if (curField.length || curRow.length) {
    curRow.push(curField);
    if (curRow.some(c => c.trim() !== '')) {
      rows.push(curRow);
    }
  }

  if (!rows.length) return [];

  const head = rows[0].map(s => s.trim());
  const dataRows = rows.slice(1);

  return dataRows.map(cells => {
    const obj = {};
    head.forEach((k, i) => {
      obj[k] = (cells[i] || '').trim();
    });
    return obj;
  });
}

async function loadCSV(name) {
  const r = await fetch(PATH + name, { cache: 'no-store' });
  if (!r.ok) throw new Error('load ' + name + ' failed');
  return parseCSV(await r.text());
}

// （保留的工具函数，当前版本没用 fuzzy，只做精确匹配）
function norm(s) {
  return (s || '').toLowerCase().replace(/\s+/g, '');
}

function fuzzy(text, q) {
  text = norm(text);
  q = norm(q);
  if (!q) return false;
  let i = 0;
  for (const c of text) {
    if (c === q[i]) i++;
  }
  return i === q.length || text.includes(q);
}

// 语音部分保留
let VOICE = null;
function pickVoice() {
  const L = speechSynthesis.getVoices();
  VOICE =
    L.find(v => /yue|Cantonese|zh[-_]HK/i.test(v.lang + v.name)) ||
    L.find(v => /zh[-_]HK/i.test(v.lang)) ||
    L.find(v => /zh/i.test(v.lang)) ||
    null;
}
if ('speechSynthesis' in window) {
  speechSynthesis.onvoiceschanged = pickVoice;
  pickVoice();
}

function speak(t) {
  if (!('speechSynthesis' in window) || !t) return;
  const u = new SpeechSynthesisUtterance(t);
  if (VOICE) u.voice = VOICE;
  u.lang = VOICE?.lang || 'zh-HK';
  speechSynthesis.cancel();
  speechSynthesis.speak(u);
}

const ICON = `<svg viewBox="0 0 24 24"><path d="M3 10v4h4l5 4V6L7 10H3zm13.5 2a3.5 3.5 0 0 0-2.5-3.34v6.68A3.5 3.5 0 0 0 16.5 12zm0-7a9.5 9.5 0 0 1 0 14l1.5 1.5A11.5 11.5 0 0 0 18 3.5L16.5 5z"/></svg>`;

// 载入 crossmap / lexeme / examples
async function boot() {
  const [cm, lx, ex] = await Promise.all([
    loadCSV('crossmap.csv'),
    loadCSV('lexeme.csv'),
    loadCSV('examples.csv'),
  ]);
  CROSS = cm;
  lx.forEach(r => {
    // 确保 id 作为字符串 key
    if (r.id != null && r.id !== '') {
      LEX[String(r.id).trim()] = r;
    }
  });
  EXMAP = ex.reduce((m, r) => {
    const lid = (r.lexeme_id || '').trim();
    if (!lid) return m;
    (m[lid] || (m[lid] = [])).push(r);
    return m;
  }, {});
}

// ===== 搜索只看 crossmap.term，大小写不敏感，完全匹配 =====

// 统一 term / query 的对比键：去掉首尾空格 + 全部小写
function termKey(s) {
  return (s || '').trim().toLowerCase();
}

/**
 * 只在 crossmap.csv 的 term 字段里做精确匹配：
 * - 用 "/" 或 ";"、"；" 分隔多个写法
 * - 中英文都可以
 * - 英文忽略大小写（termKey 统一小写）
 * - 不做任何模糊匹配，不做包含匹配
 */
function findLexemeIds(q) {
  const rawQuery = (q || '').trim();
  if (!rawQuery) return [];

  const key = termKey(rawQuery);
  const set = new Set();

  CROSS.forEach(r => {
    const rawTerm = (r.term || '').trim();
    if (!rawTerm) return;

    // 支持多种分隔符：/ ; ；
    const parts = rawTerm
      .split(/[\/;；]/)
      .map(s => s.trim())
      .filter(Boolean);

    for (const p of parts) {
      if (termKey(p) === key) {
        const id = (r.target_id || '').trim();
        if (id) set.add(id);
        break; // 同一行命中一次就够了
      }
    }
  });

  return Array.from(set);
}

// ===== UI / 渲染代码（保持原有交互） =====

const grid = document.getElementById('grid');
const examples = document.getElementById('examples');
const examplesList = document.getElementById('examples-list');

function resetUI() {
  grid.innerHTML = '';
  examples.hidden = true;
  examplesList.innerHTML = '';
}

function renderEmpty() { resetUI(); }

function pairedVariants(chs, en) {
  const A = (chs || '').split(/[;；]/).map(s => s.trim()).filter(Boolean);
  const B = (en || '').split(/[;；]/).map(s => s.trim()).filter(Boolean);
  const n = Math.max(A.length, B.length);
  const out = [];
  for (let i = 0; i < n; i++) {
    out.push({ zh: A[i] || '', en: B[i] || '' });
  }
  return out;
}

function renderPhased(lex) {
  if (!lex) {
    resetUI();
    return;
  }

  resetUI();
  const aliases = (lex.alias_zhh || '').split(/[;；]/).map(s => s.trim()).filter(Boolean);
  const variants = pairedVariants(lex.variants_chs, lex.variants_en);
  const note = (lex.note_en || '') + (lex.note_chs ? ('<br>' + lex.note_chs) : '');

  const left = document.createElement('div');
  left.className = 'card yellow left';
  left.innerHTML = `
    <div class="badge">粤语zhh：</div>
    <div class="h-head">
      <div class="h-title">${lex.zhh || '—'}</div>
      <button class="tts t-head" title="发音">${ICON}</button>
    </div>
    ${aliases.map(a => `
      <div class="row">
        <div class="alias">${a}</div>
        <button class="tts">${ICON}</button>
      </div>
    `).join('')}
  `;
  grid.appendChild(left);
  requestAnimationFrame(() => left.classList.add('show'));

  left.querySelector('.t-head').onclick = () => speak(lex.zhh || '');
  left.querySelectorAll('.row .tts').forEach((b, i) => b.onclick = () => speak(aliases[i]));

  setTimeout(() => {
    const rt = document.createElement('div');
    rt.className = 'card pink right-top';
    rt.innerHTML = `
      <div class="vars">
        ${variants.map(v => `
          <div class="var-row">
            <div class="var-zh">${v.zh}</div>
            ${v.en ? `<div class="var-en">${v.en}</div>` : ''}
          </div>
        `).join('')}
      </div>
    `;
    grid.appendChild(rt);
    requestAnimationFrame(() => rt.classList.add('show'));

    const rb = document.createElement('div');
    rb.className = 'card gray right-bottom';
    rb.innerHTML = `
      <div class="note">${note || ''}</div>
      <button id="example-btn">example 扩展</button>
    `;
    grid.appendChild(rb);
    requestAnimationFrame(() => rb.classList.add('show'));

    rb.querySelector('#example-btn').onclick =
      () => toggleExamples(lex, rb.querySelector('#example-btn'));
  }, 120);
}

function toggleExamples(lex, btn) {
  const exs = EXMAP[lex.id] || [];
  if (!exs.length) return;

  if (examples.hidden) {
    examplesList.innerHTML = '';
    exs.forEach(e => {
      const row = document.createElement('div');
      row.className = 'example';
      row.innerHTML = `
        <div class="yue">${e.ex_zhh || ''}</div>
        <div class="right">
          <div class="en">${e.ex_en || ''}</div>
          <div class="chs">${e.ex_chs || ''}</div>
        </div>
        <div class="btns">
          <button class="tts" title="粤语">${ICON}</button>
        </div>
      `;
      row.querySelector('.tts').onclick = () => speak(e.ex_zhh || '');
      examplesList.appendChild(row);
    });
    examples.hidden = false;
    btn.remove();
  } else {
    examples.hidden = true;
  }
}

document.getElementById('q').addEventListener('input', e => {
  const q = e.target.value;
  if (!q) { renderEmpty(); return; }

  // 每输入一个字符，都用当前完整输入去 crossmap 精确匹配
  const ids = findLexemeIds(q);

  if (!ids.length) {
    // 没有精确命中：不展示任何解释（避免模糊搜索效果）
    renderEmpty();
    return;
  }

  const lex = LEX[ids[0]];
  renderPhased(lex);
});

boot();
