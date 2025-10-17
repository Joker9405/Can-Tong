/* Can‑Tong front-end (demo + cloud-ready)
 * - Unified output: Cantonese written (zh-Hant-HK)
 * - Three variants: general / colloquial / polite
 * - Demo mode: rules + OpenCC (HK) + small heuristics
 * - Cloud mode: OpenAI-compatible chat endpoint (also works for many vLLM/ollama gateways)
 */

const $ = (s) => document.querySelector(s);
const $$ = (s) => Array.from(document.querySelectorAll(s));

const els = {
  input: $('#input'),
  btnRun: $('#btnRun'),
  btnClear: $('#btnClear'),
  outGeneral: $('#outGeneralText'),
  outColloquial: $('#outColloquialText'),
  outPolite: $('#outPoliteText'),
  diffArea: $('#diffArea'),

  provider: $('#provider'),
  apiBase: $('#apiBase'),
  apiKey: $('#apiKey'),
  model: $('#model'),
  timeout: $('#timeout'),
  btnSaveCfg: $('#btnSaveCfg'),
  btnTestCloud: $('#btnTestCloud'),

  chipDemo: $('#statusChip-demo'),
  chipCloud: $('#statusChip-cloud'),
};

// ---- Config persistence ----
const CFG_KEY = 'cantong_cfg_v1';
function loadCfg() {
  try {
    const raw = localStorage.getItem(CFG_KEY);
    return raw ? JSON.parse(raw) : {};
  } catch (e) { return {}; }
}
function saveCfg(cfg) {
  localStorage.setItem(CFG_KEY, JSON.stringify(cfg || {}));
}

function applyCfgToUI(cfg) {
  els.provider.value = cfg.provider || 'openai';
  els.apiBase.value = cfg.apiBase || '';
  els.apiKey.value = cfg.apiKey || '';
  els.model.value = cfg.model || '';
  els.timeout.value = cfg.timeout || 40;
  refreshCloudChip();
}
function readCfgFromUI() {
  return {
    provider: els.provider.value,
    apiBase: els.apiBase.value.trim(),
    apiKey: els.apiKey.value.trim(),
    model: els.model.value.trim(),
    timeout: Number(els.timeout.value || 40),
  };
}
function hasCloud(cfg) {
  return !!(cfg.apiBase && cfg.model && (cfg.provider === 'ollama' || cfg.apiKey));
}
function refreshCloudChip(){
  const cfg = loadCfg();
  if (hasCloud(cfg)) {
    els.chipCloud.classList.remove('off'); els.chipCloud.classList.add('on');
    els.chipCloud.textContent = '雲端模型 已配置';
    els.chipDemo.classList.remove('on'); els.chipDemo.classList.add('off');
  } else {
    els.chipCloud.classList.remove('on'); els.chipCloud.classList.add('off');
    els.chipCloud.textContent = '雲端模型 未連接';
    els.chipDemo.classList.remove('off'); els.chipDemo.classList.add('on');
  }
}

// ---- Helpers ----

// very small tokenizer for diff (word/char hybrid)
function tokenize(s){
  return s.replace(/\s+/g,' ').trim().split(/(?<=。|！|？)|\s+/); // split by sentence end or space
}

// Simple diff highlight across three variants: show terms present in colloquial/polite but not in general etc.
function renderDiff(a, b, c){
  // naive approach: list unique tokens and color if differs
  const t = (s)=> s ? s.split(/(\s+)/).filter(Boolean) : [];
  const A = new Set(t(a)), B = new Set(t(b)), C = new Set(t(c));
  const all = Array.from(new Set([...(t(a)), ...(t(b)), ...(t(c))]));
  const chunks = all.map(tok=>{
    const inA = A.has(tok), inB = B.has(tok), inC = C.has(tok);
    if(inB && !inA) return `<mark class="add">${escapeHtml(tok)}</mark>`;
    if(inC && !inA && !inB) return `<mark class="add">${escapeHtml(tok)}</mark>`;
    if(inA && !inB && !inC) return `<mark class="del">${escapeHtml(tok)}</mark>`;
    return escapeHtml(tok);
  });
  els.diffArea.innerHTML = chunks.join('');
}
function escapeHtml(s){return s.replace(/[&<>"']/g,m=>({ '&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;' }[m]))}

// ---- OpenCC init ----
let openccHK; // s2hk + t2hk combo
async function ensureOpenCC() {
  if (openccHK) return openccHK;
  // opencc-js provides converters; we chain s2hk then t2hk to be safe
  openccHK = {
    async convert(text){
      // try both s2hk (Simplified to HK) and t2hk (Traditional to HK)
      try {
        const s2hk = await OpenCC.Converter({ from: 's2hk', to: 't2hk' });
        return s2hk(text);
      } catch(e) {
        // fallback: identity
        return text;
      }
    }
  };
  return openccHK;
}

// Heuristic Cantonese-ization: add common particles, replace mandarinisms
function yueHeuristic(s){
  let out = s;
  // Common replacements (very conservative)
  const pairs = [
    ['没有','冇'],['没有了','冇咗'],['正在','緊'],['在 ','喺 '],['不是','唔係'],['可以','可以'],['不要','唔好'],
    ['我们','我哋'],['你们','你哋'],['他们','佢哋'],['他们','佢地'],['他们的','佢哋嘅'],
    ['这个','呢個'],['那个','嗰個'],['什么','乜嘢'],['怎么','點樣'],['为什么','點解'],
    ['已经','已經'],['一下','一下'],['一下子','一陣'],['真的','真係'],
  ];
  for(const [a,b] of pairs){ out = out.replace(new RegExp(a,'g'), b); }
  // Add a mild sentence-final particle if absent
  if (!/[呀啊啦喇喎喔囉嗎嘛呢～!]$/.test(out.trim())) {
    out = out.trim() + '。';
  }
  return out;
}

// Build three variants using rules (demo), optionally refine by cloud
function buildThreeVariantsLocal(base){
  // base is already Cantonese-ish
  const general = base
    .replace(/(啦|喇|呀|喎|喔|囉)+$/,'。')
    .replace(/。。+/g,'。');

  const colloquial = base
    .replace(/。$/,'啦')
    .replace(/可以/g,'得')
    .replace(/是/g,'係')
    .replace(/了/g,'咗');

  const polite = base
    .replace(/啦|喇|呀|喎|喔|囉/g,'')
    .replace(/得/g,'可以')
    .replace(/係/g,'是')
    .replace(/咗/g,'了');
  const politePrefix = '唔該你';
  const politeFinal = polite.endsWith('。')? polite : polite + '。';

  return {
    general: general,
    colloquial: colloquial,
    polite: politePrefix + (politeFinal.startsWith('，')?'': '，') + politeFinal
  };
}

// ---- Language detection ----
function detectLang(s){
  try{
    const lang = tinyld.detect(s || '');
    return (lang && lang.lang) || 'unknown';
  }catch(e){ return 'unknown'; }
}

// ---- Cloud LLM ----
async function callCloudForVariants({ input, cfg }){
  const controller = new AbortController();
  const to = setTimeout(()=>controller.abort(), (cfg.timeout||40)*1000);

  const sys = "你是一名專業的粵語文案助手。任務：把輸入內容轉寫成「粵語正字（繁體，港式）」並輸出三個變體：一般體 / 地道體 / 禮貌體。禁止輸出普通話書面。務必僅輸出 JSON，字段：general, colloquial, polite。";
  const user = `【輸入】\n${input}\n\n請直接輸出 JSON：{"general":"","colloquial":"","polite":""}，用繁體粵語。`;

  let url = cfg.apiBase.replace(/\/+$/,'') + '/chat/completions';
  let headers = { 'Content-Type':'application/json' };
  if (cfg.provider === 'openai' && cfg.apiKey) headers['Authorization'] = `Bearer ${cfg.apiKey}`;

  // For Ollama's OpenAI-compatible server, apiKey is not needed.
  const body = {
    model: cfg.model,
    messages: [
      { role:'system', content: sys },
      { role:'user', content: user }
    ],
    temperature: 0.4,
    response_format: { type: "json_object" }
  };

  const res = await fetch(url, { method:'POST', headers, body: JSON.stringify(body), signal: controller.signal });
  clearTimeout(to);
  if (!res.ok) {
    const txt = await res.text();
    throw new Error('雲端錯誤：' + res.status + ' ' + txt);
  }
  const data = await res.json();
  const content = data?.choices?.[0]?.message?.content || '{}';
  let parsed;
  try { parsed = JSON.parse(content); } catch(e){ parsed = {}; }
  if (!parsed.general) throw new Error('雲端返回格式不正確，未找到 general/colloquial/polite。');
  return parsed;
}

// ---- Main run ----
async function run(){
  const text = els.input.value.trim();
  if (!text){ return; }

  const cfg = loadCfg();
  const lang = detectLang(text);

  const oc = await ensureOpenCC();

  // Step 1: normalize to HK Traditional (for CN/Sim inputs)
  let hk = await oc.convert(text);

  // Step 2: if English & cloud available => ask LLM for Cantonese JSON
  if (/^[\x00-\x7F]+$/.test(text) && hasCloud(cfg)) {
    try {
      const j = await callCloudForVariants({ input: text, cfg });
      renderOutputs(j);
      return;
    } catch(e) {
      notify('雲端處理失敗，已回退到本地規則。原因：' + e.message);
    }
  }

  // Step 3: Heuristic cantonese-ization (demo mode or fallback)
  const yueBase = yueHeuristic(hk);

  let variants = buildThreeVariantsLocal(yueBase);

  // Step 4: If cloud exists, try refine one-shot by asking LLM to polish the three variants (optional)
  if (hasCloud(cfg)) {
    try{
      const refineInput = `請在不改變語義前提下，將以下三個變體修飾為更地道的「粵語正字（繁體，港式）」，並保持三種風格差異明顯。以 JSON 返回（general/colloquial/polite）。\n\n${JSON.stringify(variants, null, 2)}`;
      const j = await callCloudForVariants({ input: refineInput, cfg });
      variants = j;
    }catch(e){
      notify('雲端修飾失敗，保留本地結果。' + e.message);
    }
  }

  renderOutputs(variants);
}

function renderOutputs({general, colloquial, polite}){
  els.outGeneral.textContent = general || '';
  els.outColloquial.textContent = colloquial || '';
  els.outPolite.textContent = polite || '';
  renderDiff(general||'', colloquial||'', polite||'');
}

// UI events
els.btnRun.addEventListener('click', run);
els.btnClear.addEventListener('click', ()=>{
  els.input.value='';
  els.outGeneral.textContent='';
  els.outColloquial.textContent='';
  els.outPolite.textContent='';
  els.diffArea.textContent='';
});
$$('.copy').forEach(btn=>btn.addEventListener('click', e=>{
  const id = e.currentTarget.getAttribute('data-target');
  const el = document.getElementById(id);
  navigator.clipboard.writeText(el.textContent||'').then(()=>notify('已複製'));
}));

els.btnSaveCfg.addEventListener('click', ()=>{
  const cfg = readCfgFromUI();
  saveCfg(cfg); refreshCloudChip();
  notify('配置已保存');
});
els.btnTestCloud.addEventListener('click', async ()=>{
  const cfg = readCfgFromUI();
  saveCfg(cfg); refreshCloudChip();
  try{
    const j = await callCloudForVariants({ input: '幫我把「我想退貨」轉成粵語三擋。', cfg });
    renderOutputs(j);
    notify('連接成功，已用雲端生成示例。');
  }catch(e){
    notify('測試失敗：' + e.message);
  }
});

function notify(msg){
  const div = document.createElement('div');
  div.textContent = msg;
  div.style.position='fixed'; div.style.bottom='16px'; div.style.left='50%';
  div.style.transform='translateX(-50%)'; div.style.background='#111827'; div.style.color='#fff';
  div.style.padding='8px 12px'; div.style.borderRadius='10px'; div.style.zIndex=9999;
  document.body.appendChild(div);
  setTimeout(()=>div.remove(), 2200);
}

// Apply stored cfg on load
applyCfgToUI(loadCfg());
refreshCloudChip();
