# Can‑Tong · KV + Embedding 版（Vercel）

需要环境变量：OPENAI_API_KEY、KV_REST_API_URL、KV_REST_API_TOKEN、ADMIN_API_KEY、(可选) TTS_URL。
语义召回通过扫描 ct:emb:* 键并计算余弦相似度（MVP）。规模大时请接入 Upstash Vector。
