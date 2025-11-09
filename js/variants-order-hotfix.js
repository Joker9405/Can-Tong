// variants-order-hotfix.js (v2)
(function () {
  function q(sel, ctx=document){ return ctx.querySelector(sel); }
  function qa(sel, ctx=document){ return Array.from(ctx.querySelectorAll(sel)); }
  const hasCN = s => /[\u4E00-\u9FFF]/.test(String(s||''));
  const hasEN = s => /[A-Za-z]/.test(String(s||''));

  function findHint(container){
    const hint =
      q('.hint', container) ||
      q('.badge', container) ||
      q('.top-hint', container) ||
      q('[data-role="hint"]', container) ||
      q('[data-type="hint"]', container) ||
      container.firstElementChild;
    return hint || null;
  }

  function normalizeTwoLinesFromHTML(el){
    const html = el.innerHTML;
    const parts = String(html).replace(/<br\s*\/?>/gi, '\n').split(/\n+/).map(s=>s.trim()).filter(Boolean);
    if (parts.length >= 2){
      let en = parts.find(p=>hasEN(p));
      let cn = parts.find(p=>hasCN(p));
      if (!en) en = parts[0];
      if (!cn) cn = parts[1] || '';
      el.innerHTML = `<div class="en">${en}</div><div class="chs">${cn}</div>`;
      return true;
    }
    return false;
  }

  function swapHint(container){
    const hint = findHint(container);
    if (!hint) return;

    let kids = qa(':scope > *', hint).filter(n=>n.nodeType===1);
    if (kids.length < 2){
      if (!normalizeTwoLinesFromHTML(hint)){
        return;
      }
    }
    kids = qa(':scope > *', hint).filter(n=>n.nodeType===1);
    if (kids.length < 2) return;

    let enEl = q(':scope > .en', hint) || kids.find(k => hasEN(k.textContent));
    let cnEl = q(':scope > .chs', hint) || kids.find(k => hasCN(k.textContent));
    if (!enEl && !cnEl) return;

    if (enEl && enEl !== hint.firstElementChild){
      hint.insertBefore(enEl, hint.firstElementChild);
    }
    if (cnEl && cnEl !== hint.children[1]){
      hint.insertBefore(cnEl, hint.children[1] || null);
    }
  }

  function swapVariantGroups(container){
    const blocks = qa(':scope > *', container);
    let enBlock = null, cnBlock = null;
    for (const b of blocks){
      const title = (q('strong', b)?.textContent || '').trim();
      if (/Variants\s*\(EN\)/i.test(title)) enBlock = b;
      if (/变体（?中文）?/.test(title) || /变体.*中文/.test(title)) cnBlock = b;
    }
    if (enBlock && cnBlock){
      const enAfterCN = !!(enBlock.compareDocumentPosition(cnBlock) & Node.DOCUMENT_POSITION_FOLLOWING);
      if (enAfterCN){
        container.insertBefore(enBlock, cnBlock);
      }
    }
  }

  function run(){
    const container = q('#cardVariants') || q('.card.right.pink');
    if (!container) return;
    try{
      swapHint(container);
      swapVariantGroups(container);
    }catch(e){
      console.warn('[variants-order-hotfix v2] failed:', e);
    }
  }

  if (document.readyState === 'loading'){
    document.addEventListener('DOMContentLoaded', run);
  }else{
    run();
  }

  const mo = new MutationObserver((muts)=>{
    for (const m of muts){
      if (m.type === 'childList'){
        if ([m.target, ...m.addedNodes].some(n => n instanceof Element && (n.id === 'cardVariants' || n.classList?.contains('pink')))){
          run(); break;
        }
      }
    }
  });
  mo.observe(document.body, {childList:true, subtree:true});
})();