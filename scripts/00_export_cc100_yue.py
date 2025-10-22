#!/usr/bin/env python3
from datasets import load_dataset
import json, os
print("馃摝 鍔犺浇 cc100-yue ...")
ds = load_dataset("cc100", "yue", split="train")
out_path = os.path.join("datasets","raw","cc100_yue_sample.jsonl")
os.makedirs(os.path.dirname(out_path), exist_ok=True)
n = 0
with open(out_path, "w", encoding="utf-8") as f:
    for item in ds:
        text = (item.get("text") or "").strip()
        if not text: 
            continue
        rec = {"src":"cc100-yue","yue":text,"jyut":"","emotion":"","emoji":"","alts":[],"note":"鏈竻娲楀師濮嬭鏂?}
        f.write(json.dumps(rec, ensure_ascii=False)+"\n")
        n += 1
        if n >= 5000:
            break
print(f"鉁?瀵煎嚭 {n} 鏉?鈫?{out_path}")

