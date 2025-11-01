(function(){
  const $ = sel => document.querySelector(sel);
  const qEl = $('#q');
  const searchBtn = $('#searchBtn');
  const speakBtn = $('#speakBtn');
  const statusEl = $('#status');
  const resultEl = $('#result');
  const outZhh = $('#outZhh');
  const outChs = $('#outChs');
  const outEn  = $('#outEn');

  let lastText = '';

  async function translate(q){
    status('查询中…');
    toggleWorking(true);
    try{
      const url = `/api/route?fn=translate&q=${encodeURIComponent(q)}`;
      const r = await fetch(url, { method:'GET' });
      const j = await r.json();
      if(!j.ok) throw new Error(j.error || 'Unknown error');
      const { best } = j;
      outZhh.textContent = best.zhh || '—';
      outChs.textContent = best.chs || '—';
      outEn.textContent  = best.en  || '—';
      resultEl.style.display = 'grid';
      speakBtn.disabled = !(best && best.zhh);
      lastText = best.zhh || '';
      status('完成', true);
    }catch(err){
      console.error(err);
      status('查询失败：' + err.message, false);
    }finally{
      toggleWorking(false);
    }
  }

  async function speak(text){
    if(!text) return;
    try{
      const r = await fetch(`/api/route?fn=tts&text=${encodeURIComponent(text)}`);
      const j = await r.json();
      if(!j.ok) throw new Error(j.error || 'TTS error');
      if(j.mode === 'client-zh-HK'){
        const u = new SpeechSynthesisUtterance(text);
        u.lang = 'zh-HK';
        speechSynthesis.speak(u);
      }else{
        // future: stream audio from backend
      }
    }catch(err){
      console.error(err);
      status('朗读失败：' + err.message, false);
    }
  }

  function status(msg, ok){
    statusEl.textContent = msg || '';
    statusEl.classList.remove('good','bad');
    if(ok === true) statusEl.classList.add('good');
    if(ok === false) statusEl.classList.add('bad');
  }

  function toggleWorking(b){
    searchBtn.disabled = !!b;
    speakBtn.disabled = !!b || !lastText;
  }

  searchBtn.addEventListener('click', () => {
    const q = (qEl.value || '').trim();
    if(!q){ status('请输入要查询的内容'); return; }
    translate(q);
  });

  speakBtn.addEventListener('click', () => speak(lastText));

  qEl.addEventListener('keydown', (e) => {
    if(e.key === 'Enter'){
      const q = (qEl.value || '').trim();
      if(!q){ status('请输入要查询的内容'); return; }
      translate(q);
    }
  });

  window.addEventListener('load', () => qEl && qEl.focus());
})();
