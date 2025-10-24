import { kvSet, keyOf } from './kv.js';

const ADMIN_KEY = process.env.ADMIN_API_KEY || '';

function sanitize(it){
  const out = { zhh: (it.zhh||'').trim(), chs: (it.chs||'').trim(), en: (it.en||'').trim() };
  const count = ['zhh','chs','en'].filter(k => out[k]).length;
  return count >= 2 ? out : null;
}

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({error:'Method not allowed'});
  if(!ADMIN_KEY || (req.headers['x-api-key'] !== ADMIN_KEY)){
    return res.status(401).json({ error: 'Unauthorized' });
  }
  const body = req.body || {};
  const entries = Array.isArray(body.entries) ? body.entries : [];
  let ok = 0, fail = 0;
  for(const raw of entries){
    const it = sanitize(raw);
    if(!it){ fail++; continue; }
    const langs = ['zhh','chs','en'];
    const present = langs.filter(k => it[k]);
    for(const lang of present){
      await kvSet(keyOf(lang, it[lang]), it);
    }
    ok++;
  }
  return res.status(200).json({ ok, fail });
}
