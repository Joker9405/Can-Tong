const url=process.env.KV_REST_API_URL;const token=process.env.KV_REST_API_TOKEN||process.env.KV_REST_API_READ_ONLY_TOKEN;
export async function kvCmd(cmdArr){if(!url||!token)throw new Error('Missing KV env');const r=await fetch(url,{method:'POST',headers:{Authorization:`Bearer ${token}`,'Content-Type':'application/json'},body:JSON.stringify({command:cmdArr})});if(!r.ok)throw new Error('KV error '+r.status);return r.json();}
export async function kvGet(key){const j=await kvCmd(['GET',key]);return j.result?JSON.parse(j.result):null;}
export async function kvSet(key,val){return kvCmd(['SET',key,JSON.stringify(val)]);}
export function norm(s){return (s||'').trim().toLowerCase();}
export function keyOf(lang,text){return `ct:pair:${lang}:${norm(text)}`;}
export function embKey(lang,text){return `ct:emb:${lang}:${norm(text)}`;}
export async function scanEmbKeys(limit=400){let cursor='0';let keys=[];do{const r=await kvCmd(['SCAN',cursor,'MATCH','ct:emb:*','COUNT','200']);cursor=r.result[0];const batch=r.result[1]||[];keys.push(...batch);}while(cursor!=='0'&&keys.length<limit);return keys.slice(0,limit);}
