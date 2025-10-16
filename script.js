/* script.js */
(async function () {
  const Q = (s) => document.querySelector(s);
  const resultEl = Q('#result');
  const inputEl = Q('#q');
  const searchBtn = Q('#searchBtn');
  const speakBtn = Q('#shareBtn');

  // 载入主词库与可选本地音频映射
  const [lexicon, audioMap] = await Promise.all([
    fetch('data/lexicon.v9.json').then(r => r.json()),
    fetch('data/devAudioMap.v9.json').then(r => r.json()).catch(() => ({}))
  ]);

  // 常见“程度词/功能词”剥除，用于更稳的匹配（与你之前约定一致）
  const STOP_WORDS = ['这么','咁','好','非常','真系','太','好似','有点','有啲','十分','好好','真係','噉','咁样','咁樣','咁啲','so','very','really','too','quite','rather'];

  function normalizeZh(s) {
    if (!s) return '';
    let t = s.trim().toLowerCase();
    STOP_WORDS.forEach(w => { t = t.replaceAll(w.toLowerCase(), ''); });
    return t;
  }

  function longestFirst(arr) {
    return [...arr].sort((a,b)=>b.length - a.length);
  }

  // 命中策略：1) 精确或包含命中 src.zh；2) 英文命中 src.en；3) 直接命中字面 yue[].text
  function search(query) {
    const q = query.trim();
    if (!q) return null;

    const nq = normalizeZh(q);

    for (const item of lexicon) {
      const srcZh = Array.isArray(item?.src?.zh) ? item.src.zh : [];
      const srcEn = Array.isArray(item?.src?.en) ? item.src.en : [];

      // 1) 中文匹配（最长优先 + 包含）
      for (const key of longestFirst(srcZh)) {
        const nk = normalizeZh(key);
        if (nk && (nq === nk || nq.includes(nk) || key.includes(q) || q.includes(key))) {
          return item;
        }
      }
      // 2) 英文匹配
      for (const key of srcEn) {
        if (typeof key === 'string' && key.trim() && q.toLowerCase().includes(key.toLowerCase())) {
          return item;
        }
      }
      // 3) 命中候选粤语文本
      for (const y of item?.yue || []) {
        if (q.includes(y.text) || y.text.includes(q)) return item;
      }
    }
    return null;
  }

  function playAudioOrTTS(text) {
    if (!text) return;

    // 本地 mp3 优先
    const mp3 = audioMap[text];
    if (mp3) {
      const audio = new Audio(mp3);
      audio.play().catch(()=>{});
      return;
    }

    // 否则 zh-HK TTS（但界面不提示）
    if ('speechSynthesis' in window) {
      const u = new SpeechSynthesisUtterance(text);
      // 挑选 zh-HK；若不存在，仍然发音但可能是其他粤语近似
      const voices = speechSynthesis.getVoices();
      const hk = voices.find(v => /zh[-_]HK/i.test(v.lang)) || voices.find(v => /yue|cantonese/i.test(v.name));
      if (hk) u.voice = hk;
      u.rate = 1.0;
      u.pitch = 1.0;
      speechSynthesis.speak(u);
    }
  }

  function renderItem(item) {
    const { id, src = {}, yue = [], emoji, emotion /* note, tags */ } = item;

    // “情绪” → UI 文案改为 “形容”，字段仍读 emotion
    const emotionLabel = '形容';

    const yueLines = yue.map(y => {
      const jyut = y.jyut ? ` (${y.jyut})` : '';
      const safeText = y.text.replace(/"/g, '&quot;');
      return `
        <div class="row bullet">
          <button class="audio-btn" data-text="${safeText}">🔊</button>
          <span>${y.text}${jyut}</span>
        </div>`;
    }).join('');

    // 不渲染 note；保留同义词与基本释义
    const html = `
      <div class="card">
        <div class="row"><span class="label">查询:</span> <strong>${(src.zh && src.zh[0]) ? src.zh[0] : (src.en && src.en[0]) || '—'}</strong></div>
        ${emoji || emotion ? `<div class="row"><span class="label">${emotionLabel}:</span> ${emotion || '—'} ${emoji ? `<span class="pill">${emoji}</span>` : ''}</div>` : ''}
        <div class="row"><span class="label">同义:</span></div>
        ${yueLines || '<div class="row bullet muted">未收录</div>'}
      </div>
    `;
    resultEl.innerHTML = html;

    // 绑定每条粤语候选的发音按钮
    [...document.querySelectorAll('.audio-btn')].forEach(btn => {
      btn.addEventListener('click', () => playAudioOrTTS(btn.dataset.text));
    });
  }

  function onSearch() {
    const q = inputEl.value;
    const hit = search(q);
    if (!hit) {
      resultEl.innerHTML = `<div class="card"><div class="row muted">未收录：${q ? q : '(空)'}。</div></div>`;
      return;
    }
    renderItem(hit);
  }

  // “发音”按钮：若当前结果中有第一条 yue 候选则读之；否则读输入框
  function onSpeak() {
    const firstBtn = document.querySelector('.audio-btn');
    if (firstBtn) {
      playAudioOrTTS(firstBtn.dataset.text);
    } else if (inputEl.value.trim()) {
      playAudioOrTTS(inputEl.value.trim());
    }
  }

  searchBtn.addEventListener('click', onSearch);
  speakBtn.addEventListener('click', onSpeak);
  inputEl.addEventListener('keydown', (e)=>{ if (e.key === 'Enter') onSearch(); });

  // 若 URL 携带 ?q=xxx 自动查询
  const urlQ = new URLSearchParams(location.search).get('q');
  if (urlQ) { inputEl.value = urlQ; onSearch(); }
})();
