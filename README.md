# Can‑Tong Final (Single Upload)

- 直接把整个包上传到仓库**根目录**（覆盖旧文件）。
- Vercel 设置：Framework=Other（或默认），Build Command=空，Output=空。
- 成功部署后：
  - `GET /api/ping` -> `pong`
  - `GET /api/config` -> JSON
  - 页面 `/` 提供两按钮自检。
- 前端与后端分离部署时，在根目录新增 `config.js`：
  ```js
  window.BACKEND_URL = 'https://can-tong.vercel.app';
  ```
  并在 `index.html` 中 `<head>` 用 `<script src="config.js"></script>` 引入。
