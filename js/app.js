
const PATH='/data/';
let LEX={}, EXMAP={};

function parseCSV(t){return t.split(/\r?\n/).filter(Boolean).map(line=>{
  const cells=[]; let cur=''; let inQ=false;
  for(let i=0;i<line.length;i++){const ch=line[i];
    if(ch=='"'){ if(inQ && line[i+1]=='"'){cur+='"';i++;} else {inQ=!inQ;} }
    else if(ch==',' && !inQ){cells.push(cur);cur='';}
    else {cur+=ch;}
  } cells.push(cur); return cells;
});}

async function loadCSV(name){
  const r=await fetch(PATH+name,{cache:'no-store'});
  if(!r.ok) throw new Error('load csv fail '+name);
  return await r.text();
}

function norm(s){return (s||'').toLowerCase().replace(/\s+/g,'').trim();}

function buildIndex(lexRows, exRows, crossRows){
  // lexeme
  const head=lexRows.slice(1).map(r=>({id:r[0], zhh:r[1], alias_zhh:r[3]||'', en:r[4]||'', note_chs:r[5]||'', variants_zhh:r[6]||''}));
  head.forEach(x=>{LEX[x.id]=x; EXMAP[x.id]=[];});
  // examples
  exRows.slice(1).forEach(r=>{const e={lexeme_id:r[0], ex_zhh:r[1], ex_en:r[2], ex_chs:r[3]}; if(EXMAP[e.lexeme_id]) EXMAP[e.lexeme_id].push(e);});
  // crossmap -> query map
  window.QMAP=new Map();
  crossRows.slice(1).forEach(r=>{
    const term=norm(r[0]||''); const id=r[2]; if(!term||!LEX[id]) return;
    if(!window.QMAP.has(term)) window.QMAP.set(term,new Set());
    window.QMAP.get(term).add(id);
  });
}

function render(lexemeIds){
  const grid=document.getElementById('grid'); grid.innerHTML='';
  const ids=[...new Set(lexemeIds)];
  if(ids.length===0){document.getElementById('expCtl').hidden=true; document.getElementById('examples').hidden=true; return;}
  const id=ids[0]; const lex=LEX[id];
  // left yellow
  const left=document.createElement('div'); left.className='card yellow';
  left.innerHTML=`<div class="h-badge">粤语zhh：</div>
  <div class="h-title">${lex.zhh}</div>
  <div class="row"><div class="alias">${(lex.alias_zhh||'').split('/').filter(Boolean)[0]||''}</div><button class="tts" title="🔊"></button></div>
  <div class="row"><div class="alias">${(lex.alias_zhh||'').split('/').filter(Boolean)[1]||''}</div><button class="tts" title="🔊"></button></div>`;
  grid.appendChild(left);
  // right variants
  const rightTop=document.createElement('div'); rightTop.className='card pink';
  rightTop.innerHTML= (lex.variants_zhh||'').split('/').map(v=>`<div class="row"><div>${v}</div></div>`).join('') || '<div class="row"><div></div></div>';
  grid.appendChild(rightTop);
  // right note
  const rightNote=document.createElement('div'); rightNote.className='card gray';
  rightNote.innerHTML=`${lex.en?'<div>Colloquial ‘掟’, formal ‘擲’.</div>':''}<div>${lex.note_chs||''}</div>`;
  grid.appendChild(rightNote);
  // show expand btn if examples exist
  const exCtl=document.getElementById('expCtl'); const hasEx=(EXMAP[id]||[]).length>0;
  exCtl.hidden=!hasEx; document.getElementById('examples').hidden=true;
  exCtl.dataset.lexeme=id;
}

// expand
function showExamples(id){
  const wrap=document.getElementById('examples'); wrap.innerHTML=''; wrap.hidden=false;
  (EXMAP[id]||[]).forEach(e=>{
    const row=document.createElement('div'); row.className='ex-item';
    row.innerHTML=`<div class="ex-left">
      <div class="ex-zhh">${e.ex_zhh}</div>
      <div class="ex-en">${e.ex_en||''}</div>
      <div class="ex-chs">${e.ex_chs||''}</div>
    </div>
    <button class="tts" title="🔊"></button>`;
    wrap.appendChild(row);
  });
  // hide expand button after expanded (符合你的要求)
  document.getElementById('expCtl').hidden=true;
}

async function boot(){
  const [crossTxt, lexTxt, exTxt]=await Promise.all([loadCSV('crossmap.csv'), loadCSV('lexeme.csv'), loadCSV('examples.csv')]);
  buildIndex(parseCSV(crossTxt), parseCSV(lexTxt), parseCSV(exTxt));
  // search input
  const q=document.getElementById('q');
  q.addEventListener('input',()=>{
    const key=norm(q.value);
    if(!key){ document.getElementById('grid').innerHTML=''; document.getElementById('expCtl').hidden=true; document.getElementById('examples').hidden=true; return; }
    const ids = (window.QMAP.get(key) ? [...window.QMAP.get(key)] : []);
    render(ids);
  });
  // expand
  document.getElementById('btnExpand').addEventListener('click',()=>{
    const id=document.getElementById('expCtl').dataset.lexeme; if(id) showExamples(id);
  });
}
boot();
