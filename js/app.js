// Can-Tong front-end (crossmap-based search version)
// 仅根据 crossmap.csv 的 term 精确匹配来找到 target_id，再用 lexeme.csv 渲染。

(function () {
  'use strict';

  // ----------- 工具函数 -----------

  function normalizeTerm(str) {
    return (str || '').trim().toLowerCase();
  }

  function splitCSVLine(line) {
    const result = [];
    let current = '';
    let inQuotes = false;

    for (let i = 0; i < line.length; i++) {
      const ch = line[i];
      if (inQuotes) {
        if (ch === '"') {
          if (i + 1 < line.length && line[i + 1] === '"') {
            current += '"';
            i++;
          } else {
            inQuotes = false;
          }
        } else {
          current += ch;
        }
      } else {
        if (ch === ',') {
          result.push(current);
          current = '';
        } else if (ch === '"') {
          inQuotes = true;
        } else {
          current += ch;
        }
      }
    }
    result.push(current);
    return result;
  }

  function parseCSV(text) {
    if (!text) return [];
    const lines = text.replace(/\r\n/g, '\n').replace(/\r/g, '\n').split('\n');
    if (!lines.length) return [];

    const headerLine = lines[0];
    const headers = splitCSVLine(headerLine).map(h => h.trim());
    const rows = [];

    for (let i = 1; i < lines.length; i++) {
      const line = lines[i];
      if (!line || !line.trim()) continue;
      const cells = splitCSVLine(line);
      const row = {};
      for (let j = 0; j < headers.length; j++) {
        const key = headers[j] || ('col' + j);
        row[key] = cells[j] !== undefined ? cells[j] : '';
      }
      rows.push(row);
    }
    return rows;
  }

  function pick(row, keys) {
    if (!row) return '';
    for (const key of keys) {
      if (row[key] && String(row[key]).trim()) {
        return String(row[key]).trim();
      }
    }
    return '';
  }

  // ----------- 状态 -----------

  const state = {
    lexemeById: new Map(),
    termToTargetId: new Map(),
    examplesByTarget: new Map(),
    dataReady: false,
  };

  // ----------- DOM -----------

  const dom = {};

  function cacheDom() {
    dom.searchInput = document.getElementById('searchInput');

    dom.zhhMainText = document.getElementById('zhhMainText');
    dom.zhhMainAudio = document.getElementById('zhhMainAudio');
    dom.zhhVariants = document.getElementById('zhhVariants');

    dom.summaryTitle = document.getElementById('summaryTitle');
    dom.summarySubtitle = document.getElementById('summarySubtitle');
    dom.noteEn = document.getElementById('noteEn');
    dom.noteChs = document.getElementById('noteChs');

    dom.examplesToggle = document.getElementById('examplesToggle');
    dom.examplesPanel = document.getElementById('examplesPanel');
    dom.examplesList = document.getElementById('examplesList');
  }

  // ----------- 数据加载 -----------

  function buildIndexes(lexemeRows, crossmapRows, exampleRows) {
    // lexeme 索引
    state.lexemeById.clear();
    lexemeRows.forEach(row => {
      const id = pick(row, ['id', 'lexeme_id']);
      if (!id) return;
      state.lexemeById.set(String(id), row);
    });

    // crossmap term -> target_id
    state.termToTargetId.clear();
    crossmapRows.forEach(row => {
      const targetId = pick(row, ['target_id', 'lexeme_id']);
      const termCell = pick(row, ['term', 'terms']);
      if (!targetId || !termCell) return;

      termCell.split('/').map(normalizeTerm).filter(Boolean).forEach(t => {
        if (!state.termToTargetId.has(t)) {
          state.termToTargetId.set(t, String(targetId));
        }
      });
    });

    // examples target_id -> rows[]
    state.examplesByTarget.clear();
    exampleRows.forEach(row => {
      const tid = pick(row, ['target_id', 'lexeme_id', 'id']);
      if (!tid) return;
      const key = String(tid);
      if (!state.examplesByTarget.has(key)) {
        state.examplesByTarget.set(key, []);
      }
      state.examplesByTarget.get(key).push(row);
    });

    state.dataReady = true;
  }

  function loadAllData() {
    // 默认路径：/data/lexeme.csv /data/crossmap.csv /data/examples.csv
    const lexemePromise = fetch('data/lexeme.csv').then(r => r.text());
    const crossmapPromise = fetch('data/crossmap.csv').then(r => r.text());
    const examplesPromise = fetch('data/examples.csv')
      .then(r => (r.ok ? r.text() : ''))
      .catch(() => '');

    return Promise.all([lexemePromise, crossmapPromise, examplesPromise])
      .then(([lexemeText, crossmapText, examplesText]) => {
        const lexemeRows = parseCSV(lexemeText);
        const crossmapRows = parseCSV(crossmapText);
        const exampleRows = parseCSV(examplesText);
        buildIndexes(lexemeRows, crossmapRows, exampleRows);
      })
      .catch(err => {
        console.error('加载 CSV 失败：', err);
      });
  }

  // ----------- 渲染 -----------

  function clearEntryView() {
    if (dom.zhhMainText) dom.zhhMainText.textContent = '—';
    if (dom.zhhVariants) dom.zhhVariants.innerHTML = '';
    if (dom.summaryTitle) dom.summaryTitle.textContent = '—';
    if (dom.summarySubtitle) dom.summarySubtitle.textContent = '';
    if (dom.noteEn) dom.noteEn.textContent = '';
    if (dom.noteChs) dom.noteChs.textContent = '';
    if (dom.examplesList) dom.examplesList.innerHTML = '';
    if (dom.examplesPanel) dom.examplesPanel.classList.add('hidden');
    if (dom.examplesToggle) dom.examplesToggle.classList.add('hidden');
  }

  function renderEntry(lexemeRow, exampleRows) {
    if (!lexemeRow) {
      clearEntryView();
      return;
    }

    // 左侧主词
    const mainYue = pick(lexemeRow, ['zhh', 'yue', 'lexeme_zhh']);
    const aliasYue = pick(lexemeRow, ['alias_zhh', 'yue_alias']);

    if (dom.zhhMainText) {
      dom.zhhMainText.textContent = mainYue || '—';
    }

    if (dom.zhhVariants) {
      dom.zhhVariants.innerHTML = '';
      const variants = [];
      if (aliasYue) {
        aliasYue.split('/').map(s => s.trim()).filter(Boolean).forEach(v => variants.push(v));
      }
      const extraVariants = pick(lexemeRow, ['variants_chs', 'variants_en']);
      // 这里只是占位，不做特别处理

      variants.forEach(text => {
        const li = document.createElement('li');
        li.className = 'zhh-variant-item';

        const span = document.createElement('span');
        span.className = 'zhh-variant-text';
        span.textContent = text;

        const btn = document.createElement('button');
        btn.type = 'button';
        btn.className = 'audio-btn';
        btn.textContent = '🔊';
        btn.addEventListener('click', () => {
          playTTS(text);
        });

        li.appendChild(span);
        li.appendChild(btn);
        dom.zhhVariants.appendChild(li);
      });
    }

    // 右侧 summary
    const chs = pick(lexemeRow, ['chs', 'zh_chs', 'meaning_chs']);
    const en = pick(lexemeRow, ['en', 'meaning_en']);

    if (dom.summaryTitle) {
      dom.summaryTitle.textContent = chs || '';
    }
    if (dom.summarySubtitle) {
      dom.summarySubtitle.textContent = en || '';
    }

    // note
    const noteChs = pick(lexemeRow, ['note_chs', 'desc_chs']);
    const noteEn = pick(lexemeRow, ['note_en', 'desc_en']);

    if (dom.noteChs) {
      dom.noteChs.textContent = noteChs || '';
    }
    if (dom.noteEn) {
      dom.noteEn.textContent = noteEn || '';
    }

    // examples
    if (dom.examplesList && dom.examplesToggle) {
      dom.examplesList.innerHTML = '';
      const rows = Array.isArray(exampleRows) ? exampleRows : [];
      if (!rows.length) {
        dom.examplesToggle.classList.add('hidden');
        dom.examplesPanel.classList.add('hidden');
      } else {
        rows.forEach(row => {
          const yue = pick(row, ['zhh', 'yue', 'example_zhh']);
          const chsExample = pick(row, ['chs', 'example_chs']);
          const enExample = pick(row, ['en', 'example_en']);

          const li = document.createElement('li');
          li.className = 'example-row';

          const ySpan = document.createElement('span');
          ySpan.className = 'example-yue';
          ySpan.textContent = yue;

          const enSpan = document.createElement('span');
          enSpan.className = 'example-en';
          enSpan.textContent = enExample;

          const chsSpan = document.createElement('span');
          chsSpan.className = 'example-chs';
          chsSpan.textContent = chsExample;

          const btn = document.createElement('button');
          btn.type = 'button';
          btn.className = 'example-audio-btn';
          btn.textContent = '🔊';
          btn.addEventListener('click', () => {
            playTTS(yue);
          });

          li.appendChild(ySpan);
          li.appendChild(enSpan);
          li.appendChild(chsSpan);
          li.appendChild(btn);

          dom.examplesList.appendChild(li);
        });

        dom.examplesToggle.classList.remove('hidden');
        // 默认折叠
        dom.examplesPanel.classList.add('hidden');
      }
    }
  }

  function renderNoResult(query) {
    clearEntryView();
    if (dom.summaryTitle) {
      dom.summaryTitle.textContent = '未找到匹配的 term';
    }
    if (dom.summarySubtitle) {
      dom.summarySubtitle.textContent = query ? '请确认与 crossmap.csv 中的 term 单元完全一致。' : '';
    }
  }

  // ----------- 搜索 -----------

  function searchByQuery(rawQuery) {
    const q = normalizeTerm(rawQuery);
    if (!q) {
      clearEntryView();
      return;
    }

    if (!state.dataReady) {
      return;
    }

    const targetId = state.termToTargetId.get(q);
    if (!targetId) {
      renderNoResult(rawQuery);
      return;
    }

    const lexemeRow = state.lexemeById.get(String(targetId));
    const examples = state.examplesByTarget.get(String(targetId)) || [];
    renderEntry(lexemeRow, examples);
  }

  // ----------- TTS -----------

  let sharedAudio = null;

  function playTTS(text) {
    if (!text) return;
    try {
      if (!sharedAudio) {
        sharedAudio = new Audio();
      }
      const url = '/api/tts?text=' + encodeURIComponent(text);
      sharedAudio.src = url;
      sharedAudio.play().catch(function (err) {
        console.warn('TTS 播放失败：', err);
      });
    } catch (err) {
      console.warn('创建 Audio 失败：', err);
    }
  }

  // ----------- 事件绑定 -----------

  function bindEvents() {
    if (dom.searchInput) {
      dom.searchInput.addEventListener('keydown', function (ev) {
        if (ev.key === 'Enter') {
          searchByQuery(ev.target.value);
        }
      });
      dom.searchInput.addEventListener('blur', function (ev) {
        // 防止只按一次 Enter 没触发的情况，失焦时再搜一遍
        if (ev.target.value) {
          searchByQuery(ev.target.value);
        }
      });
    }

    if (dom.zhhMainAudio && dom.zhhMainText) {
      dom.zhhMainAudio.addEventListener('click', function () {
        const text = dom.zhhMainText.textContent || '';
        playTTS(text);
      });
    }

    if (dom.examplesToggle && dom.examplesPanel) {
      dom.examplesToggle.addEventListener('click', function () {
        dom.examplesPanel.classList.toggle('hidden');
      });
    }
  }

  // ----------- 初始化 -----------

  document.addEventListener('DOMContentLoaded', function () {
    cacheDom();
    bindEvents();
    loadAllData().then(function () {
      console.log('CSV 数据加载完成');
    });
  });
})();
