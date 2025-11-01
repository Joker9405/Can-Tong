// Minimal serverless router for Vercel Node.js 20
// Usage: /api/route?fn=ping
module.exports = async (req, res) => {
  const fn = (req.query && req.query.fn) || "";
  if (req.method === "OPTIONS") { 
    res.setHeader("Access-Control-Allow-Origin", "*");
    res.setHeader("Access-Control-Allow-Methods", "GET,POST,OPTIONS");
    res.setHeader("Access-Control-Allow-Headers", "Content-Type, Authorization");
    return res.status(204).end();
  }
  if (fn === "ping") {
    return res.status(200).json({ ok: true, ts: Date.now() });
  }
  return res.status(404).json({ error: "fn not found", hint: "try /api/route?fn=ping" });
};
