# Can-Tong 精准 crossmap 搜索补丁

这个压缩包只包含一个需要替换的文件：

- `api/translate.js`

作用：
- 搜索时**只依赖 `data/crossmap.csv` 里的 `term` 字段**；
- `term` 里用 `/` 分隔的每个词视为一个完整关键词；
- 只有完整输入其中一个词才会命中对应 `target_id`；
- 不再对 `lexeme.csv` 做模糊匹配，也不再做英文/中文的包含匹配。

使用方法：
1. 在你的私有仓库 Can-Tong 里找到原来的 `api/translate.js`。
2. 先备份一份（例如改名为 `translate.backup.js`）。
3. 用本压缩包中的 `api/translate.js` 覆盖原文件。
4. 部署到 Vercel 之后测试搜索：
   - 输入 crossmap.csv 某条 `term` 里完整的一个单元（被 `/` 分隔的其中一段），
   - 应该只返回该 term 对应 `target_id` 的词条。
