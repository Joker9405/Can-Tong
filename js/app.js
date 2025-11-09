/* Can-Tong — EN first on the pink card's hint/variants */
(function () {
  const $ = (s)=>document.querySelector(s);
  const q = $('#q'), left = $('#cardLeft'), variants = $('#cardVariants'), notes = $('#cardNotes');
  const err = $('#error');

  window.addEventListener('error', e => {
    err.style.display='block'; err.textContent = '前端异常：' + (e.error?.message||e.message);
  });

  const pick = (row, ...keys)=>{ for(const k of keys){ const v=row?.[k]; if(v!=null && String(v).trim()!=='') return String(v).trim(); } return ''; };
  const toList = s=>String(s||'').split(/[,|、；;]+/).map(x=>x.trim()).filter(Boolean);

  async function getCSV(){
    const r = await fetch(`/data/lexeme.csv?v=${Date.now()}`, {cache:'no-store'});
    if(!r.ok) throw new Error('CSV '+r.status);
    return await r.text();
  }
  function parse(text){
    return Papa.parse(text,{header:true,skipEmptyLines:'greedy',transformHeader:h=>(h||'').replace(/^\uFEFF/,'').trim()}).data;
  }
  function index(rows){
    const m=new Map();
    for(const r of rows){
      const id=pick(r,'id','ID'); if(!id) continue;
      const zhh=pick(r,'zhh','yue','zh-HK'), chs=pick(r,'chs','zh-CN'), en=pick(r,'en','en_US');
      const alias=toList(pick(r,'alias_zhh','aliases_zhh','alias_yue'));
      for(const k of new Set([id, zhh, chs, en, ...alias])){
        const s=String(k||'').trim(); if(s) m.set(s.toLowerCase(), r);
      }
    }
    return m;
  }
  function render(r){
    const zhh=pick(r,'zhh','yue','zh-HK'); const zhh_pron=pick(r,'zhh_pron','yue_pron'); const alias=toList(pick(r,'alias_zhh','aliases_zhh','alias_yue'));
    const chs=pick(r,'chs','zh-CN'); const en=pick(r,'en','en_US'); const note_chs=pick(r,'note_chs','notes_chs'); const note_en=pick(r,'note_en','notes_en');
    const v_zhh=toList(pick(r,'variants_zhh','alias_zhh')); const v_chs=toList(pick(r,'variants_chs')); const v_en=toList(pick(r,'variants_en'));

    left.innerHTML = `
      <div class="label">粤语 zhh：</div>
      <h1 class="big">${zhh||'—'}</h1>
      ${zhh_pron?`<div class="pron">${zhh_pron}</div>`:''}
      ${alias.length?`<ul class="alias">${alias.map(x=>`<li>${x}</li>`).join('')}</ul>`:''}
    `;

    /* 🔶 Yellow hint block at top of the pink card (EN on top, CN below) */
    const hintEN = v_en[0] || '';
    const hintCN = v_chs[0] || '';
    const hint = (hintEN || hintCN) ? `
      <div class="hint" style="background:#fffb00; color:#000; border-radius:10px; padding:10px 12px; margin-bottom:10px;">
        <div class="en" style="font-weight:700;">${hintEN||''}</div>
        <div class="chs" style="opacity:.9;">${hintCN||''}</div>
      </div>` : '';

    const blocks=[];
    if(v_en.length>1)  blocks.push(`<div><strong>Variants (EN)：</strong><ul>${v_en.slice(1).map(x=>`<li>${x}</li>`).join('')}</ul></div>`);
    if(v_chs.length>1) blocks.push(`<div><strong>变体（中文）：</strong><ul>${v_chs.slice(1).map(x=>`<li>${x}</li>`).join('')}</ul></div>`);
    if(v_zhh.length)   blocks.push(`<div><strong>变体（粤语）：</strong><ul>${v_zhh.map(x=>`<li>${x}</li>`).join('')}</ul></div>`);
    variants.innerHTML = hint + (blocks.join('') || '<div>暂无变体</div>');
  }

  async function main(){
    const rows = parse(await getCSV());
    const idx = index(rows);
    const search = ()=>{
      const key=(q.value||'').trim().toLowerCase();
      const row = idx.get(key) || rows[0];
      render(row);
    };
    document.querySelector('#btnSearch').onclick = search;
    q.addEventListener('keydown', e=>{ if(e.key==='Enter') search(); });
    search();
  }
  main().catch(e=>{ err.style.display='block'; err.textContent='初始化失败：'+e.message; });
})();