// --- utils ---
async function loadJSON(path){
  const r = await fetch(path);
  if(!r.ok) throw new Error(`Load failed: ${path}`);
  return r.json();
}
const $ = id => document.getElementById(id);

// --- data holders ---
let LEX_RAW = null;       // 原始 lexicon（可能是对象或数组）
let INDEX = Object.create(null); // 统一检索索引：key(lowercased) -> entry
let AUDIO = Object.create(null);

// --- build index for both schemas ---
function buildIndex(){
  INDEX = Object.create(null);
  if (!LEX_RAW) return;

  // 情况A：字典 { "谢谢": {...}, "hello": {...} }
  if (!Array.isArray(LEX_RAW)){
    for (const k of Object.keys(LEX_RAW)){
      INDEX[k.toLowerCase()] = LEX_RAW[k];
    }
    return;
  }

  // 情况B：数组 [ {id, intents:[], yue, jyut, ...}, ... ]
  for (const item of LEX_RAW){
    if (!item) continue;
    // 用 id 也可检索
    if (item.id) INDEX[String(item.id).toLowerCase()] = item;

    // intents 里所有字符串都映射到这条记录
    if (Array.isArray(item.intents)){
      for (const s of item.intents){
        if (!s) continue;
        INDEX[String(s).toLowerCase()] = item;
      }
    }
