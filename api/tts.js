export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,POST,OPTIONS');
  if (req.method === 'OPTIONS') return res.status(204).end();
}
  try{
    const target = TTS_URL + (TTS_URL.includes('?') ? '&' : '?') + 'text=' + encodeURIComponent(text);
    const r = await fetch(target);
    const buf = Buffer.from(await r.arrayBuffer());
    res.setHeader('content-type', r.headers.get('content-type') || 'audio/mpeg');
    return res.status(200).send(buf);
  }catch(e){
    return res.status(502).json({ error: 'TTS proxy failed', detail: String(e) });
  }
}
