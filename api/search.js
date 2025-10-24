import { kvScan, kvMget } from './kv.js';

function dot(a,b){ let s=0; for(let i=0;i<Math.min(a.length,b.length);i++) s+=a[i]*b[i]; return s; }
function norm2(a){ let s=0; for(let i=0;i<a.length;i++) s+=a[i]*a[i]; return Math.sqrt(s); }
function cosine(a,b){ const d = dot(a,b); const na = norm2(a); const nb = norm2(b); return (na && nb) ? d/(na*nb) : 0; }

const OPENAI_API_KEY = process.env.OPENAI_API_KEY || '';
const MODEL = process.env.EMBED_MODEL || 'text-embedding-3-small';

async function embedOne(text){
  const r = await fetch("https://api.openai.com/v1/embeddings", {
    method:"POST",
    headers:{ "Authorization": `Bearer ${OPENAI_API_KEY}`, "Content-Type":"application/json" },
    body: JSON.stringify({ model: MODEL, input: [text||""] })
  });
  if(!r.ok){ throw new Error("Embedding API error " + r.status); }
  const j = await r.json();
  return j.data[0].embedding;
}

export default async function handler(req, res) {
  if(req.method!=='GET') return res.status(405).json({error:'Method not allowed'});
  if(!OPENAI_API_KEY) return res.status(400).json({error:'Missing OPENAI_API_KEY'});
  const text = String(req.query.text||"");
  const topk = Math.min( Number(req.query.topk||8), 20);
  const qv = await embedOne(text);
  const keys = await kvScan("ct:vec:*", 500);
  const batch = await kvMget(keys);
  let hits = [];
  for(const obj of batch){
    if(!obj || !obj.vectors) continue;
    for(const lang of Object.keys(obj.vectors)){
      const v = obj.vectors[lang];
      const score = cosine(qv, v);
      const item = obj.texts || {};
      hits.push({ id: obj.id, lang, text: item[lang] || "", score, item });
    }
  }
  hits.sort((a,b)=>b.score - a.score);
  const top = hits.slice(0, topk);
  return res.status(200).json({ q: text, hits: top });
}
