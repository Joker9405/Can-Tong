\
/*! patch.v7.3.js — DOM-level patch to enforce the 7 rules without touching your renderer */
(function(){
  const $ = (sel, root=document) => root.querySelector(sel);
  const $$ = (sel, root=document) => Array.from(root.querySelectorAll(sel));

  const S = {
    grid:    '#grid',
    examples:'#examples',
    expCtl:  '#expCtl',
    foot:    'footer.foot'
  };

  function setEmptyMode(on){
    document.body.classList.toggle('ct-empty', !!on);
  }

  // 1 & 2. Initial state => only search box (assume search box always visible in header)
  setEmptyMode(true);
  const gridEl = $(S.grid);
  const exEl   = $(S.examples);
  const ctlEl  = $(S.expCtl);

  // Helper: has results?
  function hasResults(){
    if(!gridEl) return false;
    // A result exists if there's at least one left yellow card title
    return !!gridEl.querySelector('.card.yellow, .card.left, .yellow.left');
  }

  // 3. When search hit => show three cards + show expand button
  function syncState(){
    const hit = hasResults();
    const examplesOpen = exEl && exEl.children.length > 0;
    if(!hit){
      // 5. Search miss => hide everything except search
      setEmptyMode(true);
      if(ctlEl) ctlEl.style.display = 'none';
      if(exEl) exEl.style.display = 'none';
      if(gridEl) gridEl.style.display = 'none';
      return;
    }
    // Hit:
    setEmptyMode(false);
    if(gridEl) gridEl.style.removeProperty('display');

    // 4. If examples open => hide expand button; else show it
    if(ctlEl){
      if(examplesOpen){
        ctlEl.style.display = 'none';
      }else{
        ctlEl.style.display = 'block';
        // make sure the button exists and is aligned
        ensureExpandButton();
      }
    }
  }

  function ensureExpandButton(){
    const btn = $('button[data-role="expand-examples"], .btn-exp', ctlEl || document);
    if(!btn) return;
    // align to right; CSS handles layout
  }

  // 7. Ensure each zhh alias row has a TTS button
  function ensureAliasSpeakers(){
    // We look for rows under left yellow card
    $$('.card.yellow .row, .yellow.left .row').forEach(row=>{
      const hasIcon = row.querySelector('button.tts, .tts-head, .tts-btn, [data-role="tts"]');
      if(!hasIcon){
        const b = document.createElement('button');
        b.className = 'tts';
        b.setAttribute('title','发音');
        b.innerHTML = '<svg viewBox="0 0 24 24" width="18" height="18" aria-hidden="true"><path d="M3 10v4h4l5 5V5L7 10H3zm13-2.5a3.5 3.5 0 010 7V13a1.5 1.5 0 000-3V7.5zm0-4a7.5 7.5 0 010 15V16a4.5 4.5 0 000-9V3.5z"/></svg>';
        // use your existing speak() if present; fallback no-op
        b.addEventListener('click', ()=>{
          try{
            const text = (row.textContent || '').trim();
            if(typeof window.speak==='function'){
              window.speak(text, 'zhh');
            }
          }catch(e){}
        });
        row.appendChild(b);
      }
    });
  }

  // Observe grid/examples changes produced by your renderer
  const mo = new MutationObserver(()=>{
    ensureAliasSpeakers();
    syncState();
  });
  if(gridEl) mo.observe(gridEl, {childList:true, subtree:true});
  if(exEl)   mo.observe(exEl,   {childList:true, subtree:true});

  // Also hide the expand button immediately after examples appear (user clicked)
  const moCtl = new MutationObserver(()=> syncState());
  if(ctlEl) moCtl.observe(ctlEl, {attributes:true, childList:true, subtree:true});

  // Try initial
  ensureAliasSpeakers();
  syncState();

  // Footer cleanliness (rule 6): ensure it stays at bottom and no empty spacers
  const foot = $(S.foot);
  if(foot){
    foot.classList.add('foot-fixed');
  }
})();