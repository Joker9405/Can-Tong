export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,POST,OPTIONS');
  if (req.method === 'OPTIONS') return res.status(204).end();

  return res.status(200).json({ ok: true, now: new Date().toISOString(), env: process.env.VERCEL ? "vercel" : "local" });
}
