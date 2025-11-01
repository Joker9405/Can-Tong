// Unified route: ?fn=ping|translate|tts|ingest
export default async function handler(req, res) {
  const url = new URL(req.url, `http://${req.headers.host}`);
  const fn = url.searchParams.get('fn') || 'ping';

  try {
    if (fn === 'ping') {
      return res.status(200).json({ ok: true, ts: Date.now() });
    }

    if (fn === 'translate') {
      // Minimal: read /data/seed.csv and match in-memory for MVP
      const seedUrl = `${process.env.VERCEL_URL ? 'https://' + process.env.VERCEL_URL : ''}/data/seed.csv`;
      let seed = '';
      try {
        seed = await fetch(seedUrl).then(r => r.text());
      } catch (e) {
        seed = '';
      }

      const q = (url.searchParams.get('q') || '').trim();
      if (!q) return res.status(400).json({ ok: false, error: 'missing q' });

      const lines = seed.split(/\r?\n/);
      const header = lines.shift() || '';
      const rows = lines.map(l => l.split(','));
      const norm = s => (s || '').trim().toLowerCase();

      let hit = null;
      for (const r of rows) {
        const chs = r[0] || '';
        const zhh = r[1] || '';
        const en  = r[2] || '';
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
      // Placeholder: front-end will use browser zh-HK Web Speech
      const text = url.searchParams.get('text') || '';
      return res.status(200).json({ ok: true, mode: 'client-zh-HK', text });
    }

    if (fn === 'ingest') {
      // Disabled in MVP to keep dataset private/read-only
      return res.status(403).json({ ok: false, error: 'read-only seed; ingest disabled in MVP' });
    }

    return res.status(404).json({ ok: false, error: 'unknown fn' });
  } catch (e) {
    return res.status(500).json({ ok: false, error: String(e) });
  }
}
