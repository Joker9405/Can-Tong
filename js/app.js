
const DATA_BASE='/data/';
let CROSS=[], LEX={}, EXMAP={};

const ICON_SPK = `<svg viewBox="0 0 24 24"><path d="M3 10v4h4l5 4V6L7 10H3zm13.5 2a3.5 3.5 0 0 0-2.5-3.34v6.68A3.5 3.5 0 0 0 16.5 12zm0-7a9.5 9.5 0 0 1 0 14l1.5 1.5A11.5 11.5 0 0 0 18 3.5L16.5 5z"/></svg>`;

function parseCSV(txt){
  const lines = txt.split(/\r?\n/).filter(Boolean);
  const head = lines.shift().split(',').map(s=>s.trim());
  return lines.map(line=>{
    const cells=[];let cur='',q=false;
    for(let i=0;i<line.length;i++){
      const c=line[i];
      if(c=='"'){q=!q;continue}
      if(c==',' && !q){cells.push(cur);cur=''} else {cur+=c}
    }cells.push(cur);
    const obj={}; head.forEach((k,i)=>obj[k]=(cells[i]||'').trim()); return obj;
  });
}
async function loadCSV(name){const r=await fetch(DATA_BASE+name,{cache:'no-store'}); if(!r.ok) throw new Error(name); return parseCSV(await r.text())}
function norm(s){return (s||'').toLowerCase().replace(/\s+/g,'')}
function fuzzy(t,q){t=norm(t);q=norm(q); if(!q) return false; let i=0; for(const c of t){ if(c===q[i]) i++ } return i===q.length || t.includes(q) }

// TTS 仅播粤语（优先 yue/zh-HK）
let VOICE=null; function pickVoice(){ const L=speechSynthesis.getVoices(); VOICE=L.find(v=>/yue|Cantonese|zh[-_]HK/i.test(v.lang+v.name))||L.find(v=>/zh[-_]HK/i.test(v.lang))||L.find(v=>/zh/i.test(v.lang))||null }
if('speechSynthesis' in window){ speechSynthesis.onvoiceschanged=pickVoice; pickVoice() }
function speak(text){ if(!('speechSynthesis' in window)||!text) return; const u=new SpeechSynthesisUtterance(text); if(VOICE) u.voice=VOICE; u.lang=VOICE?.lang||'zh-HK'; speechSynthesis.cancel(); speechSynthesis.speak(u) }

async function boot(){
  const [cm,lx,ex] = await Promise.all([loadCSV('crossmap.csv'),loadCSV('lexeme.csv'),loadCSV('examples.csv')]);
  CROSS = cm; lx.forEach(r=>LEX[r.id]=r);
  EXMAP = ex.reduce((m,r)=>{ (m[r.lexeme_id]||(m[r.lexeme_id]=[])).push(r); return m },{});
}

function findIds(q){
  const set=new Set(), nq=norm(q);
  CROSS.forEach(r=>{ if(fuzzy(r.term,nq)) set.add(r.target_id) });
  Object.values(LEX).forEach(r=>{
    if(fuzzy(r.zhh,nq)||fuzzy(r.en,nq)||fuzzy(r.alias_zhh||'',nq)) set.add(r.id)
  });
  return Array.from(set);
}

function clearUI(){
  const grid=document.getElementById('grid'); grid.innerHTML='';
  const ex=document.getElementById('expand'); ex.hidden=true; document.getElementById('expand-list').innerHTML='';
}

function renderEmpty(){ clearUI(); /* 只有搜索框，其他空白 */ }

function renderFlow(lex){
  clearUI();
  const grid=document.getElementById('grid');

  // 左：主词 + 别名（均带发音）
  const aliases=(lex.alias_zhh||'').split(/[;；]/).map(s=>s.trim()).filter(Boolean);
  const left=document.createElement('div'); left.className='card yellow left';
  left.innerHTML = `
    <div class="badge">粤语zhh：</div>
    <div class="h-head">
      <div class="h-title">${lex.zhh||'—'}</div>
      <button class="tts t-head" title="发音">${ICON_SPK}</button>
    </div>
    ${aliases.map(a=>`<div class="row"><div>${a}</div><button class="tts">${ICON_SPK}</button></div>`).join('')}
  `;
  grid.appendChild(left); requestAnimationFrame(()=>left.classList.add('show'));
  left.querySelector('.t-head').onclick=()=>speak(lex.zhh||'');
  left.querySelectorAll('.row .tts').forEach((b,i)=>b.onclick=()=>speak(aliases[i]));

  // 延迟再渲染右上/右下
  setTimeout(()=>{
    // 右上：变体（仅文本、无喇叭）
    const rightTop=document.createElement('div'); rightTop.className='card pink right-top';
    const variants=(lex.variants_zhh||'').split(/[;；]/).map(s=>s.trim()).filter(Boolean);
    rightTop.innerHTML = `<div class="vars">${variants.map(v=>`<div class="var-row">${v}</div>`).join('')}</div>`;
    grid.appendChild(rightTop); requestAnimationFrame(()=>rightTop.classList.add('show'));

    // 右下：备注 + 右下角固定「example 扩展」按钮
    const rightBottom=document.createElement('div'); rightBottom.className='card gray right-bottom';
    const note=(lex.note_en||'')+(lex.note_chs?('<br>'+lex.note_chs):'');
    rightBottom.innerHTML = `<div class="note">${note}</div><button class="expand-btn" id="exbtn">example 扩展</button>`;
    grid.appendChild(rightBottom); requestAnimationFrame(()=>rightBottom.classList.add('show'));

    // 绑定展开
    document.getElementById('exbtn').onclick=()=>openExamples(lex);
  }, 120);
}

function openExamples(lex){
  // 替换按钮：隐藏按钮，显示下方整块粉色例句
  const btn=document.getElementById('exbtn'); if(btn) btn.remove();
  const exSec=document.getElementById('expand'); const list=document.getElementById('expand-list');
  list.innerHTML='';
  (EXMAP[lex.id]||[]).forEach(e=>{
    const row=document.createElement('div'); row.className='example';
    row.innerHTML = `
      <div class="yue">${e.ex_zhh||''}</div>
      <div class="right"><div class="en">${e.ex_en||''}</div><div class="chs">${e.ex_chs||''}</div></div>
      <div class="btns"><button class="tts" title="粤语">${ICON_SPK}</button></div>`;
    row.querySelector('.tts').onclick=()=>speak(e.ex_zhh||'');
    list.appendChild(row);
  });
  exSec.hidden=false;
}

document.getElementById('q').addEventListener('input', e=>{
  const q=e.target.value;
  if(!q){ renderEmpty(); return; }
  const ids=findIds(q);
  if(!ids.length){ renderEmpty(); return; }
  renderFlow(LEX[ids[0]]);
});

boot();
