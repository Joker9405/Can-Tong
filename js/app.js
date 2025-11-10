/* Can-Tong — final single-file app.js
 * 功能：
 *  1) 加载 /data/lexeme.csv (+ examples.csv, crossmap.csv 可选)
 *  2) 提供输入框搜索（中文/英文/粤语别名），渲染左黄绿主卡、右上粉卡（变体）、右下灰卡（备注）、下方示例列表
 *  3) 按你的需求：粉卡黄条里“英文在上、中文在下”；并把 "Variants (EN)" 分组放到“变体（中文）”之前
 * 说明：
 *  - 不修改 index.html、style.css、data/ 下文件名；只要页面里有一个搜索输入框即可（自动寻找）
 *  - 若页面没有预置容器，本文件会自动创建所需容器
 *  - 尽量与原样式 class 对齐：.card .left .lime / .right .pink / .gray
 */

/* ------------------------------ 小工具 ------------------------------ */
const $  = (sel, ctx=document) => ctx.querySelector(sel);
const $$ = (sel, ctx=document) => Array.from(ctx.querySelectorAll(sel));

function debounce(fn, wait=200) {
  let t=null; return (...args)=>{ clearTimeout(t); t=setTimeout(()=>fn(...args), wait); };
}

// 简易且可靠的 CSV 解析（支持引号、逗号、换行）
function parseCSV(text){
  const rows=[]; let i=0, cur="", inQ=false;
  function pushCell(arr, cell){ arr.push(cell.replace(/\r/g,'').replace(/^"(.*)"$/s,'$1').replace(/""/g,'"')); }
  let row=[];
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
  // last
  if(inQ){ /* 容错：缺失引号时也结束 */ }
  if(cur.length>0 || row.length>0){ pushCell(row,cur); rows.push(row); }
  // header -> objects
  if(rows.length===0) return [];
  const header = rows[0].map(h => String(h||'').trim());
  return rows.slice(1).filter(r=>r.some(c=>String(c).trim().length)).map(cells => {
    const o={};
    header.forEach((k,idx)=>o[k]=cells[idx]===undefined?"":cells[idx]);
    return o;
  });
}

/* ------------------------------ 数据加载 ------------------------------ */
async function loadCSV(path){
  const res = await fetch(path, {cache:'no-store'});
  if(!res.ok) throw new Error(`Load failed: ${path} ${res.status}`);
  const txt = await res.text();
  return parseCSV(txt);
}

const Data = {
  lexemes: [],
  examples: [],
  crossmap: [],
};

async function bootLoad(){
  try {
    Data.lexemes  = await loadCSV('/data/lexeme.csv');
  } catch(e){ console.error(e); }
  try {
    Data.examples = await loadCSV('/data/examples.csv');
  } catch(e){ console.warn('examples.csv optional:', e.message); }
  try {
    Data.crossmap = await loadCSV('/data/crossmap.csv');
  } catch(e){ console.warn('crossmap.csv optional:', e.message); }
}

/* ------------------------------ 索引与搜索 ------------------------------ */
const CJK_RE = /[\u4E00-\u9FFF]/i;

function normalize(str){ return String(str||'').trim(); }
function splitSemi(str){ return normalize(str).split(/[;；、\|,]/).map(s=>s.trim()).filter(Boolean); }

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
  const s = q.toLowerCase();
  let score = 0;
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
  const idx = buildIndex(Data.lexemes);
  const scored = idx.map(it => ({...it, _s: scoreRow(q, it)})).filter(x=>x._s>0);
  scored.sort((a,b)=>b._s-a._s || a.idx-b.idx);
  return scored.length? scored[0].row : null;
}

/* ------------------------------ 渲染 ------------------------------ */
function ensureContainers(){
  // 主容器
  let root = $('#ct-root');
  if(!root){
    root = document.createElement('div');
    root.id = 'ct-root';
    document.body.appendChild(root);
  }
  // 左侧主卡
  if(!$('#cardLeft', root)){
    const box = document.createElement('div');
    box.id='cardLeft';
    box.className='card left lime';
    root.appendChild(box);
  }
  // 右上粉卡（变体）
  if(!$('#cardVariants', root)){
    const box = document.createElement('div');
    box.id='cardVariants';
    box.className='card right pink';
    root.appendChild(box);
  }
  // 右下灰卡（备注）
  if(!$('#cardNote', root)){
    const box = document.createElement('div');
    box.id='cardNote';
    box.className='card right gray';
    root.appendChild(box);
  }
  // 底部示例列表
  if(!$('#examples', root)){
    const box = document.createElement('div');
    box.id='examples';
    box.className='examples';
    root.appendChild(box);
  }
  return root;
}

function renderLeft(row){
  const box = $('#cardLeft');
  if(!box) return;
  box.innerHTML = '';
  const title = document.createElement('div');
  title.className='yue-title';
  title.textContent = row.zhh || '—';
  const pron = document.createElement('div');
  pron.className='yue-pron';
  pron.textContent = (row.zhh_pron||'').trim();
  const aliasWrap = document.createElement('div');
  aliasWrap.className='alias';
  splitSemi(row.alias_zhh||'').forEach(a=>{
    const li=document.createElement('div'); li.textContent=a; aliasWrap.appendChild(li);
  });
  box.appendChild(title);
  if(pron.textContent) box.appendChild(pron);
  if(aliasWrap.childElementCount) box.appendChild(aliasWrap);
}

function renderVariants(row){
  const box = $('#cardVariants'); if(!box) return;
  box.innerHTML = '';

  // 顶部黄条：英文在上、中文在下
  const hint = document.createElement('div');
  hint.className='hint';
  const en = (row.variants_en||'').trim();
  const ch = (row.variants_chs||'').trim();
  const zh = (row.variants_zhh||'').trim();
  // 优先用 en + chs；粤语补充挂在下面
  hint.innerHTML = `<div class="en">${en}</div><div class="chs">${ch}</div>`;
  box.appendChild(hint);

  // 变体分组：英文块在前、中文块在后
  if(en){
    const gEn = document.createElement('div');
    gEn.className='group';
    gEn.innerHTML = `<strong>Variants (EN)</strong><div class="list">${en}</div>`;
    box.appendChild(gEn);
  }
  if(ch || zh){
    const gZh = document.createElement('div');
    gZh.className='group';
    gZh.innerHTML = `<strong>变体（中文）</strong><div class="list">${[zh, ch].filter(Boolean).join('；')}</div>`;
    box.appendChild(gZh);
  }
}

function renderNote(row){
  const box = $('#cardNote'); if(!box) return;
  box.innerHTML = '';
  const en = (row.note_en||'').trim();
  const ch = (row.note_chs||'').trim();
  if(en){
    const p = document.createElement('div');
    p.innerHTML = `<strong>(EN)</strong> ${en}`;
    box.appendChild(p);
  }
  if(ch){
    const p = document.createElement('div');
    p.innerHTML = `<strong>（中文）</strong> ${ch}`;
    box.appendChild(p);
  }
}

function renderExamples(row){
  const box = $('#examples'); if(!box) return;
  box.innerHTML = '';
  if(!Data.examples.length){ return; }

  // 关联策略：优先用 crossmap 里 id 的映射，否则用包含该词的行
  let ids = new Set();
  const id = (row.id||'').trim();
  Data.crossmap.forEach(m => {
    if((m.src||'').trim()===id && (m.dst||'').trim()) ids.add((m.dst||'').trim());
  });

  const results = Data.examples.filter(ex => {
    if(ids.size && ids.has((ex.id||'').trim())) return true;
    // 兜底：例句里包含主词或别名
    const hay = `${ex.chs||''} ${ex.en||''} ${ex.zhh||''}`.toLowerCase();
    const keys = [row.zhh, ...splitSemi(row.alias_zhh||'')].map(s=>s.toLowerCase());
    return keys.some(k => k && hay.includes(k));
  }).slice(0, 20);

  results.forEach(ex => {
    const li = document.createElement('div');
    li.className='example-row';
    const zh = document.createElement('div'); zh.className='zhh'; zh.textContent = (ex.zhh||ex.chs||'').trim();
    const en = document.createElement('div'); en.className='en'; en.textContent = (ex.en||'').trim();
    li.appendChild(zh); li.appendChild(en);
    box.appendChild(li);
  });
}

/* ------------------------------ 搜索输入绑定 ------------------------------ */
function findSearchInput(){
  return $('#q') || $('#search') || $('input[type="search"]') || $('input[type="text"]');
}

async function onQuery(q){
  if(!q || !q.trim()) return;
  const row = searchLexeme(q.trim());
  ensureContainers();
  if(!row){
    $('#cardLeft') && ($('#cardLeft').innerHTML = '');
    $('#cardVariants') && ($('#cardVariants').innerHTML = '');
    $('#cardNote') && ($('#cardNote').innerHTML = '');
    $('#examples') && ($('#examples').innerHTML = '');
    return;
  }
  renderLeft(row);
  renderVariants(row);
  renderNote(row);
  renderExamples(row);
}

/* ------------------------------ 启动 ------------------------------ */
async function startApp(){
  await bootLoad();
  ensureContainers();
  const input = findSearchInput();
  if(input){
    input.addEventListener('keydown', e=>{
      if(e.key==='Enter'){ onQuery(input.value); }
    });
    input.addEventListener('input', debounce(()=>onQuery(input.value), 250));
  }
}

/* ------------------------------ 变体黄条顺序热修补（保险） ------------------------------ */
(function () {
  const CN_RE = /[\u4E00-\u9FFF]/;
  const EN_RE = /[A-Za-z]/;
  const q  = (sel, ctx=document) => ctx.querySelector(sel);
  const qa = (sel, ctx=document) => Array.from(ctx.querySelectorAll(sel));

  function locatePinkRoot() {
    return q('#cardVariants') || q('.card.right.pink') || q('.card.pink') || null;
  }
  function isYellow(bg) {
    const m = String(bg||'').match(/rgb\(\s*(\d+)\s*,\s*(\d+)\s*,\s*(\d+)\s*\)/i);
    if (!m) return false;
    const [r,g,b] = m.slice(1).map(Number);
    return (r>230)&&(g>200)&&(b<170);
  }
  function findHint(root) {
    let el = q('.hint', root) || q('.badge', root) || q('[data-role="hint"]', root) || q('[data-type="hint"]', root);
    if (el) return el;
    const cand = qa('*', root).find(x => {
      try { const s = getComputedStyle(x);
        return isYellow(s.backgroundColor) && (x.textContent || '').trim().length < 160;
      } catch { return false; }
    });
    return cand || null;
  }
  function normalizeTwoLines(el){
    if (el.dataset.ctNormalized==='1') return;
    const kids = qa(':scope > *', el);
    if (kids.length >= 2 && (kids.some(k=>k.classList.contains('en')) || kids.some(k=>k.classList.contains('chs')))) {
      el.dataset.ctNormalized = '1'; return;
    }
    const parts = String(el.innerHTML).replace(/<br\s*\/?>/gi,'\n').split(/\n+/).map(s=>s.trim()).filter(Boolean);
    if (parts.length >= 2){
      let en = parts.find(p=>EN_RE.test(p)) || parts[0];
      let cn = parts.find(p=>CN_RE.test(p)) || parts[1] || '';
      el.innerHTML = `<div class="en">${en}</div><div class="chs">${cn}</div>`;
      el.dataset.ctNormalized = '1'; return;
    }
    if (kids.length >= 2){
      const [a,b] = kids;
      if (!a.classList.contains('en') && !a.classList.contains('chs')){
        if (EN_RE.test(a.textContent)) a.classList.add('en');
        if (CN_RE.test(a.textContent)) a.classList.add('chs');
      }
      if (!b.classList.contains('en') && !b.classList.contains('chs')){
        if (EN_RE.test(b.textContent)) b.classList.add('en');
        if (CN_RE.test(b.textContent)) b.classList.add('chs');
      }
      el.dataset.ctNormalized = '1';
    }
  }
  function swapHint(el){
    normalizeTwoLines(el);
    const en = q(':scope > .en', el);
    const cn = q(':scope > .chs', el);
    if (en) el.insertBefore(en, el.firstElementChild);
    if (cn && el.children[1] !== cn) el.insertBefore(cn, el.children[1] || null);
    el.dataset.ctHintDone = '1';
  }
  function swapVariantGroups(root){
    const blocks = qa(':scope > *', root);
    let enBlock=null, cnBlock=null;
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
    const root = locatePinkRoot();
    if (!root) return;
    const hint = findHint(root);
    if (hint && hint.dataset.ctHintDone!=='1') swapHint(hint);
    swapVariantGroups(root);
  }
  window.addEventListener('DOMContentLoaded', applyOnce);
  const mo = new MutationObserver(() => applyOnce());
  mo.observe(document.body, { childList:true, subtree:true });
})();

/* ------------------------------ 启动应用 ------------------------------ */
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', startApp);
} else {
  startApp();
}
