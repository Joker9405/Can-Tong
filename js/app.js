
const PATH = '/data/';
const ICON_SPK = '<svg class="ic" viewBox="0 0 24 24" aria-hidden="true"><path d="M3 10h4l4-4v12l-4-4H3zM17 7a6 6 0 0 1 0 10v-2a4 4 0 0 0 0-6V7zm-2 3a2 2 0 0 1 0 4v-4z" fill="currentColor"/></svg>';

function parseCSV(text){
  text = text.replace(/^\uFEFF/,'').replace(/\r\n?/g,'\n').trim();
  if(!text) return [];
  const lines = text.split('\n');
  const header = lines.shift().split(',').map(s=>s.trim());
  return lines.map(line=>{
    const cols = line.split(',');
    const row = {};
    header.forEach((h,i)=>row[h]= (cols[i]??'').trim());
    return row;
  }).filter(r=>Object.values(r).some(Boolean));
}

async function loadCSV(name){
  const r = await fetch(PATH+name, {cache:'no-store'});
  if(!r.ok) throw new Error('CSV load failed: '+name);
  return parseCSV(await r.text());
}

const state = { lex:null, ex:null, voice:null };

function pickVoice(){
  const vs = speechSynthesis.getVoices();
  const kw = ['zh-HK','yue','Hong Kong'];
  let v = vs.find(x=>kw.some(k=>String(x.lang||x.name).includes(k))) || vs.find(x=>/zh/i.test(x.lang||'')) || vs[0];
  return v || null;
}
function speak(text){
  if(!('speechSynthesis' in window)) return;
  if(!state.voice){ state.voice = pickVoice(); }
  if(!state.voice) return;
  const u = new SpeechSynthesisUtterance(text);
  u.voice = state.voice; u.lang = state.voice.lang;
  window.speechSynthesis.speak(u);
}

function norm(s){ return (s||'').toLowerCase().replace(/\s+/g,'').trim(); }
function fuzzy(q,item){
  q = norm(q);
  const hs = [item.zhh,item.alias_zhh,item.chs,item.en].join('|').toLowerCase();
  return hs.includes(q);
}

function clearMain(){
  const grid = document.getElementById('grid');
  grid.innerHTML = '';
  document.getElementById('note').hidden = true;
  document.getElementById('examples').hidden = true;
  document.getElementById('expbtn').hidden = true;
  document.querySelector('.container').classList.remove('ready','expanded');
}

function renderLex(lex){
  const grid = document.getElementById('grid');
  grid.innerHTML = '';

  const left = document.createElement('div');
  left.className = 'card yellow left';
  left.innerHTML = `
    <div class="badge">粤语zhh：</div>
    <div class="h-title">${lex.zhh||''}</div>
    <div class="row">
      <div class="alias">${(lex.alias_zhh||'').split('/').map(s=>s.trim()).filter(Boolean).join(' / ')}</div>
      <button class="tts" aria-label="播放">${ICON_SPK}</button>
    </div>
  `;
  left.querySelector('.tts').addEventListener('click',()=>speak(lex.zhh||''));

  const rightPink = document.createElement('div');
  rightPink.className = 'card pink';
  rightPink.innerHTML = `<div>${lex.variants_zhh||''}</div>`;

  const note = document.getElementById('note');
  note.hidden = false;
  document.getElementById('note-body').innerText = (lex.note_chs?lex.note_chs+' ':'' ) + (lex.note_en||'');

  grid.appendChild(left);
  grid.appendChild(rightPink);
}

function renderExamples(rows){
  const wrap = document.getElementById('examples');
  const btn = document.getElementById('expbtn');
  if(!rows || rows.length===0){
    wrap.hidden = true; btn.hidden = true; return;
  }
  wrap.innerHTML = rows.map(r=>`
    <div class="eg">
      <div class="zhh">${r.zhh||''}<div class="chs">${r.chs||''}</div></div>
      <div class="play"><div class="en">${r.en||''}</div><button class="tts" aria-label="播放">${ICON_SPK}</button></div>
    </div>`).join('');
  wrap.querySelectorAll('.eg .tts').forEach((b,i)=>{
    const text = rows[i].zhh||'';
    b.addEventListener('click',()=>speak(text));
  });
  wrap.hidden = true;
  btn.hidden = false;
  btn.onclick = ()=>{
    document.querySelector('.container').classList.add('expanded');
    wrap.hidden = false;
    btn.hidden = true;
  };
}

function findLex(query){
  const q = norm(query);
  if(!q) return null;
  return (state.lex||[]).find(x=>{
    if(norm(x.id)===q || norm(x.zhh)===q) return true;
    const aliases = (x.alias_zhh||'').split('/').map(s=>norm(s));
    if(aliases.includes(q)) return true;
    return fuzzy(q,x);
  }) || null;
}

async function boot(){
  try{
    const [lex, ex] = await Promise.all([
      loadCSV('lexeme.csv'),
      loadCSV('examples.csv')
    ]);
    state.lex = lex; state.ex = ex;
  }catch(e){ console.error(e); }

  const container = document.querySelector('.container');
  container.classList.add('init');

  const q = document.getElementById('q');
  q.addEventListener('input', ()=>{
    const v = q.value.trim();
    if(!v){ container.classList.add('init'); clearMain(); }
  });

  q.addEventListener('keyup', (ev)=>{
    if(ev.key==='Enter'){
      const v = q.value.trim();
      if(!v){ clearMain(); return; }
      const hit = findLex(v);
      if(!hit){
        container.classList.add('init'); clearMain(); return;
      }
      container.classList.remove('init','expanded');
      container.classList.add('ready');
      renderLex(hit);
      const rows = (state.ex||[]).filter(r=> (r.lex_id||'') === (hit.id||''));
      renderExamples(rows);
    }
  });

  if('speechSynthesis' in window){
    window.speechSynthesis.onvoiceschanged = ()=>{ state.voice = pickVoice(); };
  }
}
boot();
