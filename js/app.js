(function(){
  const $ = (s)=>document.querySelector(s);
  const left = $('#cardLeft');
  const variants = $('#cardVariants');
  const notes = $('#cardNotes');
  const err = $('#error');

  window.addEventListener('error', (e)=>{
    err.style.display='block';
    err.textContent = '前端异常：' + (e.error?.message || e.message);
    console.error(e.error || e);
  });

  const pick = (row, ...keys)=>{
    for(const k of keys){
      const v = row?.[k];
      if(v!=null && String(v).trim()!=='') return String(v).trim();
    }
    return '';
  };
  const toList = (s)=>String(s||'').split(/[,|、；;]+/).map(x=>x.trim()).filter(Boolean);

  async function fetchCSV(){
    const u = `/data/lexeme.csv?v=${Date.now()}`;
    const r = await fetch(u, {cache:'no-store'});
    if(!r.ok) throw new Error('获取CSV失败：'+r.status);
    return await r.text();
  }
  function parseCSV(text){
    const p = Papa.parse(text, {
      header:true,
      skipEmptyLines:'greedy',
      transformHeader:(h)=>String(h||'').replace(/^\uFEFF/,'').trim()
    });
    if(p.errors?.length) console.warn('CSV parse warnings:', p.errors);
    return p.data;
  }
  function buildIndex(rows){
    const m = new Map();
    for(const r of rows){
      const id = pick(r,'id','ID'); if(!id) continue;
      const zhh = pick(r,'zhh','yue','zh-HK');
      const chs = pick(r,'chs','zh-CN');
      const en  = pick(r,'en','en_US');
      const alias = toList(pick(r,'alias_zhh','aliases_zhh','alias_yue'));
      const keys = new Set([id, zhh, chs, en, ...alias]);
      keys.forEach(k=>{
        const s = String(k||'').trim().toLowerCase();
        if(s) m.set(s, r);
      });
    }
    return m;
  }

  function renderRow(r){
    const zhh = pick(r,'zhh','yue','zh-HK');
    const zhh_pron = pick(r,'zhh_pron','yue_pron');
    const alias = toList(pick(r,'alias_zhh','aliases_zhh','alias_yue'));
    const chs = pick(r,'chs','zh-CN');
    const en  = pick(r,'en','en_US');
    const note_chs = pick(r,'note_chs','notes_chs');
    const note_en  = pick(r,'note_en','notes_en');
    const v_zhh = toList(pick(r,'variants_zhh','alias_zhh'));
    const v_chs = toList(pick(r,'variants_chs'));
    const v_en  = toList(pick(r,'variants_en'));

    left.innerHTML = `
      <div class="label">粤语 zhh：</div>
      <h1 class="big">${zhh || '—'}</h1>
      ${ zhh_pron ? `<div class="pron">${zhh_pron}</div>` : ''}
      ${ alias.length ? `<ul class="alias">${alias.map(x=>`<li>${x}</li>`).join('')}</ul>` : ''}
    `;

    const hintEN = v_en[0] || '';
    const hintCN = v_chs[0] || '';
    const hint = (hintEN || hintCN)
      ? `<div class="hint" style="background:#fff54d;color:#000;border-radius:12px;padding:10px 12px;margin-bottom:10px;">
           <div class="en" style="font-weight:800;">${hintEN || ''}</div>
           <div class="chs" style="opacity:.9;">${hintCN || ''}</div>
         </div>`
      : '';

    const blocks = [];
    if(v_en.length>1)  blocks.push(`<div><strong>Variants (EN)：</strong><ul>${v_en.slice(1).map(x=>`<li>${x}</li>`).join('')}</ul></div>`);
    if(v_chs.length>1) blocks.push(`<div><strong>变体（中文）：</strong><ul>${v_chs.slice(1).map(x=>`<li>${x}</li>`).join('')}</ul></div>`);
    if(v_zhh.length)   blocks.push(`<div><strong>变体（粤语）：</strong><ul>${v_zhh.map(x=>`<li>${x}</li>`).join('')}</ul></div>`);
    variants.innerHTML = hint + (blocks.join('') || '<div>暂无变体</div>');

    const panel = document.querySelector('#examplePanel');
    panel.style.display = 'none';
    panel.innerHTML = `
      <div><strong>English：</strong>${en || '—'}</div>
      <div><strong>中文：</strong>${chs || '—'}</div>
      ${ note_en ? `<div class="mt"><strong>Notes (EN)：</strong>${note_en}</div>` : ''}
      ${ note_chs ? `<div class="mt"><strong>备注（中文）：</strong>${note_chs}</div>` : ''}
    `;
    document.querySelector('#btnExample').onclick = ()=>{
      panel.style.display = (panel.style.display==='none') ? 'block' : 'none';
    };
  }

  async function main(){
    const rows = parseCSV(await fetchCSV());
    if(!rows?.length){ err.style.display='block'; err.textContent='CSV 为空或解析失败'; return; }
    const idx = buildIndex(rows);

    const doSearch = ()=>{
      const key = (document.querySelector('#q').value || '').trim().toLowerCase();
      renderRow(idx.get(key) || rows[0]);
    };
    document.querySelector('#btnSearch').onclick = doSearch;
    document.querySelector('#q').addEventListener('keydown', e=>{ if(e.key==='Enter') doSearch(); });

    doSearch();
  }

  main().catch(e=>{
    err.style.display='block';
    err.textContent = '初始化失败：' + e.message;
    console.error(e);
  });
})();