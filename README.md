# Can-Tong 自学习脚本（离线可用）

本包包含两个脚本：

1) `scripts/ingest_subs.py`
   - 读取 `data/raw/` 目录中的 **SRT/TXT/CSV**（UTF-8）
   - 自动切句、去噪与**粤语句**初筛（基于常见语气词正则）
   - 输出到 `data/curated/curated.json`（标准化结构）

2) `scripts/build_vectors.py`
   - 读取 `data/curated/curated.json`
   - 使用 **TF-IDF**（纯本地，无需联网）构建向量索引
   - 输出到 `data/vectors/vector.json`（向量+原文），供前端或服务侧做相似检索

> 可选增强：如果本地已安装 `sentence-transformers`（或 `text-embeddings-inference` 等）
> 脚本会自动优先使用 **bge-m3** 等多语模型生成更好的向量；否则回退 TF-IDF。

---

## 使用步骤（零代码基础）

1. 把你的字幕/文本/表格放到：`data/raw/`
   - 支持：`*.srt`、`*.txt`（一行一句）、`*.csv`（包含 `text` 列）
2. 运行：
   ```bash
   python3 scripts/ingest_subs.py
   python3 scripts/build_vectors.py
   ```
3. 生成文件：
   - `data/curated/curated.json`
   - `data/vectors/vector.json`

> 前端如何用？你可以在网页里加载 `data/vectors/vector.json`，
> 根据用户输入做 TF-IDF 余弦相似度（或把输入与索引送到本地模型进行 RAG 组合后输出粵語句）。

---

## 目录结构（示例）

canto-ai-scripts/
├─ scripts/
│  ├─ ingest_subs.py
│  └─ build_vectors.py
├─ data/
│  ├─ raw/            # 放你的 SRT/TXT/CSV
│  ├─ curated/        # 脚本自动输出
│  └─ vectors/        # 脚本自动输出
└─ README.md

---

## 备注

- 所有输出均为 **UTF-8** 编码的 JSON。
- `ingest_subs.py` 的粤语检测仅为**初筛**，你可在 `yue_mask.txt`（若存在）中追加词表，脚本会自动读取增强。
- 如需导出 `public/data/lexicon.json` 供旧版三挡页面使用，后续我可提供 `compile_lexicon.py`（选装）。
