# Admin 学习面板（/admin）

把 `admin.html` 放到仓库根，并用这里的 `vercel.json` 覆盖你现有的，确保：
- /admin → /admin.html
- /admin.html → /admin.html
- 其余非 /api 路径仍走 index.html（单页应用）

使用：
1) 打开 https://<你的域名>/admin
2) 粘 Admin Key（与你在 Vercel 配的 ADMIN_API_KEY 一致）
3) 粘网址 / 文本 / 上传 SRT
4) 点“生成 entries” → 预览/编辑
5) 点“一键写入” → 入库（KV + 嵌入）
