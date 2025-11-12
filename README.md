# CanTong 前端歧义消解包（crossmap 多 ID → 选 zhh）

**目的**：当 `crossmap.csv` 里出现“同一个键（term）映射到多个不同 `lexeme_id`”的情况时，前端搜索展示一块**可选项卡片**，列出这些 ID 对应的 `lexeme.csv` 里的 `zhh`，点击即可查看对应词条。

**不需要修改任何数据文件**：本包仅改前端逻辑，自动适配以下文件：
- `data/lexeme.csv`（私有/真实，包含 `id, zhh, ...` 等字段）
- `data/crossmap.csv`（包含 `term/key/query` 与 `lexeme_id/id/dst_id` 任一列名）

> 若线上不放私有数据，仍可用 `data/seed.csv` 做演示。

---

## 放置位置
- `public/index.html`、`public/app.js`、`public/style.css` → 直接覆盖你的前端壳
- `data/` 目录保持你现状（**无需改动**）；前端会尝试按顺序加载：
  - `../data/lexeme.csv`（优先）
  - `../data/seed.csv`（备选）
  - `../data/crossmap.csv`（若存在则启用歧义消解）

---

## crossmap.csv 字段自适配
程序会自动识别以下列名：
- 词键：`term` 或 `key` 或 `query`
- 目标 ID：`lexeme_id` 或 `id` 或 `dst_id`

> 只要你的 crossmap.csv 有其中任意组合即可工作。

---

## 基本交互
1. 用户输入搜索词 `q`；
2. 若 `crossmap` 中有 **相同键对应多个 ID**：
   - 顶部先显示一个“**选择 zhh**”卡片，列出这些 ID 对应的 `zhh` 备选；
   - 用户点选其一 → 渲染该 `lexeme` 详情；
3. 若没有歧义，则按原本模糊匹配/别名策略展示最优结果。

---

© 2025-11-11 CanTong MVP