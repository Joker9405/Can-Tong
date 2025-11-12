
const Q = document.getElementById('q');
const BTN = document.getElementById('btnSearch');
const chipsEl = document.getElementById('chips');
const cardMain = document.getElementById('card-main');
const zhhText = document.getElementById('zhhText');
const chsText = document.getElementById('chsText');
const enText = document.getElementById('enText');
const variantsBox = document.getElementById('variantsBox');
const notesBox = document.getElementById('notesBox');
const emptyEl = document.getElementById('empty');
const errEl = document.getElementById('error');
const pinkGuide = document.getElementById('pinkGuide');
const speakBtn = document.getElementById('speakBtn');

let LEXEME = new Map(); // id -> lexeme row
let CROSS = [];         // {term, target_id}

const CSV_OPTS = {header:true, skipEmptyLines:true, transformHeader: h => h.trim(), dynamicTyping:false};

function absolute(path){ return `${path}?v=${window.__BUILD_TS__}`; }

async function loadCSV(url){
  return new Promise((resolve, reject)=>{
    Papa.parse(absolute(url), {
      ...CSV_OPTS,
      download:true,
      fastMode:true,
      error: err => reject(err),
      complete: res => resolve(res.data),
    });
  });
}

function normalize(s){
  return (s || '').toString().trim().toLowerCase();
}

function unique(arr){
  return Array.from(new Set(arr));
}

function buildIndexes(lexRows, crossRows){
  // Map lexeme by id
  LEXEME.clear();
  for(const r of lexRows){
    const id = (r.id || r.ID || r.Id || '').toString().trim();
    if(!id) continue;
    LEXEME.set(id, {
      id,
      zhh: r.zhh || r.yue || r['粵語'] || '',
      chs: r.chs || r.zh || r['中文'] || '',
      en:  r.en || r['English'] || '',
      variants_chs: r.variants_chs || r['variants_zhh'] || r['variants'] || '',
      variants_en: r.variants_en || '',
      notes: r.notes || r.note || r['備註'] || ''
    });
  }
  // Crossmap rows
  CROSS = [];
  for(const c of crossRows){
    const term = c.term ?? c.Term ?? c['詞條'] ?? c['term'];
    const tid  = c.target_id ?? c.target ?? c['target'] ?? c['targetId'] ?? c['target_id'];
    if(!term || !tid) continue;
    CROSS.push({ term: String(term), target_id: String(tid) });
  }
}

function searchByCross(term){
  const key = normalize(term);
  if(!key) return [];

  // 1) exact match by crossmap.term
  let exact = CROSS.filter(r => normalize(r.term) === key).map(r => r.target_id);

  // 2) if none, fallback to contains()
  if(exact.length === 0){
    exact = CROSS.filter(r => normalize(r.term).includes(key)).map(r => r.target_id);
  }

  // Map to lexeme
  const ids = unique(exact).filter(id => LEXEME.has(id));
  return ids.map(id => LEXEME.get(id));
}

function fallbackSearchLexeme(term){
  const key = normalize(term);
  const results = [];
  for(const row of LEXEME.values()){
    const hay = [row.zhh, row.chs, row.en].map(normalize).join(' || ');
    if(hay.includes(key)) results.push(row);
  }
  return results.slice(0, 30);
}

function renderChips(rows, activeId){
  chipsEl.innerHTML = '';
  if(rows.length <= 1){ pinkGuide.classList.add('hidden'); return; }
  pinkGuide.classList.remove('hidden');

  rows.forEach(row => {
    const btn = document.createElement('button');
    btn.className = 'chip' + (row.id === activeId ? ' active' : '');
    btn.textContent = row.zhh || row.chs || row.en || ('#' + row.id);
    btn.dataset.id = row.id;
    btn.addEventListener('click', () => {
      renderMain(row);
      renderChips(rows, row.id);
    });
    chipsEl.appendChild(btn);
  });
}

function renderMain(row){
  if(!row){ cardMain.classList.add('hidden'); return; }
  emptyEl.classList.add('hidden');
  cardMain.classList.remove('hidden');

  zhhText.textContent = row.zhh || '（無粵語）';
  chsText.textContent = row.chs || '—';
  enText.textContent  = row.en  || '—';

  // Variants (if any)
  const vchs = row.variants_chs ? String(row.variants_chs).split(/[,;、|]/).map(s=>s.trim()).filter(Boolean) : [];
  const ven  = row.variants_en ? String(row.variants_en).split(/[,;、|]/).map(s=>s.trim()).filter(Boolean) : [];
  const blocks = [];
  if(vchs.length){
    blocks.push(`<div><b>中文變體：</b> ${vchs.map(x=>`<span class="chip">${x}</span>`).join(' ')}</div>`);
  }
  if(ven.length){
    blocks.push(`<div><b>英文變體：</b> ${ven.map(x=>`<span class="chip">${x}</span>`).join(' ')}</div>`);
  }
  if(blocks.length){
    variantsBox.innerHTML = blocks.join('');
    variantsBox.classList.remove('hidden');
  }else{
    variantsBox.classList.add('hidden');
    variantsBox.innerHTML = '';
  }

  // Notes
  if(row.notes){
    notesBox.textContent = row.notes;
    notesBox.classList.remove('hidden');
  }else{
    notesBox.classList.add('hidden');
    notesBox.textContent = '';
  }

  // Speak
  speakBtn.onclick = () => speakYue(row.zhh || row.chs || '');
}

function speakYue(text){
  try{
    const utter = new SpeechSynthesisUtterance(text);
    // Try to pick Cantonese voice if available
    const pick = (window.speechSynthesis.getVoices() || []).find(v => /yue|zh[-_]hk/i.test(v.lang));
    if(pick) utter.voice = pick;
    utter.rate = 0.95;
    speechSynthesis.cancel();
    speechSynthesis.speak(utter);
  }catch(e){ console.warn('speech error', e); }
}

async function boot(){
  try{
    // Fetch CSVs with no-cache semantics
    const [lexRows, crossRows] = await Promise.all([
      loadCSV('/data/lexeme.csv'),
      loadCSV('/data/crossmap.csv')
    ]);
    buildIndexes(lexRows, crossRows);
  }catch(e){
    errEl.textContent = '數據文件讀取失敗：' + (e?.message || e);
    errEl.classList.remove('hidden');
    return;
  }

  function doSearch(){
    const term = Q.value.trim();
    if(!term){ emptyEl.classList.remove('hidden'); return; }
    const rows = searchByCross(term);
    const list = rows.length ? rows : fallbackSearchLexeme(term);

    if(list.length === 0){
      chipsEl.innerHTML = '';
      pinkGuide.classList.add('hidden');
      renderMain(null);
      emptyEl.textContent = '未找到，換個關鍵詞試試。';
      emptyEl.classList.remove('hidden');
      return;
    }

    // Initial active row: prefer exact zhh/chS/en match
    const active = list[0];
    renderChips(list, active.id);
    renderMain(active);
  }

  BTN.addEventListener('click', doSearch);
  Q.addEventListener('keydown', (e)=>{ if(e.key === 'Enter') doSearch(); });
}

boot();
