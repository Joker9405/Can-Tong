<script>
// oov.js  MIT License
// 作用：识别 OOV（词库外 & 忽略表中）并自动“学会”读音/发音（TTS优先，浏览器zh-HK兜底），结果缓存在IndexedDB。
// 不做三挡/变体，不限制输出风格。仅提供读音/发音的自动化与缓存。

(function (global) {
  const DB_NAME = 'cantong-oov';
  const STORE = 'audio';
  const DB_VERSION = 1;

  // —— 简易 IndexedDB 封装 ——
  function openDB() {
    return new Promise((resolve, reject) => {
      const req = indexedDB.open(DB_NAME, DB_VERSION);
      req.onupgradeneeded = () => {
        const db = req.result;
        if (!db.objectStoreNames.contains(STORE)) {
          const os = db.createObjectStore(STORE, { keyPath: 'key' });
          os.createIndex('ts', 'ts');
        }
      };
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => reject(req.error);
    });
  }
  async function getFromDB(key) {
    const db = await openDB();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(STORE, 'readonly');
      const store = tx.objectStore(STORE);
      const req = store.get(key);
      req.onsuccess = () => resolve(req.result || null);
      req.onerror = () => reject(req.error);
    });
  }
  async function putToDB(rec) {
    const db = await openDB();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(STORE, 'readwrite');
      tx.objectStore(STORE).put(rec);
      tx.oncomplete = () => resolve(true);
      tx.onerror = () => reject(tx.error);
    });
  }

  // —— 文本切分（中/英/数字/符号）——
  function tokenize(text) {
    // 连续汉字为一段；连续英文/数字为一段；其他单符号分开
    const re = /([\u4E00-\u9FFF]+|[A-Za-z0-9]+|[^\s\u4E00-\u9FFFA-Za-z0-9])/g;
    return (text || '').match(re) || [];
  }

  // —— 浏览器 TTS 兜底（zh-HK 优先）——
  function speakByBrowser(text) {
    return new Promise((resolve) => {
      const u = new SpeechSynthesisUtterance(text);
      const pick = (voices) => {
        // 优先 zh-HK / yue / cantonese
        const prefer = voices.find(v => /zh[-_]?HK|yue|cantonese/i.test(v.lang+v.name));
        u.voice = prefer || voices.find(v => /^zh/i.test(v.lang)) || null;
        speechSynthesis.cancel();
        speechSynthesis.speak(u);
        // 无法拿到音频数据，但可作为兜底发音
        resolve({ ok: true, from: 'browser-tts' });
      };
      const vs = speechSynthesis.getVoices();
      if (vs.length) pick(vs);
      else {
        // 某些浏览器异步加载声音列表
        const h = () => {
          const v2 = speechSynthesis.getVoices();
          pick(v2);
          speechSynthesis.removeEventListener('voiceschanged', h);
        };
        speechSynthesis.addEventListener('voiceschanged', h);
      }
    });
  }

  // —— 将 Blob 保存并返回 blobURL —— 
  async function cacheBlob(key, blob) {
    await putToDB({ key, ts: Date.now(), blob });
    return URL.createObjectURL(blob);
  }

  // —— 从缓存拿 blobURL —— 
  async function getCachedURL(key) {
    const rec = await getFromDB(key);
    if (!rec || !rec.blob) return null;
    return URL.createObjectURL(rec.blob);
  }

  // —— 拉取你自己的 TTS —— 
  async function fetchTTS(ttsBase, text) {
    // 统一接口约定：
    // GET/POST ${ttsBase}?text=...&voice=zh-HK&format=mp3
    // 返回：Content-Type: audio/mpeg 的二进制音频
    const url = `${ttsBase}${ttsBase.includes('?') ? '&':'?'}text=${encodeURIComponent(text)}&voice=zh-HK&format=mp3`;
    const res = await fetch(url);
    if (!res.ok) throw new Error('TTS fetch failed');
    const blob = await res.blob(); // mp3
    return blob;
  }

  // —— 可选：加载字典（显示读音提示，不作为硬依赖）——
  async function loadDict(dictURL) {
    if (!dictURL) return null;
    try {
      const res = await fetch(dictURL);
      if (!res.ok) return null;
      const data = await res.json(); // { "字": ["pron1","pron2"], ... }
      return data;
    } catch {
      return null;
    }
  }

  // —— 主模块 —— 
  const OOV = {
    _cfg: {
      ttsBase: null,      // 你的 TTS 服务基址；也可从 URL ?tts= 获取
      dictURL: null,      // 可选字典 JSON（kCantonese 精简）
      lexiconGetter: null // 可选：返回内置词库（Map/Set），用于判定 OOV
    },
    _dict: null,

    async init(cfg = {}) {
      // 支持从 URL 参数读取 tts
      const params = new URLSearchParams(location.search);
      this._cfg.ttsBase = cfg.ttsBase || params.get('tts') || null;
      this._cfg.dictURL = cfg.dictURL || null;
      this._cfg.lexiconGetter = typeof cfg.lexiconGetter === 'function' ? cfg.lexiconGetter : null;
      this._dict = await loadDict(this._cfg.dictURL); // 可为空
      return true;
    },

    // 判定某 token 是否 OOV（不在词库 或 标记忽略）
    isOOV(token) {
      if (!token || /^\s+$/.test(token)) return false;
      const isHan = /[\u4E00-\u9FFF]/.test(token);
      const lex = this._cfg.lexiconGetter ? this._cfg.lexiconGetter() : null;
      if (!lex) return isHan; // 没提供词库：默认汉字串视为需学习（最稳）
      return isHan && !lex.has?.(token) && !lex.has?.(token.trim());
    },

    // 给一整句做“学习”：会对 OOV 的词逐个生成并缓存音频
    async ensureLearned(text) {
      const toks = tokenize(text);
      for (const tk of toks) {
        if (!this.isOOV(tk)) continue;
        const key = `oov:${tk}`;
        const cached = await getFromDB(key);
        if (cached && cached.blob) continue; // 已学过
        try {
          if (this._cfg.ttsBase) {
            const blob = await fetchTTS(this._cfg.ttsBase, tk);
            await putToDB({ key, ts: Date.now(), blob });
          } else {
            // 没有 TTS 接口就不缓存音频（浏览器 TTS 无法拿到mp3）
            // 但会在 speak 时用浏览器发音
          }
        } catch (e) {
          // 忽略单词失败，继续其它
          console.warn('TTS failed for', tk, e);
        }
      }
      return true;
    },

    // 播放整句（优先：你的 TTS → 退回：拼接缓存/浏览器 TTS）
    async speak(text) {
      // 1) 如果配置了 ttsBase，用整句直接拉一次
      if (this._cfg.ttsBase) {
        try {
          const blob = await fetchTTS(this._cfg.ttsBase, text);
          const url = URL.createObjectURL(blob);
          const a = new Audio(url);
          a.play();
          return { ok: true, from: 'server-tts' };
        } catch (e) {
          console.warn('server tts failed, fallback to cache/browser', e);
        }
      }

      // 2) 尝试用缓存中“逐词音频”顺序播放（若之前 ensureLearned 过）
      const toks = tokenize(text);
      const urls = [];
      for (const tk of toks) {
        if (!this.isOOV(tk)) continue; // 非 OOV 这里不处理
        const key = `oov:${tk}`;
        const u = await getCachedURL(key);
        if (u) urls.push(u);
      }
      if (urls.length) {
        // 顺序播放
        let i = 0;
        const player = new Audio(urls[0]);
        player.onended = () => {
          i++;
          if (i < urls.length) { player.src = urls[i]; player.play(); }
        };
        player.play();
        return { ok: true, from: 'cache' };
      }

      // 3) 最后兜底：浏览器 zh-HK 直接读整句
      await speakByBrowser(text);
      return { ok: true, from: 'browser-tts' };
    },

    // 可选：取读音提示（基于字典），仅用于 UI 展示
    lookupPronHint(token) {
      if (!this._dict || !token) return null;
      if (token.length === 1 && this._dict[token]) return this._dict[token]; // 单字
      // 简单合并：逐字取第一个读音
      const list = [];
      for (const ch of token) {
        if (this._dict[ch] && this._dict[ch].length) list.push(this._dict[ch][0]);
      }
      return list.length ? list : null;
    }
  };

  global.OOV = OOV;
})(window);
</script>
