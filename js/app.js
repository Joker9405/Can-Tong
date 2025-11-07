
const PATH = './data/';
const ICON_SPK = `<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 9v6h4l5 4V5L8 9H4zm13.5 3c0-1.77-1.02-3.29-2.5-4.03v8.06c1.48-.74 2.5-2.26 2.5-4.03zM14 3.23v2.06c2.89.86 5 3.54 5 6.71s-2.11 5.85-5 6.71v2.06c4.01-.91 7-4.49 7-8.77s-2.99-7.86-7-8.77z"/></svg>`;

let LEX = {}, XMAP = {};
let VOICE = null;

function speakYue(text){
  if(!('speechSynthesis' in window)) return;
  if(!VOICE){
    // try pick Cantonese voice by lang tag zh-HK / yue
    const vs = speechSynthesis.getVoices();
    VOICE = vs.find(v => /yue|zh[-_]HK/i.test(v.lang)) || vs.find(v=>/zh/i.test(v.lang));
  }
  const u = new SpeechSynthesisUtterance(text);
  if(VOICE) u.voice = VOICE;
  u.lang = VOICE?.lang || 'zh-HK';
  speechSynthesis.speak(u);
}

async function loadCSVs(){
  const [lexeme, examples] = await Promise.all([
    fetch(PATH+'lexeme.csv',{cache:'no-store'}).then(r=>r.text()),
    fetch(PATH+'examples.csv',{cache:'no-store'}).then(r=>r.text())
  ]);
  LEX = parseCSV(lexeme).reduce((acc,row)=>{acc[row.id]=row;return acc;},{});
  // examples map by lexeme id
  XMAP = {};
  parseCSV(examples).forEach(r=>{
    if(!XMAP[r.lex_id]) XMAP[r.lex_id] = [];
    XMAP[r.lex_id].push(r);
  });
}

function parseCSV(t){
  const lines = t.trim().split(/\r?\n/);
  const header = lines.shift().split(',').map(s=>s.trim());
  return lines.map(line=>{
    const parts = line.split(',').map(s=>s.replace(/^"|"$/g,'').trim());
    const obj = {};
    header.forEach((h,i)=>obj[h]=parts[i]||'');
    return obj;
  });
}

function norm(s){ return (s||'').toLowerCase().replace(/\s+/g,'').trim(); }

function findIdsByQuery(q){
  const nq = norm(q);
  if(!nq) return [];
  const hit = [];
  Object.values(LEX).forEach(r=>{
    const src = (r.zhh + r.alias_zhh + r.chs + r.en).toLowerCase();
    if(src.includes(nq)) hit.push(r.id);
  });
  return hit;
}

function el(tag,cls,html){ const d=document.createElement(tag); if(cls) d.className=cls; if(html!=null) d.innerHTML=html; return d; }

function renderNone(){
  document.getElementById('grid').hidden = true;
  document.getElementById('notes').hidden = true;
  document.getElementById('examples').hidden = true;
  // ensure button hidden
  document.getElementById('expandBtn').hidden = true;
}

function renderCards(id){
  const lex = LEX[id];
  if(!lex){ renderNone(); return; }

  const grid = document.getElementById('grid');
  grid.innerHTML = '';
  grid.hidden = false;

  // left yellow
  const left = el('div','card yellow');
  left.innerHTML = `
    <div class="badge">粤语zhh：</div>
    <div class="h-title">${lex.zhh}</div>
    ${lex.alias_zhh.split('/').filter(Boolean).map(a=>`
      <div class="alias-row">
        <div class="alias">${a}</div>
        <button class="tts" data-yue="${a}" title="粤语发音">${ICON_SPK}</button>
      </div>
    `).join('')}
  `;
  grid.appendChild(left);

  // right variants (pink, text-only)
  const right = el('div','card pink');
  const vars = (lex.variants_zhh||'').split('/').filter(Boolean);
  right.classList.add('var-list');
  right.innerHTML = vars.map(v=>`<div class="v">${v}</div>`).join('') || '<div class="v">（无变体）</div>';
  grid.appendChild(right);

  // note (gray) and expand btn
  const notes = document.getElementById('notes');
  const noteText = document.getElementById('noteText');
  noteText.textContent = (lex.note_chs || '') + (lex.note_en ? ' ' + lex.note_en : '');
  notes.hidden = false;
  document.getElementById('expandBtn').hidden = false; // show expand
}

function renderExamples(id){
  const list = XMAP[id] || [];
  const wrap = document.getElementById('examples');
  wrap.innerHTML = '';
  wrap.hidden = false;
  // hide button after expand
  document.getElementById('expandBtn').hidden = true;

  list.forEach(row=>{
    const r = el('div','row');
    const left = el('div','yue', row.zhh);
    const right = el('div','desc', `<div class="en">${row.en||''}</div><div class="chs">${row.chs||''}</div>`);
    const t = el('button','tts'); t.innerHTML = ICON_SPK; t.title='粤语发音'; t.addEventListener('click',()=>speakYue(row.zhh));
    r.appendChild(left); r.appendChild(t); r.appendChild(right);
    wrap.appendChild(r);
  });
}

async function boot(){
  await loadCSVs();
  const q = document.getElementById('q');
  const expandBtn = document.getElementById('expandBtn');
  expandBtn.addEventListener('click',()=>{
    const id = expandBtn.dataset.currentId;
    if(id) renderExamples(id);
  });

  q.addEventListener('input', ()=>{
    const ids = findIdsByQuery(q.value);
    if(ids.length){
      const id = ids[0];
      document.getElementById('expandBtn').dataset.currentId = id;
      renderCards(id);
      document.getElementById('examples').hidden = true; // collapse view until user clicks expand
    }else{
      renderNone();
    }
  });

  renderNone();
}
document.addEventListener('DOMContentLoaded', boot);
