# CanTong Disambiguation One-Step

**目标**：保持你现有 UI 不变；当 crossmap 同词多 id 时弹出 zhh 选择层。

## 操作两步到位
1) 复制文件：
   - `public/disambiguation.js`
   - `public/disambiguation.css`
   - 覆盖根目录 `index.html`（或把三段引用放到你现有 `</body>` 前）
   - 把 `vercel.json` 放在仓库根目录（静态路由，避免 404）

2) Vercel 项目设置（Build & Output Settings）：
   - Framework Preset: **Other**
   - Build Command: **(空)**
   - Output Directory: **.**
   - Root Directory: **/**

## 你的目录需包含
- `/index.html`
- `/assets/style.css`
- `/js/app.js`
- `/data/lexeme.csv`
- `/data/crossmap.csv`
- `/public/disambiguation.js`
- `/public/disambiguation.css`

## 验证
- 打开 `/data/lexeme.csv` 能直接访问
- 搜索 crossmap 中同词多 id 的词 → 弹出选择层

© 2025-11-12 CanTong MVP
