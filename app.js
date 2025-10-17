// Can‑Tong chat UI (demo + cloud-ready).
// - ChatGPT-style dialogue
// - Always outputs Cantonese written form (zh-Hant-HK)
// - Not limited to 3 variants; produces multiple suggestions with grey notes
// - Robust fallbacks for CDN deps; non-blocking interactions

const $ = (s)=>document.querySelector(s);
const chat = $('#chat');
const input = $('#input');
const btnSend = $('#btnSend');
const btnCfg = $('#btnCfg');
const drawer = $('#cfgDrawer');
const btnCloseCfg = $('#btnCloseCfg');
const modeNote = $('#modeNote');

const els = {
  provider: $('#provider'),
  apiBase: $('#apiBase'),
  apiKey: $('#apiKey'),
  model: $('#model'),
  timeout: $('#timeout'),
  btnSaveCfg: $('#btnSaveCfg'),
  btnTest: $('#btnTest')
};

const CFG_KEY = 'cantong_cfg_v2';
function loadCfg(){ try{ return JSON.parse(localStorage.getItem(CFG_KEY)||'{}'); }catch(e){ return {}; } }
function saveCfg(cfg){ localStorage.setItem(CFG_KEY, JSON.stringify(cfg||{})); }
function hasCloud(cfg){ return !!(cfg.apiBase && cfg.model && (cfg.provider==='ollama' || cfg.apiKey)); }
function applyCfgToUI(cfg){
  els.provider.value = cfg.provider || 'openai';
  els.apiBase.value = cfg.apiBase || '';
  els.apiKey.value = cfg.apiKey || '';
  els.model.value = cfg.model || '';
  els.timeout.value = Number(cfg.timeout || 45);
  updateModeNote();
}
function readCfgFromUI(){
  return {
    provider: els.provider.value,
    apiBase: els.apiBase.value.trim(),
    apiKey: els.apiKey.value.trim(),
    model: els.model.value.trim(),
    timeout: Number(els.timeout.value || 45)
  };
}
function updateModeNote(){
  const cfg = loadCfg();
  if (hasCloud(cfg)) modeNote.textContent = '已連雲端模型（OpenAI 兼容）；英文將用機器翻譯，中文/粵語可進一步精修';
  else modeNote.textContent = '演示模式（本地規則）；未連雲端模型';
}

// --- Chat helpers ---
function addMsg(role, html){
  const div = document.createElement('div');
  div.className = 'msg ' + (role==='user' ? 'user':'bot');
  const bubble = document.createElement('div');
  bubble.className = 'bubble';
  bubble.innerHTML = html;
  div.appendChild(bubble);
  chat.appendChild(div);
  chat.scrollTop = chat.scrollHeight;
}

function escapeHtml(s){ return s.replace(/[&<>"']/g,m=>({ '&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;' }[m])); }

function renderVariants(list){
  // list: [{text, note}...]
  return list.map(it=>{
    return `<div class="variant">
      <div>${escapeHtml(it.text)}</div>
      <div class="note muted">${escapeHtml(it.note||'可用說法')}</div>
    </div>`;
  }).join('');
}

// --- OpenCC HK convert (safe fallback) ---
async function toHK(text){
  try{
    const ok = await window.__depsReady;
    if (ok && window.OpenCC) {
      // Convert to HK variant
      const converter = await OpenCC.Converter({ from: 'cn', to: 'hk' });
      return converter(text);
    }
  }catch(e){ /* ignore */ }
  return text;
}

// --- Heuristic Cantonese-ization (very conservative) ---
function yueHeuristic(s){
  let out = s;
  const pairs = [
    ['没有','冇'],['沒有','冇'],['不是','唔係'],['在 ','喺 '],['在於','喺於'],
    ['我们','我哋'],['我們','我哋'],['你们','你哋'],['他们','佢哋'],['他們','佢哋'],
    ['这个','呢個'],['這個','呢個'],['那个','嗰個'],['那個','嗰個'],
    ['什么','乜嘢'],['甚麼','乜嘢'],['怎么','點樣'],['為什麼','點解'],['为什么','點解'],
    ['已经','已經'],['已經','已經'],['一下','一下'],
    ['可以','可以'],['不要','唔好'],['需要','要']
  ];
  for(const [a,b] of pairs){ out = out.replace(new RegExp(a,'g'), b); }
  // add final punctuation if none
  if(!/[。！？!?]$/.test(out.trim())) out = out.trim() + '。';
  return out;
}

// --- Build multiple suggestions locally (not fixed to 3) ---
function localSuggestions(base){
  const a = base
    .replace(/(啦|喇|呀|喎|喔|囉)+$/,'。')
    .replace(/是/g,'係')
    .replace(/了/g,'咗');
  const b = base
    .replace(/可以/g,'得')
    .replace(/是/g,'係')
    .replace(/了/g,'咗')
    .replace(/。$/,'啦');
  const c = ('唔該你，' + base.replace(/啦|喇|呀|喎|喔|囉/g,'')).replace(/，，+/g,'，');
  return [
    { text: a, note: '日常用' },
    { text: b, note: '較口語 / 地道' },
    { text: c.endsWith('。')? c: c+'。', note: '禮貌 / 正式' }
  ];
}

// --- Cloud call (OpenAI-compatible) ---
async function callCloud({prompt, cfg}){
  const controller = new AbortController();
  const to = setTimeout(()=>controller.abort(), (cfg.timeout||45)*1000);
  const url = cfg.apiBase.replace(/\/+$/,'') + '/chat/completions';
  const headers = { 'Content-Type':'application/json' };
  if (cfg.provider==='openai' && cfg.apiKey) headers['Authorization'] = `Bearer ${cfg.apiKey}`;

  const sys = "你是粵語助手。把用戶內容轉為『粵語正字（繁體，港式）』，提供多個可用說法，每條後面括號灰字標註語體（例如：日常用 / 地道 / 禮貌）。僅輸出 JSON，字段：items=[{text,note}]。";
  const user = `輸入：${prompt}\n請輸出 JSON：{"items":[{"text":"","note":""}, ...] }，所有內容必須為繁體粵語。`;

  const body = {
    model: cfg.model,
    temperature: 0.5,
    response_format: { type: "json_object" },
    messages: [
      { role:'system', content: sys },
      { role:'user', content: user }
    ]
  };

  const res = await fetch(url, { method:'POST', headers, body: JSON.stringify(body), signal: controller.signal });
  clearTimeout(to);
  if(!res.ok){
    const t = await res.text().catch(()=>'');
    throw new Error('雲端錯誤 ' + res.status + '：' + t);
  }
  const data = await res.json();
  const content = data?.choices?.[0]?.message?.content || '{}';
  let parsed; try{ parsed = JSON.parse(content); }catch(_){ parsed = {}; }
  if (!parsed.items || !Array.isArray(parsed.items) || parsed.items.length===0) {
    throw new Error('雲端返回格式不正確');
  }
  return parsed.items;
}

// --- Pipeline ---
async function processText(text){
  const cfg = loadCfg();
  // 1) normalize to HK
  const hk = await toHK(text);
  // 2) English detection (quick): if mostly ASCII and cloud configured => use cloud MT + formatting
  const isAscii = /^[\x00-\x7F\s.,!?'"-:;()]+$/.test(text);
  if (isAscii && hasCloud(cfg)) {
    try{
      return await callCloud({ prompt: text, cfg });
    }catch(e){
      console.warn(e);
      // fallback to local
    }
  }
  // 3) Local heuristic cantonese-ization
  const base = yueHeuristic(hk);
  return localSuggestions(base);
}

// --- Events ---
btnSend.addEventListener('click', async ()=>{
  const val = (input.value||'').trim();
  if(!val) return;
  addMsg('user', escapeHtml(val));
  input.value='';
  // placeholder while processing
  const loadingId = 'loading-' + Date.now();
  addMsg('bot', `<span id="${loadingId}" class="muted">處理中…</span>`);
  try{
    const items = await processText(val);
    const html = `<div>以下係幾種可用講法：</div>${renderVariants(items)}`;
    const node = document.getElementById(loadingId);
    if (node) node.parentElement.innerHTML = html;
  }catch(e){
    const node = document.getElementById(loadingId);
    if (node) node.parentElement.innerHTML = `<span class="bad">出錯了：${escapeHtml(e.message||'未知錯誤')}</span>`;
  }
});
input.addEventListener('keydown', (e)=>{
  if(e.key==='Enter' && !e.shiftKey){ e.preventDefault(); btnSend.click(); }
});

btnCfg.addEventListener('click', ()=> drawer.classList.remove('hidden'));
btnCloseCfg.addEventListener('click', ()=> drawer.classList.add('hidden'));
els.btnSaveCfg.addEventListener('click', ()=>{
  saveCfg(readCfgFromUI());
  updateModeNote();
  toast('配置已保存');
});
els.btnTest.addEventListener('click', async ()=>{
  saveCfg(readCfgFromUI()); updateModeNote();
  try{
    const items = await callCloud({ prompt: '我想退貨', cfg: loadCfg() });
    toast('連接成功（已返回 '+items.length+' 條建議）');
  }catch(e){
    toast('測試失敗：' + (e.message||'未知錯誤'));
  }
});

function toast(msg){
  const d = document.createElement('div');
  d.textContent = msg;
  Object.assign(d.style, {
    position:'fixed', left:'50%', bottom:'16px', transform:'translateX(-50%)',
    background:'#1f2937', color:'#fff', padding:'8px 12px', borderRadius:'10px',
    border:'1px solid #334155', zIndex: 9999
  });
  document.body.appendChild(d);
  setTimeout(()=>d.remove(), 2200);
}

// init
applyCfgToUI(loadCfg());
