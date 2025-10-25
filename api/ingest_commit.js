import { kvSet, keyOf, embKey, norm } from './kv.js';
import { embed } from './openai.js';

const ADMIN_KEY = process.env.ADMIN_API_KEY || '';

function splitVariants(s){ return (s||'').split(/\s*[,/|、]\s*/).map(x=>x.trim()).filter(Boolean); }

export default async function handler(req,res){
  if(req.method!=='POST') return res.status(405).json({error:'Method not allowed'});
  if(!ADMIN_KEY || (req.headers['x-api-key'] !== ADMIN_KEY)) return res.status(401).json({error:'Unauthorized'});

  const { entries = [] } = req.body || {};
  let ok=0, fail=0, wrote=0;

  for(const raw of entries){
    const z = splitVariants(raw.zhh||'');
    const c = splitVariants(raw.chs||'');
    const e = splitVariants(raw.en||'');
    const nonEmpty = [z.length>0, c.length>0, e.length>0].filter(Boolean).length;
    if(nonEmpty < 2){ fail++; continue; }
    const group = (e[0] && ('grp:'+norm(e[0]))) || ('grp:'+Date.now()+'-'+Math.random().toString(36).slice(2,8));
    const variants=[]; for(const t of z){variants.push({lang:'zhh',text:t,group});} for(const t of c){variants.push({lang:'chs',text:t,group});} for(const t of e){variants.push({lang:'en',text:t,group});}
    for(const v of variants){
      try{
        const vec = await embed(v.text);
        await kvSet(embKey(v.lang,v.text), { ...v, vec });
        const map = { zhh: z[0]||'', chs: c[0]||'', en: e[0]||'' };
        await kvSet(keyOf(v.lang,v.text), map);
        wrote++;
      }catch(e){}
    }
    ok++;
  }
  return res.status(200).json({ ok, fail, wrote });
}