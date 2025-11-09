const PATH='/data/'; let CROSS=[], LEX={}, EXMAP={};
function parseCSV(t){const lines=t.split(/\r?\n/).filter(Boolean);const head=lines.shift().split(',').map(s=>s.trim());return lines.map(line=>{const cells=[];let cur='',inQ=false;for(let i=0;i<line.length;i++){const ch=line[i];if(ch=='"'){inQ=!inQ;continue}if(ch==','&&!inQ){cells.push(cur);cur=''}else{cur+=ch}}cells.push(cur);const obj={};head.forEach((k,i)=>obj[k]=(cells[i]||'').trim());return obj})}
async function loadCSV(name){const r=await fetch(PATH+name,{cache:'no-store'});if(!r.ok) throw new Error('load '+name+' failed');return parseCSV(await r.text())}
function norm(s){return (s||'').toLowerCase().replace(/\s+/g,'')}
function fuzzy(text,q){text=norm(text);q=norm(q);if(!q)return false;let i=0;for(const c of text){if(c===q[i])i++}return i===q.length||text.includes(q)}
let VOICE=null;function pickVoice(){const L=speechSynthesis.getVoices();VOICE=L.find(v=>/yue|Cantonese|zh[-_]HK/i.test(v.lang+v.name))||L.find(v=>/zh[-_]HK/i.test(v.lang))||L.find(v=>/zh/i.test(v.lang))||null}if('speechSynthesis'in window){speechSynthesis.onvoiceschanged=pickVoice;pickVoice()}
function speak(t){if(!('speechSynthesis'in window)||!t)return;const u=new SpeechSynthesisUtterance(t);if(VOICE)u.voice=VOICE;u.lang=VOICE?.lang||'zh-HK';speechSynthesis.cancel();speechSynthesis.speak(u)}
const ICON=`<svg viewBox="0 0 24 24"><path d="M3 10v4h4l5 4V6L7 10H3zm13.5 2a3.5 3.5 0 0 0-2.5-3.34v6.68A3.5 3.5 0 0 0 16.5 12zm0-7a9.5 9.5 0 0 1 0 14l1.5 1.5A11.5 11.5 0 0 0 18 3.5L16.5 5z"/></svg>`;
async function boot(){const[cm,lx,ex]=await Promise.all([loadCSV('crossmap.csv'),loadCSV('lexeme.csv'),loadCSV('examples.csv')]);CROSS=cm;lx.forEach(r=>LEX[r.id]=r);EXMAP=ex.reduce((m,r)=>{(m[r.lexeme_id]||(m[r.lexeme_id]=[])).push(r);return m},{})}
function findLexemeIds(q){const nq=norm(q);if(!nq)return[];const set=new Set();CROSS.forEach(r=>{if(fuzzy(r.term,nq))set.add(r.target_id)});Object.values(LEX).forEach(r=>{if(fuzzy(r.zhh,nq)||fuzzy(r.en,nq)||fuzzy(r.alias_zhh||'',nq))set.add(r.id)});return Array.from(set)}
const grid=document.getElementById('grid');const examples=document.getElementById('examples');const examplesList=document.getElementById('examples-list');
function resetUI(){grid.innerHTML='';examples.hidden=true;examplesList.innerHTML=''}
function renderEmpty(){resetUI()}
function pairedVariants(chs,en){const A=(chs||'').split(/[;；]/).map(s=>s.trim()).filter(Boolean);const B=(en||'').split(/[;；]/).map(s=>s.trim()).filter(Boolean);const n=Math.max(A.length,B.length);const out=[];for(let i=0;i<n;i++){out.push({zh:A[i]||'',en:B[i]||''})}return out}
function renderPhased(lex){resetUI();
  const aliases=(lex.alias_zhh||'').split(/[;；]/).map(s=>s.trim()).filter(Boolean);
  const variants=pairedVariants(lex.variants_chs, lex.variants_en);
  const note=(lex.note_en||'')+(lex.note_chs?('<br>'+lex.note_chs):'');
  const left=document.createElement('div');left.className='card yellow left';
  left.innerHTML=`<div class="badge">粤语zhh：</div>
    <div class="h-head"><div class="h-title">${lex.zhh||'—'}</div><button class="tts t-head" title="发音">${ICON}</button></div>
    ${aliases.map(a=>`<div class="row"><div class="alias">${a}</div><button class="tts">${ICON}</button></div>`).join('')}`;
  grid.appendChild(left);requestAnimationFrame(()=>left.classList.add('show'));
  left.querySelector('.t-head').onclick=()=>speak(lex.zhh||''); left.querySelectorAll('.row .tts').forEach((b,i)=>b.onclick=()=>speak(aliases[i]));
  setTimeout(()=>{
    const rt=document.createElement('div');rt.className='card pink right-top';
    rt.innerHTML=`<div class="vars">${variants.map(v=>`<div class="var-row"><div class="var-zh">${v.zh}</div>${v.en?`<div class="var-en">${v.en}</div>`:''}</div>`).join('')}</div>`;
    grid.appendChild(rt);requestAnimationFrame(()=>rt.classList.add('show'));
    const rb=document.createElement('div');rb.className='card gray right-bottom';
    rb.innerHTML=`<div class="note">${note||''}</div><button id="example-btn">example 扩展</button>`;grid.appendChild(rb);requestAnimationFrame(()=>rb.classList.add('show'));
    rb.querySelector('#example-btn').onclick=()=>toggleExamples(lex, rb.querySelector('#example-btn'));
  },120);
}
function toggleExamples(lex, btn){const exs=EXMAP[lex.id]||[];if(!exs.length)return;
  if(examples.hidden){
    examplesList.innerHTML='';
    exs.forEach(e=>{const row=document.createElement('div');row.className='example';
      row.innerHTML=`<div class="yue">${e.ex_zhh||''}</div>
        <div class="right"><div class="en">${e.ex_en||''}</div><div class="chs">${e.ex_chs||''}</div></div>
        <div class="btns"><button class="tts" title="粤语">${ICON}</button></div>`;
      row.querySelector('.tts').onclick=()=>speak(e.ex_zhh||'');examplesList.appendChild(row)});
    examples.hidden=false; btn.remove();
  }else{examples.hidden=true;}
}
document.getElementById('q').addEventListener('input',e=>{const q=e.target.value; if(!q){renderEmpty();return} const ids=findLexemeIds(q); if(!ids.length){renderEmpty();return} renderPhased(LEX[ids[0]])});
boot();
