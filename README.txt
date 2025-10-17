# Can-Tong · 雲端 TTS 一鍵打包

本包包含：
1) `frontend/`：前端頁面（支持 `?tts=`；不帶參數時請求同域 `/api/tts`）。
2) `vercel/`：Vercel 服務端（Python + gTTS）。導入 GitHub 後，Vercel 會生成 `https://<your>.vercel.app/api/tts`。
3) `cloudflare/`：Cloudflare Worker 服務端（JS 代理 Google TTS）。粘貼 `worker.js` 即可。

## 用法 A（Vercel，最簡單）
1. 新建 GitHub 倉庫，只放 `vercel/` 內三個文件：`vercel.json`、`requirements.txt`、`api/tts.py`。
2. 打開 https://vercel.com → Add New Project → Import GitHub Repo → Deploy。
3. 部署成功後得到 `https://xxx.vercel.app/api/tts`。
4. 打開你的前端頁面時加參數：
   `https://你的前端域名/?tts=https://xxx.vercel.app/api/tts`

## 用法 B（Cloudflare Workers）
1. https://dash.cloudflare.com → Workers → Create → HTTP handler。
2. 粘貼 `cloudflare/worker.js` 全部內容，Deploy。
3. 得到 `https://你的子域.workers.dev/tts`，前端用：
   `https://你的前端域名/?tts=https://你的子域.workers.dev/tts`

## 前端（GitHub Pages）
把 `frontend/` 三個文件放到你的 Pages 目錄。
- 不帶 `?tts=` 時，會請求同域 `/api/tts`（如果你用 Vercel 同倉部署，二者域名一致即可）。
- 帶 `?tts=` 時，直接用該雲端地址。
