/* Can-Tong — final single-file app.js (robust loader)
 * 功能：
 *  1) 加载 data/*.csv（相对/绝对路径都兼容）
 *  2) 输入框搜索（中/英/粤语别名），渲染左黄绿主卡、右上粉卡（变体），右下灰卡（备注），下方示例
 *  3) 粉卡黄条：英文在上、中文在下；并把 “Variants (EN)” 分组排在“变体（中文）”之前
 * 说明：仅替换 /js/app.js；其它文件不改
 */

/* ------------------------------ 小工具 ------------------------------ */
const $  = (sel, ctx=document) => ctx.querySelector(sel);
const $$ = (sel, ctx=document) => Array.from(ctx.querySelectorAll(sel));
const sleep = (ms)=>new Promise(r=>setTimeout(r,ms));
function debounce(fn, wait=200) { let t=null; return (...args)=>{ clearTimeout(t); t=setTimeout(()=>fn(...args), wait); }; }

// 简易 CSV 解析（支持引号/换行）
function parseCSV(text){
  const rows=[]; let i=0, cur="", inQ=false; let row=[];
  const pushCell = (arr, cell)=>arr.push(String(cell??'').replace(/\r/g,'').replace(/^"(.*)"$/s,'$1').replace(/""/g,'"'));
  while(i<text.length){
    const ch=text[i];
    if(inQ){
      if(ch==='"' && text[i+1]==='"'){ cur+='"'; i+=2; continue; }
      if(ch==='"'){ inQ=false; i++; continue; }
      cur+=ch; i++; continue;
    }else{
      if(ch==='"'){ inQ=true; i++; continue; }
      if(ch===','){ pushCell(row,cur); cur=""; i++; continue; }
      if(ch==='\n'){ pushCell(row,cur); rows.push(row); row=[]; cur=""; i++; continue; }
      cur+=ch; i++; continue;
    }
  }
  if(cur.length>0 || row.length>0){ pushCell(row,cur); rows.push(row); }
  if(rows.length===0) return [];
  const header = rows[0].map(h => String(h||'').trim().replace(/^\uFEFF/,'')); // 去掉 BOM
  return rows.slice(1).filter(r=>r.some(c=>String(c).trim().length)).map(cells => {
    const o={};
    header.forEach((k,idx)=>o[k]=cells[idx]===undefined?"":cells[idx]);
    return o;
  });
}

/* ------------------------------ 数据加载 ------------------------------ */
async function fetchText(path){
  const res = await fetch(path, {cache:'no-store'});
  if(!res.ok) throw new Error(`${res.status} ${res.statusText}`);
  return await res.text();
}
// 优先相对路径，其次绝对路径，最后 ./ 相对
async function loadCSVSmart(filename){
  const tries = [`data/${filename}`, `/data/${filename}`, `./data/${filename}`];
  for (const p of tries){
    try { const txt = await fetchText(p); return parseCSV(txt); }
    catch(e){ /* 下一条 */ }
  }
  return [];
}

const Data = { lexemes:[], examples:[], crossmap:[] };

async function bootLoad(){
  Data.lexemes  = await loadCSVSmart('lexeme.csv');
  Data.examples = await loadCSVSmart('examples.csv');
  Data.crossmap = await loadCSVSmart('crossmap.csv');
}

/* ------------------------------ 索引与搜索 ------------------------------ */
const CJK_RE = /[\u4E00-\u9FFF]/i;
const normalize = (s)=>String(s||'').trim();
const splitSemi = (str)=>normalize(str).split(/[;；、\|,]/).map(s=>s.trim()).filter(Boolean);

function buildIndex(list){
  return list.map((row, idx)=>{
    const zhh = normalize(row.zhh);
    const chs = normalize(row.chs);
    const en  = normalize(row.en);
    const alias = splitSemi(row.alias_zhh||"");
    return { idx, row, zhh, chs, en, alias };
  });
}
function scoreRow(q, item){
  const s = q.toLowerCase(); let score = 0;
  if(CJK_RE.test(q)){
    if(item.zhh.includes(q)) score += 50;
    if(item.chs.includes(q)) score += 40;
    if(item.alias.some(a=>a.includes(q))) score += 35;
  }else{
    if(item.en.toLowerCase().includes(s)) score += 50;
    if(item.alias.some(a=>a.toLowerCase().includes(s))) score += 30;
    if(item.chs.toLowerCase().includes(s)) score += 10;
  }
  return score;
}
function searchLexeme(q){
  if(!Data.lexemes.length) return null;
  const idx = buildIndex(Data.lexemes);
  const scored = idx.map(it => ({...it, _s: scoreRow(q, it)})).filter(x=>x._s>0);
  scored.sort((a,b)=>b._s-a._s || a.idx-b.idx);
  return scored.length? scored[0].row : null;
}

/* ------------------------------ 渲染容器 ------------------------------ */
function ensureContainers(){
  let root = $('#ct-root'); if(!root){ root = document.createElement('div'); root.id='ct-root'; document.body.appendChild(root); }
  if(!$('#cardLeft',root)){ const d=document.createElement('div'); d.id='cardLeft'; d.className='card left lime'; root.appendChild(d); }
  if(!$('#cardVariants',root)){ const d=document.createElement('div'); d.id='cardVariants'; d.className='card right pink'; root.appendChild(d); }
  if(!$('#cardNote',root)){ const d=document.createElement('div'); d.id='cardNote'; d.className='card right gray'; root.appendChild(d); }
  if(!$('#examples',root)){ const d=document.createElement('div'); d.id='examples'; d.className='examples'; root.appendChild(d); }
  return root;
}

/* ------------------------------ 具体渲染 ------------------------------ */
function renderLeft(row){
  const box = $('#cardLeft'); if(!box) return; box.innerHTML='';
  const title = document.createElement('div'); title.className='yue-title'; title.textContent=row.zhh||'—';
  const pron  = document.createElement('div'); pron.className='yue-pron'; pron.textContent=(row.zhh_pron||'').trim();
  const aliasWrap = document.createElement('div'); aliasWrap.className='alias';
  splitSemi(row.alias_zhh||'').forEach(a=>{ const li=document.createElement('div'); li.textContent=a; aliasWrap.appendChild(li); });
  box.appendChild(title); if(pron.textContent) box.appendChild(pron); if(aliasWrap.childElementCount) box.appendChild(aliasWrap);
}
function renderVariants(row){
  const box = $('#cardVariants'); if(!box) return; box.innerHTML='';
  const en = (row.variants_en||'').trim(); const ch = (row.variants_chs||'').trim(); const zh = (row.variants_zhh||'').trim();

  // 顶部黄条：英文在上、中文在下
  const hint = document.createElement('div'); hint.className='hint';
  hint.innerHTML = `<div class="en">${en}</div><div class="chs">${ch}</div>`; box.appendChild(hint);

  // 分组：英文在前，中文在后
  if(en){ const gEn=document.createElement('div'); gEn.className='group'; gEn.innerHTML=`<strong>Variants (EN)</strong><div class="list">${en}</div>`; box.appendChild(gEn); }
  if(ch||zh){ const gZh=document.createElement('div'); gZh.className='group'; gZh.innerHTML=`<strong>变体（中文）</strong><div class="list">${[zh,ch].filter(Boolean).join('；')}</div>`; box.appendChild(gZh); }
}
function renderNote(row){
  const box=$('#cardNote'); if(!box) return; box.innerHTML='';
  const en=(row.note_en||'').trim(); const ch=(row.note_chs||'').trim();
  if(en){ const p=document.createElement('div'); p.innerHTML=`<strong>(EN)</strong> ${en}`; box.appendChild(p); }
  if(ch){ const p=document.createElement('div'); p.innerHTML=`<strong>（中文）</strong> ${ch}`; box.appendChild(p); }
}
function renderExamples(row){
  const box=$('#examples'); if(!box) return; box.innerHTML=''; if(!Data.examples.length) return;
  // 简单关联：例句里包含 zhh 或别名（不依赖 crossmap 字段名）
  const keys=[row.zhh,...splitSemi(row.alias_zhh||'')].map(s=>s.toLowerCase()).filter(Boolean);
  const results = Data.examples.filter(ex=>{
    const hay = `${ex.chs||''} ${ex.en||''} ${ex.zhh||''}`.toLowerCase();
    return keys.some(k => k && hay.includes(k));
  }).slice(0,20);
  results.forEach(ex=>{
    const li=document.createElement('div'); li.className='example-row';
    const zh=document.createElement('div'); zh.className='zhh'; zh.textContent=(ex.zhh||ex.chs||'').trim();
    const en=document.createElement('div'); en.className='en'; en.textContent=(ex.en||'').trim();
    li.appendChild(zh); li.appendChild(en); box.appendChild(li);
  });
}

/* ------------------------------ 搜索绑定 ------------------------------ */
function findSearchInput(){ return $('#q') || $('#search') || $('input[type="search"]') || $('input[type="text"]'); }
async function onQuery(q){
  if(!q || !q.trim()) return;
  const row = searchLexeme(q.trim());
  ensureContainers();
  if(!row){ ['#cardLeft','#cardVariants','#cardNote','#examples'].forEach(sel=>{ const el=$(sel); if(el) el.innerHTML=''; }); return; }
  renderLeft(row); renderVariants(row); renderNote(row); renderExamples(row);
}

/* ------------------------------ 启动 ------------------------------ */
async function startApp(){
  await bootLoad();
  ensureContainers();
  const input = findSearchInput();
  if(input){
    input.addEventListener('keydown', e=>{ if(e.key==='Enter'){ onQuery(input.value); } });
    input.addEventListener('input', debounce(()=>onQuery(input.value), 250));
  }
}

// 兼容旧页面：把黄条两行顺序强制校正（保险）
(function () {
  const CN_RE = /[\u4E00-\u9FFF]/; const EN_RE = /[A-Za-z]/;
  const q=(s,c=document)=>c.querySelector(s); const qa=(s,c=document)=>Array.from(c.querySelectorAll(s));
  function locatePinkRoot(){ return q('#cardVariants') || q('.card.right.pink') || q('.card.pink') || null; }
  function normalizeTwoLines(el){
    if (el.dataset.ctNormalized==='1') return;
    const kids = qa(':scope > *', el);
    if (kids.length >= 2 && (kids.some(k=>k.classList.contains('en')) || kids.some(k=>k.classList.contains('chs')))) { el.dataset.ctNormalized='1'; return; }
    const parts = String(el.innerHTML).replace(/<br\s*\/?>/gi,'\n').split(/\n+/).map(s=>s.trim()).filter(Boolean);
    if (parts.length >= 2){
      let en = parts.find(p=>EN_RE.test(p)) || parts[0];
      let cn = parts.find(p=>CN_RE.test(p)) || parts[1] || '';
      el.innerHTML = `<div class="en">${en}</div><div class="chs">${cn}</div>`;
      el.dataset.ctNormalized='1'; return;
    }
    if (kids.length >= 2){
      const [a,b]=kids;
      if (!a.classList.contains('en') && EN_RE.test(a.textContent)) a.classList.add('en');
      if (!a.classList.contains('chs') && CN_RE.test(a.textContent)) a.classList.add('chs');
      if (!b.classList.contains('en') && EN_RE.test(b.textContent)) b.classList.add('en');
      if (!b.classList.contains('chs') && CN_RE.test(b.textContent)) b.classList.add('chs');
      el.dataset.ctNormalized='1';
    }
  }
  function swapHint(el){
    normalizeTwoLines(el);
    const en = q(':scope > .en', el); const cn = q(':scope > .chs', el);
    if (en) el.insertBefore(en, el.firstElementChild);
    if (cn && el.children[1] !== cn) el.insertBefore(cn, el.children[1] || null);
    el.dataset.ctHintDone='1';
  }
  function swapVariantGroups(root){
    const blocks = qa(':scope > *', root); let enBlock=null, cnBlock=null;
    for (const b of blocks){
      const title = (q('strong', b)?.textContent || '').trim();
      if (/Variants\s*\(EN\)/i.test(title)) enBlock = b;
      if (/变体（?中文）?/.test(title) || /变体.*中文/.test(title)) cnBlock = b;
    }
    if (enBlock && cnBlock){
      const enAfterCN = !!(enBlock.compareDocumentPosition(cnBlock) & Node.DOCUMENT_POSITION_FOLLOWING);
      if (enAfterCN) root.insertBefore(enBlock, cnBlock);
    }
  }
  function applyOnce(){
    const root = locatePinkRoot(); if (!root) return;
    const hint = q('.hint', root) || q('.badge', root) || q('[data-role="hint"]', root) || q('[data-type="hint"]', root);
    if (hint && hint.dataset.ctHintDone!=='1') swapHint(hint);
    swapVariantGroups(root);
  }
  window.addEventListener('DOMContentLoaded', applyOnce);
  const mo = new MutationObserver(() => applyOnce());
  mo.observe(document.body, { childList:true, subtree:true });
})();

if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', startApp);
else startApp();
