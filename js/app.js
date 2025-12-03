const PATH='/data/'; let CROSS=[], LEX={}, EXMAP={};

/**
 * 更稳健的 CSV 解析（在你原代码基础上“最小改动”替换 parseCSV）
 * 修复点：
 * 1) 支持 RFC4180：引号、逗号、\r\n、以及 "" 转义引号
 * 2) 针对“某一列未加引号但包含英文逗号, 导致后半列整体错位”的情况：
 *    - 如果 cells.length > head.length，会把多出来的 cell 合并回长文本列（优先 note_en）
 *    - 这样就能修复你说的：唯独 L61 右侧释义/英文解释（通常在 note_en/note_chs）不显示
 */
function parseCSV(t){
  t = (t || '').replace(/^\uFEFF/, ''); // 去 BOM

  // 先把文本解析为二维数组 rows[][]（支持引号与换行）
  const rows = [];
  let row = [];
  let cur = '';
  let inQ = false;

  for (let i = 0; i < t.length; i++) {
    const ch = t[i];

    if (ch === '"') {
      // 处理转义双引号："" -> "
      const next = t[i + 1];
      if (inQ && next === '"') { cur += '"'; i++; continue; }
      inQ = !inQ;
      continue;
    }

    // 字段分隔符
    if (ch === ',' && !inQ) { row.push(cur); cur = ''; continue; }

    // 行分隔符（只在非引号内才算换行）
    if ((ch === '\n' || ch === '\r') && !inQ) {
      // 兼容 \r\n
      if (ch === '\r' && t[i + 1] === '\n') i++;
      row.push(cur); cur = '';
      // 跳过全空行
      if (row.some(c => String(c).trim() !== '')) rows.push(row);
      row = [];
      continue;
    }

    cur += ch;
  }
  row.push(cur);
  if (row.some(c => String(c).trim() !== '')) rows.push(row);

  if (!rows.length) return [];

  const head = rows.shift().map(s => String(s || '').trim());
  const idxMap = Object.create(null);
  head.forEach((k, i) => { idxMap[k] = i; });

  function fixCells(cells){
    // 统一 string 化（先不 trim，合并后再 trim）
    cells = cells.map(c => c == null ? '' : String(c));

    if (cells.length === head.length) return cells;

    // 少列：补空
    if (cells.length < head.length) {
      return cells.concat(Array(head.length - cells.length).fill(''));
    }

    // 多列：尝试把多出来的部分合并回“长文本列”
    let extra = cells.length - head.length;

    // 你这个项目里右侧“不显示”的内容通常来自这些列（优先 note_en）
    const mergeCandidates = [
      'note_en','note_chs',
      'usage_en','usage_chs',
      'explain_en','explain_chs',
      'detail_en','detail_chs',
      'desc_en','desc_chs'
    ];

    let mergeIdx = -1;
    for (const key of mergeCandidates) {
      if (idxMap[key] !== undefined) { mergeIdx = idxMap[key]; break; }
    }
    // 找不到就退化：合并到最后一列
    if (mergeIdx < 0) mergeIdx = head.length - 1;

    // 把 cells[mergeIdx ... mergeIdx+extra] 合并成一个字段
    const merged = cells.slice(mergeIdx, mergeIdx + extra + 1).join(',');
    let out = cells.slice(0, mergeIdx).concat([merged]).concat(cells.slice(mergeIdx + extra + 1));

    // 如果仍然多列（极端情况：多列都包含未加引号的逗号），再把尾部合并到最后一列兜底
    if (out.length > head.length) {
      const extra2 = out.length - head.length;
      const li = head.length - 1;
      const merged2 = out.slice(li, li + extra2 + 1).join(',');
      out = out.slice(0, li).concat([merged2]);
    }

    // 如果还少列（理论上不会），补空
    if (out.length < head.length) out = out.concat(Array(head.length - out.length).fill(''));

    return out;
  }

  return rows.map(rawCells => {
    const cells = fixCells(rawCells).map(s => String(s || '').trim());
    const obj = {};
    head.forEach((k, i) => obj[k] = (cells[i] || '').trim());
    return obj;
  });
}

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
