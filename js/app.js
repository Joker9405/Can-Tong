// Load three CSVs: crossmap, lexeme, examples. Render strict layout.
const PATH = '/data/';
const CSV = { crossmap:'crossmap.csv', lexeme:'lexeme.csv', examples:'examples.csv' };
let CROSS=[], LEX={}, EXMAP={};

function parseCSV(text){
  const lines = text.split(/\r?\n/).filter(Boolean);
  const header = lines.shift().split(',').map(s=>s.trim());
  return lines.map(line=>{
    const cells = line.split(',').map(s=>s.trim());
    const obj={}; header.forEach((h,i)=>obj[h]=cells[i]||''); return obj;
  });
}

async function loadCSV(name){
  const res = await fetch(PATH+name,{cache:'no-store'});
  if(!res.ok) throw new Error(name+' 404');
  const txt = await res.text();
  return parseCSV(txt);
}

function norm(s){return (s||'').toLowerCase().replace(/\s+/g,'');}
function fuzzy(t,q){t=norm(t);q=norm(q);if(!q)return false;let i=0;for(const ch of t){if(ch===q[i]) i++;}return i===q.length || t.includes(q);}

async function boot(){
  try{
    const [cm, lx, ex] = await Promise.all([loadCSV(CSV.crossmap), loadCSV(CSV.lexeme), loadCSV(CSV.examples)]);
    CROSS = cm;
    // build lex dict
    lx.forEach(r=>{ LEX[r.id]=r; });
    // examples by lexeme_id
    EXMAP = ex.reduce((m,r)=>{ (m[r.lexeme_id]||(m[r.lexeme_id]=[])).push(r); return m; },{});
  }catch(e){ console.error(e); }
}

function findLexemeIds(q){
  const nq = norm(q);
  const out = new Set();
  // match in crossmap term and lexeme core fields
  CROSS.forEach(r=>{
    if(fuzzy(r.term, nq)) out.add(r.target_id);
  });
  Object.values(LEX).forEach(r=>{
    if(fuzzy(r.zhh,nq)||fuzzy(r.en,nq)||fuzzy(r.alias_zhh||'',nq)) out.add(r.id);
  });
  return Array.from(out);
}

function speak(text){
  if(!window.speechSynthesis) return;
  const u=new SpeechSynthesisUtterance(text);
  u.lang='yue-HK'; window.speechSynthesis.cancel(); window.speechSynthesis.speak(u);
}

function renderEmpty(q){
  const cards = document.getElementById('cards');
  cards.innerHTML = `<div class="empty">未找到：<b>${q}</b>。请补充到词库。</div>`;
  document.getElementById('expand-toggle').hidden = true;
  document.getElementById('expand-list').hidden = true;
}

function render(lex){
  const cards = document.getElementById('cards');
  cards.innerHTML='';

  // left main
  const left = document.createElement('div');
  left.className='card yellow left';
  left.innerHTML = `
    <div class="badge">粤语zhh：</div>
    <div class="h-title">${lex.zhh||'—'}</div>
    ${(lex.alias_zhh||'').split(';').filter(Boolean).map(a=>`
      <div class="row"><div>${a}</div><button class="tts"></button></div>
    `).join('')}
  `;
  // attach TTS buttons
  left.querySelectorAll('.tts').forEach((b,i)=>{
    const label = i===0 ? lex.zhh : (lex.alias_zhh||'').split(';').filter(Boolean)[i-0];
    b.addEventListener('click',()=>speak(label||lex.zhh));
  });

  // right usage
  const rt = document.createElement('div');
  rt.className='card pink right-top';
  rt.innerHTML = `<div class="vars">${lex.variants_zhh||''}</div>`;

  // right note
  const rb = document.createElement('div');
  rb.className='card gray right-bottom';
  const note = (lex.note_en||'') + (lex.note_chs?('<br>'+lex.note_chs):'');
  rb.innerHTML = `<div class="note">${note}</div>`;

  cards.appendChild(left);
  cards.appendChild(rt);
  cards.appendChild(rb);

  // expand examples
  const toggle = document.getElementById('expand-toggle');
  const list   = document.getElementById('expand-list');
  const exs = EXMAP[lex.id] || [];
  if(exs.length){
    toggle.hidden=false; list.hidden=true;
    toggle.onclick = ()=>{
      list.hidden = !list.hidden;
      if(!list.hidden){ toggle.textContent='收起扩展'; } else { toggle.textContent='example 扩展'; }
    };
    toggle.textContent='example 扩展';

    list.innerHTML = exs.map(e=>`
      <div class="example">
        <div class="txt">${e.ex_zhh || e.ex_chs || e.ex_en}</div>
        <button class="tts"></button>
      </div>
    `).join('');
    list.querySelectorAll('.example .tts').forEach((b,i)=>{
      const t = exs[i].ex_zhh || exs[i].ex_chs || exs[i].ex_en;
      b.addEventListener('click',()=>speak(t));
    });
  }else{
    toggle.hidden=true; list.hidden=true; list.innerHTML='';
  }
}

document.getElementById('q').addEventListener('input', e=>{
  const q = e.target.value;
  const ids = findLexemeIds(q);
  if(!q){ document.getElementById('cards').innerHTML=''; document.getElementById('expand-toggle').hidden=true; document.getElementById('expand-list').hidden=true; return; }
  if(!ids.length){ renderEmpty(q); return; }
  const lex = LEX[ids[0]]; // take first
  render(lex);
});

boot();
