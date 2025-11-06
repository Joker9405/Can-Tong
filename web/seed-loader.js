(function(){
  async function fetchSeed(){
    const res = await fetch('/data/seed.csv', {cache:'no-store'});
    if(!res.ok) throw new Error('seed.csv not found');
    const text = await res.text();
    const lines = text.split(/\r?\n/).filter(Boolean);
    const header = lines.shift().split(',').map(s=>s.trim().toLowerCase());
    const idx = { chs: header.indexOf('chs'), zhh: header.indexOf('zhh'), en: header.indexOf('en') };
    const rows = lines.map(l=>l.split(',')).map(parts=>({chs:parts[idx.chs]||'', zhh:parts[idx.zhh]||'', en:parts[idx.en]||''}));
    return rows;
  }
  function norm(s){ return (s||'').trim().toLowerCase(); }
  function search(rows, q){
    const nq = norm(q);
    let best = rows.find(r=>[r.chs,r.zhh,r.en].some(v=>norm(v)===nq));
    if(!best){
      best = rows.find(r=>[r.chs,r.zhh,r.en].some(v=>norm(v).includes(nq)));
    }
    const candidates = rows.filter(r=>best && norm(r.en)===norm(best.en)).slice(0,8);
    return {best, candidates};
  }
  function ensureResultPanel(){
    let panel = document.getElementById('funwa-result');
    if(!panel){
      panel = document.createElement('div');
      panel.id = 'funwa-result';
      panel.style.marginTop = '16px';
      panel.style.lineHeight = '1.6';
      document.body.appendChild(panel);
    }
    return panel;
  }
  function render(panel, result){
    if(!result.best){ panel.innerHTML = '<em>No result</em>'; return; }
    let html = '<div><strong>Best</strong>: ' + result.best.zhh + ' ｜ ' + result.best.chs + ' ｜ ' + result.best.en + '</div>';
    if(result.candidates && result.candidates.length>1){
      html += '<div style="margin-top:8px;"><strong>Also:</strong><ul>' +
        result.candidates.filter(c=>c!==result.best).map(c=>'<li>'+c.zhh+' ｜ '+c.chs+' ｜ '+c.en+'</li>').join('') +
      '</ul></div>';
    }
    panel.innerHTML = html;
  }
  async function main(){
    const rows = await fetchSeed().catch(()=>null);
    if(!rows) return;
    const input = document.querySelector('input[type="text"], input:not([type])');
    const button = Array.from(document.querySelectorAll('button,input[type="button"],input[type="submit"]')).find(b=>/search/i.test(b.textContent||b.value||''));
    const panel = ensureResultPanel();
    function trigger(){
      const q = (input && input.value)||'';
      const r = search(rows, q);
      render(panel, r);
    }
    if(input){ input.addEventListener('keydown', (e)=>{ if(e.key==='Enter'){ e.preventDefault(); trigger(); } }); }
    if(button){ button.addEventListener('click', (e)=>{ e.preventDefault(); trigger(); }); }
  }
  if(document.readyState==='loading'){ document.addEventListener('DOMContentLoaded', main); } else { main(); }
})();
