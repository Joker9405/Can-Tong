// app.js · OOV集成版（不添加三挡/变体）
(function(){
  const $ = (s)=>document.querySelector(s);
  const elIn = $('#inp');
  const elOut = $('#out');
  const elStatus = $('#status');
  const elRun = $('#btn-run');
  const elSpeak = $('#btn-speak');

  function setStatus(msg){ elStatus.textContent = msg||''; }

  OOV.init({
    dictURL: './data/unihan_kCantonese.min.json'
  }).then(()=>{
    setStatus('OOV 就绪' + (new URLSearchParams(location.search).get('tts') ? ' · 已配置外部 TTS' : ' · 未配置外部 TTS（将使用浏览器粤语兜底）'));
  });

  function translateToCantonese(input){
    return (input||'').trim();
  }

  async function onRun(){
    const src = elIn.value || '';
    const yue = translateToCantonese(src);
    elOut.textContent = yue || '（空）';
    setStatus('已生成结果 · 正在学习 OOV 发音缓存…');
    await OOV.ensureLearned(yue);
    setStatus('已生成结果 · OOV 学习完成');
  }

  async function onSpeak(){
    const txt = elOut.textContent || elIn.value || '';
    if (!txt) { setStatus('没有可读的文本'); return; }
    setStatus('播放中…');
    await OOV.speak(txt);
    setStatus('播放完成');
  }

  elRun.addEventListener('click', onRun);
  elSpeak.addEventListener('click', onSpeak);
})();