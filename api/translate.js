import fs from 'fs/promises';
import path from 'path';
import { kvGet, keyOf, norm } from './kv_basic.js';
import searchHandler from './search.js';

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({error:'Method not allowed'});
  const { text, src='zhh', tgt='chs', withSimilar=false } = req.body || {};
  const t = norm(text);
  let out = text || '';
  let matched = false;
  try{
    const basicKV = await kvGet(keyOf(src, t));
    if(basicKV && basicKV[tgt]){
      matched = true;
      out = basicKV[tgt];
    }else{
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
  }catch(e){}
  let similar = [];
  if(withSimilar){
    const fakeReq = { method:'GET', query: { text, topk: 8 } };
    const container = { payload:null, code:200 };
    const fakeRes = { status:(c)=>({ json:(o)=>{ container.code=c; container.payload=o; } }) };
    await searchHandler(fakeReq, fakeRes);
    if(container.payload?.hits) similar = container.payload.hits;
  }
  return res.status(200).json({ text: out, meta: { src, tgt, matched }, similar });
}
