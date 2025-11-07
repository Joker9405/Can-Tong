
async function loadCSV(path){
  const res = await fetch(path, {cache:'no-store'});
  if(!res.ok) throw new Error('load fail: '+path);
  const txt = await res.text();
  return parseCSV(txt);
}
function parseCSV(txt){
  const lines = txt.trim().split(/\r?\n/);
  const head = lines.shift().split(',').map(h=>h.trim());
  return lines.filter(Boolean).map(line=>{
    const cols = []; let cur='', inQ=false;
    for(let i=0;i<line.length;i++){
      const c=line[i];
      if(c==='"' ){ inQ=!inQ; continue; }
      if(c===',' && !inQ){ cols.push(cur); cur=''; } else { cur+=c; }
    }
    cols.push(cur);
    const o={}; head.forEach((h,i)=> o[h]= (cols[i]??'').trim() );
    return o;
  });
}
function byId(id){return document.getElementById(id)}
function el(tag, cls, txt){const n=document.createElement(tag); if(cls) n.className=cls; if(txt!=null) n.textContent=txt; return n}

function splitList(v){ 
  if(!v) return [];
  return v.split(/[;；]/).map(s=>s.trim()).filter(Boolean);
}

function match(term, entry){
  const t = term.trim().toLowerCase();
  if(!t) return false;
  const hay = [
    entry.zhh||'',
    (entry.alias_zhh||'').replace(/[\/|]/g,' '),
    entry.en||'',
  ].join(' ').toLowerCase();
  return hay.includes(t);
}

async function boot(){
  const q = byId('q');
  const cards = byId('cards');
  const [lexemes, examples, xmap] = await Promise.all([
    loadCSV('/data/lexeme.csv'),
    loadCSV('/data/examples.csv').catch(()=>[]),
    loadCSV('/data/crossmap.csv').catch(()=>[]),
  ]);

  function search(term){
    cards.innerHTML='';
    const t = term.trim();
    if(!t){ return; }

    const ids = xmap.filter(r=> (r.term||'').toLowerCase()===t.toLowerCase()).map(r=>r.target_id);
    let hits = lexemes.filter(e=> ids.includes(e.id));
    if(hits.length===0){
      hits = lexemes.filter(e=> match(t,e));
    }
    if(hits.length===0) return;

    const e = hits[0];

    const left = el('div','card lime');
    const h1 = el('div','h1', e.zhh||'');
    left.appendChild(h1);
    left.appendChild(rowWithAudio(e.zhh||'', (e.zhh_pron||'')) );
    const aliases = (e.alias_zhh||'').split(/[\/、\|]/).map(s=>s.trim()).filter(Boolean);
    aliases.forEach(a=> left.appendChild(rowWithAudio(a,'')) );
    cards.appendChild(left);

    const pink = el('div','card pink');
    const chs = splitList(e.variants_chs||'');
    const en = splitList(e.variants_en||'');
    const n = Math.max(chs.length, en.length);
    for(let i=0;i<n;i++){
      const line = el('div','row');
      const txt = el('div','txt', chs[i]||'');
      line.appendChild(txt);
      const enSmall = el('div','note enSmall'); enSmall.style.opacity='.85'; enSmall.style.fontSize='14px'; enSmall.textContent = en[i]||'';
      line.appendChild(enSmall);
      pink.appendChild(line);
    }
    cards.appendChild(pink);

    const note = el('div','card slate note');
    const enNote = el('div','en', (e.note_en||'').trim());
    const chsNote = el('div','chs', (e.note_chs||'').trim());
    note.appendChild(enNote);
    note.appendChild(chsNote);
    cards.appendChild(note);

    const btn = el('button','btn-mini fixed','example 扩展');
    btn.addEventListener('click', ()=>toggleExamples(e.id, btn));
    document.body.appendChild(btn);
  }

  function rowWithAudio(text, pron){
    const r = el('div','row');
    r.appendChild( el('div','txt', text) );
    const b = el('button','iconbtn'); 
    b.addEventListener('click', ()=> playYue(text, pron));
    r.appendChild(b);
    return r;
  }
  function playYue(text, pron){
    const u = `/api/route?tts=zhh&q=${encodeURIComponent(text)}`;
    const a = new Audio(u); a.play();
  }

  let exNode=null;
  function toggleExamples(lexemeId, btn){
    if(exNode){ exNode.remove(); exNode=null; btn.classList.remove('hide'); return; }
    const rows = examples.filter(r=> (r.lexeme_id||'')===lexemeId);
    if(rows.length===0){ btn.classList.add('hide'); return; }

    exNode = el('div','card pink examples');
    rows.forEach(r=>{
      const line = el('div','line');
      const yue = el('div','yue', r.ex_zhh||'');
      const right = el('div','right');
      const en = el('div','en', r.ex_en||'');
      const chs = el('div','chs', r.ex_chs||'');
      const spk = el('button','iconbtn');
      spk.addEventListener('click', ()=> playYue(r.ex_zhh||'', r.ex_zhh_pron||''));
      right.appendChild(en);
      right.appendChild(chs);
      right.appendChild(spk);
      line.appendChild(yue);
      line.appendChild(right);
      exNode.appendChild(line);
    });
    const grid = byId('cards');
    grid.appendChild(exNode);
    btn.classList.add('hide');
  }

  q.addEventListener('keydown', (e)=>{
    if(e.key==='Enter'){ search(q.value||''); }
  });
}

window.addEventListener('DOMContentLoaded', boot);
