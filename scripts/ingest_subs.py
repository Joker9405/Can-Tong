#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
ingest_subs.py
读取 data/raw/ 下的 SRT/TXT/CSV，初筛“粤语句”，输出 data/curated/curated.json
"""
import os, re, json, csv, sys, glob
from pathlib import Path

BASE = Path(__file__).resolve().parents[1]
RAW = BASE / "data" / "raw"
OUT = BASE / "data" / "curated" / "curated.json"
YUE_MASK_FILE = RAW / "yue_mask.txt"

# 默认的粤语特征词
DEFAULT_YUE_MASK = r"(嘅|咗|冇|喺|嗰|嚟|啱|咩|噉|咁|哋|俾|喎|喔|啦|喇|囉|啩|呀|吖|啫|咋|得閒|飲茶|埋單|唔|嚟緊|睇吓|邊度|點樣|係唔係|系唔系)"

def load_yue_mask():
    if YUE_MASK_FILE.exists():
        try:
            words = [w.strip() for w in YUE_MASK_FILE.read_text(encoding="utf-8").splitlines() if w.strip()]
            return "(" + "|".join(map(re.escape, words)) + ")"
        except Exception:
            pass
    return DEFAULT_YUE_MASK

YUE_RE = re.compile(load_yue_mask())

def is_cjk(s):
    return bool(re.search(r"[\u4e00-\u9fff]", s))

def detect_lang(s):
    has_en = bool(re.search(r"[A-Za-z]", s))
    has_cjk = is_cjk(s)
    if has_en and not has_cjk: return "en"
    if has_cjk and not has_en:
        return "yue" if YUE_RE.search(s) else "zh"
    return "mixed"

def clean_line(s):
    s = re.sub(r"\s+", " ", s).strip()
    s = re.sub(r"^[\-\–\—\·\•\*]+", "", s)  # 删首部项目符号
    return s

def parse_srt(path: Path):
    out = []
    block = []
    for line in path.read_text(encoding="utf-8", errors="ignore").splitlines():
        if line.strip()=="" and block:
            # 处理一个块
            txt = " ".join([l for l in block if "-->" not in l and not l.strip().isdigit()]).strip()
            txt = clean_line(txt)
            if txt:
                out.append(txt)
            block = []
        else:
            block.append(line)
    if block:
        txt = " ".join([l for l in block if "-->" not in l and not l.strip().isdigit()]).strip()
        txt = clean_line(txt)
        if txt:
            out.append(txt)
    return out

def parse_txt(path: Path):
    out = []
    for line in path.read_text(encoding="utf-8", errors="ignore").splitlines():
        line = clean_line(line)
        if line:
            out.append(line)
    return out

def parse_csv(path: Path):
    out = []
    with open(path, "r", encoding="utf-8", errors="ignore") as f:
        reader = csv.DictReader(f)
        key = None
        header = [h.lower() for h in reader.fieldnames or []]
        for cand in ["text","content","sentence","line"]:
            if cand in header:
                key = cand
                break
        if not key:
            # 尝试第一列
            f.seek(0); reader = csv.reader(f)
            for row in reader:
                if not row: continue
                out.append(clean_line(row[0]))
            return out
        f.seek(0); reader = csv.DictReader(f)
        for row in reader:
            val = clean_line(row.get(key,""))
            if val:
                out.append(val)
    return out

def main():
    RAW.mkdir(parents=True, exist_ok=True)
    OUT.parent.mkdir(parents=True, exist_ok=True)
    items = []

    for path in RAW.glob("*"):
        if path.is_dir(): continue
        low = path.name.lower()
        lines = []
        if low.endswith(".srt"):
            lines = parse_srt(path)
        elif low.endswith(".txt"):
            lines = parse_txt(path)
        elif low.endswith(".csv"):
            lines = parse_csv(path)
        else:
            continue

        for s in lines:
            lang = detect_lang(s)
            # 初筛：只收粤语/中文/混合（英文可保留用于对齐或后续翻译）
            entry = {
                "text": s,
                "lang": lang,
                "source": path.name
            }
            items.append(entry)

    # 去重
    seen = set()
    uniq = []
    for it in items:
        key = it["text"].strip().lower()
        if key in seen: continue
        seen.add(key); uniq.append(it)

    OUT.write_text(json.dumps({"items": uniq}, ensure_ascii=False, indent=2), encoding="utf-8")
    print(f"[OK] Curated {len(uniq)} items → {OUT}")

if __name__ == "__main__":
    main()
