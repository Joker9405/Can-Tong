export default async function handler(req, res) {
  // 允许在 GitHub Pages 等第三方域调用（如不需要跨域，可删去以下 6 行）
  const origin = req.headers.origin || '*';
  res.setHeader('Access-Control-Allow-Origin', origin);
  res.setHeader('Vary', 'Origin');
  res.setHeader('Access-Control-Allow-Methods', 'GET,OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  if (req.method === 'OPTIONS') return res.status(204).end();

  return res.status(200).send('pong');
}
