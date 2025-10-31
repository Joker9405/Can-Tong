// Bridge that loads the real handler from web/api/route.js (bundled via includeFiles)
// Adds CORS and normalizes fn from either /api/:fn or ?fn=

function setCors(res) {
  const allow = process.env.FRONTEND_URL || "*";
  res.setHeader("Access-Control-Allow-Origin", allow);
  res.setHeader("Access-Control-Allow-Methods", "GET,POST,OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type, Authorization");
}

export default async function handler(req, res) {
  setCors(res);
  if (req.method === "OPTIONS") {
    res.status(204).end();
    return;
  }
  try {
    // normalize fn
    const url = new URL(req.url, "http://localhost");
    let fn = url.searchParams.get("fn");
    if (!fn) {
      const m = url.pathname.match(/^\/api\/(\w+)/);
      if (m) fn = m[1];
    }
    if (!req.query) req.query = {};
    if (fn) req.query.fn = fn;

    // static relative import; file is bundled via vercel.json includeFiles
    const mod = await import("../web/api/route.js");
    const entry = mod.default || mod.handler || mod;
    return entry(req, res);
  } catch (e) {
    res.status(500).json({ ok: false, error: "route-bridge-failed", detail: String(e) });
  }
}
