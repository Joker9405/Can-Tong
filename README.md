# Can‑Tong Vercel Starter

两种部署方式：

## 方式 A（推荐）：前后端**同一个** Vercel 项目
- 不需要环境变量和 CORS。
- 直接访问 `https://你的域名/api/ping` 应返回 `pong`。

## 方式 B：前端在 GitHub Pages，后端在 Vercel
1) 在根目录创建 `config.js`，写入：
```js
window.BACKEND_URL = 'https://can-tong.vercel.app';
```
2) 保留 `api/*` 函数中的 CORS 代码。
3) 前端发起请求将使用 `https://can-tong.vercel.app/api/...`。

---

### 本项目包含
- `api/ping.js`：测试接口，返回 `pong`。
- `api/tts.js`：占位接口（501），后续替换为真实 TTS 逻辑。
- `index.html`：简单检测页面。
- `vercel.json`：路由规则（将 `/api/*` 指到 serverless 函数，其余路径回退到 `index.html`）。

### 部署
- 关联 GitHub 仓库后，“Framework” 选择 **Other**（或不设置），无需 Build 命令。
- 输出目录为空（使用根目录）。
- 一旦部署成功，访问根域名查看页面；访问 `/api/ping` 查看接口。

