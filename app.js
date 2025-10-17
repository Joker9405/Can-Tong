// Minimal static CN/EN → YUE "three-variant" demo using a tiny lexicon.
// No external API; suitable for GitHub Pages.
const $chat = document.getElementById('chat');
const $input = document.getElementById('userInput');
const $form = document.getElementById('composer');

// Load lexicon
let LEX = {};
fetch('data/lexicon.json').then(r => r.json()).then(j => { LEX = j; });

// Util: basic mapping
function mapToYue(text) {
  // very naive segmentation; split by spaces and common punctuation
  const tokens = text.split(/(\s+|[，。！？,.!?]+)/).filter(t => t.length);
  return tokens.map(tok => {
    const key = tok.toLowerCase();
    if (LEX.cn[key]) return LEX.cn[key];
    if (LEX.en[key]) return LEX.en[key];
    return tok;
  }).join('');
}

// Generate three variants
function genVariants(text) {
  // 1) General: mapped + neutral endings
  const base = mapToYue(text);
  const general = base.replace(/(吗|嗎)\s*$/,'？').replace(/吧\s*$/,'啦');

  // 2) Colloquial: add particles, contractions
  let colloq = general;
  colloq = colloq
    .replace(/我/g, '我')
    .replace(/你/g, '你')
    .replace(/是/g, '係')
    .replace(/了/g, '咗')
    .replace(/吗|嗎/g, '咩')
    .replace(/不要|别/g, '唔好')
    + (/[。！？!?]$/.test(general) ? '' : ' 啦');

  // 3) Polite: soften tone / formal register
  let polite = general
    .replace(/你/g,'您')
    .replace(/唔/g,'不')
    .replace(/啦|喇|啊/g,'');
  if (!/[。！？!?]$/.test(polite)) polite += '。';
  polite = '勞煩您：' + polite;

  return [
    { type: 'General', text: general },
    { type: 'Colloquial', text: colloq },
    { type: 'Polite', text: polite },
  ];
}

// TTS via Web Speech API (browser dependent); silent fallback (no UI message)
function speakYue(text) {
  if (!('speechSynthesis' in window)) return;
  const u = new SpeechSynthesisUtterance(text);
  // Try Cantonese/HK voices if present
  const prefer = ['yue-HK', 'zh-HK', 'cmn-Hant-HK', 'zh-Hant-HK'];
  const voices = speechSynthesis.getVoices();
  const found = voices.find(v => prefer.some(p => (v.lang||'').includes(p) || (v.name||'').includes('Hong Kong')));
  if (found) u.voice = found;
  u.lang = found?.lang || 'zh-HK';
  speechSynthesis.speak(u);
}

function addMessage(role, html) {
  const div = document.createElement('div');
  div.className = `msg ${role}`;
  div.innerHTML = `
    <div class="avatar">${role === 'user' ? 'U' : 'Y'}</div>
    <div class="bubble">${html}</div>
  `;
  $chat.appendChild(div);
  $chat.scrollTop = $chat.scrollHeight;
}

function renderVariants(vs) {
  const html = `
    <h3>三檔變體</h3>
    <div class="variants">
      ${vs.map(v => `
        <div class="card">
          <div class="row">
            <span class="tag">${v.type}</span>
            <div class="actions">
              <button data-say="${v.text.replace(/"/g,'&quot;')}">▶ 發音</button>
              <button data-copy="${v.text.replace(/"/g,'&quot;')}">複製</button>
            </div>
          </div>
          <div class="text">${v.text}</div>
        </div>
      `).join('')}
    </div>
  `;
  addMessage('bot', html);

  // bind actions
  const bubble = $chat.lastElementChild.querySelector('.bubble');
  bubble.querySelectorAll('button[data-say]').forEach(btn => {
    btn.addEventListener('click', () => speakYue(btn.getAttribute('data-say')));
  });
  bubble.querySelectorAll('button[data-copy]').forEach(btn => {
    btn.addEventListener('click', async () => {
      await navigator.clipboard.writeText(btn.getAttribute('data-copy'));
      btn.textContent = '已複製';
      setTimeout(() => btn.textContent = '複製', 900);
    });
  });
}

// Initial tip
addMessage('bot', '<div>輸入 中文 / English，系統會輸出粵語（繁體）三檔變體：General / Colloquial / Polite。此為靜態 Demo，未連接雲端模型。</div>');

$form.addEventListener('submit', (e) => {
  e.preventDefault();
  const text = $input.value.trim();
  if (!text) return;
  addMessage('user', `<div class="text">${text}</div>`);
  $input.value = '';
  const variants = genVariants(text);
  renderVariants(variants);
});
