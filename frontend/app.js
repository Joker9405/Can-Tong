// Minimal frontend glue for ASR → MT → TTS
let mediaRecorder, chunks = [], isRecording = false;

const els = {
  input: document.getElementById('inputText'),
  output: document.getElementById('outputText'),
  btnMic: document.getElementById('btnMic'),
  btnStop: document.getElementById('btnStop'),
  btnTranslate: document.getElementById('btnTranslate'),
  btnSpeak: document.getElementById('btnSpeak'),
  asrState: document.getElementById('asrState'),
  mtState: document.getElementById('mtState'),
  ttsState: document.getElementById('ttsState'),
  audio: document.getElementById('audio'),
  asrURL: document.getElementById('asrURL'),
  mtURL: document.getElementById('mtURL'),
  ttsURL: document.getElementById('ttsURL'),
  sourceLang: document.getElementById('sourceLang'),
  targetLang: document.getElementById('targetLang'),
};

function setBadge(el, ok){ el.innerHTML = ok ? '已连接' : '未连接'; el.className = 'pill ' + (ok ? 'ok' : ''); }
function checkConnectivity(){
  setBadge(els.asrState, !!els.asrURL.value);
  setBadge(els.mtState,  !!els.mtURL.value);
  setBadge(els.ttsState, !!els.ttsURL.value);
}
['asrURL','mtURL','ttsURL'].forEach(id=>els[id].addEventListener('input', checkConnectivity));
checkConnectivity();

// ---- ASR (if backend configured), otherwise no-op and keep manual input ----
async function postASR(blob){
  const url = els.asrURL.value;
  if(!url){ alert('未配置 ASR API，您也可以直接在输入框键入文本。'); return; }
  const form = new FormData();
  form.append('file', blob, 'audio.webm');
  const res = await fetch(url, { method:'POST', body: form });
  if(!res.ok){ throw new Error('ASR 请求失败'); }
  const data = await res.json();
  return data.text || '';
}

// ---- MT ----
async function postMT(text){
  const url = els.mtURL.value;
  if(!url){
    // Fallback: trivial pass-through + regex-yue-ish normalizer demo
    return text
      .replace(/你们/g, '你哋')
      .replace(/我们/g, '我哋')
      .replace(/不要/g, '唔好')
      .replace(/别/g, '唔好')
      .replace(/推/g, '推（ong）');
  }
  const payload = {
    text,
    source_lang: els.sourceLang.value,
    target_lang: els.targetLang.value
  };
  const res = await fetch(url, {
    method:'POST',
    headers:{'Content-Type':'application/json'},
    body: JSON.stringify(payload)
  });
  if(!res.ok){ throw new Error('MT 请求失败'); }
  const data = await res.json();
  return data.text || '';
}

// ---- TTS ----
async function postTTS(text){
  const url = els.ttsURL.value;
  if(!url){
    // Browser fallback: zh-HK voice if available
    if('speechSynthesis' in window){
      const u = new SpeechSynthesisUtterance(text);
      u.lang = 'zh-HK';
      speechSynthesis.speak(u);
    }else{
      alert('此浏览器不支持语音合成。');
    }
    return;
  }
  const res = await fetch(url, {
    method:'POST',
    headers:{'Content-Type':'application/json'},
    body: JSON.stringify({ text, lang: 'yue_Hant' })
  });
  if(!res.ok){ throw new Error('TTS 请求失败'); }
  const buf = await res.arrayBuffer();
  const blob = new Blob([buf], { type: 'audio/mpeg' });
  els.audio.src = URL.createObjectURL(blob);
  els.audio.play();
}

// Recording via MediaRecorder
async function startRec(){
  const stream = await navigator.mediaDevices.getUserMedia({ audio:true });
  chunks = [];
  mediaRecorder = new MediaRecorder(stream);
  mediaRecorder.ondataavailable = e => chunks.push(e.data);
  mediaRecorder.onstop = async () => {
    const blob = new Blob(chunks, { type: 'audio/webm' });
    try{
      const text = await postASR(blob);
      els.input.value = text;
    }catch(err){
      alert(err.message);
    }
  };
  mediaRecorder.start();
  isRecording = true;
  els.btnMic.disabled = true;
  els.btnStop.disabled = false;
}
function stopRec(){
  if(mediaRecorder && isRecording){
    mediaRecorder.stop();
    isRecording = false;
    els.btnMic.disabled = false;
    els.btnStop.disabled = true;
  }
}

els.btnMic.onclick = startRec;
els.btnStop.onclick = stopRec;

els.btnTranslate.onclick = async () => {
  const text = els.input.value.trim();
  if(!text){ alert('请先输入或识别文本'); return; }
  try{
    const out = await postMT(text);
    els.output.value = out;
  }catch(err){ alert(err.message); }
};

els.btnSpeak.onclick = async () => {
  const text = els.output.value.trim() || els.input.value.trim();
  if(!text){ alert('没有可播报文本'); return; }
  try{
    await postTTS(text);
  }catch(err){ alert(err.message); }
};
