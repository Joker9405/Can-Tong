
/**
 * CanTongMVP v6.6
 * - 初始：仅搜索框 + example按钮（不渲染结果）
 * - 搜索后：渲染头卡片/变体/备注，但 examples 仍隐藏，只显示按钮
 * - 点击 example 扩展：加载并显示例句面板；展开后不再收起
 * - 全站中文默认字体为 Adobe 繁黑體 Std；zhh 主词加粗（在 CSS 中）
 * - 右上用法/备注卡片没有喇叭
 */
const els = {
  q: document.getElementById('q'),
  grid: document.getElementById('resultGrid'),
  head: document.getElementById('headWord'),
  aliases: document.getElementById('aliases'),
  variants: document.getElementById('variants'),
  noteLines: document.getElementById('noteLines'),
  exWrap: document.getElementById('examplesWrap'),
  exPanel: document.getElementById('examplesPanel'),
  btnExample: document.getElementById('btnExample'),
};

// CSV paths
const PATHS = {
  lexeme: '/data/lexeme.csv',
  cross:  '/data/crossmap.csv',
  ex:     '/data/examples.csv'
};

let DB = { lexeme: [], cross: [], ex: [] };
let currentLexeme = null;
let exLoadedOnceFor = new Set();

/* ---------- utils ---------- */
function parseCSV(text){
  const lines = text.split(/\r?\n/).filter(l=>l.trim().length>0);
  if(lines.length===0) return [];
  const headers = lines[0].split(',').map(h=>h.trim());
  return lines.slice(1).map(line => {
    const cells = [];
    let cur='', inQ=false;
    for (let i=0;i<line.length;i++){
      const ch=line[i];
      if(ch==='\"'){ inQ=!inQ; continue; }
      if(ch===',' && !inQ){ cells.push(cur); cur=''; }
      else cur+=ch;
    }
    cells.push(cur);
    const row={};
    headers.forEach((h,idx)=> row[h]= (cells[idx] ?? '').trim());
    return row;
  });
}
async function loadAll(){
  const [lex, cr, ex] = await Promise.all([
    fetch(PATHS.lexeme).then(r=>r.text()).catch(()=>''),
    fetch(PATHS.cross).then(r=>r.text()).catch(()=>''),
    fetch(PATHS.ex).then(r=>r.text()).catch(()=>''),
  ]);
  DB.lexeme = parseCSV(lex);
  DB.cross  = parseCSV(cr);
  DB.ex     = parseCSV(ex);
}
function playTTS(text){
  if(!text) return;
  const url = `/api/route?tn=tts&text=${encodeURIComponent(text)}&lang=zhh`;
  const a = new Audio(url);
  a.play().catch(()=>{});
}
function makePlayBtn(isPink=false){
  const b=document.createElement('button');
  b.className = 'play' + (isPink?' pink':'');
  b.innerHTML = '🔊';
  return b;
}

/* ---------- render ---------- */
function clearResults(){
  els.head.textContent='';
  els.aliases.innerHTML='';
  els.variants.innerHTML='';
  els.noteLines.textContent='';
  els.grid.classList.add('hidden');
  // examples area remains hidden until user clicks button
  els.exPanel.innerHTML='';
  els.exWrap.classList.add('hidden');
  els.btnExample.setAttribute('aria-expanded','false');
}
function renderLexeme(lex){
  currentLexeme = lex;
  // head word (single, no slash)
  els.head.textContent = (lex.zhh || '').split('/')[0];
  // aliases -> each one line with speaker
  els.aliases.innerHTML='';
  const aliases = (lex.alias_zhh || '').split(/[,，\/\s]+/).filter(Boolean);
  aliases.forEach(a=>{
    const li = document.createElement('li'); li.className='alias-item';
    li.textContent = a;
    const p = makePlayBtn(false);
    p.onclick = ()=>playTTS(a);
    li.appendChild(p);
    els.aliases.appendChild(li);
  });
  // variants (right pink), NO speaker in this module
  els.variants.innerHTML='';
  const vs = (lex.variants_zhh || '').split(/[|,，\/\s]+/).filter(Boolean);
  vs.forEach(v=>{
    const li=document.createElement('li');
    li.textContent=v;
    els.variants.appendChild(li);
  });
  // note
  let note = '';
  if(lex.note_en){ note += lex.note_en + '\n'; }
  if(lex.note_chs){ note += lex.note_chs; }
  els.noteLines.textContent = note.trim();

  els.grid.classList.remove('hidden');
  // Examples stay collapsed until user clicks
  els.exWrap.classList.add('hidden');
  els.btnExample.classList.remove('hidden');
  els.btnExample.setAttribute('aria-expanded','false');
}
function renderExamplesFor(lexId){
  const rows = DB.ex.filter(r => (r.lexeme_id || r.id || '').trim() === (lexId||'').trim());
  els.exPanel.innerHTML='';
  rows.forEach(r=>{
    const row = document.createElement('div');
    row.className='example-row';
    const left = document.createElement('div'); left.className='example-left';
    left.textContent = (r.ex_zhh || r.ex_chs || '').trim(); // 左侧展示句子（按你图示为中文/粤语可兼容）
    const right = document.createElement('div'); right.className='example-right';
    const en = document.createElement('div'); en.className='example-en'; en.textContent = (r.ex_en||'').trim();
    const cn = document.createElement('div'); cn.className='example-cn'; cn.textContent = (r.ex_chs||'').trim();
    right.appendChild(en); right.appendChild(cn);
    const play = makePlayBtn(true);
    play.classList.add('example-audio');
    play.onclick = ()=>playTTS((r.ex_zhh || '').trim());
    row.appendChild(left); row.appendChild(right); row.appendChild(play);
    els.exPanel.appendChild(row);
  });
  els.exWrap.classList.remove('hidden');
}

/* ---------- search ---------- */
function search(term){
  const q = (term||'').trim();
  clearResults();
  if(!q) return;
  // map via crossmap
  let hit = DB.cross.find(r => r.term===q) || DB.cross.find(r => r.term===q && (r.lang==='chs' || r.lang==='en' || r.lang==='zhh'));
  if(!hit && DB.lexeme.length){
    // fallback: try head match
    hit = { target_id: (DB.lexeme.find(l => (l.zhh||'').split('/')[0]===q) || {}).id };
  }
  if(!hit || !hit.target_id){
    // still show empty examples button state
    return;
  }
  const lex = DB.lexeme.find(l => (l.id||'').trim() === (hit.target_id||'').trim());
  if(!lex){ return; }
  renderLexeme(lex);
  // remember id for examples
  els.btnExample.onclick = ()=>{
    // 展开一次后保持展开（按钮仅用于首次展开）
    if(els.btnExample.getAttribute('aria-expanded')==='true') return;
    renderExamplesFor(lex.id);
    els.btnExample.setAttribute('aria-expanded','true');
  };
}

/* ---------- init ---------- */
loadAll().then(()=>{
  clearResults(); // 初始空白（仅搜索与 example 按钮）
  // 回车搜索
  els.q.addEventListener('keydown', e=>{
    if(e.key==='Enter'){ search(els.q.value); }
  });
});
