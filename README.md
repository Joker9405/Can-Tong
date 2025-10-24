# Can‑Tong · KV + 语义召回 版（Vercel）

新增能力
- `/api/learn_semantic`：写入词条并为现有语言值（zhh/chs/en）计算嵌入向量，保存到 KV。
- `/api/search`：输入任意语言短语，做语义相似召回（Top-K）。
- `/api/translate`：支持 `withSimilar=true` 返回相似表达列表。

环境变量
- `KV_REST_API_URL` / `KV_REST_API_TOKEN`
- `ADMIN_API_KEY`
- `OPENAI_API_KEY`
- `EMBED_MODEL`（可选，默认 text-embedding-3-small）
- `TTS_URL`（可选）

说明
- 当前用 `SCAN ct:vec:* COUNT 500` 拉最多 500 条向量参与相似度计算（MVP 简化）。
- 后续量大时，请迁移到专业向量库（Upstash Vector/Pinecone/Qdrant），或新增倒排/ANN。
