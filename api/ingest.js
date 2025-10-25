// api/ingest.js
export const config = { api: { bodyParser: { sizeLimit: '4mb' } } };

const isLatin = s => /[A-Za-z]/.test(s);
const isCJK = s => /[\u4E00-\u9FFF]/.test(s);
const isCantoneseHeur = s => /[唔咗冇啲嘅嗰哋喺嚟咁啦啱邊咩哇喎]/.test(s);

function srtToLines(srt){
  const lines = (srt||'').split(/\r?\n/);
  const texts=[];
  for(const line of lines){
    if(/^\d+$/.test(line)) continue;
    if(/\d+:\d+:\d+/.test(line)) continue;
    const t=line.trim(); if(t) texts.push(t);
  }
  return texts;
}
function stripHtml(html){
  return (html||'').replace(/<script[\s\S]*?<\/script>/gi,'')
                   .replace(/<style[\s\S]*?<\/style>/gi,'')
                   .replace(/<[^>]+>/g,' ')
                   .replace(/\s+/g,' ')
                   .trim();
}
function splitSentences(text){
  return (text||'').split(/[。！？!?\n\r]+/).map(x=>x.trim()).filter(Boolean);
}
function langOf(s){
  if(!s) return 'unknown';
  if(isLatin(s) && !isCJK(s)) return 'en';
  if(isCantoneseHeur(s)) return 'zhh';
  if(isCJK(s)) return 'chs';
  return 'unknown';
}
function buildPairs(lines){
  const entries=[];
  for(let i=0;i<lines.length;i++){
    const w = lines.slice(i, i+3);
    const bucket = { zhh:[], chs:[], en:[] };
    for(const t of w){
      const L = langOf(t);
      if(L==='zhh') bucket.zhh.push(t);
      else if(L==='chs') bucket.chs.push(t);
      else if(L==='en') bucket.en.push(t);
    }
    const ok = (bucket.zhh.length + bucket.chs.length + bucket.en.length) >= 2;
    if(ok){
      entries.push({
        zhh: bucket.zhh.join(' / ') || '',
        chs: bucket.chs.join(' / ') || '',
        en: bucket.en.join(' / ') || ''
      });
      i += 2;
    }
  }
  return dedupe(entries);
}
function dedupe(arr){
  const seen=new Set(); const out=[];
  for(const it of arr){
    const key=[it.zhh,it.chs,it.en].join('|').toLowerCase();
    if(seen.has(key)) continue; seen.add(key); out.push(it);
  }
  return out;
}

export default async function handler(req,res){
  if(req.method!=='POST') return res.status(405).json({error:'Method not allowed'});
  const { urls=[], texts=[], srt=[] } = req.body || {};
  const lines=[];

  for(const u of urls){
    try{
      const r = await fetch(u);
      const ct = r.headers.get('content-type') || '';
      const raw = await r.text();
      if(ct.includes('html')) lines.push(...splitSentences(stripHtml(raw)));
      else lines.push(...splitSentences(raw));
    }catch(e){}
  }
  for(const t of texts){ lines.push(...splitSentences(t)); }
  for(const s of srt){ lines.push(...srtToLines(s)); }

  const entries = buildPairs(lines).slice(0, 500);
  return res.status(200).json({ entries, count: entries.length });
}
