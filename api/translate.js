import fs from 'fs/promises';
import path from 'path';
function normalize(s){ return (s||'').trim().toLowerCase(); }
export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({error:'Method not allowed'});
  const { text, src='zhh', tgt='chs' } = req.body || {};
  const base = path.join(process.cwd(), 'public', 'lexicon.json');
  let lex = {};
  try{
    const raw = await fs.readFile(base, 'utf8');
    lex = JSON.parse(raw);
  }catch(e){}
  const t = normalize(text);
  let out = text || '';
  const items = Object.values(lex);
  const hit = items.find(it => normalize(it[src]) === t);
  if(hit){
    out = hit[tgt] || text;
  }
  return res.status(200).json({ text: out, meta: { src, tgt, matched: !!hit } });
}
