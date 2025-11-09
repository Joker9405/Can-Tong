// variants-order-hotfix.js
(function () {
  function q(sel, ctx = document) { return ctx.querySelector(sel); }
  function qa(sel, ctx = document) { return Array.from(ctx.querySelectorAll(sel)); }

  function swapHint(container) {
    const hint = q('.hint', container) || container.firstElementChild;
    if (!hint) return;
    const kids = qa(':scope > *', hint).filter(el => el.nodeType === 1);
    if (kids.length >= 2) {
      let enEl = q(':scope > .en', hint) || kids.find(k => /[A-Za-z]/.test(k.textContent));
      let cnEl = q(':scope > .chs', hint) || kids.find(k => /[\u4E00-\u9FFF]/.test(k.textContent));
      if (enEl && cnEl && enEl !== kids[0]) {
        hint.insertBefore(enEl, kids[0]);
      }
      const second = hint.children[1];
      if (cnEl && second !== cnEl) {
        hint.insertBefore(cnEl, hint.children[1] || null);
      }
    }
  }

  function swapGroups(container) {
    const blocks = qa(':scope > div, :scope > section, :scope > article, :scope > *', container);
    let enBlock = null, cnBlock = null;
    for (const b of blocks) {
      const strongText = (q('strong', b)?.textContent || '').trim();
      if (/Variants\s*\(EN\)/i.test(strongText)) enBlock = b;
      if (/变体（?中文）?/.test(strongText)) cnBlock = b;
    }
    if (enBlock && cnBlock && enBlock.compareDocumentPosition(cnBlock) & Node.DOCUMENT_POSITION_FOLLOWING) {
      container.insertBefore(enBlock, cnBlock);
    }
  }

  function run() {
    const container = q('#cardVariants') || q('.card.right.pink');
    if (!container) return;
    try {
      swapHint(container);
      swapGroups(container);
    } catch (e) {
      console.warn('[variants-order-hotfix] failed:', e);
    }
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', run);
  } else {
    run();
  }

  const mo = new MutationObserver((muts) => {
    for (const m of muts) {
      if (m.type === 'childList') {
        if ([m.target, ...m.addedNodes].some(n => n instanceof Element && (n.id === 'cardVariants' || n.classList?.contains('pink')))) {
          run();
          break;
        }
      }
    }
  });
  mo.observe(document.body, { childList: true, subtree: true });
})();