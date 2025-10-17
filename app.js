// Cloud-ready simple chat: connect your endpoints for (1) translate via lexicon/model, (2) TTS audio.
// If endpoints are empty or fail, falls back to local rules + browser TTS.

const chat = document.getElementById('chat');
const input = document.getElementById('input');
const btnSend = document.getElementById('btnSend');
const cloudStatus = document.getElementById('cloudStatus');

// ====== MINIMAL CONFIG (EDIT THESE 3 FIELDS) ======
const CFG = {
  CLOUD_TRANSLATE_ENDPOINT: "", // e.g. "https://your.domain/api/translate"
  CLOUD_TTS_ENDPOINT: "",       // e.g. "https://your.domain/api/tts"
  CLOUD_HEADERS: {              // optional headers (e.g., auth)
    // "Authorization": "Bearer YOUR_TOKEN"
  }
};
// ==================================================

function updateCloudStatus(){
  const on = !!(CFG.CLOUD_TRANSLATE_ENDPOINT || CFG.CLOUD_TTS_ENDPOINT);
  if(!cloudStatus) return;
  if(on){ cloudStatus.textContent = '雲端：已配置'; cloudStatus.classList.remove('off'); cloudStatus.classList.add('on'); }
  else  { cloudStatus.textContent = '雲端：未配置'; cloudStatus.classList.remove('on'); cloudStatus.classList.add('off'); }
}
updateCloudStatus();

function addMsg(role, html){
  const div = document.createElement('div');
  div.className = 'msg ' + (role==='user' ? 'user' : 'bot');
  const bubble = document.createElement('div');
  bubble.className = 'bubble';
  bubble.innerHTML = html;
  div.appendChild(bubble);
  chat.appendChild(div);
  chat.scrollTop = chat.scrollHeight;
}

function escapeHtml(s){ return s.replace(/[&<>"']/g, m=>({ '&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;' }[m])); }

// Optional OpenCC HK
async function toHK(text){
  try{
    const ok = await window.__openccReady;
    if (ok && window.OpenCC){
      const conv = await OpenCC.Converter({ from:'cn', to:'hk' });
      return conv(text);
    }
  }catch(e){}
  return text;
}

// Local heuristic for demo (kept simple)
function yueHeuristic(s){
  let out = s;
  const pairs = [
    ['没有','冇'],['沒有','冇'],['不是','唔係'],
    ['我们','我哋'],['我們','我哋'],['你们','你哋'],['他们','佢哋'],['他們','佢哋'],
    ['这个','呢個'],['這個','呢個'],['那个','嗰個'],['那個','嗰個'],
    ['什么','乜嘢'],['甚麼','乜嘢'],['怎么','點樣'],['為什麼','點解'],['为什么','點解'],
    ['在 ','喺 '],['在于','喺於'],
    ['了','咗'],['是','係'],['不要','唔好'],['需要','要']
  ];
  for(const [a,b] of pairs){ out = out.replace(new RegExp(a,'g'), b); }
  // English quick mapping
  if (/^[\x00-\x7F\s.,!?'"-:;()]+$/.test(out)){
    out = out
      .replace(/i need/gi,'我需要')
      .replace(/i want/gi,'我想要')
      .replace(/please/gi,'唔該')
      .replace(/refund/gi,'退款')
      .replace(/return/gi,'退貨')
      .replace(/order/gi,'訂單')
      .replace(/where is/gi,'喺邊度有')
      .replace(/bathroom/gi,'洗手間')
      .replace(/coffee/gi,'咖啡')
      .replace(/iced/gi,'凍');
  }
  if(!/[。！？!?]$/.test(out.trim())) out = out.trim() + '。';
  return out;
}

function buildSuggestions(base){
  const a = base.replace(/(啦|喇|呀|喎|喔|囉)+$/,'。');
  const b = base.replace(/可以/g,'得').replace(/是/g,'係').replace(/了/g,'咗').replace(/。$/,'啦');
  const c = ('唔該你，' + base.replace(/啦|喇|呀|喎|喔|囉/g,'')).replace(/，，+/g,'，');
  const list = [
    { text: a, note: '日常用' },
    { text: b, note: '較口語 / 地道' },
    { text: c.endsWith('。')? c : c+'。', note: '禮貌 / 正式' }
  ];
  // unique
  const seen = new Set(); const uniq = [];
  for(const it of list){ if(!seen.has(it.text)){ seen.add(it.text); uniq.push(it); } }
  return uniq;
}

// Cloud translate call
async function cloudTranslate(text){
  if (!CFG.CLOUD_TRANSLATE_ENDPOINT) throw new Error('No endpoint');
  const body = { text, source: 'auto', target: 'yue-Hant-HK', n: 3 };
  const res = await fetch(CFG.CLOUD_TRANSLATE_ENDPOINT, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', ...CFG.CLOUD_HEADERS },
    body: JSON.stringify(body),
  });
  if(!res.ok){
    const msg = await res.text().catch(()=>'');
    throw new Error('雲端翻譯錯誤 ' + res.status + ': ' + msg);
  }
  const data = await res.json().catch(()=>null);
  let items = [];
  if (data?.items && Array.isArray(data.items)) items = data.items;
  else if (Array.isArray(data?.texts)) items = data.texts.map(t=>({text:t, note:'可用說法'}));
  else if (typeof data?.text === 'string') items = [{text:data.text, note:'可用說法'}];
  else throw new Error('雲端返回格式不正確');
  items = items.map(it=>({ text: String(it.text||''), note: it.note ? String(it.note) : '可用說法' })).filter(it=>it.text.trim());
  if (items.length===0) throw new Error('雲端返回為空');
  return items.slice(0,3);
}

// Cloud TTS call -> play audio
async function cloudSpeak(text){
  if (!CFG.CLOUD_TTS_ENDPOINT) throw new Error('No endpoint');
  const res = await fetch(CFG.CLOUD_TTS_ENDPOINT, {
    method: 'POST',
    headers: { ...CFG.CLOUD_HEADERS, 'Content-Type': 'application/json' },
    body: JSON.stringify({ text, voice: 'zh-HK', format: 'mp3' })
  });
  if(!res.ok){
    const msg = await res.text().catch(()=>'');
    throw new Error('雲端發音錯誤 ' + res.status + ': ' + msg);
  }
  const blob = await res.blob();
  const url = URL.createObjectURL(blob);
  const audio = new Audio(url);
  audio.play().catch(()=>{});
}

// Browser TTS fallback
function browserSpeak(text){
  const synth = window.speechSynthesis;
  if (!synth){ alert('此瀏覽器不支援發音。'); return; }
  const utter = new SpeechSynthesisUtterance(text);
  const pick = ()=>{
    const vs = synth.getVoices()||[];
    let v = vs.find(v=>/zh[-_]?HK/i.test(v.lang));
    if(!v) v = vs.find(v=>/yue|cantonese/i.test((v.name||'')+(v.lang||'')));
    if(!v) v = vs.find(v=>/^zh/i.test(v.lang));
    return v;
  };
  let v = pick(); if (v) utter.voice = v;
  synth.cancel(); synth.speak(utter);
}

async function speak(text){
  try{
    if (CFG.CLOUD_TTS_ENDPOINT) return await cloudSpeak(text);
  }catch(e){
    console.warn(e);
  }
  browserSpeak(text);
}

function renderList(items){
  return `<div class="list">` + items.map(it=>`
    <div class="item">
      <div class="col">
        <div class="txt">${escapeHtml(it.text)}</div>
        <div class="note">${escapeHtml(it.note||'可用說法')}</div>
      </div>
      <div class="controls">
        <button data-tts="${escapeHtml(it.text)}">發音</button>
      </div>
    </div>
  `).join('') + `</div>`;
}

// Pipeline: prefer cloud translate, else local
async function processText(t){
  const hk = await toHK(t);
  if (CFG.CLOUD_TRANSLATE_ENDPOINT) {
    try{
      return await cloudTranslate(hk);
    }catch(e){
      console.warn('cloudTranslate fail, fallback:', e);
    }
  }
  const base = yueHeuristic(hk);
  return buildSuggestions(base);
}

btnSend.addEventListener('click', async ()=>{
  const val = (input.value||'').trim();
  if(!val) return;
  addMsg('user', escapeHtml(val));
  input.value='';
  const holderId = 'h'+Date.now();
  addMsg('bot', `<span id="${holderId}" class="muted">處理中…</span>`);
  try{
    const items = await processText(val);
    const node = document.getElementById(holderId);
    if (node){
      node.parentElement.innerHTML = `<div>以下係幾種講法：</div>` + renderList(items);
      node.parentElement.querySelectorAll('button[data-tts]').forEach(btn=>{
        btn.addEventListener('click', ()=> speak(btn.getAttribute('data-tts')));
      });
    }
  }catch(e){
    const node = document.getElementById(holderId);
    if (node) node.parentElement.innerHTML = `<span class="bad">出錯：${escapeHtml(e.message||'未知錯誤')}</span>`;
  }
});

input.addEventListener('keydown', (e)=>{
  if(e.key==='Enter' && !e.shiftKey){ e.preventDefault(); btnSend.click(); }
});
