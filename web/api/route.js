// Bridge to real handler. In 2024 Vercel, this file will be bundled together
// with /web/api/** via vercel.json includeFiles.
function cors(res){
  const allow = process.env.FRONTEND_URL || "*";
  res.setHeader("Access-Control-Allow-Origin", allow);
  res.setHeader("Access-Control-Allow-Methods","GET,POST,OPTIONS");
  res.setHeader("Access-Control-Allow-Headers","Content-Type, Authorization");
}
export default async function handler(req, res){
  cors(res);
  if (req.method === "OPTIONS") return res.status(204).end();
  try{
    const url = new URL(req.url, "http://localhost");
    let fn = url.searchParams.get("fn");
    if(!fn){
      const m = url.pathname.match(/^\/api\/(\w+)/);
      if(m) fn = m[1];
    }
    if(!req.query) req.query = {};
    if(fn) req.query.fn = fn;

    // static import so bundler includes the file
    const mod = await import("../web/api/route.js");
    const entry = mod.default || mod.handler || mod;
    return entry(req, res);
  }catch(e){
    res.status(500).json({ ok:false, error:"route-bridge-failed", detail: String(e) });
  }
}
