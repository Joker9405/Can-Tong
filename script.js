// ------- utils -------
async function loadJSON(p){ const r=await fetch(p); if(!r.ok) throw new Error(`Load failed: ${p}`); return r.json(); }
const $ = id => document.getElementById(id);

// ------- state -------
let GROUPS = [];                 // 语义组数组（标准格式）
let INDEX = Object.create(null); // 触发词 -> 组
let AUDIO = Object.create(null);

// 兼容旧格式：若检测到旧的“字典/数组”格式，转换为语义组
function normalizeToGroups(raw){
  // 已是数组且存在 src/yue 数组 => 视为新格式
  if (Array.isArray(raw) && raw.length && (raw[0]?.src || raw[0]?.yue)) return raw;

  // 字典格式 { "谢谢": {...} } -> 每个键一个组
  if (!Array.isArray(raw) && typeof raw === 'object'){
    return Object.entries(raw).map(([k,v],i)=>({
      id: v?.id || `legacy_${i}`,
      src: { zh: [k] },
      yue: v?.yue ? [{text: v.yue, jyut: v.jyut||""}] : [],
      emoji: v?.emoji||"", emotion: v?.emotion||"", note: v?.note||"", tags:[]
    }));
  }

  // 旧数组格式 [{id,intents,yue,jyut,...}] -> intents 作为 src.zh
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
    // 触发词：收集各语言 src 里的所有词
    const langs = Object.keys(g.src||{});
    for (const L of langs){
      for (const s of (g.src[L]||[])){
        if (!s) continue;
        INDEX[s.toLowerCase()] = g;
      }
    }
    // 也允许用 yue 文本直接检索
    for (const y of (g.yue||[])){
      if (y?.text) INDEX[String(y.text).toLowerCase()] = g;
    }
    // id 也可检索
    if (g.id) INDEX[String(g.id).toLowerCase()] = g;
  }
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
  // 展示第一条为主
  const first = (group.yue||[])[0] || {};
  $('yue').textContent = first.text || '—';
  $('jyut').textContent = first.jyut || '—';
  $('emotion').textContent = group.emotion || '—';
  $('emoji').textContent = group.emoji || '';
  $('note').textContent  = group.note || '';

  // 同义列表（可点发音）
  $('alts').innerHTML = (group.yue||[]).map((y,i)=>{
    const safe = y.text.replace(/"/g,'&quot;');
    return `<li><button data-i="${i}" class="say" style="margin-right:6px">🔊</button>${safe} <span style="color:#666">(${y.jyut||'—'})</span></li>`;
  }).join('') || '<li>—</li>';

  // 绑定每条的发音按钮
  document.querySelectorAll('.say').forEach(btn=>{
    btn.onclick = ()=>{
      const i = Number(btn.dataset.i||0);
      speakYue((group.yue||[])[i]?.text);
    };
  });
}

function show(q){
  q = (q||'').trim().toLowerCase();
  if (!q) return;
  const g = INDEX[q] || null;
  render(g);
}

// 发音：优先 devAudioMap；否则浏览器 zh-HK TTS
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
  // 如果 query 命中了组就读第一条粤语，否则直接读 query
  const g = INDEX[q.toLowerCase()];
  const text = g?.yue?.[0]?.text || q;
  speakYue(text);
}

// ------- bootstrap -------
(async()=>{
  try{
    const raw = await loadJSON('./data/lexicon.json');
    GROUPS = normalizeToGroups(raw);
    buildIndex();
    AUDIO = await loadJSON('./data/devAudioMap.json').catch(()=> ({}));
  }catch(e){ console.warn(e); }
})();

$('search').onclick = ()=> show(($('q').value||''));
$('speak').onclick  = ()=> speakQ
