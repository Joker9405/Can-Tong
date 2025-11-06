const $ = (q,root=document)=>root.querySelector(q);

function playTTS(text, voiceHint){
  const url = `/api/tts?text=${encodeURIComponent(text)}&voice=${encodeURIComponent(voiceHint||'yue-HK')}`;
  fetch(url).then(r=>{
    if(r.ok && (r.headers.get('content-type')||'').includes('audio')){
      return r.blob();
    }
    throw new Error('fallback');
  }).then(blob=>{
    const audio = new Audio(URL.createObjectURL(blob));
    audio.play();
  }).catch(()=>{
    try{
      const u = new SpeechSynthesisUtterance(text);
      u.lang = 'yue-HK';
      speechSynthesis.speak(u);
    }catch{}
  });
}

document.addEventListener('click', (e)=>{
  const btn = e.target.closest('.tts');
  if(!btn) return;
  const targetId = btn.getAttribute('data-tts-target');
  if(targetId){
    const text = document.getElementById(targetId)?.textContent?.trim();
    if(text) playTTS(text, 'yue-HK');
    return;
  }
  const text = btn.getAttribute('data-tts');
  if(text) playTTS(text, 'yue-HK');
});

const examples = $('#examples');
const toggle = $('#examplesToggle');
toggle?.addEventListener('click', ()=>examples.classList.toggle('open'));

function renderResult(data){
  $('#resultRoot').hidden = false;
  toggle.hidden = false;

  $('#termMain').textContent = data.main_zhh || '—';

  const vWrap = $('#variants');
  vWrap.innerHTML = '';
  (data.variants_zhh||[]).forEach(v=>{
    vWrap.insertAdjacentHTML('beforeend', `
      <div class="variant-row">
        <div class="variant-text">${v}</div>
        <button class="tts" data-tts="${v}" aria-label="播放讀音">
          <svg viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg"><path d="M4 10v4h4l5 4V6l-5 4H4z" fill="currentColor"/><path d="M16.5 8.5a5 5 0 010 7" stroke="currentColor" stroke-width="2" stroke-linecap="round"/></svg>
        </button>
      </div>`);
  });

  const u = $('#usageList');
  u.innerHTML = (data.usages||[]).map(t=>`<span class="usage-badge">${t}</span>`).join('');

  $('#noteEn').textContent = data.note_en || '';
  $('#noteZh').textContent = data.note_zh || '';

  const aliasWrap = $('#aliasChips');
  aliasWrap.innerHTML = (data.aliases_zhh||[]).map(a=>`<span class="chip">${a}</span>`).join('');

  const exWrap = $('#examplesList');
  exWrap.innerHTML = '';
  (data.examples || []).forEach(ex=>{
    exWrap.insertAdjacentHTML('beforeend', `
      <div class="example-item">
        <div class="ex-zhh">${ex.zhh || ''}</div>
        <div class="ex-expl">
          <div class="en">${ex.en || ''}</div>
          <div class="zh">${ex.chs || ''}</div>
        </div>
        <div class="ex-audio" style="display:flex;justify-content:center">
          <button class="tts" data-tts="${ex.zhh || ''}" aria-label="播放例句讀音">
            <svg viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg"><path d="M4 10v4h4l5 4V6l-5 4H4z" fill="currentColor"/><path d="M16.5 8.5a5 5 0 010 7" stroke="currentColor" stroke-width="2" stroke-linecap="round"/></svg>
          </button>
        </div>
      </div>`);
  });
}

document.getElementById('searchForm').addEventListener('submit', async (e)=>{
  e.preventDefault();
  const q = document.getElementById('q').value.trim();
  if(!q) return;
  try{
    const r = await fetch(`/api/translate?q=${encodeURIComponent(q)}`);
    const data = await r.json();
    const shaped = {
      main_zhh: data?.zhh?.[0] || data?.main_zhh,
      variants_zhh: data?.zhh?.slice(1) || data?.variants_zhh || [],
      usages: data?.usage || data?.usages || [],
      note_en: data?.notes?.en || data?.note_en || '',
      note_zh: data?.notes?.zh || data?.note_zh || '',
      aliases_zhh: data?.aliases_zhh || data?.alias || [],
      examples: (data?.examples||[]).map(x=>({zhh:x.zhh||x.cantonese||'', chs:x.chs||x.cn||x.zh||'', en:x.en||x.english||''}))
    };
    renderResult(shaped);
  }catch(err){
    console.error(err);
  }
});

const initQ = new URLSearchParams(location.search).get('q');
if(initQ){
  document.getElementById('q').value = initQ;
  document.getElementById('searchForm').dispatchEvent(new Event('submit'));
}
