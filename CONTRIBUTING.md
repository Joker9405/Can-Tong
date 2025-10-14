# 贡献指南（Can-Tong）

我们欢迎任何形式的贡献：地道译文、正字修正、粤拼校对、情感/emoji 标注、发音录音、脚本代码等。

## 提交方式
1. Fork 仓库并创建分支。
2. 将新增/修正的数据放入：
   - 文本：`datasets/final/can_tong_text.jsonl`
   - 词典/多表述：`datasets/final/lexicon.jsonl`
   - 语音对齐清单：`datasets/final/can_tong_tts.tsv` （格式：`audio_path\tyue\tjyut\temotion`）
3. 若你增加了脚本，请放在 `scripts/` 并写明依赖与用法。
4. 提交 PR，并在描述中说明来源、许可与验证方式。

## 数据质量要求
- 粤语**正字**优先（繁体），可在 `note` 中注明地区/变体。
- 必填字段：`yue`（句子）、`jyut`（粤拼），建议加上 `emotion` 与 `emoji`。
- 建议附上来源（若可公开）与用途说明。

## 示例条目（JSON Lines 每行一条）
```json
{"src":"manual","yue":"咁奇怪","jyut":"gam3 kei4 gwaai3","emotion":"惊讶","emoji":"😮","alts":["咁古怪","咁旖旎"],"note":"口语；港式"}
```
