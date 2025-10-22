#!/usr/bin/env python3
import json, sys, os
def is_cantonese(s):
    keys = ["鍐?,"鍠?,"鍜?,"鍟?,"鍜?,"鍟?,"鍠?,"鍣?,"鍡?,"鍤?,"鐣€","鍜?,"鍠?,"鍛€","鍥?,"鍢?]
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
    os.makedirs("data_store/interim", exist_ok=True)
    out = "data_store/interim/gap_report.json"
    with open(out, "w", encoding="utf-8") as f:
        json.dump(report, f, ensure_ascii=False, indent=2)
    print("鈥斺€?妫€娴嬪畬鎴?鈥斺€?)
    print(json.dumps(report, ensure_ascii=False, indent=2))
    print(f"馃搫 鍐欏嚭锛歿out}")
if __name__ == "__main__":
    if len(sys.argv) < 2:
        print("鐢ㄦ硶: python scripts/50_check_gaps.py <jsonl_path>")
        raise SystemExit(1)
    main(sys.argv[1])

