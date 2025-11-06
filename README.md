# Can‑Tong UI Integrated Package

- 颜色保持不变：主色 **neon lime(#b9ff39)**、辅色 **hot pink(#ff1188)** 与深色背景沿用。
- 结构：
  - `index.html`：页面骨架
  - `assets/style.css`：样式（颜色已锁定）
  - `js/app.js`：逻辑（兼容后端字段；统一以 zhh 为最大显示；EN 与 CHS 合并到 Notes；例句无 Variant 列；右下角 example 扩展折叠）
- 依赖：后端提供 `/api/translate?q=` 与 `/api/tts?text=`。若 TTS 不可用，会自动回退浏览器 `speechSynthesis`。
- 替换方法：将本包覆盖到你的 Vercel 项目根目录即可（保留你现有 `/api` 目录）。
