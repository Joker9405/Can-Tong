
async function loadCSV(url){
  const res = await fetch(url);
  const txt = await res.text();
  const rows = txt.trim().split(/\r?\n/).map(l=>l.split(/,(?!\s)/));
  const header = rows.shift();
  return rows.map(r=>Object.fromEntries(header.map((h,i)=>[h.trim(), (r[i]||"").trim()])));
}
function speak(text){
  if(!window.speechSynthesis)return;
  const u = new SpeechSynthesisUtterance(text);
  const v = speechSynthesis.getVoices().find(v=>/zh(-|_)HK/i.test(v.lang));
  if(v) u.voice=v; u.lang = v ? v.lang : "zh-HK";
  speechSynthesis.speak(u);
}
const $ = s=>document.querySelector(s);
const q = $("#q"); const result = $("#result");
const head = $("#headword"); const aliasList=$("#aliasList");
const variantList=$("#variantList"); const note=$("#note");
const exampleCard=$("#card-examples"); const exampleList=$("#exampleList");
const btnExample=$("#btnExample");
let LEX=[], EXS=[];
async function boot(){
  [LEX, EXS] = await Promise.all([loadCSV("data/lexeme.csv").catch(()=>[]), loadCSV("data/examples.csv").catch(()=>[])]);
  q.addEventListener("keydown", e=>{ if(e.key==="Enter") doSearch(q.value.trim()); });
  btnExample.classList.add("hidden"); exampleCard.classList.add("hidden");
  btnExample.addEventListener("click", ()=>toggleExamples(true));
}
function splitAliases(s){ return (s||"").split("/").map(x=>x.trim()).filter(Boolean); }
function renderAliases(s){
  aliasList.innerHTML=""; splitAliases(s).forEach(a=>{
    const li=document.createElement("li"); li.className="alias-item";
    const t=document.createElement("span"); t.className="alias-text"; t.textContent=a;
    const b=document.createElement("button"); b.className="play"; b.textContent="🔊"; b.onclick=()=>speak(a);
    li.append(t,b); aliasList.append(li);
  });
}
function renderVariants(vs){
  variantList.innerHTML=""; (vs||"").split("、").join("/").split("/").map(x=>x.trim()).filter(Boolean).forEach(v=>{
    const li=document.createElement("li"); li.className="variant-item"; li.textContent=v; variantList.append(li);
  });
}
let currentId=null;
function doSearch(term){
  if(!term) return;
  const row = LEX.find(r=> (r.zhh&&r.zhh.includes(term)) || (r.chs&&r.chs.includes(term)) || (r.en&&r.en.toLowerCase().includes(term.toLowerCase())) );
  if(!row){ alert("未找到"); return; }
  currentId=row.id; head.textContent=row.zhh||"";
  renderAliases(row.alias_zhh||""); renderVariants(row.variants_zhh||"");
  note.textContent=(row.note_chs||row.note_en||"").replace(/\s+$/,"");
  result.classList.remove("hidden");
  btnExample.classList.remove("hidden"); exampleCard.classList.add("hidden"); exampleList.innerHTML="";
}
function toggleExamples(show){
  if(!currentId) return;
  if(show){
    const rows=EXS.filter(r=>(r.lexeme_id||"").trim()===currentId);
    exampleList.innerHTML="";
    rows.forEach(r=>{
      const li=document.createElement("li"); li.className="example-item";
      const left=document.createElement("div"); left.className="example-zhh"; left.textContent=r.ex_zhh||"";
      const right=document.createElement("div");
      right.innerHTML=`<div class="example-en"><strong>${r.ex_en||""}</strong></div><div class="example-chs">${r.ex_chs||""}</div>`;
      const play=document.createElement("button"); play.className="play-l"; play.textContent="🔊"; play.onclick=()=>speak(r.ex_zhh||"");
      li.append(left,right,play); exampleList.append(li);
    });
    exampleCard.classList.remove("hidden"); btnExample.classList.add("hidden");
  } else { exampleCard.classList.add("hidden"); btnExample.classList.remove("hidden"); }
}
boot();
