export default async function handler(req,res){
  if(req.method!=='POST') return res.status(405).json({error:'Method Not Allowed'});
  try{
    const url=process.env.BACKEND_URL;
    if(!url) return res.status(500).json({error:'Missing BACKEND_URL env'});
    const r=await fetch(url.replace(/\/$/,'')+'/api/translate',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(req.body||{})});
    const data=await r.json();
    res.setHeader('Access-Control-Allow-Origin','*');
    res.status(r.ok?200:500).json(data);
  }catch(e){ res.status(500).json({error:String(e)}) }
}