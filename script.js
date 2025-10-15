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
      yue: it.yue ? [{ text:it.yue, jyut]()
