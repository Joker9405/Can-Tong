export const config = {
  runtime: 'nodejs18.x',
};

export default async function handler(req, res) {
  const origin = req.headers.origin || '*';
  res.setHeader('Access-Control-Allow-Origin', origin);
  res.setHeader('Vary', 'Origin');
  res.setHeader('Access-Control-Allow-Methods', 'POST,GET,OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  if (req.method === 'OPTIONS') return res.status(204).end();

  // 这里只是占位返回，方便你后续接入真正 TTS
  res.status(501).json({ ok: false, message: 'TTS endpoint not implemented yet.' });
}
