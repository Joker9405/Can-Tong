#!/usr/bin/env python3
import json, sys, os
def is_cantonese(s):
    keys = ["冇","喺","咁","啲","咩","啦","喎","噉","嗰","嚟","畀","咗","喇","呀","囉","嘛"]
    return any(k in s for k in keys)
def main(path):
    report = {"total":0,"non_yue":0,"missing_jyut":0,"missing_emotion":0,"examples":{"non_yue":[]}}
    with open(path, encoding="utf-8") as f:
        for line in f:
            try:
                obj = json.loads(line)
            except Exception:
                continue
            report["total"] += 1
            yue = obj.get("yue","")
            if not is_cantonese(yue):
                report["non_yue"] += 1
                if len(report["examples"]["non_yue"]) < 10:
                    report["examples"]["non_yue"].append(yue[:80])
            if not obj.get("jyut"):
                report["missing_jyut"] += 1
            if not obj.get("emotion"):
                report["missing_emotion"] += 1
    os.makedirs("datasets/interim", exist_ok=True)
    out = "datasets/interim/gap_report.json"
    with open(out, "w", encoding="utf-8") as f:
        json.dump(report, f, ensure_ascii=False, indent=2)
    print("—— 检测完成 ——")
    print(json.dumps(report, ensure_ascii=False, indent=2))
    print(f"📄 写出：{out}")
if __name__ == "__main__":
    if len(sys.argv) < 2:
        print("用法: python scripts/50_check_gaps.py <jsonl_path>")
        raise SystemExit(1)
    main(sys.argv[1])
