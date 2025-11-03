# MIGRATE_FROM_CURRENT_FILES.md

## 建议保留
- ping.js / route.js（后端健康检查/路由，若现网可用就保留）
- web/、index.html、app.js、package.json、vercel.json（前端与部署）
- supabase/*（仍使用则保留）
- LICENSE_USAGE.md、CONTRIBUTION_CLA.md、README*（文档）

## 建议替换/合并
- crossmap.CsV → **改名** `data/crossmap.csv`（小写/统一后缀）；内容迁移到本模板结构。
- lexeme.csV / seed.csV / sense.csv / tag.csv / rules.csv → **合并为**
  - `data/lexeme.csv`（主词条：粤/中/英/别名/备注/发音一一对齐）
  - `data/examples.csv`（扩充例句：每行中英对齐 + 粤语发音，仅播粤语）
  - `data/crossmap.csv`（可搜词索引：驱动自动补全与命中）

## 目录建议
data/
  lexeme.csv
  examples.csv
  crossmap.csv
  _archive/         # 旧 CSV 备份

## 前端加载建议
- 启动时 fetch 三个 CSV，建立：
  - lexemeMap: id → lexeme
  - examplesMap: id → [examples...]
  - termIndex: term → [{id,kind,lang}]
- 搜索框对 termIndex 做前缀匹配（head>alias>example>note 排序）。
- 词条页按 lexeme + examples 渲染。
