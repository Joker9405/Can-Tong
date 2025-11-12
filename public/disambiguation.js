(function(){
  const PATHS = {
    lexeme: ['../data/lexeme.csv', '../data/seed.csv'],
    crossmap: ['../data/crossmap.csv'],
  };

  function norm(s) { return (s||'').toLowerCase().trim().replace(/\s+/g,''); }

  function csvParse(txt){
    const lines = txt.split(/\r?\n/).filter(x=>x.trim().length);
    if(!lines.length) return [];
    const header = lines.shift().split(',').map(h=>h.trim());
    return lines.map(line=>{
      const cols = line.split(',');
      const obj = {};
      header.forEach((h,i)=> obj[h] = (cols[i]||'').trim());
      return obj;
    });
  }

  async function loadFirst(paths){
    for(const p of paths){
      try{
        const res = await fetch(p + '?t=' + Date.now());
        if(res.ok){
          const txt = await res.text();
          const rows = csvParse(txt);
          if(rows && rows.length) return rows;
        }
      }catch{}
    }
    return [];
  }

  function autodetectCrossmap(row){
    const term = row.term || row.key || row.query || '';
    const id = row.lexeme_id || row.id || row.dst_id || '';
    return { term, id };
  }

  function buildMask(){
    const mask = document.createElement('div');
    mask.className = 'cantong-mask';
    mask.innerHTML = '<div class="cantong-panel">\
      <button class="cantong-close">关闭</button>\
      <h3 class="cantong-title"></h3>\
      <div class="cantong-hint">此关键词在 crossmap 中对应多个词条，请选择一个：</div>\
      <div class="cantong-list"></div>\
    </div>';
    mask.querySelector('.cantong-close').addEventListener('click', ()=> hide(mask));
    mask.addEventListener('click', (e)=>{ if(e.target===mask) hide(mask); });
    document.body.appendChild(mask);
    return mask;
  }

  function show(mask){ mask.style.display = 'block'; }
  function hide(mask){ mask.style.display = 'none'; }

  function ui(mask, termKey, rows, onPick){
    mask.querySelector('.cantong-title').textContent = '选择与「' + termKey + '」相关的 zhh';
    const list = mask.querySelector('.cantong-list');
    list.innerHTML = rows.map(r => '<div class="cantong-opt" data-id="' + (r.id||'') + '">' + (r.zhh||'(未命名)') + ' <small>#' + (r.id||'') + '</small></div>').join('');
    list.querySelectorAll('.cantong-opt').forEach(el => {
      el.addEventListener('click', ()=>{
        const id = el.getAttribute('data-id');
        const row = rows.find(x => (x.id||'')===id);
        hide(mask);
        if(onPick) onPick({ id: id, row: row });
        document.dispatchEvent(new CustomEvent('cantong:pickLexeme', { detail: { id: id, row: row } }));
      });
    });
    show(mask);
  }

  const Disambig = {
    async init(options){
      options = options || {};
      const cfg = {
        getQuery: options.getQuery || function(){ return (document.querySelector('#q')?.value || '').trim(); },
        onPick: options.onPick || null,
        mount: options.mount || document.body,
      };

      // Load data
      const lexeme = await loadFirst(PATHS.lexeme);
      const byId = new Map();
      for(const r of lexeme) if(r.id) byId.set(String(r.id).trim(), r);

      const cross = await loadFirst(PATHS.crossmap);
      const map = new Map(); // termKey -> [ids]
      for(const row of cross){
        const ad = autodetectCrossmap(row);
        const term = ad.term, id = ad.id;
        if(!term || !id) continue;
        const key = norm(term);
        if(!map.has(key)) map.set(key, []);
        map.get(key).push(String(id).trim());
      }

      // Prepare mask
      const mask = buildMask();

      async function maybeDisambiguate(rawQuery){
        const q = (rawQuery!=null ? rawQuery : cfg.getQuery()).trim();
        if(!q) return false;
        const key = norm(q);
        if(!map.has(key)) return false;
        const ids = map.get(key).filter(id => byId.has(id));
        const uniq = Array.from(new Set(ids));
        if(uniq.length <= 1) return false;
        const rows = uniq.map(id => byId.get(id)).filter(Boolean);
        if(!rows.length) return false;
        ui(mask, q, rows, cfg.onPick);
        return true;
      }

      // Hook default search UI if present
      const $q = document.querySelector('#q');
      const $btn = document.querySelector('#btnSearch');
      if($q){
        $q.addEventListener('keydown', async function(e){
          if(e.key==='Enter'){
            const handled = await maybeDisambiguate($q.value);
            if(handled) e.preventDefault();
          }
        });
      }
      if($btn){
        $btn.addEventListener('click', async function(e){
          const handled = await maybeDisambiguate();
          if(handled) e.preventDefault();
        }, true);
      }

      // Expose API
      window.Disambig = Object.assign({}, window.Disambig || {}, {
        maybe: maybeDisambiguate,
        init: Disambig.init
      });
    }
  };

  window.Disambig = Disambig;
})();