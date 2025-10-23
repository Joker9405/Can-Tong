# Can‑Tong MVP (Vercel)

这份最小可运行模板解决你在 Vercel 的 404 问题，并提供：
- `/` 前端单页（index.html）
- `/api/ping` 健康检查（修复你截图的 404）
- `/api/translate` 简单词库翻译（`public/lexicon.json`）
- `/api/tts` 可选 TTS 代理（未配置时，前端回退浏览器 `zh-HK` 语音）

## 如何使用
1. 覆盖上传整个项目到 `main` 分支（不要包含 Next.js 相关依赖）。
2. Vercel 仓库框架选择 **Other**（不是 Next.js）。
3. 环境变量（可选）：
   - `TTS_URL`：你的后端 TTS 地址，例如 `https://can-tong-huc3.vercel.app/api/tts`
4. 访问 `https://<your-app>.vercel.app/`，不会再 404；`/api/ping` 返回 `{ ok: true }`。

## 词库扩展（自学/闭源）
Serverless 运行时**不能写入仓库文件**，要“自学”持久化，你需要一个可写的存储：
- Vercel KV（Redis）或 Vercel Postgres
- Supabase / Neon / PlanetScale 等
- 或者自建后端（Node/Flask）+ 数据库

推荐先用 **Vercel KV**：
- 新增环境变量：`KV_REST_API_URL`、`KV_REST_API_TOKEN`（Upstash）
- 把 `/api/translate` 改成：先查 KV（用户自定义词条）→ 再查 `public/lexicon.json`（基础开源）→ 最后回退规则。
- 这样你的增补词条就写到 KV，**天然闭源**。

## 路线图
- [x] 修复 404（保留 API 路由，前端走单页重写）
- [x] MVP：中英粤互译 + 粤语发音回退
- [ ] 接入 KV，开放“学习”接口 `/api/learn`（写入自定义词条）
- [ ] 批量导入：上传文件（CSV/JSON）→ 后端校验后写入 KV
- [ ] 权限：仅你登录后可写（例如 Vercel Auth / Supabase Auth）
