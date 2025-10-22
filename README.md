# 前端（GitHub Pages 可直接部署）

- 将 `frontend/` 整个文件夹上传到你的 GitHub Pages 仓库（如 `Joker9405/Can-Tong`），其中 `index.html` 为入口。
- 如暂未配置后端，页面会使用 **浏览器 zh‑HK 语音** 演示 TTS，并保留一个**简易规则**做演示级“粵語化”；上线后只需在页面底部**填入你的后端 API URL** 即可切换为真模型推理。

统一 API 协议：
- `POST /api/asr`：multipart，字段 `file`（音频）。返回 JSON：`{"text":"..."}`
- `POST /api/translate`：JSON：`{"text","source_lang","target_lang"}`。返回 JSON：`{"text":"..."}`
- `POST /api/tts`：JSON：`{"text","lang"}`。返回 **audio/mpeg** 流。

