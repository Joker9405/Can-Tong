#!/usr/bin/env python3
import json, pathlib
src = pathlib.Path("datasets/interim/text_cleaned.jsonl")
dst = pathlib.Path("datasets/final/can_tong_text.jsonl")
dst.parent.mkdir(parents=True, exist_ok=True)
with dst.open("w", encoding="utf-8") as f:
    if src.exists():
        for line in src.open("r", encoding="utf-8"):
            try:
                rec = json.loads(line)
                out = {"instruction":"把下句翻译成地道粤语（含粤拼与emoji）","input": rec.get("input","这么奇怪"),"output": f"{rec.get('yue','咁奇怪')} （{rec.get('jyut','gam3 kei4 gwaai3')}） {rec.get('emoji','😮')}"}
                f.write(json.dumps(out, ensure_ascii=False)+"\n")
            except Exception:
                pass
    else:
        out = {"instruction":"把下句翻译成地道粤语（含粤拼与emoji）","input":"这么奇怪","output":"咁奇怪 （gam3 kei4 gwaai3） 😮"}
        f.write(json.dumps(out, ensure_ascii=False)+"\n")
print(f"Wrote -> {dst}")
