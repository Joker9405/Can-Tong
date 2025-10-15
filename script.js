// ========== script.js (v12) ==========

// 工具
async function loadJSON(path){
  const r = await fetch(path, { cache: "no-store" });
  if(!r.ok) throw new Error(`load failed: ${path} (${r.status})`);
  return r.json();
}
const $ = id => document.getElementById(id);

// 运行态
let GROUPS = [];                 // 统一语义组
let INDEX  = Object.create(null); // 触发词/词根 -> group
let AUDIO  = Object.create(null); // 文本 -> mp3 路径

// —— 规则：常见“程度/语气”成分（会被剥除以做词根匹配）——
const DEGREE_WORDS = [
  "这么","咁","好","非常","十分","真系","真係","极其","极度","太","几咁","几咁样","都几","有啲","有点","有點","好唔","好唔系","特别","特別"
];
// 一些标点/空白
const SEP_RE = /[，。、「」『』（）\(\)\[\]【】?!？！；;、\s]+/g;

// 词根化：去掉程度词 + 修剪
function stemZh(s){
  if(!s) return "";
  let t = String(s).trim();
  for(const w of DEGREE_WORDS){
    t = t.replaceAll(w, "");
  }
  return t.trim();
}

// 把不同数据格式统一成语义组
function normalizeToGroups(raw){
  if (Array.isArray(raw) && raw.length && (raw[0]?.src || raw[0]?.yue)) return raw;

  if (!Array.isArray(raw) && typeof raw === "object" && raw){
    return Object.entries(raw).map(([k,v],i)=>({
      id: v?.id || `legacy_${i}`,
      src:{ zh:[k] },
      yue: v?.yue ? [{ text:v.yue, jyut:v.jyut||"" }] : [],
      emoji:v?.emoji||"", emotion:v?.emotion||"", note:v?.note||"", tags:[]
    }));
  }
  if (Array.isArray(raw)){
    return raw.map((it,i)=>({
      id: it.id || `legacy_${i}`,
      src:{ zh:Array.isArray(it.intents)? it.intents:[] },
      yue: it.yue ? [{ text:it.yue, jyut:it.jyut||"" }] : [],
      emoji:it.emoji||"", emotion:it.emotion||"", note:it.note||"", tags:[]
    }));
  }
  return [];
}

// 建索引（含词根与原词、以及全部同义词）
function buildIndex(){
  INDEX = Object.create(null);

  for(const g of GROUPS){
    // 1) 源中文同义词
    for(const s of (g.src?.zh || [])){
      if(!s) continue;
      INDEX[s.toLowerCase()] = g;
      const st = stemZh(s);
      if(st && st !== s) INDEX[st.toLowerCase()] = g;

      // 额外：把句子里的词切出来也索引一下（提升召回）
      const parts = s.split(SEP_RE).filter(Boolean);
      for(const p of parts){
        const pst = stemZh(p);
        if(p.length >= 2) INDEX[p.toLowerCase()] = g;
        if(pst && pst !== p && pst.length>=2) INDEX[pst.toLowerCase()] = g;
      }
    }
    // 2) 粤语候选文本也可作触发
    for(const y of (g.yue || [])){
      if(y?.text){
        INDEX[y.text.toLowerCase()] = g;
      }
    }
    if (g.id) INDEX[g.id.toLowerCase()] = g;
  }
  // console.log("[index size]", Object.keys(INDEX).length);
}

// 匹配：先精确，再词根精确，再“包含命中”（最长优先）
function matchGroup(qRaw){
  let q = (qRaw||"").trim().toLowerCase();
  if(!q) return null;

  // 精确
  if (INDEX[q]) return INDEX[q];

  // 词根精确
  const st = stemZh(q).toLowerCase();
  if (st && INDEX[st]) return INDEX[st];

  // 包含命中：在所有 key 里找能被包含的，长度越长优先
  const keys = Object.keys(INDEX);
  let best = null, bestLen = 0;
  for(const k of keys){
    if(!k) continue;
    if (q.includes(k) || st.includes(k) || k.includes(q)) {
      if (k.length > bestLen){
        best = INDEX[k]; bestLen = k.length;
      }
    }
  }
  return best;
}

// 渲染
function render(group){
  if (!group){
    $("yue").textContent="（未收录）";
    $("jyut").textContent="—";
    $("emotion").textContent="—";
    $("emoji").textContent="";
    $("note").textContent="";
    $("alts").innerHTML="<li>—</li>";
    return;
  }
  const first = (group.yue||[])[0] || {};
  $("yue").textContent = first.text || "—";
  $("jyut").textContent = first.jyut || "—";
  $("emotion").textContent = group.emotion || "—";
  $("emoji").textContent = group.emoji || "";
  $("note").textContent = group.note || "";

  $("alts").innerHTML = (group.yue||[]).map((y,i)=>{
    const safe = (y.text||"").replace(/"/g,'&quot;');
    return `<li><button data-i="${i}" class="say" style="margin-right:6px">🔊</button>${safe} <span style="color:#666">(${y.jyut||"—"})</span></li>`;
  }).join("") || "<li>—</li>";

  document.querySelectorAll(".say").forEach(btn=>{
    btn.onclick = ()=>{
      const i = Number(btn.dataset.i||0);
      const y = (group.yue||[])[i];
      speakYue(y?.text);
    };
  });
}

// 查询入口
function show(q){
  const g = matchGroup(q);
  render(g);
}

// 发音：本地 mp3 优先，否则 TTS 回退
function speakYue(text){
  if (!text) return;
  const key = text.toLowerCase();
  const local = AUDIO[key];
  if (local){ new Audio(local).play(); return; }
  const u = new SpeechSynthesisUtterance(text);
  u.lang = "zh-HK";
  speechSynthesis.speak(u);
}

function speakQuery(){
  const q = (document.getElementById("q").value||"").trim();
  if(!q) return;
  const g = matchGroup(q);
  const text = g?.yue?.[0]?.text || q;
  speakYue(text);
}

// 启动
(async()=>{
  try{
    const raw = await loadJSON("./data/lexicon.v9.json");
    GROUPS = normalizeToGroups(raw);
    buildIndex();

    // 可选：本地音频映射；不存在就用 TTS
    AUDIO = await loadJSON("./data/devAudioMap.v9.json").catch(()=> ({}));
  }catch(e){
    console.error(e);
  }
})();

$("search").onclick = ()=> show((document.getElementById("q").value||""));
$("speak").onclick  = ()=> speakQuery();

// ========== /script.js ==========
