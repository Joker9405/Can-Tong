// --- utils ---
async function loadJSON(path){
  const r = await fetch(path);
  console.log('[fetch]', path, r.status);
  if(!r.ok) throw new Error(`Load failed: ${path} (${r.status})`);
  return r.json();
}
const $ = id => document.getElementById(id);

// --- state ---
let GROUPS = [];                 // 统一后的“语义组”数组
let INDEX = Object.create(null); // 触发词 -> 语义组
let AUDIO = Object.create(null);

// 将旧格式转换为统一“语义组”
function normalizeToGroups(raw){
  // 新格式：数组里有 src / yue
  if (Array.isArray(raw) && raw.length && (raw[0]?.src || raw[0]?.yue)) return raw;

  // 字典格式 { "谢谢": {...} }
  if (!Array.isArray(raw) && typeof raw === 'object' && raw){
    return Object.entries(raw).map(([k,v],i)=>({
      id: v?.id || `legacy_${i}`,
      src: { zh: [k] },
      yue: v?.yue ? [{text: v.yue, jyut: v.jyut||""}] : [],
      emoji: v?.emoji||"", emotion: v?.emotion||"", note: v?.note||"", tags:[]
    }));
  }

  // 旧数组格式 [{id,intents,yue,jyut,...}]
  if (Array.isArray(raw)){
    return raw.map((it,i)=>({
      id: it.id || `legacy_${i}`,
      src: { zh: Array.isArray(it.intents)? it.intents : [] },
      yue: it.yue ? [{text: it.yue, jyut: it.jyut||""}] : [],
      emoji: it.emoji||"", emotion: it.emotion||"", note: it.note||"", tags:[]
    }));
  }
  return [];
}

function buildIndex(){
  INDEX = Object.create(null);
  for (const g of GROUPS){
    // 各语言触发词
    for (const L of Object.keys(g.src||{})){
      for (const s of (g.src[L]||[])){
        if (s) INDEX[String(s).toLowerCase()] = g;
      }
    }
    // 允许以粤语文本检索
    for (const y of (g.yue||[])){
      if (y?.text) INDEX[String(y.text).toLowerCase()] = g;
    }
    if (g.id) INDEX[String(g.id).toLowerCase()] = g;
  }
  console.log('[index size]', Object.keys(INDEX).length);
}

function render(group){
  if (!group){
    $('yue').textContent='（未收录）';
    $('jyut').textContent='—';
    $('emotion').textContent='—';
    $('emoji').textContent='';
    $('note').textContent='';
    $('alts').innerHTML='<li>—</li>';
    return;
  }
  const first = (group.yue||[])[0] || {};
  $('yue').textContent = first.text || '—';
  $('jyut').textContent = first.jyut || '—';
  $('emotion').textContent = group.emotion || '—';
  $('emoji').textContent = group.emoji || '';
  $('note').textContent  = group.note || '';

  $('alts').innerHTML = (group.yue||[]).map((y,i)=>{
    const safe = (y.text||'').replace(/"/g,'&quot;');
    return `<li><button data-i="${i}" class="say" style="margin-right:6px">🔊</button>${safe} <span style="color:#666">(${y.jyut||'—'})</span></li>`;
  }).join('') || '<li>—</li>';

  document.querySelectorAll('.say').forEach(btn=>{
    btn.onclick = ()=>{
      const i = Number(btn.dataset.i||0);
      const y = (group.yue||[])[i];
      speakYue(y?.text);
    };
  });
}

function show(q){
  q = (q||'').trim().toLowerCase();
  if (!q) return;
  const g = INDEX[q] || null;
  console.log('[query]', q, 'hit?', !!g);
  render(g);
}

function speakYue(text){
  if (!text) return;
  const key = text.toLowerCase();
  const local = AUDIO[key];
  if (local){ new Audio(local).play(); return; }
  const u = new SpeechSynthesisUtterance(text);
  u.lang = 'zh-HK';
  speechSynthesis.speak(u);
}

function speakQuery(){
  const q = (document.getElementById('q').value||'').trim();
  if (!q) return;
  const g = INDEX[q.toLowerCase()];
  const text = g?.yue?.[0]?.text || q;
  speakYue(text);
}

// --- bootstrap ---
(async()=>{
  try{
    const raw = await loadJSON('./data/lexicon.json');
    GROUPS = normalizeToGroups(raw);
    buildIndex();
    AUDIO = await loadJSON('./data/devAudioMap.json').catch(()=> ({}));
  }catch(e){
    console.error(e);
  }
})();

$('search').onclick = ()=> show(($('q').value||''));
$('speak').onclick  = ()=> speakQuery();
