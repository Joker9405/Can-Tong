# 数据集与脚本工作流（Can-Tong）

本目录提供“把现有开源资源整合 → 清洗 → 统一字段 → 导出训练格式”的最小可行工作流。

## 目录结构
```
datasets/
  raw/                  # 各来源的原始包/解压后文件
  interim/              # 清洗和切分后的中间产物（JSONL）
  final/                # 统一字段/可训练的最终产物
scripts/                # 拉取/清洗/导出脚本
LICENSES.md             # 各源许可与归属记录
```

## 统一数据字段（文本）
- yue：粤语句子（繁体正字）
- jyut：粤拼（Jyutping）
- emotion：情感/语气标签（如 惊讶/疑惑/亲切…）
- emoji：表情符号（如 😮 🤔 😊）
- alts：同义或近义的其它表述（数组）
- note：备注（口语体/地区风格等）

## 快速开始
1. 在 `LICENSES.md` 填写你实际下载的数据来源与许可。
2. 运行脚本：
   - `python scripts/01_fetch_hkcancor.py`（占位：打印下载说明）
   - `python scripts/10_normalize_text.py datasets/raw/sample.txt`
   - `python scripts/40_export_sft_format.py`
3. 将你在网页端收集到的“贡献导出 JSON”对齐为 `datasets/final/lexicon.jsonl` 的同字段结构。

> 注意：本仓库不直接包含第三方数据，请按各自许可下载并在 `LICENSES.md` 记录。
