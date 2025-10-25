export default async function handler(req, res){
  if(req.method!=='POST') return res.status(405).json({error:'Method not allowed'});
  const { texts = [], srt = '' } = req.body || {};
  const entries = [];
  const pushEntry = (zhh, chs, en) => {
    const obj = { zhh: (zhh||'').trim(), chs: (chs||'').trim(), en: (en||'').trim() };
    const filled = ['zhh','chs','en'].filter(k=>obj[k]).length;
    if(filled >= 2) entries.push(obj);
  };
  for(const t of texts){
    const lines = String(t).split(/\r?\n/);
    let cur = { zhh:'', chs:'', en:'' };
    for(const line of lines){
      const m = line.match(/^\s*(zhh|chs|en)\s*[:：]\s*(.+)$/i);
      if(m){ cur[m[1].toLowerCase()] = m[2].trim(); }
      else if(line.trim()===''){ pushEntry(cur.zhh, cur.chs, cur.en); cur={zhh:'',chs:'',en:''}; }
    }
    pushEntry(cur.zhh, cur.chs, cur.en);
  }
  if(srt){
    const clean = srt.split(/\r?\n/).filter(l=>!/^\d+$/.test(l) && !/-->/.test(l)).join(' ');
    const bits = clean.split(/[。！？!?]/).map(x=>x.trim()).filter(Boolean);
    for(const b of bits){
      const hasLatin = /[a-zA-Z]/.test(b);
      const hasCJK = /[\u4e00-\u9fff]/.test(b);
      if(hasLatin && hasCJK){}
      else if(hasLatin){ pushEntry('', '', b); }
      else if(hasCJK){ pushEntry(b, b, ''); }
    }
  }
  return res.status(200).json({ entries, count: entries.length });
}