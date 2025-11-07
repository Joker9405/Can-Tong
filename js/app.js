// CanTongMVP DOM-only patch v6.8 — removes example CTA after expand, hides on home.
// Safe to include after /js/app.js; does not modify your app logic.
(function () {
  const q = (sel, root=document) => root.querySelector(sel);
  const qa = (sel, root=document) => Array.from(root.querySelectorAll(sel));

  const state = {
    removed: false
  };

  function els() {
    return {
      grid: q('#grid'),
      expCtl: q('#expCtl'),
      examples: q('#examples') || q('.exampleswrap')
    };
  }

  function hideCTA(ctl) {
    if (!ctl) return;
    ctl.style.display = 'none';
  }
  function showCTA(ctl) {
    if (!ctl) return;
    if (state.removed) return; // after expand we never show again until reload/new search
    ctl.style.removeProperty('display');
    ctl.hidden = false;
  }
  function removeCTA(ctl) {
    if (!ctl || state.removed) return;
    state.removed = true;
    try { ctl.remove(); } catch(e){ ctl.hidden = true; }
  }

  function onInitial() {
    const { grid, expCtl } = els();
    // Home page: if no search results (no cards), keep example hidden
    if (!grid || grid.children.length === 0) {
      hideCTA(expCtl);
    }
  }

  function onAfterSearch() {
    const { grid, expCtl, examples } = els();
    if (!grid) return;

    const hasCards = grid.children.length > 0;
    const examplesEmpty = !examples || examples.children.length === 0;
    if (hasCards && examplesEmpty && !state.removed) {
      showCTA(expCtl);
    }
  }

  function attachClickToCTA() {
    const { expCtl, examples } = els();
    if (!expCtl) return;
    expCtl.addEventListener('click', function (e) {
      // Wait for examples to be rendered by app.js, then remove CTA.
      setTimeout(() => {
        const { examples: ex2 } = els();
        if (ex2 && ex2.children.length > 0) {
          removeCTA(expCtl);
        }
      }, 30);
    }, { capture: false });
  }

  function observeExamples() {
    const { examples, expCtl } = els();
    if (!examples) return;
    const mo = new MutationObserver(() => {
      // If examples got content, nuke CTA and stop observing.
      const hasContent = examples.children.length > 0;
      if (hasContent) {
        removeCTA(expCtl);
        mo.disconnect();
      }
    });
    mo.observe(examples, { childList: true, subtree: false });
  }

  // Observe grid so we can detect "after search" moment even if app.js re-renders.
  function observeGrid() {
    const { grid } = els();
    if (!grid) return;
    const mo = new MutationObserver(() => onAfterSearch());
    mo.observe(grid, { childList: true, subtree: false });
  }

  function boot() {
    onInitial();
    onAfterSearch();
    attachClickToCTA();
    observeExamples();
    observeGrid();
    // Also handle route-refresh / app-level redraws with a timer safety.
    // (Harmless, cheap — runs a few times and settles)
    let tick = 0;
    const iv = setInterval(() => {
      onAfterSearch();
      tick += 1;
      if (tick > 40) clearInterval(iv); // ~1.2s total if 30ms tick
    }, 30);
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', boot, { once: true });
  } else {
    boot();
  }
})();
