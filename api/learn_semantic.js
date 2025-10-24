import { kvSet, keyEntry, keyVec } from './kv.js';

const ADMIN_KEY = process.env.ADMIN_API_KEY || '';
const OPENAI_API_KEY = process.env.OPENAI_API_KEY || '';
const MODEL = process.env.EMBED_MODEL || 'text-embedding-3-small';

function clean(it){
  return { zhh:(it.zhh||'').trim(), chs:(it.chs||'').trim(), en:(it.en||'').trim() };
}
function has2(out){ return ['zhh','chs','en'].filter(k=>out[k]).length >= 2; }

async function embedMany(texts){
  const inputs = texts.map(t => t || "");
  const r = await fetch("https://api.openai.com/v1/embeddings", {
    method:"POST",
    headers:{ "Authorization": `Bearer ${OPENAI_API_KEY}`, "Content-Type":"application/json" },
    body: JSON.stringify({ model: MODEL, input: inputs })
  });
  if(!r.ok){ throw new Error("Embedding API error " + r.status); }
  const j = await r.json();
  return j.data.map(d => d.embedding);
}

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({error:'Method not allowed'});
  if(!ADMIN_KEY || (req.headers['x-api-key'] !== ADMIN_KEY)){
    return res.status(401).json({ error: 'Unauthorized' });
  }
  if(!OPENAI_API_KEY){
    return res.status(400).json({ error: 'Missing OPENAI_API_KEY' });
  }
  const entries = Array.isArray(req.body?.entries) ? req.body.entries : [];
  let ok=0, fail=0, ids=[];
  for(const raw of entries){
    const it = clean(raw);
    if(!has2(it)){ fail++; continue; }
    const id = (typeof crypto!=='undefined' && crypto.randomUUID) ? crypto.randomUUID() : String(Date.now()) + Math.random().toString(16).slice(2);
    const present = ['zhh','chs','en'].filter(k => it[k]);
    const texts = present.map(k => it[k]);
    let vecs = {};
    try{
      const emb = await embedMany(texts);
      present.forEach((lang, i) => { vecs[lang] = emb[i]; });
    }catch(e){
      fail++; continue;
    }
    await kvSet(keyEntry(id), { id, ...it });
    await kvSet(keyVec(id), { id, vectors: vecs, texts: it });
    ids.push(id); ok++;
  }
  return res.status(200).json({ ok, fail, ids });
}
