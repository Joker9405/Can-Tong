// oov.js  MIT License
(function (global) {
  const DB_NAME = 'cantong-oov';
  const STORE = 'audio';
  const DB_VERSION = 1;

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

  function tokenize(text) {
    const re = /([\u4E00-\u9FFF]+|[A-Za-z0-9]+|[^\s\u4E00-\u9FFFA-Za-z0-9])/g;
    return (text || '').match(re) || [];
  }

  function speakByBrowser(text) {
    return new Promise((resolve) => {
      const u = new SpeechSynthesisUtterance(text);
      const pick = (voices) => {
        const prefer = voices.find(v => /zh[-_]?HK|yue|cantonese/i.test((v.lang||'')+(v.name||'')));
        u.voice = prefer || voices.find(v => /^zh/i.test(v.lang||'')) || null;
        speechSynthesis.cancel();
        speechSynthesis.speak(u);
        resolve({ ok: true, from: 'browser-tts' });
      };
      const vs = speechSynthesis.getVoices();
      if (vs.length) pick(vs);
      else {
        const h = () => {
          const v2 = speechSynthesis.getVoices();
          pick(v2);
          speechSynthesis.removeEventListener('voiceschanged', h);
        };
        speechSynthesis.addEventListener('voiceschanged', h);
      }
    });
  }

  async function getCachedURL(key) {
    const rec = await getFromDB(key);
    if (!rec || !rec.blob) return null;
    return URL.createObjectURL(rec.blob);
  }

  async function fetchTTS(ttsBase, text) {
    const url = `${ttsBase}${ttsBase.includes('?') ? '&':'?'}text=${encodeURIComponent(text)}&voice=zh-HK&format=mp3`;
    const res = await fetch(url);
    if (!res.ok) throw new Error('TTS fetch failed');
    const blob = await res.blob();
    return blob;
  }

  async function loadDict(dictURL) {
    if (!dictURL) return null;
    try {
      const res = await fetch(dictURL);
      if (!res.ok) return null;
      const data = await res.json();
      return data;
    } catch {
      return null;
    }
  }

  const OOV = {
    _cfg: { ttsBase: null, dictURL: null, lexiconGetter: null },
    _dict: null,

    async init(cfg = {}) {
      const params = new URLSearchParams(location.search);
      this._cfg.ttsBase = cfg.ttsBase || params.get('tts') || null;
      this._cfg.dictURL = cfg.dictURL || null;
      this._cfg.lexiconGetter = typeof cfg.lexiconGetter === 'function' ? cfg.lexiconGetter : null;
      this._dict = await loadDict(this._cfg.dictURL);
      return true;
    },

    isOOV(token) {
      if (!token || /^\s+$/.test(token)) return false;
      const isHan = /[\u4E00-\u9FFF]/.test(token);
      const lex = this._cfg.lexiconGetter ? this._cfg.lexiconGetter() : null;
      if (!lex) return isHan;
      try {
        if (typeof lex.has === 'function') {
          return isHan && !lex.has(token) && !lex.has(token.trim());
        }
        if (lex instanceof Set) {
          return isHan && !lex.has(token) && !lex.has(token.trim());
        }
        return isHan;
      } catch {
        return isHan;
      }
    },

    async ensureLearned(text) {
      const toks = tokenize(text);
      for (const tk of toks) {
        if (!this.isOOV(tk)) continue;
        const key = `oov:${tk}`;
        const cached = await getFromDB(key);
        if (cached && cached.blob) continue;
        try {
          if (this._cfg.ttsBase) {
            const blob = await fetchTTS(this._cfg.ttsBase, tk);
            await (async () => {
              const db = await openDB();
              return new Promise((resolve, reject) => {
                const tx = db.transaction(STORE, 'readwrite');
                tx.objectStore(STORE).put({ key, ts: Date.now(), blob });
                tx.oncomplete = () => resolve(true);
                tx.onerror = () => reject(tx.error);
              });
            })();
          }
        } catch (e) {
          console.warn('TTS failed for', tk, e);
        }
      }
      return true;
    },

    async speak(text) {
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
      const toks = tokenize(text);
      const urls = [];
      for (const tk of toks) {
        if (!this.isOOV(tk)) continue;
        const key = `oov:${tk}`;
        const u = await getCachedURL(key);
        if (u) urls.push(u);
      }
      if (urls.length) {
        let i = 0;
        const player = new Audio(urls[0]);
        player.onended = () => {
          i++;
          if (i < urls.length) { player.src = urls[i]; player.play(); }
        };
        player.play();
        return { ok: true, from: 'cache' };
      }
      await speakByBrowser(text);
      return { ok: true, from: 'browser-tts' };
    },

    lookupPronHint(token) {
      if (!this._dict || !token) return null;
      if (token.length === 1 && this._dict[token]) return this._dict[token];
      const list = [];
      for (const ch of token) {
        if (this._dict[ch] && this._dict[ch].length) list.push(this._dict[ch][0]);
      }
      return list.length ? list : null;
    }
  };

  global.OOV = OOV;
})(window);