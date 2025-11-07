// tiny CSV parser (handles quoted commas)
function parseCSV(text){
  const rows=[], re = /(?:^|,)(?:"([^"]*(?:""[^"]*)*)"|([^",\n]*))/g;
  let row=[]; text=text.replace(/\r/g,'');
  for (let i=0, m; i<text.length; ){
    re.lastIndex = i;
    m = re.exec(text);
    if (!m){ // end of line
      rows.push(row); row=[]; i = text.indexOf("\n", i); if(i<0) break; i++;
      continue;
    }
    let cell = m[1] ? m[1].replace(/""/g,'"') : (m[2]||"");
    row.push(cell);
    i = re.lastIndex;
    // if next char is newline, push row
    if (text[i]==="\n"){ rows.push(row); row=[]; i++; }
  }
  if (row.length) rows.push(row);
  return rows.filter(r=>r.length && r.some(x=>x!==''));
}

const ICON_SPK=`<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M3 10v4h3l4 3V7L6 10H3zm13.5 2c0-1.77-1.02-3.29-2.5-4.03v8.06c1.48-.74 2.5-2.26 2.5-4.03zm-2.5-9v3.06c2.89.86 5 3.54 5 6.94s-2.11 6.08-5 6.94V21c3.99-.91 7-4.49 7-9s-3.01-8.09-7-9z" fill="currentColor"/></svg>`;

const PATH='data/';
let LEX={}, EXMAP={}, READY=false;
let VOICE=null;
function pickVoice(){
  const voices = window.speechSynthesis ? speechSynthesis.getVoices() : [];
  const hk = voices.find(v=>/yue|cantonese|zh[-_]?HK/i.test(v.lang||v.name));
  return hk || voices.find(v=>/zh/i.test(v.lang||v.name)) || voices[0] || null;
}
function speak(text){
  if(!('speechSynthesis' in window) || !text) return;
  const u = new SpeechSynthesisUtterance(text); VOICE && (u.voice = VOICE); speechSynthesis.speak(u);
}
function norm(s){ return (s||'').toLowerCase().replace(/\s+/g,'').trim(); }

async function loadCSV(name){
  const r = await fetch(PATH+name, {cache:'no-store'});
  if(!r.ok) throw new Error('CSV load failed: '+name);
  const txt = await r.text();
  const rows = parseCSV(txt);
  const head = rows.shift();
  return {head,rows};
}

function buildMaps({lx,ex,cross}){
  // LEX by id
  for(const row of lx.rows){
    const obj={};
    lx.head.forEach((h,i)=> obj[h]=row[i]||'');
    LEX[obj.id]=obj;
  }
  // EXMAP by lexeme_id
  for(const row of ex.rows){
    const obj={};
    ex.head.forEach((h,i)=> obj[h]=row[i]||'');
    (EXMAP[obj.lexeme_id]??=([])).push(obj);
  }
  // CROSS map -> id set
  const M=new Map();
  for(const row of cross.rows){
    const obj={}; cross.head.forEach((h,i)=>obj[h]=row[i]||'');
    const key = norm(obj.term);
    const set = M.get(key) || new Set();
    set.add(obj.target_id); M.set(key,set);
  }
  return M;
}

function clearUI(){
  document.getElementById('grid').setAttribute('hidden','');
  document.getElementById('noteWrap').setAttribute('hidden','');
  document.getElementById('examples').setAttribute('hidden','');
}

function renderPhased(id){
  const lx = LEX[id]; if(!lx) return;

  const grid = document.getElementById('grid'); grid.innerHTML=''; grid.hidden=false;

  // left-yellow
  const left = document.createElement('div'); left.className='card yellow left'; 
  left.innerHTML = `
    <div class="badge">粤语zhh：</div>
    <div class="h-title">${lx.zhh||''}</div>
    <div class="row"><div class="alias">${(lx.alias_zhh||'').split('/')[0]||''}</div><button class="tts" title="发音">${ICON_SPK}</button></div>
    <div class="row"><div class="alias">${(lx.alias_zhh||'').split('/')[1]||''}</div><button class="tts" title="发音">${ICON_SPK}</button></div>
  `;
  const aliasTTS = left.querySelectorAll('.row .tts');
  aliasTTS[0]?.addEventListener('click', ()=>speak((lx.alias_zhh||'').split('/')[0]||lx.zhh));
  aliasTTS[1]?.addEventListener('click', ()=>speak((lx.alias_zhh||'').split('/')[1]||lx.zhh));
  grid.appendChild(left);

  // right-top variants (pink, text only)
  const rightTop = document.createElement('div'); rightTop.className='card pink';
  const variants = (lx.variants_zhh||'').split('/').map(s=>s.trim()).filter(Boolean);
  rightTop.innerHTML = variants.map(v=>`<div class="variant">${v}</div>`).join('') || `<div class="variant"> </div>`;
  grid.appendChild(rightTop);

  // note + expand
  const noteWrap = document.getElementById('noteWrap'); noteWrap.hidden=false;
  document.getElementById('noteCard').innerHTML = `
    <div>"Colloquial ‘掟’; formal ‘擲’." </div>
    <div>口语常作“掟”，正式可写“擲”。</div>
  `;
  const expBtn = document.getElementById('expCtl');
  expBtn.hidden=false;
  expBtn.onclick = ()=> renderExamples(id);
}

function renderExamples(id){
  const list = EXMAP[id]||[];
  const host = document.getElementById('examples'); host.innerHTML='';
  for(const row of list){
    const div = document.createElement('div'); div.className='exampleRow';
    div.innerHTML = `
      <div>
        <div class="ex-l">${row.ex_zhh||''}</div>
        <div class="ex-r"><b>${row.ex_en||''}</b><small>${row.ex_chs||''}</small></div>
      </div>
      <button class="tts" title="发音">${ICON_SPK}</button>
    `;
    div.querySelector('.tts').addEventListener('click', ()=>speak(row.ex_zhh||''));
    host.appendChild(div);
  }
  if(!list.length){
    host.innerHTML = `<div class="exampleRow"><div class="ex-l">（暂无例句）</div></div>`;
  }
  host.hidden=false;
  document.getElementById('expCtl').hidden = true; // hide button after expand
}

async function boot(){
  // preload voices (async event on some browsers)
  if ('speechSynthesis' in window){
    VOICE = pickVoice();
    speechSynthesis.onvoiceschanged = ()=>{ VOICE = pickVoice(); };
  }

  const [lx, ex, cross] = await Promise.all([
    loadCSV('lexeme.csv'),
    loadCSV('examples.csv'),
    loadCSV('crossmap.csv')
  ]);
  const CROSSMAP = buildMaps({lx,ex,cross});
  READY=true;

  const q = document.getElementById('q');
  const search = ()=>{
    const key = norm(q.value);
    clearUI();
    if(!key){ return; }
    // 1) crossmap first
    let ids = CROSSMAP.get(key);
    // 2) fallback simple scan
    if(!ids){
      ids = new Set(Object.keys(LEX).filter(id=>{
        const lx = LEX[id];
        return norm(lx.zhh).includes(key) || norm(lx.alias_zhh).includes(key) || norm(lx.en).includes(key);
      }));
    }
    const id = ids && ids.values().next().value;
    if(id){ renderPhased(id); }
  };
  q.addEventListener('keyup', (e)=>{ if(e.key==='Enter') search(); });
  q.addEventListener('change', search);
}

document.addEventListener('DOMContentLoaded', boot);
