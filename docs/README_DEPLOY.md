# 部署与排错（MVP）

## 1) 文件位置
- `/api/route.js`：统一 API（ping/translate/tts/ingest）
- `/data/seed.csv`：只读演示词库（三列：chs, zhh, en）
- `/docs/LICENSE_USAGE.md`：许可与闭源策略
- `/docs/CONTRIBUTION_CLA.md`：贡献者许可协议

## 2) Vercel 设置
- 需存在 `vercel.json`，确保路由将 `/api/*` 指向 `/api/route.js`，其余回退到 `index.html`。
- 不要在 Dashboard → Functions 里配置旧版/自定义 `Runtime`。

## 3) 验证
- `GET /api/route?fn=ping` → `{ ok: true }`
- `GET /api/route?fn=translate&q=手机` → 返回 `best` 字段
- 前端调用 `/api/route?fn=tts&text=...` 返回 `mode: client-zh-HK`，浏览器用 Web Speech 播放。

## 4) 常见问题
- **404**：确认根目录存在 `index.html`，且 `vercel.json` 有回退规则。
- **函数报错**：检查 `api/` 下只保留 `route.js`，删除旧的 `ping.js` 等冲突文件。
- **跨域/缓存**：本 MVP 默认同域；如需跨源部署，请在前端使用相对路径或统一域名。

## 5) 升级路径
- 词库改为私有 DB（KV/SQL），在 `/api/route.js` 内替换 `translate` 的实现即可；同时加入 IP+Token 限流。
- 发音改为云 TTS，保持 `/api/tts` 接口签名不变，仅替换内部实现。
