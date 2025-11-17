# CanTong crossmap / lexeme 示例数据（扔垃圾 / 拖延时间 / 磨洋工）

这个示例包演示了一个「一个 term 只指向一个 lexeme」的做法，方便你在现有项目里对照调整。

## 目录结构

- `data/lexeme.csv`
  - 每条是一个「语义单元」（概念），包含：
    - `lexeme_id`：唯一 ID，例如 `L_TRASH_THROW`
    - `zhh_main`：主打粤语写法
    - `zhh_variants`：粤语变体写法（用顿号或竖线分隔皆可）
    - `chs_core`：对应的核心中文说法
    - `chs_variants`：其它常见中文别名
    - `en_core`：核心英文表达
    - `en_variants`：其它较自然的英文说法
    - `remark`：场景 / 语气 / 注意事项说明（中文写）
    - `example_*`：中/英/粤例句（可选）

- `data/crossmap.csv`
  - 只做「搜索入口 → lexeme_id」的映射：
    - `term`：用户可能输入的东西（中文 / 英文 / 粤语任意）
    - `lang`：chs / en / zhh
    - `lexeme_id`：指向 `lexeme.csv` 里的某条
    - `note`：可选说明（如“口語整句入口”）

## 使用建议（和你现有项目结合）

1. **在你的项目里继续用现在的 `lexeme.csv` 列名没问题**，只要保证有一个唯一 ID（可以叫 `id` 或 `target_id`），这个 ID 就等价于这里的 `lexeme_id`。
2. 把 `crossmap.csv` 的结构固定成：`term, lang, lexeme_id, note` 四列即可。
3. 以后新增映射时：
   - 允许很多 term → 同一个 `lexeme_id`（N→1）
   - 不要让同一个 term 指向多个 `lexeme_id`（避免 1→N）
4. 遇到很模糊的词（例如「扔」「拖」「搞」），尽量改成具体短语后再放进 `crossmap`，例如：
   - `扔垃圾`、`扔掉`、`拖延时间`、`拖订单`……

你可以根据需要，把这两个 CSV 里的内容复制到你现有的 `lexeme.csv` / `crossmap.csv` 里，对齐字段名即可。