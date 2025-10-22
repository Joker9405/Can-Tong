# Can‑Tong · 中英粵互通 · 最小可用集成（前后端可独立）

- `frontend/`：静态前端，可直接部署到 **GitHub Pages**。未接后端时提供**浏览器演示**能力，便于你“先上页面再换后端”。
- `backend-fastapi/`：可商用开源模型的推理服务（ASR: SenseVoice，小语种/粵化翻译：DL-Translate，TTS：CosyVoice2）。用于生产时建议放在 GPU 云。

快速开始：
1) 先把 `frontend/` 上传到你的 `joker9405.github.io/Can-Tong/` 仓库测试页面。
2) 需要真推理时，在任意 GPU 机器跑起 `backend-fastapi/`，然后把前端页面底部的 API URL 填上即可。

许可证建议：MIT（前端与你自建的词库/规则）。各模型依其仓库许可证使用。