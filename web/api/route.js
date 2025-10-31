// Core handler used by /api/route.js bridge.
function setCors(res){
  const allow = process.env.FRONTEND_URL || "*";
  res.setHeader("Access-Control-Allow-Origin", allow);
  res.setHeader("Access-Control-Allow-Methods","GET,POST,OPTIONS");
  res.setHeader("Access-Control-Allow-Headers","Content-Type, Authorization");
}

function ok(res, data){ res.status(200).json({ ok: true, ...data }); }

const SEED = [
  { key: ["早抖","早点休息","早點休息","rest early","go rest early"], zhh: "早啲休息", chs: "早点休息", en: "rest early" },
  { key: ["早抖吖","早点休息呀","rest early ya"], zhh: "早啲休息吖", chs: "早点休息呀", en: "rest early" }
];

function simpleLookup(text){
  const t = String(text||"").trim().toLowerCase();
  for(const item of SEED){
    for(const k of item.key){
      if(t === String(k).toLowerCase()) return item;
    }
  }
  return null;
}

async function translateHandler(req, res){
  const url = new URL(req.url, "http://localhost");
  const text = url.searchParams.get("text") || (req.body && req.body.text) || "";
  const src  = (url.searchParams.get("src") || "auto").toLowerCase();
  const dst  = (url.searchParams.get("dst") || "zhh").toLowerCase();

  const hit = simpleLookup(text);
  let best = null;
  if(hit){
    best = { zhh: hit.zhh, chs: hit.chs, en: hit.en };
  }else{
    best = { zhh: text, chs: text, en: text };
  }

  ok(res, { fn: "translate", input: { text, src, dst }, best, variants: [best] });
}

export default async function handler(req, res){
  setCors(res);
  if (req.method === "OPTIONS") return res.status(204).end();

  const url = new URL(req.url, "http://localhost");
  const fn = (url.searchParams.get("fn") || "").toLowerCase();

  try{
    if(fn === "ping") return ok(res, { fn: "ping", time: new Date().toISOString() });
    if(fn === "translate" || url.pathname.includes("/translate")) return translateHandler(req,res);
    return ok(res, { message: "CanTong core route online", time: new Date().toISOString() });
  }catch(e){
    res.status(500).json({ ok:false, error: String(e) });
  }
}
