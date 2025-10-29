
# Cantong Starter (v1)

最小可运行：Supabase + Vercel Edge + Upstash（可选）+ Base44/静态前端。

## 一步步

1. **Supabase**
   - 新建项目 → SQL Editor 运行 `supabase/schema.sql` 与 `supabase/policies.sql`
   - 打开 RLS；确认匿名可 `select`，写入需 Service Role。

2. **Vercel**
   - 新建项目连接此仓库
   - 添加环境变量：`SUPABASE_URL`、`SUPABASE_ANON_KEY`、（可选）`SUPABASE_SERVICE_ROLE`、（可选）`UPSTASH_REDIS_REST_URL`、`UPSTASH_REDIS_REST_TOKEN`、（可选）`ADMIN_TOKEN`
   - 部署→ `GET /api/route?fn=lookup&q=早唞`

3. **（可选）Upstash Redis**
   - 创建 Redis → 复制 REST URL/Token → 填 Vercel 环境变量

4. **导入数据**
   - Supabase 控制台 → Table editor → Import CSV（见 `data/*.csv` 模板）

5. **前端**
   - 使用 Base44 或 `web/index.html` 做测试页（同域部署更简单）。

## 路由

- `/api/route?fn=lookup&q=...&lang=zhh`
- `/api/route?fn=normalize&q=...`
- `/api/route?fn=align&q=...&src=en&tgt=zhh`
- `/api/route?fn=ingest`（POST，需 `x-admin-token`）

## 许可证
- 代码 MIT；数据按各自来源许可。
