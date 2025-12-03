const PATH = '/data/';
let CROSS = [], LEX = {}, EXMAP = {};

// 读取 CSV（保留你原来的解析逻辑）
function parseCSV(t) {
  const lines = t.split(/\r?\n/).filter(Boolean);
  const head = lines.shift().split(',').map(s => s.trim());
  return lines.map(line => {
    const cells = [];
    let cur = '', inQ = false;
    for (let i = 0; i < line.length; i++) {
      const ch = line[i];
      if (ch == '"') { inQ = !inQ; continue; }
      if (ch == ',' && !inQ) {
        cells.push(cur);
        cur = '';
      } else {
        cur += ch;
      }
    }
    cells.push(cur);
    const obj = {};
    head.forEach((k, i) => obj[k] = (cells[i] || '').trim());
    return obj;
  });
}

async function loadCSV(name) {
  const r = await fetch(PATH + name, { cache: 'no-store' });
  if (!r.ok) throw new Error('load ' + name + ' failed');
  return parseCSV(await r.text());
}

// 这两个函数保留（以后你要用模糊搜索还可以用），现在 findLexemeIds 不再使用它们
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
  lx.forEach(r => LEX[r.id] = r);
  EXMAP = ex.reduce((m, r) => {
    (m[r.lexeme_id] || (m[r.lexeme_id] = [])).push(r);
    return m;
  }, {});

  // 小工具：方便你在控制台排查某个 term
  window.debugTerm = function (term) {
    const q = (term || '').trim().toLowerCase();
    console.log('🔍 CROSS 命中的行：');
    console.log(CROSS.filter(r => (r.term || '').toLowerCase().includes(q)));
  };
}

// ⭐⭐ 核心：只按 crossmap.term 精确匹配（忽略大小写）+ 前缀保护 ⭐⭐
// 需求 2：在输入每一个字的时候，只“内部筛选”，但只有在“完全输入匹配的 term”
// 且不存在更长的候选时，才真正返回 target_id。
function findLexemeIds(q) {
  const query = (q || '').trim();
  if (!query) return [];

  const qLower = query.toLowerCase();
  const idsSet = new Set();
  let hasLongerCandidate = false;

  CROSS.forEach(r => {
    const rawTerm = (r.term || '').trim();
    if (!rawTerm) return;

    const parts = rawTerm
      .split('/')
      .map(s => s.trim())
      .filter(Boolean);

    for (const p of parts) {
      const t = p.toLowerCase();
      if (!t) continue;

      // 1）精确匹配（忽略大小写）→ 收集 candidate target_id
      if (t === qLower) {
        const id = (r.target_id || '').trim();
        if (id) idsSet.add(id);
      }

      // 2）如果当前输入是某个 term 的前缀，而且那个 term 比当前输入更长，
      //    说明用户可能还在继续输入 → 暂时不要出结果
      if (t.startsWith(qLower) && t.length > qLower.length) {
        hasLongerCandidate = true;
      }
    }
  });

  // 前缀保护：还存在更长的 term 以当前输入为前缀 → 不返回任何结果
  if (hasLongerCandidate) {
    return [];
  }

  // 没有更长前缀候选了 → 可以安全返回当前精确匹配的 target_id 列表
  const ids = Array.from(idsSet);

  // 为了避免像“侧侧膊”这种只命中一个“空解释”的词条，
  // 在这里按 lexeme 的「解释丰富度」做个排序，再交给 UI 使用 ids[0]
  ids.sort((a, b) => {
    const la = LEX[a] || {};
    const lb = LEX[b] || {};

    function score(lex) {
      let s = 0;
      if (lex.note_chs || lex.note_en) s += 2;
      if (lex.variants_chs || lex.variants_en) s += 1;
      if (lex.alias_zhh) s += 0.5;
      return s;
    }

    return score(lb) - score(la);
  });

  return ids;
}

// ===== UI / 渲染代码 =====

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
  if (!lex) { resetUI(); return; }

  resetUI();
  const aliases = (lex.alias_zhh || '').split(/[;；]/).map(s => s.trim()).filter(Boolean);
  const variants = pairedVariants(lex.variants_chs, lex.variants_en);
  const note = (lex.note_en || '') + (lex.note_chs ? ('<br>' + lex.note_chs) : '');

  const left = document.createElement('div');
  left.className = 'card yellow left';
  left.innerHTML = `
    <div class="badge">粤语 zhh：</div>
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
  const ids = findLexemeIds(q);
  if (!ids.length) { renderEmpty(); return; }
  const lex = LEX[ids[0]];
  renderPhased(lex);
});

boot();
