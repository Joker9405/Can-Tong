
CanTongMVP_search_patch_vPinkChips
==================================

目的
----
- 修复 crossmap.csv 中 term 相同但指向不同 target_id 的情况，**在搜索结果上方显示“粉色可点选的粤语词条（来自 lexeme.csv 的 zhh）**，用户点击即可切换到对应翻译。
- 纯前端实现；读取 /data/lexeme.csv 与 /data/crossmap.csv；**无需任何 Vercel 框架设置变更**。

文件
----
- index.html   —— 主页面
- style.css    —— 样式（含粉色 chips 样式）
- app.js       —— 逻辑（Papa Parse 解析 CSV；根据 crossmap 做多指向分歧选择）
- vercel.json  —— 仅为 /data/*.csv 设置 Cache-Control: no-store（避免浏览器缓存导致 CSV 更新不生效）

放置位置
--------
将以上文件 **直接放在仓库根目录**（与现有 index.html 同级）。
你的数据文件应在 `/data/lexeme.csv` 和 `/data/crossmap.csv`（public 根可访问）。

一次性替换步骤
--------------
1. 用本压缩包中的 `index.html`, `style.css`, `app.js`, `vercel.json` 覆盖你的仓库同名文件（若不存在则新增）。
2. 保持 `Framework Preset = Other`（或 Static Files），**不要填写任何 Build/Output 命令**。
3. 提交后 **Redeploy 一次** 即可。

搜索逻辑
--------
- 先在 `crossmap.csv` 中按 `term` 精确匹配；若没有，则按包含匹配。
- 将匹配出的 `target_id` 去重后映射到 `lexeme.csv` 行；
- 若匹配到多条，页面上方出现 **粉色 chips（显示 zhh）**，可点击切换；
- 若 crossmap 没有命中，则回退在 `lexeme.csv` 的 `zhh/chs/en` 中做包含匹配。

字段兼容
--------
- lexeme.csv: 支持列名 `id, zhh, chs, en, variants_chs, variants_en, notes`（额外别名会自动兼容）。
- crossmap.csv: 支持列名 `term, target_id`（兼容 `target`/`targetId` 等）。

语音
----
- 点击 🔊 使用浏览器 SpeechSynthesis，若系统可用会优先选 `zh-HK`/`yue` 音色。
- 纯浏览器功能，无需后端。

