// Robust unified route with debug; fetch seed.csv via absolute origin URL
export default async function handler(req, res) {
  const proto = (req.headers['x-forwarded-proto'] || 'https');
  const host = req.headers.host;
  const origin = `${proto}://${host}`;

  const url = new URL(req.url, origin);
  const fn = url.searchParams.get('fn') || 'ping';

  async function readSeedText() {
    const seedUrl = new URL('/data/seed.csv', origin).toString();
    let text = '';
    let error = null;
    try {
      const r = await fetch(seedUrl);
      if (!r.ok) throw new Error(`HTTP ${r.status}`);
      text = await r.text();
    } catch (e) {
      error = String(e);
    }
    return { text, error, seedUrl };
  }

  try {
    if (fn === 'ping') {
      return res.status(200).json({ ok: true, ts: Date.now() });
    }

    if (fn === 'debug') {
      const { text, error, seedUrl } = await readSeedText();
      return res.status(200).json({ ok: !error, origin, seedUrl, error, sample: text.slice(0, 120) });
    }

    if (fn === 'translate') {
      const q = (url.searchParams.get('q') || '').trim();
      if (!q) return res.status(400).json({ ok: false, error: 'missing q' });

      const { text, error } = await readSeedText();
      if (error) {
        return res.status(500).json({ ok: false, error: 'seed-load-failed' });
      }

      const lines = text.split(/\r?\n/);
      const header = (lines.shift() || '').split(',');
      const idx = {
        chs: header.findIndex(h => h.trim().toLowerCase() === 'chs'),
        zhh: header.findIndex(h => h.trim().toLowerCase() === 'zhh'),
        en:  header.findIndex(h => h.trim().toLowerCase() === 'en'),
      };
      const norm = s => (s || '').trim().toLowerCase();

      let hit = null;
      for (const line of lines) {
        if (!line.trim()) continue;
        const parts = line.split(',');
        const chs = parts[idx.chs] || '';
        const zhh = parts[idx.zhh] || '';
        const en  = parts[idx.en]  || '';
        if (norm(chs) === norm(q) || norm(zhh) === norm(q) || norm(en) === norm(q)) {
          hit = { chs, zhh, en };
          break;
        }
      }
      const best = hit ? { zhh: hit.zhh || q, chs: hit.chs || q, en: hit.en || q }
                       : { zhh: q, chs: q, en: q };
      return res.status(200).json({ ok: true, best });
    }

    if (fn === 'tts') {
      const text = url.searchParams.get('text') || '';
      return res.status(200).json({ ok: true, mode: 'client-zh-HK', text });
    }

    if (fn === 'ingest') {
      return res.status(403).json({ ok: false, error: 'read-only seed; ingest disabled in MVP' });
    }

    return res.status(404).json({ ok:false, error:'unknown fn' });
  } catch (e) {
    return res.status(500).json({ ok:false, error: String(e) });
  }
}
