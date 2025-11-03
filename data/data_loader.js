// data_loader.js — minimal CSV loader (简单场景，无第三方依赖)
export async function loadAllData(prefix = "/data") {
  async function fetchText(path){ const r = await fetch(path,{cache:"no-store"}); if(!r.ok) throw new Error(path); return r.text(); }
  function parseCSV(t){
    const L=t.replace(/\r\n/g,"\n").replace(/\r/g,"\n").split("\n").filter(Boolean);
    const H=L[0].split(",");
    return L.slice(1).map(line=>{
      const C=line.split(",");
      const o={}; H.forEach((h,i)=>o[h.trim()]=(C[i]||"").trim()); return o;
    });
  }
  const [lx, ex, mp] = await Promise.all([
    fetchText(`${prefix}/lexeme.csv`),
    fetchText(`${prefix}/examples.csv`),
    fetchText(`${prefix}/crossmap.csv`),
  ]);
  const lexemes = parseCSV(lx), examples = parseCSV(ex), crossmap = parseCSV(mp);
  const lexemeMap = new Map(lexemes.map(r=>[r.id,r]));
  const examplesMap = new Map(); for(const e of examples){ if(!examplesMap.has(e.lexeme_id)) examplesMap.set(e.lexeme_id,[]); examplesMap.get(e.lexeme_id).push(e); }
  const termIndex = new Map(); for(const m of crossmap){ const k=(m.term||'').toLowerCase(); if(!termIndex.has(k)) termIndex.set(k,[]); termIndex.get(k).push({id:m.target_id,kind:m.kind,lang:m.lang}); }
  return { lexemeMap, examplesMap, termIndex };
}
