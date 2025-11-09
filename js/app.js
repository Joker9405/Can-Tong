/* Can-Tong robust front-end (csv-compatible) — EN first on pink card */
(function () {
  const $ = (sel) => document.querySelector(sel);
  const qInput = $('#q');
  const left = $('#cardLeft');
  const variants = $('#cardVariants');
  const notes = $('#cardNotes');
  const errBox = $('#error');

  window.addEventListener('error', (e) => {
    errBox.style.display = 'block';
    errBox.textContent = '前端异常：' + (e.error?.message || e.message);
    console.error(e.error || e);
  });

  const pick = (row, ...keys) => {
    for (const k of keys) {
      if (!k) continue;
      const v = row[k];
      if (v != null && String(v).trim() !== '') return String(v).trim();
    }
    return '';
  };
  const toList = (s) => String(s || '')
    .split(/[,|、；;]+/)
    .map(x => x.trim())
    .filter(Boolean);

  async function fetchCSV() {
    const primary = `data/lexeme.csv?v=${Date.now()}`;
    const r = await fetch(primary, { cache: 'no-store' });
    if (!r.ok) throw new Error('获取 CSV 失败：' + r.status);
    return await r.text();
  }

  function parseCSV(text) {
    const parsed = Papa.parse(text, {
      header: true,
      skipEmptyLines: 'greedy',
      transformHeader: (h) => (h || '').replace(/^\uFEFF/, '').trim()
    });
    if (parsed.errors?.length) console.warn('CSV parse warnings:', parsed.errors);
    return parsed.data;
  }

  function buildIndex(rows) {
    const m = new Map();
    for (const r of rows) {
      const id  = pick(r, 'id', 'ID');
      if (!id) continue;
      const zhh = pick(r, 'zhh', 'yue', 'zh-HK');
      const chs = pick(r, 'chs', 'zh-CN');
      const en  = pick(r, 'en', 'en_US');
      const alias_zhh = toList(pick(r, 'alias_zhh', 'aliases_zhh', 'alias_yue'));
      const keys = new Set([id, zhh, chs, en, ...alias_zhh]);
      keys.forEach(k => {
        const kk = String(k || '').trim();
        if (kk) m.set(kk.toLowerCase(), r);
      });
    }
    return m;
  }

  function renderRow(r) {
    try {
      const zhh         = pick(r, 'zhh', 'yue', 'zh-HK');
      const zhh_pron    = pick(r, 'zhh_pron', 'yue_pron');
      const alias_zhh   = toList(pick(r, 'alias_zhh', 'aliases_zhh', 'alias_yue'));
      const chs         = pick(r, 'chs', 'zh-CN');
      const en          = pick(r, 'en', 'en_US');
      const note_chs    = pick(r, 'note_chs', 'notes_chs');
      const note_en     = pick(r, 'note_en', 'notes_en');
      const variants_zhh= toList(pick(r, 'variants_zhh', 'alias_zhh'));
      const variants_chs= toList(pick(r, 'variants_chs'));
      const variants_en = toList(pick(r, 'variants_en'));

      // left card
      left.innerHTML = `
        <div class="label">粤语 zhh：</div>
        <h1 class="big">${zhh || '—'}</h1>
        ${zhh_pron ? `<div class="pron">${zhh_pron}</div>` : ''}
        ${alias_zhh.length ? `<ul class="alias">${alias_zhh.map(x=>`<li>${x}</li>`).join('')}</ul>` : ''}
      `;

      // pink variants — EN first, then CN, then ZHH
      const parts = [];
      if (variants_en.length)  parts.push(`<div><strong>Variants (EN)：</strong><ul>${variants_en.map(x=>`<li>${x}</li>`).join('')}</ul></div>`);
      if (variants_chs.length) parts.push(`<div><strong>变体（中文）：</strong><ul>${variants_chs.map(x=>`<li>${x}</li>`).join('')}</ul></div>`);
      if (variants_zhh.length) parts.push(`<div><strong>变体（粤语）：</strong><ul>${variants_zhh.map(x=>`<li>${x}</li>`).join('')}</ul></div>`);
      variants.innerHTML = parts.join('') || '<div>暂无变体</div>';

      // gray notes — EN first then CN
      const panel = document.querySelector('#examplePanel');
      panel.style.display = 'none';
      panel.innerHTML = `
        <div><strong>English：</strong>${en || '—'}</div>
        <div><strong>中文：</strong>${chs || '—'}</div>
        ${note_en ? `<div class="mt"><strong>Notes (EN)：</strong>${note_en}</div>` : ''}
        ${note_chs ? `<div class="mt"><strong>备注（中文）：</strong>${note_chs}</div>` : ''}
      `;
      document.querySelector('#btnExample').onclick = () => {
        panel.style.display = panel.style.display === 'none' ? 'block' : 'none';
      };
    } catch (e) {
      errBox.style.display = 'block';
      errBox.textContent = '渲染异常：' + e.message;
      console.error(e);
    }
  }

  async function main() {
    const csv = await fetchCSV();
    const rows = parseCSV(csv);
    if (!rows?.length) {
      errBox.style.display = 'block';
      errBox.textContent = 'CSV 为空或解析失败';
      return;
    }
    const idx = buildIndex(rows);
    const doSearch = () => {
      const key = (qInput.value || '').trim().toLowerCase();
      renderRow(idx.get(key) || rows[0]);
    };
    document.querySelector('#btnSearch').onclick = doSearch;
    qInput.addEventListener('keydown', (e) => { if (e.key === 'Enter') doSearch(); });
    doSearch();
  }
  main().catch(e => {
    errBox.style.display = 'block';
    errBox.textContent = '初始化失败：' + e.message;
    console.error(e);
  });
})();