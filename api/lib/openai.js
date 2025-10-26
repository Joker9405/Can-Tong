export async function embed(text){
  const apiKey = process.env.OPENAI_API_KEY;
  if(!apiKey) throw new Error('Missing OPENAI_API_KEY');
  const r = await fetch('https://api.openai.com/v1/embeddings', {
    method: 'POST',
    headers: { 'Authorization': `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ input: text, model: 'text-embedding-3-small' })
  });
  if(!r.ok){ const t = await r.text(); throw new Error('Embedding failed: ' + t); }
  const j = await r.json();
  return j.data[0].embedding;
}
export function cosine(a,b){
  let dot=0,na=0,nb=0;
  for(let i=0;i<a.length;i++){ const x=a[i], y=b[i]; dot+=x*y; na+=x*x; nb+=y*y; }
  return dot/(Math.sqrt(na)*Math.sqrt(nb)+1e-12);
}
