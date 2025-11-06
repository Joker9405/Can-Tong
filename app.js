// app.js — pure static front-end (no /api)
let cfg = { ttsUrl: "", translateUrl: "" };

async function loadConfig(){
  try{
    const res = await fetch('/public/config.json');
    if(!res.ok) throw new Error('config not found');
    cfg = await res.json();
    document.querySelector('#cfgStatus').textContent = '配置已载入';
  }catch(e){
    document.querySelector('#cfgStatus').textContent = '未找到 /public/config.json，请填写后再部署';
  }
}

function $(sel){ return document.querySelector(sel); }

async function doTranslate(){
  const q = $('#q').value.trim();
  if(!q){ alert('请输入查询内容'); return; }
  $('#out').style.display = 'block';
  $('#result').textContent = '查询中…';

  if(!cfg.translateUrl){
    // No backend yet — demo rendering only
    $('#result').textContent = `（演示）你输入了：${q}\n这里显示：\n- 粤语：<示例> 唔好推我\n- 普通话：不要推我\n- 英文：Don\'t push me`;
    return;
  }

  try{
    const r = await fetch(cfg.translateUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ q })
    });
    const data = await r.json();
    // Expect data like { zhh: "...", chs: "...", en: "..." }
    $('#result').textContent = [
      data.zhh ? `粤语：${data.zhh}` : '',
      data.chs ? `普通话：${data.chs}` : '',
      data.en  ? `英文：${data.en}`  : ''
    ].filter(Boolean).join('\n');
  }catch(err){
    $('#result').textContent = '请求失败：' + err.message;
  }
}

async function doTTS(){
  const text = ($('#result').textContent.match(/粤语：(.+)/) || [,''])[1].trim();
  if(!text){ alert('没有可播放的粤语文本'); return; }
  if(!cfg.ttsUrl){ alert('未配置 ttsUrl'); return; }

  try{
    const r = await fetch(cfg.ttsUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ text, lang: 'yue-HK' })
    });
    if(!r.ok) throw new Error('TTS 服务返回错误');
    const blob = await r.blob();
    const url = URL.createObjectURL(blob);
    const player = document.querySelector('#player');
    player.src = url;
    player.play();
  }catch(err){
    alert('TTS 播放失败：' + err.message);
  }
}

window.addEventListener('DOMContentLoaded', () => {
  loadConfig();
  $('#btnTranslate').addEventListener('click', doTranslate);
  $('#btnTTS').addEventListener('click', doTTS);
});
