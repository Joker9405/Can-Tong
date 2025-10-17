// Can‑Tong simplified chat: no settings, vertical list of suggestions, HK TTS per line.

const chat = document.getElementById('chat');
const input = document.getElementById('input');
const btnSend = document.getElementById('btnSend');

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

// Tiny bilingual lexicon (EN/CN -> Yue)
const LEXICON = {
  "refund": ["要求退款","申請退貨退款"],
  "order": ["訂單","單"],
  "coffee": ["咖啡"],
  "iced coffee": ["凍咖啡","冰咖啡"],
  "where is": ["喺邊度"],
  "bathroom": ["洗手間","廁所"],
  "help": ["幫手","幫忙"],
  "please": ["唔該","麻煩你"],
  "thank you": ["多謝你","唔該晒"],
  "我想": ["我想","我想要","我想買"],
  "我要": ["我要","畀我"],
  "退貨": ["退貨"],
  "退款": ["退款"],
  "我需要": ["我要","我需要"],
  "可以": ["可以","得"]
};

function applyLexiconEN(s){
  let out = s;
  const lower = s.toLowerCase();
  for(const k in LEXICON){
    if (!/[^\x00-\x7F]/.test(k) && lower.includes(k)){
      const cand = LEXICON[k][0];
      out += ' ' + cand;
    }
  }
  return out;
}

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
  if (/^[\x00-\x7F\s.,!?'"-:;()]+$/.test(out)){
    out = applyLexiconEN(out);
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
  const seen = new Set(); const uniq = [];
  for(const it of list){ const k = it.text; if(!seen.has(k)){ seen.add(k); uniq.push(it); } }
  return uniq;
}

// TTS (HK)
function speak(text){
  try{
    const synth = window.speechSynthesis;
    if (!synth) throw new Error('TTS not supported');
    const utter = new SpeechSynthesisUtterance(text);
    const pick = ()=>{
      const vs = synth.getVoices()||[];
      let v = vs.find(v=>/zh[-_]?HK/i.test(v.lang));
      if(!v) v = vs.find(v=>/yue|cantonese/i.test((v.name||'')+(v.lang||'')));
      if(!v) v = vs.find(v=>/^zh/i.test(v.lang));
      return v;
    };
    let voice = pick();
    if(!voice){ synth.onvoiceschanged = ()=>{ voice = pick(); }; }
    else { utter.voice = voice; }
    utter.rate = 1; utter.pitch = 1;
    synth.cancel();
    synth.speak(utter);
  }catch(e){
    alert('瀏覽器未支援或被禁用發音。');
  }
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

async function processText(t){
  const hk = await toHK(t);
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
