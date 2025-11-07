# Can‑Tong 纯静态部署包（无 /api）

本包用于在 Vercel Hobby 套餐下绕过 “每次部署最多 12 个 Serverless Functions” 的限制。做法：**完全不生成函数**。

## 使用方法
1. 删除或重命名你仓库里的 `/api` 目录（例如改为 `/_api_backup`）。
2. 用本包覆盖你的仓库根目录（包含 `index.html`、`app.js`、`vercel.json`、`/public/config.json`）。
3. 编辑 `/public/config.json`：
   - `ttsUrl`：填你的 TTS 服务 HTTP POST 地址（返回音频）。
   - `translateUrl`（可选）：如果已经有独立后端，填翻译接口地址；没有就先留空，前端会用演示文案。
4. 推送到 GitHub，Vercel 重新部署即可。

## 注意
- 纯静态项目中**不能**读取 Vercel 的服务器端环境变量；因此把外部地址放在 `public/config.json`。
- 将来如需后端，建议单独开一个 Vercel 项目托管 API，前端通过 `config.json` 指向该后端域名。
