// app.js — crossmap-only search version
// 只通过 crossmap.csv 的 term -> target_id 做精确匹配；不再做英文模糊搜索。

(function() {
  const LEXEME_URL = '/data/lexeme.csv';
  const CROSSMAP_URL = '/data/crossmap.csv';
  const EXAMPLES_URL = '/data/examples.csv';

  const state = {
    lexemesById: new Map(),
    crossByTerm: new Map(),  // term(lowercased) -> [{ term, lang, level, target_id }]
    examplesByLexeme: new Map(), // lexeme_id -> [exampleRows]
    ready: false
  };

  function normalize(str) {
    return (str || '').trim().toLowerCase();
  }

  // 简单 CSV 行拆分，支持双引号包含逗号
  function splitCsvLine(line) {
    const out = [];
    let cur = '';
    let inQuotes = false;

    for (let i = 0; i < line.length; i++) {
      const ch = line[i];
      if (ch === '"') {
        if (inQuotes && line[i + 1] === '"') {
          cur += '"';
          i++;
        } else {
          inQuotes = !inQuotes;
        }
      } else if (ch === ',' && !inQuotes) {
        out.push(cur);
        cur = '';
      } else {
        cur += ch;
      }
    }
    out.push(cur);
    return out;
  }

  function parseCsv(text) {
    const lines = text.replace(/\r\n/g, '\n').replace(/\r/g, '\n').split('\n').filter(l => l.trim() !== '');
    if (!lines.length) return [];
    const header = splitCsvLine(lines[0]).map(h => h.trim());
    const rows = [];

    for (let i = 1; i < lines.length; i++) {
      const cols = splitCsvLine(lines[i]);
      const row = {};
      for (let j = 0; j < header.length; j++) {
        const key = header[j] || ('col' + j);
        let val = cols[j] || '';
        // 去掉包裹的引号
        val = val.replace(/^"(.*)"$/, '$1');
        row[key] = val;
      }
      rows.push(row);
    }
    return rows;
  }

  async function loadAll() {
    const [lexemeText, crossText, exText] = await Promise.all([
      fetch(LEXEME_URL).then(r => r.text()),
      fetch(CROSSMAP_URL).then(r => r.text()),
      fetch(EXAMPLES_URL).then(r => r.text())
    ]);

    const lexemeRows = parseCsv(lexemeText);
    const crossRows = parseCsv(crossText);
    const exRows = parseCsv(exText);

    // 1) lexeme: 建 id -> row 映射
    lexemeRows.forEach(row => {
      const id = row.id || row.lexeme_id || row.target_id || row.key || row.head || null;
      if (!id) return;
      state.lexemesById.set(String(id), row);
    });

    // 2) crossmap: term(lower) -> 数组
    crossRows.forEach(row => {
      const termKey = row.term || row.surface || row.text || row.alias || row.q;
      if (!termKey) return;
      const keyNorm = normalize(termKey);
      const list = state.crossByTerm.get(keyNorm) || [];
      list.push(row);
      state.crossByTerm.set(keyNorm, list);
    });

    // 3) examples: lexeme_id/target_id -> 数组
    exRows.forEach(row => {
      const lid = row.lexeme_id || row.target_id || row.id;
      if (!lid) return;
      const key = String(lid);
      const list = state.examplesByLexeme.get(key) || [];
      list.push(row);
      state.examplesByLexeme.set(key, list);
    });

    state.ready = true;
  }

  function getMainYue(row) {
    // 取第一个非空的粤语字段作为主词
    return row.zhh || row.yue || row.yue_main || row.head_zhh || row.head || '';
  }

  function getYueVariants(row) {
    const result = [];
    const keys = Object.keys(row);
    keys.forEach(k => {
      const lk = k.toLowerCase();
      if (lk === 'zhh' || lk === 'yue') {
        if (row[k]) result.push(row[k]);
      } else if (lk.startsWith('zhh_') || lk.startsWith('yue_')) {
        if (row[k]) result.push(row[k]);
      }
    });
    // 去重
    const seen = new Set();
    return result.filter(v => {
      const t = v.trim();
      if (!t || seen.has(t)) return false;
      seen.add(t);
      return true;
    });
  }

  function getField(row, names) {
    for (const n of names) {
      if (n in row && row[n]) return row[n];
    }
    return '';
  }

  function buildGridForLexeme(lexemeRow) {
    const grid = document.getElementById('grid');
    if (!grid) return;
    grid.innerHTML = '';

    const id = String(lexemeRow.id || lexemeRow.lexeme_id || lexemeRow.target_id || '');

    const mainYue = getMainYue(lexemeRow);
    const yueVariants = getYueVariants(lexemeRow);
    if (!yueVariants.length && mainYue) yueVariants.push(mainYue);

    const variantsChs = getField(lexemeRow, ['variants_chs', 'var_chs']);
    const variantsEn = getField(lexemeRow, ['variants_en', 'var_en']);
    const noteChs = getField(lexemeRow, ['note_chs', 'notes_chs', 'chs_note']);
    const noteEn = getField(lexemeRow, ['note_en', 'notes_en', 'en_note']);

    // 左侧黄卡
    const left = document.createElement('article');
    left.className = 'card yellow left show';

    const badge = document.createElement('div');
    badge.className = 'badge';
    badge.textContent = '粵語zhh：';
    left.appendChild(badge);

    const hHead = document.createElement('div');
    hHead.className = 'h-head';

    const hTitle = document.createElement('h1');
    hTitle.className = 'h-title';
    hTitle.textContent = mainYue || (yueVariants[0] || '');
    hHead.appendChild(hTitle);

    if (mainYue) {
      const ttsBtn = createTtsButton(mainYue);
      hHead.appendChild(ttsBtn);
    }
    left.appendChild(hHead);

    const varsWrap = document.createElement('div');
    varsWrap.className = 'vars';
    yueVariants.forEach((yv, idx) => {
      const row = document.createElement('div');
      row.className = 'row';
      const span = document.createElement('span');
      span.textContent = yv;
      row.appendChild(span);
      const btn = createTtsButton(yv);
      row.appendChild(btn);
      varsWrap.appendChild(row);
    });
    left.appendChild(varsWrap);

    // 右上粉卡：variants
    const rightTop = document.createElement('article');
    rightTop.className = 'card pink right-top show';
    const vRow = document.createElement('div');
    vRow.className = 'var-row';

    if (variantsEn) {
      const enDiv = document.createElement('div');
      enDiv.className = 'var-en';
      enDiv.textContent = variantsEn;
      vRow.appendChild(enDiv);
    }
    if (variantsChs) {
      const chsDiv = document.createElement('div');
      chsDiv.className = 'var-zh';
      chsDiv.textContent = variantsChs;
      vRow.appendChild(chsDiv);
    }
    rightTop.appendChild(vRow);

    // 右下灰卡：note
    const rightBottom = document.createElement('article');
    rightBottom.className = 'card gray right-bottom show';

    const noteBox = document.createElement('div');
    noteBox.className = 'note';

    if (noteEn) {
      const nEn = document.createElement('div');
      nEn.textContent = noteEn;
      noteBox.appendChild(nEn);
    }
    if (noteChs) {
      const nChs = document.createElement('div');
      nChs.textContent = noteChs;
      noteBox.appendChild(nChs);
    }
    rightBottom.appendChild(noteBox);

    // example 扩展按钮
    const exBtn = document.createElement('button');
    exBtn.id = 'example-btn';
    exBtn.textContent = 'example 擴展';
    exBtn.addEventListener('click', () => {
      toggleExamples(id);
    });
    rightBottom.appendChild(exBtn);

    grid.appendChild(left);
    grid.appendChild(rightTop);
    grid.appendChild(rightBottom);

    // 渲染例句（默认收起）
    renderExamples(id, false);
  }

  function createTtsButton(text) {
    const btn = document.createElement('button');
    btn.className = 'tts';
    btn.type = 'button';
    btn.setAttribute('data-tts', text);
    btn.innerHTML = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M3 10v4h4l5 5V5L7 10H3zm13.5 2c0-1.77-.77-3.29-1.97-4.3v8.59A5.48 5.48 0 0 0 16.5 12zM14 3.23v2.06A7.49 7.49 0 0 1 19 12a7.49 7.49 0 0 1-5 6.71v2.06A9.49 9.49 0 0 0 21 12 9.49 9.49 0 0 0 14 3.23z"></path></svg>';
    btn.addEventListener('click', () => playTts(text));
    return btn;
  }

  let ttsAudio;
  function playTts(text) {
    if (!text) return;
    try {
      if (!ttsAudio) {
        ttsAudio = new Audio();
      } else {
        ttsAudio.pause();
      }
      const url = '/api/tts?q=' + encodeURIComponent(text);
      ttsAudio.src = url;
      ttsAudio.play();
    } catch (err) {
      console.error('TTS error', err);
    }
  }

  function renderExamples(lexemeId, expandNow) {
    const exSection = document.getElementById('examples');
    const list = document.getElementById('examples-list');
    if (!exSection || !list) return;

    list.innerHTML = '';

    const items = state.examplesByLexeme.get(String(lexemeId)) || [];
    if (!items.length) {
      exSection.hidden = true;
      return;
    }

    items.forEach(row => {
      const ex = document.createElement('div');
      ex.className = 'example';

      const yue = getField(row, ['ex_zhh', 'ex_yue', 'yue']);
      const chs = getField(row, ['ex_chs', 'chs']);
      const en = getField(row, ['ex_en', 'en']);

      const yueDiv = document.createElement('div');
      yueDiv.className = 'yue';
      yueDiv.textContent = yue;
      ex.appendChild(yueDiv);

      const textWrap = document.createElement('div');
      if (en) {
        const enDiv = document.createElement('div');
        enDiv.className = 'en';
        enDiv.textContent = en;
        textWrap.appendChild(enDiv);
      }
      if (chs) {
        const chsDiv = document.createElement('div');
        chsDiv.className = 'chs';
        chsDiv.textContent = chs;
        textWrap.appendChild(chsDiv);
      }
      ex.appendChild(textWrap);

      const btns = document.createElement('div');
      btns.className = 'btns';
      const ttsBtn = createTtsButton(yue);
      btns.appendChild(ttsBtn);
      ex.appendChild(btns);

      list.appendChild(ex);
    });

    exSection.hidden = !expandNow;
  }

  function toggleExamples(lexemeId) {
    const sec = document.getElementById('examples');
    if (!sec) return;
    const isHidden = sec.hidden;
    if (isHidden) {
      renderExamples(lexemeId, true);
    } else {
      sec.hidden = true;
    }
  }

  function clearView() {
    const grid = document.getElementById('grid');
    if (grid) grid.innerHTML = '';
    const exSection = document.getElementById('examples');
    if (exSection) exSection.hidden = true;
  }

  function searchByCrossmapTerm(query) {
    const key = normalize(query);
    if (!key) return null;
    const rows = state.crossByTerm.get(key);
    if (!rows || !rows.length) return null;
    // 如果有多条，先拿第一条；后续可按 level/head 做排序
    const row = rows[0];
    const targetId = row.target_id || row.lexeme_id || row.id || row.key;
    if (!targetId) return null;
    return state.lexemesById.get(String(targetId)) || null;
  }

  function setupSearchBox() {
    const input = document.getElementById('q');
    if (!input) return;

    input.addEventListener('keydown', function(evt) {
      if (evt.key === 'Enter' || evt.keyCode === 13) {
        evt.preventDefault();
        const q = input.value;
        if (!q.trim()) {
          clearView();
          return;
        }

        const lexeme = searchByCrossmapTerm(q);
        if (!lexeme) {
          clearView();
          return;
        }

        buildGridForLexeme(lexeme);
      }
    });
  }

  document.addEventListener('DOMContentLoaded', function() {
    Promise.resolve()
      .then(loadAll)
      .then(() => {
        state.ready = true;
        setupSearchBox();
      })
      .catch(err => {
        console.error('Init error:', err);
      });
  });
})();
