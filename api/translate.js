import fs from 'fs/promises';
import path from 'path';
import { kvGet, keyOf, norm } from './kv.js';

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({error:'Method not allowed'});
  const { text, src='zhh', tgt='chs' } = req.body || {};
  const t = norm(text);
  let out = text || '';
  let matched = false;
  try{
    // 1) KV first (private)
    const hit = await kvGet(keyOf(src, t));
    if(hit && hit[tgt]){
      matched = true;
      out = hit[tgt];
    }else{
      // 2) fallback to public lexicon.json
      const base = path.join(process.cwd(), 'public', 'lexicon.json');
      const raw = await fs.readFile(base, 'utf8');
      const lex = JSON.parse(raw);
      const arr = Object.values(lex);
      const item = arr.find(it => (it[src]||'').trim().toLowerCase() === t);
      if(item && item[tgt]){
        matched = true;
        out = item[tgt];
      }
    }
  }catch(e){
    // ignore
  }
  return res.status(200).json({ text: out, meta: { src, tgt, matched } });
}
