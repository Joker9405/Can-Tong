# Can‑Tong · KV 版（Vercel）

功能
- `/` 单页应用（中英粤互译 + 发音）
- `/api/translate`：先查 KV（你的私库）→ 再查 `public/lexicon.json`（开源底库）
- `/api/learn`：写入词条到 KV（需要 `x-api-key`）
- `/api/ping`：健康检查
- `/api/tts`：可选代理外部 TTS（未配置时前端回退浏览器 `zh-HK`）

## 环境变量
- `KV_REST_API_URL`：Upstash KV 的 REST URL
- `KV_REST_API_TOKEN`：Upstash KV 的 REST Token（或只读 token 也可，但 /api/learn 需要可写）
- `ADMIN_API_KEY`：管理密钥（你自己设置一个强密码）
- `TTS_URL`：（可选）你的 TTS 接口

## 部署
1. 将整个目录覆盖上传到 GitHub 仓库根；Vercel 框架选择 **Other**。
2. 填好环境变量 → 重新部署。
3. `/api/ping` 返回 `{ ok: true }` 即成功。

## 数据模型（KV）
key：`ct:pair:<lang>:<normalized_text>` → value：`{ zhh, chs, en }`。

## 批量学习
POST `/api/learn`
```json
{ "entries": [ { "zhh":"多謝", "chs":"谢谢", "en":"thanks" } ] }
```
至少两个字段非空。
