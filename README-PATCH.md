# Patch: Backend Learning + Multi-target Translate
Drop these files into your repo (same paths). Then redeploy.

- api/translate.js        → { best: { zhh, en }, related }
- api/ingest.js           → build entries[] from urls/texts/srt (heuristics)
- api/ingest_commit.js    → write entries into KV + embeddings (x-api-key=ADMIN_API_KEY)

Usage:
1) POST /api/ingest { urls:[], texts:[], srt:[] } → get { entries }
2) POST /api/ingest_commit with header x-api-key to persist
3) POST /api/translate { text, src } → returns best.zhh + best.en
