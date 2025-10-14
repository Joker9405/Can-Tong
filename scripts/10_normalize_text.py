#!/usr/bin/env python3
import sys, json, re, pathlib
def norm_line(s:str)->str:
    s = s.strip()
    s = re.sub(r"\s+"," ", s)
    return s

inp = pathlib.Path(sys.argv[1]) if len(sys.argv)>1 else None
outp = pathlib.Path("datasets/interim/text_cleaned.jsonl")
outp.parent.mkdir(parents=True, exist_ok=True)
with outp.open("w", encoding="utf-8") as f:
    if inp and inp.exists():
        for line in inp.open("r", encoding="utf-8"):
            s = norm_line(line)
            if s:
                rec = {"src":"manual","yue":s,"jyut":"","emotion":"","emoji":""}
                f.write(json.dumps(rec, ensure_ascii=False)+"\n")
    else:
        f.write(json.dumps({"src":"manual","yue":"咁奇怪","jyut":"gam3 kei4 gwaai3","emotion":"惊讶","emoji":"😮"}, ensure_ascii=False)+"\n")
print(f"Wrote -> {outp}")
