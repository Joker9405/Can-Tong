from gtts import gTTS
from io import BytesIO

def handler(request):
    try:
        data = request.get_json() or {}
        text = data.get('text', '你好')
        lang = 'zh'  # demo voice
        tts = gTTS(text=text, lang=lang)
        buf = BytesIO()
        tts.write_to_fp(buf)
        audio = buf.getvalue()
        return (audio, 200, {
            "Content-Type": "audio/mpeg",
            "Access-Control-Allow-Origin": "*",
            "Cache-Control": "no-store"
        })
    except Exception as e:
        return ({ "error": str(e) }, 500, { "Content-Type": "application/json" })

def app(request):
    return handler(request)
