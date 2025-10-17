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
  const pairs = [['没有','冇'],['沒有','冇'],['不是','唔係'],['我们','我哋'],['我們','我哋'],['你们','你哋'],['他们','佢哋'],['他們','佢哋'],['这个','呢個'],['這個','呢個'],['那个','嗰個'],['那個','嗰個'],['什么','乜嘢'],['甚麼','乜嘢'],['怎么','點樣'],['為什麼','點解'],['为什么','點解'],['在 ','喺 '],['在于','喺於'],['了','咗'],['是','係'],['不要','唔好'],['需要','要']];
  for(const [a,b] of pairs){ out = out.replace(new RegExp(a,'g'), b); }
  if (/^[\x00-\x7F\s.,!?'"-:;()]+$/.test(out)){
    out = out.replace(/i need/gi,'我需要').replace(/i want/gi,'我想要').replace(/please/gi,'唔該').replace(/refund/gi,'退款').replace(/return/gi,'退貨').replace(/order/gi,'訂單').replace(/where is/gi,'喺邊度有').replace(/bathroom/gi,'洗手間').replace(/coffee/gi,'咖啡').replace(/iced/gi,'凍');
  }
  if(!/[。！？!?]$/.test(out.trim())) out = out.trim() + '。';
  return out;
}
function buildSuggestions(base){
  const a = base.replace(/(啦|喇|呀|喎|喔|囉)+$/,'。');
  const b = base.replace(/可以/g,'得').replace(/是/g,'係').replace(/了/g,'咗').replace(/。$/,'啦');
  const c = ('唔該你，' + base.replace(/啦|喇|呀|喎|喔|囉/g,'')).replace(/，，+/g,'，');
  const list = [{ text: a, note: '日常用' }, { text: b, note: '較口語 / 地道' }, { text: c.endsWith('。')? c : c+'。', note: '禮貌 / 正式' }];
  const seen = new Set(); const uniq = [];
  for(const it of list){ if(!seen.has(it.text)){ seen.add(it.text); uniq.push(it); } }
  return uniq;
}
// Cloud TTS (?tts= or /api/tts) + browser fallback
const params = new URLSearchParams(location.search);
const TTS_ENDPOINT = params.get('tts') || (location.origin + '/api/tts');
async function cloudSpeak(text){
  const res = await fetch(TTS_ENDPOINT, { method:'POST', headers: { 'Content-Type':'application/json' }, body: JSON.stringify({ text, voice:'zh-HK', format:'mp3' }) });
  if(!res.ok) throw new Error('cloud TTS error '+res.status);
  const blob = await res.blob();
  const url = URL.createObjectURL(blob);
  const audio = new Audio(url);
  await audio.play();
}
function waitVoicesOnce(){
  return new Promise(resolve=>{
    const v = speechSynthesis.getVoices();
    if (v && v.length) return resolve(v);
    const handler = ()=>{
      const vs = speechSynthesis.getVoices();
      if (vs && vs.length){ speechSynthesis.onvoiceschanged = null; resolve(vs); }
    };
    speechSynthesis.onvoiceschanged = handler;
    setTimeout(()=>resolve(speechSynthesis.getVoices()||[]), 4000);
  });
}
async function getVoicesRobust(){
  let voices = speechSynthesis.getVoices();
  for (let i=0;i<3 && (!voices || voices.length===0); i++){ voices = await waitVoicesOnce(); }
  return voices || [];
}
function pickVoice(voices){
  let v = voices.find(v=>/zh[-_]?HK/i.test(v.lang));
  if(!v) v = voices.find(v=>/yue|cantonese/i.test((v.name||'')+(v.lang||'')));
  if(!v) v = voices.find(v=>/^zh/i.test(v.lang));
  if(!v) v = voices[0];
  return v || null;
}
async function browserSpeak(text){
  const synth = window.speechSynthesis;
  if (!synth) throw new Error('no synth');
  try{ synth.resume && synth.resume(); }catch(_){}
  const voices = await getVoicesRobust();
  const voice = pickVoice(voices);
  const u = new SpeechSynthesisUtterance(text);
  if (voice) u.voice = voice;
  u.lang = (voice && voice.lang) ? voice.lang : 'zh-HK';
  u.rate = 1; u.pitch = 1; u.volume = 1;
  synth.cancel();
  synth.speak(u);
}
async function speak(text){
  try{ await cloudSpeak(text); return; }catch(e){}
  try{ await browserSpeak(text); }catch(e){ alert('此瀏覽器/環境無法發音，請改用桌面 Chrome/Edge，或部署雲端 TTS 並以 ?tts= 連接。'); }
}
function renderList(items){
  return `<div class="list">` + items.map(it=>`
    <div class="item">
      <div class="col"><div class="txt">${escapeHtml(it.text)}</div><div class="note">${escapeHtml(it.note||'可用說法')}</div></div>
      <div class="controls"><button data-tts="${escapeHtml(it.text)}">發音</button></div>
    </div>`).join('') + `</div>`;
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
      node.parentElement.innerHTML = renderList(items);
      node.parentElement.querySelectorAll('button[data-tts]').forEach(btn=>{ btn.addEventListener('click', ()=> speak(btn.getAttribute('data-tts'))); });
    }
  }catch(e){
    const node = document.getElementById(holderId);
    if (node) node.parentElement.innerHTML = `<span class="bad">出錯：${escapeHtml(e.message||'未知錯誤')}</span>`;
  }
});
input.addEventListener('keydown', (e)=>{ if(e.key==='Enter' && !e.shiftKey){ e.preventDefault(); btnSend.click(); } });