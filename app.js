/* Can‑Tong Chat UI (demo+cloud). No fixed 'three variants'; we output multiple options with grey notes. */

const qs = s => document.querySelector(s);
const chat = qs('#chat');
const ipt = qs('#ipt');
const btnSend = qs('#btnSend');
const btnCfg = qs('#btnCfg');
const dlg = qs('#cfgDialog');
const apiBaseEl = qs('#apiBase');
const apiKeyEl = qs('#apiKey');
const modelEl = qs('#model');
const timeoutEl = qs('#timeout');
const cloudState = qs('#cloudState');

const CFG_KEY = 'cantong_chat_cfg_v1';
function loadCfg(){ try{ return JSON.parse(localStorage.getItem(CFG_KEY) || '{}'); }catch{ return {}; } }
function saveCfg(c){ localStorage.setItem(CFG_KEY, JSON.stringify(c||{})); }
function hasCloud(c){ return !!(c.apiBase && c.model && (c.apiBase.startsWith('http'))); }
function setCloudChip(){
  const c = loadCfg();
  cloudState.textContent = hasCloud(c) ? '云端：已配置' : '云端：未连接';
}
setCloudChip();

// Simple utility
function pushMsg(role, html){
  const div = document.createElement('div');
  div.className = 'msg ' + role;
  const b = document.createElement('div');
  b.className = 'bubble';
  b.innerHTML = html;
  div.appendChild(b);
  chat.appendChild(div);
  chat.scrollTop = chat.scrollHeight;
}
function escapeHtml(s){return s.replace(/[&<>"']/g,m=>({ '&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;' }[m]))}

// Demo local heuristic: turn input to several Cantonese options with grey notes; extremely conservative.
function localCantonize(text){
  let t = text.trim();
  // very light replacements
  const pairs = [
    [/我们/g,'我哋'],[/你们/g,'你哋'],[/他们/g,'佢哋'],[/不是/g,'唔係'],[/没有/g,'冇'],[/在/g,'喺'],
    [/这个/g,'呢個'],[/那个/g,'嗰個'],[/什么/g,'乜嘢'],[/怎么/g,'點樣'],[/为什么/g,'點解'],
    [/可以/g,'可以'],[/已经/g,'已經'],[/了\b/g,'咗'],[/是/g,'係']
  ];
  for(const [a,b] of pairs){ t = t.replace(a,b); }
  if(!/[。！？!？]$/.test(t)) t += '。';

  // produce 3-4 options
  const opts = [];
  opts.push({ text: t.replace(/。$/,'。'), note:'日常用' });
  opts.push({ text: t.replace(/。$/,'啦'), note:'較口語/地道' });
  opts.push({ text: '唔該你，' + t.replace(/^/,'').replace(/。$/,'。'), note:'禮貌/正式' });
  // an extra colloquial tweak
  opts.push({ text: t.replace(/可以/g,'得').replace(/。$/,'喎'), note:'地道變體' });
  // dedupe
  const seen = new Set(); const uniq = [];
  for(const o of opts){ const k=o.text; if(!seen.has(k)){ seen.add(k); uniq.push(o); } }
  return uniq;
}

// Cloud call (OpenAI-compatible / vLLM / Ollama OpenAI server)
async function cloudGenerate(messages, cfg){
  const controller = new AbortController();
  const to = setTimeout(()=>controller.abort(), (Number(cfg.timeout)||40)*1000);

  const sys = '你是粵語助手。請將用戶輸入轉寫為「粵語正字（繁體，港式）」的多個可用說法（最多5條），每條用一兩個灰色括號小註標記風格，例如（日常用）（較口語）（禮貌）等。只返回 JSON：{"options":[{"text":"...","note":"..."},...]}';
  const url = cfg.apiBase.replace(/\/+$/,'') + '/chat/completions';
  const headers = { 'Content-Type':'application/json' };
  if (!/localhost|127\.0\.0\.1/.test(cfg.apiBase) && cfg.apiKey) headers['Authorization'] = 'Bearer ' + cfg.apiKey;

  const body = {
    model: cfg.model,
    messages: [{role:'system',content:sys}, ...messages],
    temperature: 0.5,
    response_format: { type:'json_object' }
  };

  const res = await fetch(url, { method:'POST', headers, body: JSON.stringify(body), signal: controller.signal });
  clearTimeout(to);
  if(!res.ok){
    const text = await res.text().catch(()=>'');
    throw new Error('云端错误：' + res.status + ' ' + text);
  }
  const data = await res.json();
  let content = data?.choices?.[0]?.message?.content || '{}';
  let j; try{ j = JSON.parse(content); }catch{ j={}; }
  if(!Array.isArray(j.options)) throw new Error('返回格式不正確（缺少 options）。');
  return j.options;
}

// Conversation state (only used for cloud; demo mode generates per-turn)
const history = [];

async function handleSend(){
  const text = ipt.value.trim();
  if(!text) return;
  ipt.value = ''; autoGrow();
  pushMsg('user', escapeHtml(text));

  btnSend.disabled = true;

  const cfg = loadCfg();
  try{
    if(hasCloud(cfg)){
      // use full conversation context for better results
      history.push({ role:'user', content:text });
      const options = await cloudGenerate(history, cfg);
      history.push({ role:'assistant', content: JSON.stringify(options) });
      renderAssistant(options);
    }else{
      // demo mode
      const options = localCantonize(text).slice(0,5);
      renderAssistant(options);
    }
  }catch(e){
    pushMsg('sys', '<span class="muted">⚠️ ' + escapeHtml(e.message) + '。已回退為本地規則。</span>');
    const options = localCantonize(text).slice(0,5);
    renderAssistant(options);
  }finally{
    btnSend.disabled = false;
  }
}

function renderAssistant(options){
  const html = options.map(o=>`<div class="item">「${escapeHtml(o.text)}」<span class="note">（${escapeHtml(o.note||'備註')}）</span></div>`).join('');
  pushMsg('assistant', html);
}

function autoGrow(){
  ipt.style.height = 'auto';
  ipt.style.height = Math.min(160, Math.max(40, ipt.scrollHeight)) + 'px';
}
ipt.addEventListener('input', autoGrow);
ipt.addEventListener('keydown', e=>{
  if(e.key==='Enter' && !e.shiftKey){
    e.preventDefault();
    handleSend();
  }
});

btnSend.addEventListener('click', handleSend);

// Config dialog
btnCfg.addEventListener('click', ()=>{
  const c = loadCfg();
  apiBaseEl.value = c.apiBase || '';
  apiKeyEl.value = c.apiKey || '';
  modelEl.value = c.model || '';
  timeoutEl.value = c.timeout || 40;
  dlg.showModal();
});
qs('#btnClose').addEventListener('click', ()=>dlg.close());
qs('#btnSave').addEventListener('click', ()=>{
  const c = {
    apiBase: apiBaseEl.value.trim(),
    apiKey: apiKeyEl.value.trim(),
    model: modelEl.value.trim(),
    timeout: Number(timeoutEl.value||40),
  };
  saveCfg(c); setCloudChip();
  pushMsg('sys','<span class="muted">✅ 配置已保存。</span>');
});
qs('#btnTest').addEventListener('click', async ()=>{
  const c = {
    apiBase: apiBaseEl.value.trim(),
    apiKey: apiKeyEl.value.trim(),
    model: modelEl.value.trim(),
    timeout: Number(timeoutEl.value||40),
  };
  saveCfg(c); setCloudChip();
  try{
    const demo = [{role:'user', content:'請將「我想退貨」轉為多個粵語說法'}];
    const opts = await cloudGenerate(demo, c);
    renderAssistant(opts.slice(0,3));
    pushMsg('sys','<span class="muted">✅ 連接成功。</span>');
  }catch(e){
    pushMsg('sys','<span class="muted">⚠️ 測試失敗：' + escapeHtml(e.message) + '</span>');
  }
});

// Ensure clicks never "stall": guard all top-level async errors
window.addEventListener('error', (e)=>{
  pushMsg('sys','<span class="muted">⚠️ 腳本錯誤：' + escapeHtml(String(e.message||e.error)) + '</span>');
});
window.addEventListener('unhandledrejection', (e)=>{
  pushMsg('sys','<span class="muted">⚠️ 請求被拒絕：' + escapeHtml(String(e.reason)) + '</span>');
});
