
const PATH='/data/';
let CROSS=[], LEX={}, EXMAP={};

const ICON_SPK=`<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M3 10v4h4l5 4V6L7 10H3zm13.5 2a3.5 3.5 0 0 0-2.5-3.34v6.68A3.5 3.5 0 0 0 16.5 12zm0-7a9.5 9.5 0 0 1 0 14l1.5 1.5A11.5 11.5 0 0 0 18 3.5L16.5 5z"/></svg>`;

function parseCSV(txt){
  const lines = txt.split(/\r?\n/).filter(Boolean);
  const head = lines.shift().split(',').map(s=>s.trim());
  return lines.map(line=>{
    const cells=[]; let cur='', inQ=false;
    for(let i=0;i<line.length;i++){
      const ch=line[i];
      if(ch=='"'){ inQ=!inQ; continue }
      if(ch==',' && !inQ){ cells.push(cur); cur='' } else { cur+=ch }
    }
    cells.push(cur);
    const o={}; head.forEach((k,i)=>o[k]=(cells[i]||'').trim()); return o;
  });
}
async function loadCSV(name){
  const r = await fetch(PATH+name,{cache:'no-store'});
  if(!r.ok) throw new Error(name+' 404');
  return parseCSV(await r.text());
}
function norm(s){return (s||'').toLowerCase().replace(/\s+/g,'')}
function fuzzy(text,q){text=norm(text);q=norm(q);if(!q)return false;let i=0;for(const c of text){if(c===q[i])i++}return i===q.length||text.includes(q)}

let VOICE=null;
function pickVoice(){
  const L = speechSynthesis.getVoices();
  VOICE = L.find(v=>/yue|Cantonese|zh[-_]HK/i.test(v.lang+v.name))
       || L.find(v=>/zh[-_]HK/i.test(v.lang))
       || L.find(v=>/zh/i.test(v.lang)) || null;
}
if('speechSynthesis'in window){speechSynthesis.onvoiceschanged=pickVoice;pickVoice()}
function speak(t){
  if(!('speechSynthesis'in window)||!t) return;
  const u=new SpeechSynthesisUtterance(t);
  if(VOICE) u.voice=VOICE; u.lang=VOICE?.lang||'zh-HK';
  speechSynthesis.cancel(); speechSynthesis.speak(u);
}

async function boot(){
  const [cm, lx, ex] = await Promise.all([
    loadCSV('crossmap.csv'),
    loadCSV('lexeme.csv'),
    loadCSV('examples.csv')
  ]);
  CROSS = cm;
  lx.forEach(r=>LEX[r.id]=r);
  EXMAP = ex.reduce((m,r)=>{(m[r.lexeme_id]||(m[r.lexeme_id]=[])).push(r);return m},{})

  // 初始空白
  renderEmpty();
}

function findLexemeIds(q){
  const nq=norm(q); const set=new Set();
  CROSS.forEach(r=>{ if(fuzzy(r.term,nq)) set.add(r.target_id) });
  Object.values(LEX).forEach(r=>{
    if(fuzzy(r.zhh,nq) || fuzzy(r.en,nq) || fuzzy(r.alias_zhh||'',nq)) set.add(r.id);
  });
  return Array.from(set);
}

function clearCards(){
  document.getElementById('cards').innerHTML='';
  const btn=document.getElementById('expand-btn'), box=document.getElementById('expand-box');
  btn.hidden=true; box.hidden=true; document.getElementById('expand-list').innerHTML='';
}

function renderEmpty(){
  clearCards(); // 搜索框之外保持空白
}

function renderPhased(lex){
  clearCards();
  const grid=document.getElementById('cards');

  const aliases=(lex.alias_zhh||'').split(/[;；]/).map(s=>s.trim()).filter(Boolean);
  const variants=(lex.variants_zhh||'').split(/[;；]/).map(s=>s.trim()).filter(Boolean);

  // 1) 左侧黄卡（先出现）
  const left=document.createElement('div'); left.className='card yellow left';
  left.innerHTML=`
    <div class="badge">粤语zhh：</div>
    <div class="h-head">
      <div class="h-title">${lex.zhh||'—'}</div>
      <button class="tts t-head" title="发音">${ICON_SPK}</button>
    </div>
    ${aliases.map(a=>`<div class="row"><div class="alias">${a}</div><button class="tts" title="发音">${ICON_SPK}</button></div>`).join('')}
  `;
  grid.appendChild(left); requestAnimationFrame(()=>left.classList.add('show'));
  left.querySelector('.t-head')?.addEventListener('click',()=>speak(lex.zhh||''));
  left.querySelectorAll('.row .tts').forEach((b,i)=>{const t=aliases[i]; b.addEventListener('click',()=>speak(t))});

  // 2) 稍后右上粉卡（仅文本，无喇叭）与右下灰卡
  setTimeout(()=>{
    const rtop=document.createElement('div'); rtop.className='card pink right-top';
    rtop.innerHTML=`<div class="vars">${variants.map(v=>`<div class="var-row">${v}</div>`).join('')||''}</div>`;
    grid.appendChild(rtop); requestAnimationFrame(()=>rtop.classList.add('show'));

    const rbot=document.createElement('div'); rbot.className='card gray right-bottom';
    const note=(lex.note_en||'')+(lex.note_chs?('<br>'+lex.note_chs):'');
    rbot.innerHTML=`<div class="note">${note||''}</div>`;
    grid.appendChild(rbot); requestAnimationFrame(()=>rbot.classList.add('show'));

    // 3) 灰卡右下角“example 扩展”按钮（固定位置）
    mountExpand(lex);
  }, 120);
}

function mountExpand(lex){
  const btn=document.getElementById('expand-btn');
  const box=document.getElementById('expand-box');
  const list=document.getElementById('expand-list');
  const exs=EXMAP[lex.id]||[];
  if(!exs.length){btn.hidden=true;box.hidden=true;return;}
  btn.hidden=false; box.hidden=true; list.innerHTML=''; btn.textContent='example 扩展';

  btn.onclick=()=>{
    btn.hidden=true; // 展开后取代按钮
    box.hidden=false;
    list.innerHTML='';
    exs.forEach(e=>{
      const row=document.createElement('div'); row.className='example';
      row.innerHTML=`
        <div class="yue">${e.ex_zhh||''}</div>
        <div class="right"><div class="en">${e.ex_en||''}</div><div class="chs">${e.ex_chs||''}</div></div>
        <div class="btns"><button class="tts t1" title="粤语">${ICON_SPK}</button></div>`;
      row.querySelector('.t1').addEventListener('click',()=>speak(e.ex_zhh||''));
      list.appendChild(row);
    });
  };
}

document.getElementById('q').addEventListener('input',e=>{
  const q=e.target.value;
  if(!q){ renderEmpty(); return; }
  const ids=findLexemeIds(q);
  if(!ids.length){ renderEmpty(); return; }
  const lex=LEX[ids[0]]; // 取第一命中
  renderPhased(lex);
});

boot();
