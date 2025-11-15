// Can-Tong front-end (crossmap-only search version)
// 搜索逻辑：只允许在 crossmap.csv 里出现的 term 进行查询，
// 再用 crossmap 里的 target_id 精准找到 lexeme。

(function () {
  const LEXEME_URL = '/data/lexeme.csv';
  const CROSSMAP_URL = '/data/crossmap.csv';
  const EXAMPLES_URL = '/data/examples.csv';

  const lexemeList = [];
  const lexemeById = new Map();
  const aliasToId = new Map();      // term(normalized) -> target_id
  const examplesByLexId = new Map();// lexeme_id -> [examples...]

  let $q, $grid, $examplesSection, $examplesList;

  function normalize(str) {
    return (str || '').trim().toLowerCase();
  }

  // --- CSV 解析（支持简单引号与逗号） ---
  function parseCSV(text) {
    const rows = [];
    let cur = [];
    let field = '';
    let inQuotes = false;

    for (let i = 0; i < text.length; i++) {
      const ch = text[i];
      if (inQuotes) {
        if (ch === '"') {
          if (text[i + 1] === '"') {
            field += '"';
            i++;
          } else {
            inQuotes = false;
          }
        } else {
          field += ch;
        }
      } else {
        if (ch === '"') {
          inQuotes = true;
        } else if (ch === ',') {
          cur.push(field);
          field = '';
        } else if (ch === '\n') {
          cur.push(field);
          rows.push(cur);
          cur = [];
          field = '';
        } else if (ch === '\r') {
          // skip
        } else {
          field += ch;
        }
      }
    }
    if (field !== '' || cur.length) {
      cur.push(field);
      rows.push(cur);
    }
    return rows;
  }

  function rowsToObjects(rows) {
    if (!rows.length) return [];
    const header = rows[0].map(h => (h || '').trim());
    const objs = [];
    for (let i = 1; i < rows.length; i++) {
      const row = rows[i];
      if (!row || !row.length) continue;
      const obj = {};
      for (let j = 0; j < header.length; j++) {
        const key = header[j];
        if (!key) continue;
        obj[key] = (row[j] || '').trim();
      }
      // 跳过完全空行
      if (Object.values(obj).join('').trim() === '') continue;
      objs.push(obj);
    }
    return objs;
  }

  function get(obj, keys, fallback = '') {
    for (const k of keys) {
      if (k in obj && obj[k] != null && String(obj[k]).trim() !== '') {
        return String(obj[k]).trim();
      }
    }
    return fallback;
  }

  // --- 加载 lexeme.csv ---
  async function loadLexemes() {
    const resp = await fetch(LEXEME_URL);
    if (!resp.ok) throw new Error('lexeme.csv load failed');
    const text = await resp.text();
    const rows = parseCSV(text);
    const objs = rowsToObjects(rows);

    for (let i = 0; i < objs.length; i++) {
      const o = objs[i];
      const id = get(o, ['id'], String(i + 1));
      const lex = {
        id,
        key: get(o, ['key']),
        zhh_main: get(o, ['head_zhh', 'zhh', 'head_yue']),
        zhh_alt1: get(o, ['zhh_alt1', 'zhh_var1', 'alias_zhh1']),
        zhh_alt2: get(o, ['zhh_alt2', 'zhh_var2', 'alias_zhh2']),
        chs: get(o, ['head_chs', 'chs']),
        en: get(o, ['head_en', 'en']),
        variants_chs: get(o, ['variants_chs']),
        variants_en: get(o, ['variants_en']),
        note_chs: get(o, ['note_chs']),
        note_en: get(o, ['note_en']),
      };
      lexemeList.push(lex);
      lexemeById.set(id, lex);
    }
  }

  // --- 加载 crossmap.csv：term -> target_id ---
  async function loadCrossmap() {
    const resp = await fetch(CROSSMAP_URL);
    if (!resp.ok) throw new Error('crossmap.csv load failed');
    const text = await resp.text();
    const rows = parseCSV(text);
    if (!rows.length) return;

    let start = 0;
    if (rows[0].length > 1) {
      const last = (rows[0][rows[0].length - 1] || '').toLowerCase();
      if (last.includes('id')) {
        start = 1; // 跳过表头
      }
    }

    for (let i = start; i < rows.length; i++) {
      const row = rows[i];
      if (!row || row.length < 2) continue;
      let term = (row[0] || '').trim();
      const targetId = (row[row.length - 1] || '').trim();
      if (!term || !targetId) continue;
      if (term.length >= 2 && term[0] === '"' && term[term.length - 1] === '"') {
        term = term.slice(1, -1);
      }
      const key = normalize(term);
      if (!key) continue;
      if (!aliasToId.has(key)) {
        aliasToId.set(key, targetId);
      }
    }
  }

  // --- 加载 examples.csv ---
  async function loadExamples() {
    try {
      const resp = await fetch(EXAMPLES_URL);
      if (!resp.ok) return;
      const text = await resp.text();
      const rows = parseCSV(text);
      const objs = rowsToObjects(rows);
      if (!objs.length) return;

      for (const o of objs) {
        const lexId =
          get(o, ['lexeme_id', 'target_id', 'id']) || null;
        if (!lexId) continue;
        const ex = {
          yue: get(o, ['ex_zhh', 'ex_yue', 'zhh']),
          chs: get(o, ['ex_chs', 'chs']),
          en: get(o, ['ex_en', 'en']),
        };
        if (!examplesByLexId.has(lexId)) {
          examplesByLexId.set(lexId, []);
        }
        examplesByLexId.get(lexId).push(ex);
      }
    } catch (e) {
      console.error('examples.csv load failed', e);
    }
  }

  // --- UI 渲染 ---

  function clearUI() {
    if ($grid) $grid.innerHTML = '';
    if ($examplesList) $examplesList.innerHTML = '';
    if ($examplesSection) $examplesSection.hidden = true;
  }

  function renderNoResult() {
    clearUI();
    if (!$grid) return;
    const card = document.createElement('article');
    card.className = 'card gray show';
    card.textContent = 'No result in crossmap for this query.';
    $grid.appendChild(card);
  }

  function createTtsButton(text) {
    const btn = document.createElement('button');
    btn.className = 'tts';
    btn.type = 'button';
    btn.setAttribute('data-tts-text', text || '');
    btn.innerHTML =
      '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M3 9v6h4l5 5V4L7 9H3zm13.5 3a4.5 4.5 0 0 0-2.5-4.06v8.12A4.5 4.5 0 0 0 16.5 12zm0-7.5v2.06A7.5 7.5 0 0 1 21 12a7.5 7.5 0 0 1-4.5 6.94V21A9.5 9.5 0 0 0 23 12 9.5 9.5 0 0 0 16.5 4.5z"></path></svg>';
    btn.addEventListener('click', () => {
      const txt = btn.getAttribute('data-tts-text') || '';
      if (!txt) return;
      try {
        const msg = new SpeechSynthesisUtterance(txt);
        msg.lang = 'zh-HK';
        window.speechSynthesis.cancel();
        window.speechSynthesis.speak(msg);
      } catch (e) {
        console.warn('TTS failed', e);
      }
    });
    return btn;
  }

  function renderExamples(lexId, examples) {
    if (!$examplesList || !$examplesSection) return;
    $examplesList.innerHTML = '';
    if (!examples || !examples.length) {
      $examplesSection.hidden = true;
      return;
    }

    for (const ex of examples) {
      const row = document.createElement('div');
      row.className = 'example';

      const yue = document.createElement('div');
      yue.className = 'yue';
      yue.textContent = ex.yue || '';

      const mid = document.createElement('div');
      const en = document.createElement('div');
      en.className = 'en';
      en.textContent = ex.en || '';
      const chs = document.createElement('div');
      chs.className = 'chs';
      chs.textContent = ex.chs || '';
      mid.appendChild(en);
      mid.appendChild(chs);

      const btns = document.createElement('div');
      btns.className = 'btns';
      btns.appendChild(createTtsButton(ex.yue || ''));

      row.appendChild(yue);
      row.appendChild(mid);
      row.appendChild(btns);

      $examplesList.appendChild(row);
    }

    $examplesSection.hidden = false;
  }

  function renderLexeme(lex) {
    clearUI();
    if (!$grid) return;

    // 左侧黄卡
    const left = document.createElement('article');
    left.className = 'card yellow left show';

    const badge = document.createElement('div');
    badge.className = 'badge';
    badge.textContent = '粤语zhh：';
    left.appendChild(badge);

    const hHead = document.createElement('div');
    hHead.className = 'h-head';

    const hTitle = document.createElement('h1');
    hTitle.className = 'h-title';
    hTitle.textContent = lex.zhh_main || lex.key || '';
    hHead.appendChild(hTitle);

    if (lex.zhh_main) {
      hHead.appendChild(createTtsButton(lex.zhh_main));
    }
    left.appendChild(hHead);

    const varsWrap = document.createElement('div');
    varsWrap.className = 'vars';

    function addAltRow(text) {
      if (!text) return;
      const row = document.createElement('div');
      row.className = 'row';
      const span = document.createElement('div');
      span.textContent = text;
      row.appendChild(span);
      row.appendChild(createTtsButton(text));
      varsWrap.appendChild(row);
    }

    addAltRow(lex.zhh_alt1);
    addAltRow(lex.zhh_alt2);
    left.appendChild(varsWrap);

    // 右上粉卡（变体）
    const rightTop = document.createElement('article');
    rightTop.className = 'card pink right-top show';

    const varRow = document.createElement('div');
    varRow.className = 'var-row';

    if (lex.variants_en) {
      const el = document.createElement('div');
      el.className = 'var-en';
      el.textContent = lex.variants_en;
      varRow.appendChild(el);
    }
    if (lex.variants_chs) {
      const el = document.createElement('div');
      el.className = 'var-zh';
      el.textContent = lex.variants_chs;
      varRow.appendChild(el);
    }
    rightTop.appendChild(varRow);

    // 右下灰卡（note + example 按钮）
    const rightBottom = document.createElement('article');
    rightBottom.className = 'card gray right-bottom show';

    const noteBox = document.createElement('div');
    noteBox.className = 'note';

    if (lex.note_en) {
      const p = document.createElement('div');
      p.textContent = lex.note_en;
      noteBox.appendChild(p);
    }
    if (lex.note_chs) {
      const p = document.createElement('div');
      p.textContent = lex.note_chs;
      noteBox.appendChild(p);
    }

    rightBottom.appendChild(noteBox);

    const exampleBtn = document.createElement('button');
    exampleBtn.id = 'example-btn';
    exampleBtn.type = 'button';
    exampleBtn.textContent = 'example 扩展';
    rightBottom.appendChild(exampleBtn);

    // 挂到 grid
    $grid.appendChild(left);
    $grid.appendChild(rightTop);
    $grid.appendChild(rightBottom);

    // 例句按钮逻辑
    exampleBtn.addEventListener('click', () => {
      const list = examplesByLexId.get(lex.id) || [];
      if ($examplesSection && !$examplesSection.hidden) {
        // 收起
        $examplesSection.hidden = true;
      } else {
        renderExamples(lex.id, list);
      }
    });
  }

  function doSearch() {
    const q = normalize($q && $q.value);
    if (!q) {
      clearUI();
      return;
    }
    const targetId = aliasToId.get(q);
    if (!targetId) {
      renderNoResult();
      return;
    }
    const lex = lexemeById.get(targetId);
    if (!lex) {
      renderNoResult();
      return;
    }
    renderLexeme(lex);
  }

  function setupUI() {
    $q = document.getElementById('q');
    $grid = document.getElementById('grid');
    $examplesSection = document.getElementById('examples');
    $examplesList = document.getElementById('examples-list');

    if (!$q) return;

    $q.addEventListener('keydown', function (evt) {
      if (evt.key === 'Enter' || evt.keyCode === 13) {
        evt.preventDefault();
        doSearch();
      }
    });
  }

  document.addEventListener('DOMContentLoaded', function () {
    setupUI();
    Promise.all([loadLexemes(), loadCrossmap(), loadExamples()])
      .then(() => {
        console.log('Data loaded: lexemes=%d, aliases=%d', lexemeById.size, aliasToId.size);
      })
      .catch(err => {
        console.error('Init failed', err);
      });
  });
})();
