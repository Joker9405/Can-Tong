/* Can-Tong 前端純靜態：三語互通 + 粵語三檔 + 發音 + OOV回退 */
const $ = (q) => document.querySelector(q);
const $$ = (q) => Array.from(document.querySelectorAll(q));
const S = (id) => document.getElementById(id);

const state = {
  voices: [],
  zhHK: null,
  yue: null,
  zh: null,
  data: [],
  audioIndex: new Map(), // 文本→本地音頻相對路徑
};

// —— 初始化：載入數據 & 語音 —— //
window.addEventListener("load", async () => {
  await loadLexicon();
  await loadVoices();
  bindUI();
});

async function loadLexicon(){
  try{
    const res = await fetch("./data/lexicon.json", {cache:"no-store"});
    state.data = await res.json();
    // 建立本地音頻索引（可選）
    state.data.forEach(e=>{
      if(e.audio && e.audio.map){
        Object.values(e.yue||{}).forEach(txt=>{
          if (txt && e.audio.map[txt]) state.audioIndex.set(norm(txt), e.audio.map[txt]);
        });
      }
    });
  }catch(e){
    console.warn("lexicon.json 加載失敗，使用空數據", e);
    state.data = [];
  }
}

function loadVoices(){
  return new Promise(resolve=>{
    function pick(){
      state.voices = speechSynthesis.getVoices();
      state.zhHK = state.voices.find(v=>/zh\-HK/i.test(v.lang));
      state.yue  = state.voices.find(v=>/yue|cantonese/i.test(v.name+v.lang));
      state.zh   = state.voices.find(v=>/zh/i.test(v.lang));
      resolve();
    }
    speechSynthesis.onvoiceschanged = pick;
    pick();
  });
}

function bindUI(){
  S("btnSend").onclick = onSend;
  S("btnClear").onclick = () => {
    S("q").value=""; ["yue_general","yue_colloquial","yue_polite","cn","en"].forEach(id=>S(id).textContent="");
  };
  $$(".speak").forEach(btn=>{
    btn.onclick = () => speak( S(btn.dataset.target).textContent.trim() );
  });
}

// —— 主流程 —— //
async function onSend(){
  const q = S("q").value.trim();
  if(!q) return;

  const auto = S("chkAuto").checked;
  const lang = auto ? detectLang(q) : guessFromChars(q);
  S("lang").textContent = lang;

  // 1) 試圖從詞庫命中（子串/模糊）
  let hit = searchLexicon(q, lang);

  // 2) 命中則直接展示；否則做規則生成（含 OOV 回退）
  const out = hit ? packFromLexicon(hit, q) : generateByRules(q, lang);

  render(out);
}

// —— 渲染 —— //
function render(o){
  S("yue_general").textContent = o.yue.general || "";
  S("yue_colloquial").textContent = o.yue.colloquial || "";
  S("yue_polite").textContent = o.yue.polite || "";
  S("cn").textContent = o.cn || "";
  S("en").textContent = o.en || "";
}

// —— 詞庫檢索（極簡本地） —— //
function searchLexicon(q, lang){
  const nq = norm(q);
  let best = null, score = 0;

  for(const e of state.data){
    const bag = [
      e.title, e.cn, e.en,
      e.yue?.general, e.yue?.colloquial, e.yue?.polite,
      ...(e.examples||[]).flatMap(x=>[x.yue,x.cn,x.en].filter(Boolean))
    ].filter(Boolean).map(norm);

    // exact
    if (bag.includes(nq)) return e;

    // substring score
    const s = bag.reduce((acc,t)=> acc + (t.includes(nq)? t.length : 0), 0);
    if (s>score){ score=s; best=e; }
  }
  return best;
}

function packFromLexicon(e, q){
  // 若無英/中文，嘗試回退
  return {
    yue:{
      general:   e.yue?.general || ruleZh2Yue(e.cn || q),
      colloquial:e.yue?.colloquial || moreColloquial( e.yue?.general || ruleZh2Yue(e.cn || q) ),
      polite:    e.yue?.polite || morePolite( e.yue?.general || ruleZh2Yue(e.cn || q) ),
    },
    cn: e.cn || ruleYue2Zh(e.yue?.general || q),
    en: e.en || ruleToEn(e.cn || e.yue?.general || q),
  };
}

// —— 規則生成（簡化：可即用；後續可換模型/RAG） —— //
function generateByRules(q, lang){
  let cn="", en="", yue="";

  if (lang==="en"){
    en = q;
    cn = simpleEn2Zh(q);
    yue = ruleZh2Yue(cn);
  }else if (lang==="zh"){
    cn = q;
    yue = ruleZh2Yue(q);
    en = ruleToEn(cn);
  }else{ // yue or mixed
    yue = toTraditionalHK(q);
    cn  = ruleYue2Zh(yue);
    en  = ruleToEn(cn);
  }

  return {
    yue:{
      general: yue,
      colloquial: moreColloquial(yue),
      polite: morePolite(yue),
    },
    cn, en
  };
}

// —— 發音（優先本地音頻 → zh-HK → yue → zh） —— //
async function speak(text){
  if(!text) return;
  const useLocal = S("chkLocalAudio").checked;

  // 1) 本地音頻
  if (useLocal && state.audioIndex.has(norm(text))){
    const src = state.audioIndex.get(norm(text));
    const au = new Audio(src);
    au.play();
    return;
  }

  // 2) 瀏覽器語音
  const u = new SpeechSynthesisUtterance(text);
  u.rate = 1.0; u.pitch = 1.0;

  if (S("chkZHk").checked && state.zhHK) u.voice = state.zhHK;
  else if (state.yue) u.voice = state.yue;
  else if (state.zh) u.voice = state.zh;

  speechSynthesis.cancel();
  speechSynthesis.speak(u);
}

// —— 語種檢測（極簡） —— //
function detectLang(s){
  const hasEN = /[A-Za-z]/.test(s);
  const hasCJK = /[\p{Script=Han}]/u.test(s);
  if (hasEN && !hasCJK) return "en";
  if (!hasEN && hasCJK){
    // 根據口語詞/語氣詞簡單判斷粵語
    const yueMask = /(嘅|咗|冇|喺|嗰|嚟|啱|咩|噉|咁|哋|俾|喎|喔|啦|喇|囉|啩|呀|吖|啫|咋|得閒|飲茶|埋單|唔|嚟緊|睇吓|邊度|點樣|系唔系|係唔係)/;
    return yueMask.test(s) ? "yue" : "zh";
  }
  return "mixed";
}
const guessFromChars = detectLang;

// —— 文本規範化 —— //
const norm = (t) => t.replace(/\s+/g,"").toLowerCase();

// —— 規則：簡體→繁（港標） —— //
// 這裡只做最小子集，更多可後續接入 OpenCC（前端版）
function toTraditionalHK(s){
  // 常見簡繁（小集合）
  const map = {"价":"價","个":"個","这":"呢/這","时":"時","里":"裏/裡"};
  return s.replace(/[价个这时里]/g, ch=>map[ch]||ch);
}

// —— 規則：普通話句 → 粵語句（最小可用版） —— //
function ruleZh2Yue(s){
  let t = toTraditionalHK(s);
  // 常見口語替換（最小集合，可擴充）
  t = t
    .replace(/(可以|能不能|可不可以)/g, "可唔可以")
    .replace(/便宜(一点|一點)?/g, "平啲")
    .replace(/这个|這個/g, "呢個")
    .replace(/那个|那個/g, "嗰個")
    .replace(/我们|我們/g, "我哋")
    .replace(/你们|你們/g, "你哋")
    .replace(/(没有)/g, "冇")
    .replace(/(在)/g, "喺")
    .replace(/(真的?)/g, "真係")
    .replace(/(比较|比較)/g, "幾")
    .replace(/(一下)/g, "吓")
    .replace(/(看)/g, "睇")
    .replace(/(吃)/g, "食");
  return t;
}

// —— 規則：粵語 → 中文（最小可用版） —— //
function ruleYue2Zh(s){
  return s
    .replace(/可唔可以/g, "可不可以")
    .replace(/平啲/g, "便宜一点")
    .replace(/呢個/g, "这个")
    .replace(/嗰個/g, "那个")
    .replace(/我哋/g, "我们")
    .replace(/你哋/g, "你们")
    .replace(/冇/g, "没有")
    .replace(/喺/g, "在")
    .replace(/真係/g, "真的")
    .replace(/幾/g, "比较")
    .replace(/吓/g, "一下")
    .replace(/睇/g, "看")
    .replace(/食/g, "吃");
}

// —— 規則：中文/粵語 → English（最小可用版） —— //
function ruleToEn(s){
  // 簡單詞典 + 模板（可擴）
  const dict = [
    [/可不可以|可唔可以.*便宜.*一?|价.?格.*好点|平啲/i, "Can I get a better price?"],
    [/这个|呢個.*好.*用/i, "This is pretty good."],
    [/在哪里|喺邊度/i, "Where is it?"],
  ];
  for (const [re, en] of dict){ if (re.test(s)) return en; }
  return simpleZh2En(s);
}

// —— EN↔ZH 極簡回退（示意用） —— //
function simpleEn2Zh(s){ return s; /* 先原樣返回，避免亂譯；你也可替換為字典/模板 */ }
function simpleZh2En(s){ return s; /* 同上 */ }

// —— 風格變體 —— //
function moreColloquial(y){ 
  return y.replace(/非常|十分|挺/g, "好")
          .replace(/比較/g,"幾")
          .replace(/可以/g,"得")
          .replace(/便宜/g,"平")
          .replace(/一点/g,"啲")
          .replace(/这个/g,"呢個");
}
function morePolite(y){
  return y.replace(/可唔可以/g,"可否")
          .replace(/平啲/g,"再優惠一點")
          .replace(/呢個/g,"這個")
          .replace(/幾/g,"比較");
}
