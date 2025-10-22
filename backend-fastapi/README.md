# 后端（FastAPI · 可商用开源模型）

## 功能
- **/api/asr** → SenseVoice-Small：强项为中英夹杂、粵語识别。
- **/api/translate** → DL-Translate：支持 `yue_Hant`，可在你词库规则上做再写入/正字化。
- **/api/tts** → CosyVoice2：粤语 TTS，支持后续自训音色。

## 环境
建议 **CUDA GPU**。本地启动：

```bash
python -m venv .venv && source .venv/bin/activate
pip install -r requirements.txt
# 某些平台需提前安装 ffmpeg 以生成 mp3（可选）
uvicorn main:app --host 0.0.0.0 --port 8000
```

## 部署建议
- **测试/私有用**：本地或一张消费级 GPU 服务器。
- **线上**：选用带 GPU 的云（如 RunPod/AWS/GCP），或把 ASR/MT/TTS 拆成独立服务进行水平扩展。
- **Vercel/Netlify**：不适合直跑大模型，可作为 **反向代理** 指向 GPU 服务。

## 与前端对接
启动后端后，在前端页面底部填入：
- ASR: `https://你的域名/api/asr`
- MT:  `https://你的域名/api/translate`
- TTS: `https://你的域名/api/tts`

即可切换到真推理链路。

## 可替换
- 若更偏“端到端语音对话”，你也可以换 **Qwen2.5‑Omni / Qwen2‑Audio** 做理解，保留 CosyVoice2 专职粤语播报。
