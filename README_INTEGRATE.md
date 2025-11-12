# CanTong Disambiguation Add‑on（保留你原始界面，不改 UI）

**作用**：当 `crossmap.csv` 里同一个查询键映射到多个不同 `id` 时，前端弹出**遮罩选择层**，把这些 `id` 在 `lexeme.csv` 里的 `zhh` 列出来让用户点选。  
**不替换你的 `index.html/app.js/style.css`**，只需多引入一个 JS 与 CSS 文件即可。

---

## 快速接入（保持你图一的界面不变）

1. 把以下两个文件放进你的项目：
   - `public/disambiguation.js`
   - `public/disambiguation.css`

2. 在你的 `index.html`（或模板）里，**保留你现有的引入**，再追加：

```html
<link rel="stylesheet" href="/public/disambiguation.css" />
<script src="/public/disambiguation.js"></script>
<script>
// 选一种集成方式（A 或 B）。推荐 A：显式 API。
Disambig.init({
  // 返回当前搜索词（若你的输入框不是 #q，请改为获取你的真实输入值）
  getQuery: () => (document.querySelector('#q')?.value || '').trim(),
  // 用户选择了某个候选后，如何渲染？交还给你的现有渲染函数。
  onPick: ({ id, row }) => {
    // 若你已有渲染函数，如 window.renderById(id) 或 window.renderLexeme(row)
    if (window.renderById) window.renderById(id);
    else if (window.renderLexeme) window.renderLexeme(row);
    // 如果你是通过输入值+按钮触发搜索，也可以把选中的 zhh 写回输入框再触发一次搜索：
    // const q = (row.zhh || '').trim(); document.querySelector('#q').value = q; document.querySelector('#btnSearch')?.click();
  },
  // 把遮罩挂到哪个容器下；留空则挂 body
  mount: document.body,
});
</script>
```

> 如果你不想写 `onPick`，也可以用 **方式 B（事件驱动）**：
> 监听 `document` 上的 `cantong:pickLexeme` 事件，自己决定怎么渲染：
> 
> ```js
> document.addEventListener('cantong:pickLexeme', (e) => {
>   const { id, row } = e.detail;
>   // 自行渲染
> });
> ```

---

## 工作原理（非侵入）
- 组件只监听“搜索”的尝试：点击 `#btnSearch` 或在 `#q` 上敲 Enter；也可通过上面的显式 API 直接调用。  
- 组件会按顺序加载：`../data/lexeme.csv`（或回退 `../data/seed.csv`）以及 `../data/crossmap.csv`。  
- 若发现当前查询键在 crossmap 中对应多个 id，则弹出遮罩层，列出这些 id 对应词条的 `zhh` 供选择；否则不干预，保持你原有的搜索流程。

---

## CSV 字段自适配
- crossmap：支持 `term/key/query` 作为查询键列；`lexeme_id/id/dst_id` 作为目标 id 列。  
- lexeme：至少需要 `id` 与 `zhh` 列（其他列可选）。

---

© 2025-11-12 CanTong MVP