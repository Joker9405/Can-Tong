async function loadJSON(path){const r=await fetch(path);if(!r.ok)throw new Error(`Load failed: ${path}`);return r.json();}
let LEX=null,AUDIO=null;
(async()=>{try{[LEX,AUDIO]=await Promise.all([loadJSON('./data/lexicon.json'),loadJSON('./data/devAudioMap.json')]);}catch(e){console.warn(e);LEX={};AUDIO={};}})();
const $=id=>document.getElementById(id);
document.getElementById('search').onclick=()=>show((document.getElementById('q').value||'').trim());
document.getElementById('speak').onclick =()=>speak((document.getElementById('q').value||'').trim());
function show(key){if(!key)return;const hit=(LEX||{})[key.toLowerCase()]||null;
$('yue').textContent=hit?.yue||'（未收录）';$('jyut').textContent=hit?.jyut||'—';
$('emotion').textContent=hit?.emotion||'—';$('emoji').textContent=hit?.emoji||'';
$('note').textContent=hit?.note||'';$('alts').innerHTML=(hit?.alts||[]).map(x=>`<li>${x}</li>`).join('')||'<li>—</li>';}
function speak(key){if(!key)return;const local=(AUDIO||{})[key.toLowerCase()];if(local){new Audio(local).play();return;}
const u=new SpeechSynthesisUtterance(key);u.lang='zh-HK';speechSynthesis.speak(u);}
