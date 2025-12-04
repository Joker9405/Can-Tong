const PATH = '/data/';
let CROSS = [], LEX = {}, EXMAP = {};

// =================== CSV 解析（支持换行 & 引号） ===================
function parseCSV(text) {
  const rows = [];
  let curField = '';
  let curRow = [];
  let inQuotes = false;

  for (let i = 0; i < text.length; i++) {
    const ch = text[i];

    if (ch === '"') {
      // 处理转义引号 ""
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
      if (ch === '\r' && text[i + 1] === '\n') i++; // 兼容 \r\n
      curRow.push(curField);
      curField = '';
      if (curRow.some(c => c.trim() !== '')) {
        rows.push(curRow);
      }
      curRow = [];
      continue;
    }

    curField += ch;
  }

  // 收尾最后一行
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

// 保留工具函数（当前不再用 fuzzy，只是预留）
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

// =================== 语音 ===================
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

// =================== 载入数据 ===================
async function boot() {
  const [cm, lx, ex] = await Promise.all([
    loadCSV('crossmap.csv'),
    loadCSV('lexeme.csv'),
    loadCSV('examples.csv'),
  ]);
  CROSS = cm;

  lx.forEach(r => {
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

// =================== 搜索逻辑（只看 crossmap.term） ===================
function termKey(s) {
  return (s || '').trim().toLowerCase();
}

/**
 * 只在 crossmap.csv 的 term 字段里做精确匹配：
 * - 用 / ; ； 分隔多写法
 * - 忽略大小写
 * - 不做模糊匹配
 */
function findLexemeIds(q) {
  const rawQuery = (q || '').trim();
  if (!rawQuery) return [];

  const key = termKey(rawQuery);
  const set = new Set();

  CROSS.forEach(r => {
    const rawTerm = (r.term || '').trim();
    if (!rawTerm) return;

    const parts = rawTerm
      .split(/[\/;；]/)
      .map(s => s.trim())
      .filter(Boolean);

    for (const p of parts) {
      if (termKey(p) === key) {
        const id = (r.target_id || '').trim();
        if (id) set.add(id);
        break;
      }
    }
  });

  return Array.from(set);
}

// =================== UI ===================
const grid = document.getElementById('grid');
const examples = document.getElementById('examples');
const examplesList = document.getElementById('examples-list');

function resetUI() {
  grid.innerHTML = '';
  examples.hidden = true;
  examplesList.innerHTML = '';
}

function renderEmpty() { resetUI(); }

// 这个 pairedVariants 保留，以后要恢复旧样式可以用，现在不再调用
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

  // alias_zhh：保留「；」拆行逻辑
  const aliases = (lex.alias_zhh || '').split(/[;；]/).map(s => s.trim()).filter(Boolean);

  // note：保持原有逻辑（英文在上，中文在下）
  const noteHtml =
    (lex.note_en || '') +
    (lex.note_chs ? ('<br>' + lex.note_chs) : '');

  // variants：不再按「；」拆分，只当成两段文本和 note 一样展示
  const variantsHtml =
    (lex.variants_en || '') +
    (lex.variants_chs ? ('<br>' + lex.variants_chs) : '');

  // ---------- 左侧：粤语 + alias ----------
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

  // ---------- 右上：variants（样式跟 note 一样的块文本） ----------
  setTimeout(() => {
    const rt = document.createElement('div');
    rt.className = 'card pink right-top';
    rt.innerHTML = `
      <div class="note">${variantsHtml || ''}</div>
    `;
    grid.appendChild(rt);
    requestAnimationFrame(() => rt.classList.add('show'));

    // ---------- 右下：note + example 按钮 ----------
    const rb = document.createElement('div');
    rb.className = 'card gray right-bottom';
    rb.innerHTML = `
      <div class="note">${noteHtml || ''}</div>
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

// =================== 输入监听 ===================
document.getElementById('q').addEventListener('input', e => {
  const q = e.target.value;
  if (!q) { renderEmpty(); return; }

  // 每次输入用当前完整 query 去 crossmap 精确匹配
  const ids = findLexemeIds(q);

  if (!ids.length) {
    // 没精确命中就不显示任何解释
    renderEmpty();
    return;
  }

  const lex = LEX[ids[0]];
  renderPhased(lex);
});

boot();
