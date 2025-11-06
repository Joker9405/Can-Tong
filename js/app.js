// CanTongMVP front — minimal search & render
const SEED_URL = '/data/seed.csv';
let LEX = [];
let READY = false;

// CSV parse (naive, comma only; for demo keep simple)
function parseCSV(text){
  const lines = text.split(/\r?\n/).filter(Boolean);
  const header = lines.shift().split(',');
  return lines.map(line=>{
    const cells = line.split(',').map(s=>s.trim());
    const obj = {}; header.forEach((h,i)=>obj[h]=cells[i]||'');
    return obj;
  });
}

function norm(s){return (s||'').toLowerCase().replace(/\s+/g,'');}
function fuzzyIncludes(t,q){t=norm(t);q=norm(q);if(!q)return false;let i=0;for(const ch of t){if(ch===q[i]) i++;}return i===q.length || t.includes(q);}

async function boot(){
  try{
    const res = await fetch(SEED_URL,{cache:'no-store'});
    if(!res.ok) throw new Error('seed.csv not found');
    const text = await res.text();
    LEX = parseCSV(text).map(x=>({
      ...x,
      _alias: (x.alias_zhh||'').split(';').map(s=>s.trim()).filter(Boolean),
      _examples: (x.examples||'').split('||').map(s=>s.trim()).filter(Boolean),
      _hay: [x.chs,x.zhh,x.en,x.alias_zhh].join(' || ')
    }));
    READY = true;
  }catch(e){
    console.error(e); READY=false;
  }
}

function search(q){
  if(!READY || !q) return [];
  return LEX.filter(x=>fuzzyIncludes(x._hay,q)).slice(0,20);
}

function speak(text,langHint='yue-HK'){
  if(!window.speechSynthesis){return}
  const u = new SpeechSynthesisUtterance(text);
  u.lang = (langHint==='yue-HK'?'yue-HK':'zh-HK');
  window.speechSynthesis.cancel();
  window.speechSynthesis.speak(u);
}

function render(list,q){
  const el = document.getElementById('result');
  el.innerHTML='';
  if(!q) return;

  if(!list.length){
    el.innerHTML = `<div class="card empty">未找到：<b>${q}</b><br>欢迎点击右下角「example 扩展」补充词条。</div>`;
    return;
  }

  // 只展示首条为主卡，其余以 examples 扩展
  const item = list[0];
  const alias = item._alias;
  const vars  = item.variants_zhh || '';
  const note  = (item.note_en||'') + (item.note_chs? ('<br>'+item.note_chs):'');

  const grid = document.createElement('div');
  grid.className='grid';

  // 左黄卡
  const left = document.createElement('div');
  left.className='card yellow';
  left.innerHTML = `
    <div class="title">${item.zhh||'—'}</div>
    ${alias.length? `<div class="alias">${alias.join('</div><div class="alias">')}</div>` : ''}
    <button class="tts" aria-label="speak"></button>
  `;
  left.querySelector('.tts').addEventListener('click',()=>speak(item.zhh,'yue-HK'));

  // 右粉卡（变体）
  const right = document.createElement('div');
  right.className='card pink';
  right.innerHTML = `<div class="vars">${vars}</div>`;

  // 右下灰卡（备注）
  const noteBox = document.createElement('div');
  noteBox.className='card gray';
  noteBox.innerHTML = `<div class="note">${note||''}</div>`;

  grid.appendChild(left);
  grid.appendChild(right);
  grid.appendChild(document.createElement('div'));
  grid.appendChild(noteBox);
  el.appendChild(grid);

  // 扩展示例
  const listWrap = document.createElement('div');
  listWrap.className='examples';
  (item._examples||[]).forEach(line=>{
    const row = document.createElement('div');
    row.className='example-row';
    row.innerHTML = `<div class="txt">${line}</div><button class="tts" aria-label="speak"></button>`;
    row.querySelector('.tts').addEventListener('click',()=>speak(line,'yue-HK'));
    listWrap.appendChild(row);
  });
  el.appendChild(listWrap);
}

document.getElementById('q').addEventListener('input', e=>{
  const q = e.target.value;
  const matches = search(q);
  render(matches,q);
});

document.getElementById('expand').addEventListener('click',()=>{
  alert('「扩展」提交入口尚未接入后端表单。请在 GitHub issues 或表单提交。');
});

boot();
