
const PATH='/data/';let CROSS=[],LEX={},EXMAP={};
const ICON_SPK=`<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M3 10v4h4l5 4V6L7 10H3zm13.5 2a3.5 3.5 0 0 0-2.5-3.34v6.68A3.5 3.5 0 0 0 16.5 12zm0-7a9.5 9.5 0 0 1 0 14l1.5 1.5A11.5 11.5 0 0 0 18 3.5L16.5 5z"/></svg>`;

function parseCSV(t){const l=t.split(/\r?\n/).filter(Boolean);const h=l.shift().split(',').map(s=>s.trim());return l.map(line=>{const cells=[];let cur='',inQ=false;for(let i=0;i<line.length;i++){const ch=line[i];if(ch=='"'){inQ=!inQ;continue}if(ch==','&&!inQ){cells.push(cur);cur=''}else{cur+=ch}}cells.push(cur);const o={};h.forEach((k,i)=>o[k]=(cells[i]||'').trim());return o})}
async function loadCSV(n){const r=await fetch(PATH+n,{cache:'no-store'});if(!r.ok)throw new Error(n+' 404');return parseCSV(await r.text())}
function norm(s){return (s||'').toLowerCase().replace(/\s+/g,'')}function fuzzy(t,q){t=norm(t);q=norm(q);if(!q)return false;let i=0;for(const c of t){if(c===q[i])i++}return i===q.length||t.includes(q)}

let VOICE=null;function pickVoice(){const L=speechSynthesis.getVoices();VOICE=L.find(v=>/yue|Cantonese|zh[-_]HK/i.test(v.lang+v.name))||L.find(v=>/zh[-_]HK/i.test(v.lang))||L.find(v=>/zh/i.test(v.lang))||null}
if('speechSynthesis'in window){speechSynthesis.onvoiceschanged=pickVoice;pickVoice()}
function speak(t){if(!('speechSynthesis'in window)||!t)return;const u=new SpeechSynthesisUtterance(t);if(VOICE)u.voice=VOICE;u.lang=VOICE?.lang||'zh-HK';speechSynthesis.cancel();speechSynthesis.speak(u)}

async function boot(){const[cm,lx,ex]=await Promise.all([loadCSV('crossmap.csv'),loadCSV('lexeme.csv'),loadCSV('examples.csv')]);CROSS=cm;lx.forEach(r=>LEX[r.id]=r);EXMAP=ex.reduce((m,r)=>{(m[r.lexeme_id]||(m[r.lexeme_id]=[])).push(r);return m},{})}
function findLexemeIds(q){const nq=norm(q);const set=new Set();CROSS.forEach(r=>{if(fuzzy(r.term,nq))set.add(r.target_id)});Object.values(LEX).forEach(r=>{if(fuzzy(r.zhh,nq)||fuzzy(r.en,nq)||fuzzy(r.alias_zhh||'',nq))set.add(r.id)});return Array.from(set)}

function clearUI(){document.getElementById('cards').innerHTML='';document.getElementById('expand-toolbar').classList.add('hidden');document.getElementById('examples-holder').classList.add('hidden')}
function renderEmpty(q){document.getElementById('cards').innerHTML=`<div class="empty">未找到：<b>${q}</b>。请补充到词库。</div>`;document.getElementById('expand-toolbar').classList.add('hidden');document.getElementById('examples-holder').classList.add('hidden')}

function render(lex){
  const cards=document.getElementById('cards');cards.innerHTML='';
  const aliases=(lex.alias_zhh||'').split(/[;；]/).map(s=>s.trim()).filter(Boolean);

  const left=document.createElement('div');left.className='card yellow left';left.innerHTML=`
    <div class="badge">粤语zhh：</div>
    <div class="h-head">
      <div class="h-title">${lex.zhh||'—'}</div>
      <button class="tts t-head" title="发音">${ICON_SPK}</button>
    </div>
    ${aliases.map(a=>`<div class="row"><div class="alias">${a}</div><button class="tts" title="发音">${ICON_SPK}</button></div>`).join('')}
  `;
  left.querySelector('.t-head').addEventListener('click',()=>speak(lex.zhh||''));
  left.querySelectorAll('.row .tts').forEach((b,i)=>{const t=aliases[i];b.addEventListener('click',()=>speak(t))});

  const rightTop=document.createElement('div');rightTop.className='card pink right-top';
  const variants=(lex.variants_zhh||'').split(/[;；]/).map(s=>s.trim()).filter(Boolean);
  rightTop.innerHTML = `<div class="vars">${variants.map(v=>`<div class="var-row">${v}</div>`).join('')}</div>`;

  const rightBottom=document.createElement('div');rightBottom.className='card gray right-bottom';
  const note=(lex.note_en||'')+(lex.note_chs?('<br>'+lex.note_chs):'');rightBottom.innerHTML=`<div class="note">${note}</div>`;

  cards.appendChild(left);cards.appendChild(rightTop);cards.appendChild(rightBottom);

  const toolbar=document.getElementById('expand-toolbar');const btn=document.getElementById('expand-toggle');const holder=document.getElementById('examples-holder');const list=document.getElementById('examples-list');
  const exs=EXMAP[lex.id]||[];
  if(!exs.length){toolbar.classList.add('hidden');holder.classList.add('hidden');list.innerHTML='';return;}
  toolbar.classList.remove('hidden');holder.classList.add('hidden');btn.textContent='example 扩展';list.innerHTML='';

  btn.onclick=()=>{
    const hidden=holder.classList.toggle('hidden');
    btn.textContent=hidden?'example 扩展':'收起扩展';
  };

  // Build rows (once) — one speaker per row (play 粤语)
  exs.forEach(e=>{
    const li=document.createElement('li');li.className='example-row';
    li.innerHTML=`
      <div class="yue">${e.ex_zhh||''}</div>
      <div class="right"><div class="en">${e.ex_en||''}</div><div class="chs">${e.ex_chs||''}</div></div>
      <button class="tts" title="发音">${ICON_SPK}</button>`;
    li.querySelector('.tts').addEventListener('click',()=>speak(e.ex_zhh||''));
    list.appendChild(li);
  });
}

document.addEventListener('DOMContentLoaded',()=>{
  // inject expand scaffold expected by the new CSS
  const main=document.querySelector('.container');
  const toolbar=document.createElement('div');toolbar.id='expand-toolbar';toolbar.className='expand-toolbar hidden';
  toolbar.innerHTML='<button id="expand-toggle" class="expand-toggle">example 扩展</button>';
  const holder=document.createElement('div');holder.id='examples-holder';holder.className='examples-card hidden';
  holder.innerHTML='<ul id="examples-list" class="examples-list"></ul>';
  main.appendChild(toolbar);main.appendChild(holder);

  const q=document.getElementById('q');
  q.placeholder=''; // 空白占位（不显示预置词）
  q.addEventListener('input',e=>{
    const v=e.target.value;
    if(!v){clearUI();return;}
    const ids=findLexemeIds(v);
    if(!ids.length){renderEmpty(v);return;}
    render(LEX[ids[0]]);
  });
});

boot();
