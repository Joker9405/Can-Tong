import io
import uvicorn
from fastapi import FastAPI, File, UploadFile
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from typing import Optional

# ---- CORS ----
app = FastAPI(title="Can-Tong OSS Backend", version="0.1.0")
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# ---- Lazy loaders to reduce cold start ----
_asr_pipe = None
_mt_model = None
_tts_model = None

# ---------- ASR: SenseVoice-Small via ModelScope/FunASR ----------
def get_asr():
    global _asr_pipe
    if _asr_pipe is None:
        from funasr import AutoModel
        # SenseVoice-Small
        _asr_pipe = AutoModel(model="iic/SenseVoiceSmall",
                              vad_model="fsmn-vad",
                              vad_kwargs={"max_single_segment_time": 30000},
                              disable_update=True)
    return _asr_pipe

# ---------- MT: DL-Translate (yue_Hant) ----------
def get_mt():
    global _mt_model
    if _mt_model is None:
        import dl_translate as dlt
        _mt_model = dlt.TranslationModel()  # will download NLLB/MBART weights
    return _mt_model

# ---------- TTS: CosyVoice2 (FunAudioLLM) ----------
def get_tts():
    global _tts_model
    if _tts_model is None:
        from funaudiollm import CosyVoice2
        # Choose an available Cantonese-capable checkpoint; user can replace with fine-tuned one.
        _tts_model = CosyVoice2.from_pretrained("FunAudioLLM/CosyVoice2-0.5B")
    return _tts_model

# ---------- Schemas ----------
class TranslateIn(BaseModel):
    text: str
    source_lang: Optional[str] = "auto"
    target_lang: str = "yue_Hant"

class TTSIn(BaseModel):
    text: str
    lang: Optional[str] = "yue_Hant"

# ---------- Routes ----------
@app.post("/api/asr")
def asr(file: UploadFile = File(...)):
    # Expect audio/webm or wav; FunASR handles common formats
    audio_bytes = file.file.read()
    pipe = get_asr()
    # Return best segment text; language auto-detected; robust to code-switching
    result = pipe.generate(input=io.BytesIO(audio_bytes))
    # FunASR returns list of segments; join
    if isinstance(result, list):
        text = " ".join([seg.get('text', '') for seg in result])
    else:
        text = str(result)
    return {"text": text.strip()}

@app.post("/api/translate")
def translate(inp: TranslateIn):
    mt = get_mt()
    src = inp.source_lang if inp.source_lang != "auto" else None
    out = mt.translate(inp.text, source=src, target=inp.target_lang)
    return {"text": out}

@app.post("/api/tts")
def tts(inp: TTSIn):
    model = get_tts()
    # Generate Cantonese speech; default speaker can be swapped, here we pick a built-in id if available
    wav, sr = model.infer(text=inp.text, language=inp.lang if inp.lang else "yue_Hant")
    # Encode to mp3 on the fly (fallback to wav if pydub/lame not present)
    import soundfile as sf
    import numpy as np
    import tempfile
    import subprocess
    import os

    # Write wav to temp
    with tempfile.NamedTemporaryFile(suffix=".wav", delete=False) as tmp_wav:
        sf.write(tmp_wav.name, wav.astype(np.float32), sr)
        wav_path = tmp_wav.name

    # Try ffmpeg to convert to mp3 if available
    mp3_bytes = None
    try:
        with tempfile.NamedTemporaryFile(suffix=".mp3", delete=False) as tmp_mp3:
            cmd = ["ffmpeg", "-y", "-i", wav_path, "-codec:a", "libmp3lame", "-b:a", "128k", tmp_mp3.name]
            subprocess.run(cmd, check=True, stdout=subprocess.PIPE, stderr=subprocess.PIPE)
            mp3_path = tmp_mp3.name
        with open(mp3_path, "rb") as f:
            mp3_bytes = f.read()
        os.unlink(mp3_path)
    except Exception:
        pass

    # Cleanup wav
    try:
        os.unlink(wav_path)
    except Exception:
        pass

    from fastapi.responses import Response, StreamingResponse
    if mp3_bytes:
        return Response(content=mp3_bytes, media_type="audio/mpeg")
    else:
        # Fallback to wav stream
        with open(wav_path, "rb") as f:
            data = f.read()
        return Response(content=data, media_type="audio/wav")

@app.get("/")
def root():
    return {"ok": True, "name": "Can-Tong OSS Backend", "asr":"SenseVoiceSmall", "mt":"DL-Translate", "tts":"CosyVoice2"}

if __name__ == "__main__":
    uvicorn.run(app, host="0.0.0.0", port=8000)
