/* Can-Tong single app.js (hotfix merged)
 * 说明：这是一个“最小改动”的合并版，只做 UI 顺序微调：
 *   - 粉色“变体”卡顶部黄色提示条：英文在上、中文在下（兼容 <br> 单元素换行写法）
 *   - “Variants (EN)” 分组排在 “变体（中文）” 分组之前
 * 不依赖其他新增脚本；可直接替换原 js/app.js 使用。
 * 如果你的原 app.js 还包含其他渲染逻辑，请把那部分保留在本文件“上方”或“下方”均可；
 * 本补丁是后置逻辑，不会影响既有功能。
 */

(function () {
  const CN_RE = /[\u4E00-\u9FFF]/;
  const EN_RE = /[A-Za-z]/;
  const q  = (sel, ctx=document) => ctx.querySelector(sel);
  const qa = (sel, ctx=document) => Array.from(ctx.querySelectorAll(sel));

  // 找到粉色“变体”卡根节点（尽量不中断现有结构）
  function locatePinkRoot() {
    return q('#cardVariants') || q('.card.right.pink') || q('.card.pink') || null;
  }

  // 判断是否接近黄色背景（用于兜底识别黄条）
  function isYellow(bg) {
    const m = String(bg||'').match(/rgb\(\s*(\d+)\s*,\s*(\d+)\s*,\s*(\d+)\s*\)/i);
    if (!m) return false;
    const [r,g,b] = m.slice(1).map(Number);
    return (r>230)&&(g>200)&&(b<170);
  }

  // 在粉卡内寻找“黄条”容器
  function findHint(root) {
    let el = q('.hint', root) || q('.badge', root) || q('[data-role="hint"]', root) || q('[data-type="hint"]', root);
    if (el) return el;
    // 兜底：找黄底且文本较短的元素
    const cand = qa('*', root).find(x => {
      try {
        const s = getComputedStyle(x);
        return isYellow(s.backgroundColor) && (x.textContent || '').trim().length < 160;
      } catch { return false; }
    });
    return cand || null;
  }

  // 把单元素换行拆成两行，并标注 .en / .chs
  function normalizeTwoLines(el){
    if (el.dataset.ctNormalized==='1') return;
    const kids = qa(':scope > *', el);
    if (kids.length >= 2 && (kids.some(k=>k.classList.contains('en')) || kids.some(k=>k.classList.contains('chs')))) {
      el.dataset.ctNormalized = '1'; return;
    }
    const parts = String(el.innerHTML).replace(/<br\s*\/?>/gi,'\n').split(/\n+/).map(s=>s.trim()).filter(Boolean);
    if (parts.length >= 2){
      let en = parts.find(p=>EN_RE.test(p)) || parts[0];
      let cn = parts.find(p=>CN_RE.test(p)) || parts[1] || '';
      el.innerHTML = `<div class="en">${en}</div><div class="chs">${cn}</div>`;
      el.dataset.ctNormalized = '1'; return;
    }
    if (kids.length >= 2){
      const [a,b] = kids;
      if (!a.classList.contains('en') && !a.classList.contains('chs')){
        if (EN_RE.test(a.textContent)) a.classList.add('en');
        if (CN_RE.test(a.textContent)) a.classList.add('chs');
      }
      if (!b.classList.contains('en') && !b.classList.contains('chs')){
        if (EN_RE.test(b.textContent)) b.classList.add('en');
        if (CN_RE.test(b.textContent)) b.classList.add('chs');
      }
      el.dataset.ctNormalized = '1';
    }
  }

  // 交换黄条两行：英文在上，中文在下
  function swapHint(el){
    normalizeTwoLines(el);
    const en = q(':scope > .en', el);
    const cn = q(':scope > .chs', el);
    if (en) el.insertBefore(en, el.firstElementChild);
    if (cn && el.children[1] !== cn) el.insertBefore(cn, el.children[1] || null);
    el.dataset.ctHintDone = '1';
  }

  // 把 “Variants (EN)” 分组移到 “变体（中文）” 前
  function swapVariantGroups(root){
    const blocks = qa(':scope > *', root);
    let enBlock=null, cnBlock=null;
    for (const b of blocks){
      const title = (q('strong', b)?.textContent || '').trim();
      if (/Variants\s*\(EN\)/i.test(title)) enBlock = b;
      if (/变体（?中文）?/.test(title) || /变体.*中文/.test(title)) cnBlock = b;
    }
    if (enBlock && cnBlock){
      const enAfterCN = !!(enBlock.compareDocumentPosition(cnBlock) & Node.DOCUMENT_POSITION_FOLLOWING);
      if (enAfterCN) root.insertBefore(enBlock, cnBlock);
    }
  }

  function applyOnce(){
    const root = locatePinkRoot();
    if (!root) return;
    const hint = findHint(root);
    if (hint && hint.dataset.ctHintDone!=='1') swapHint(hint);
    swapVariantGroups(root);
  }

  // 初次执行
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', applyOnce);
  } else {
    applyOnce();
  }
  // 监听后续更新
  const mo = new MutationObserver(() => applyOnce());
  mo.observe(document.body, { childList:true, subtree:true });
})();
