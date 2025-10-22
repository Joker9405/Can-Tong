#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
build_vectors.py
读取 data/curated/curated.json，构建向量索引（TF-IDF；若安装 sentence-transformers 则优先用嵌入模型）
输出 data/vectors/vector.json
"""
import os, json, sys, re
from pathlib import Path

BASE = Path(__file__).resolve().parents[1]
CURATED = BASE / "data" / "curated" / "curated.json"
VEC_OUT = BASE / "data" / "vectors" / "vector.json"

def load_items():
    if not CURATED.exists():
        print(f"[ERR] {CURATED} 不存在，请先运行 ingest_subs.py", file=sys.stderr)
        sys.exit(1)
    data = json.loads(CURATED.read_text(encoding="utf-8"))
    items = data.get("items", [])
    # 仅保留粤语/中文/混合（英文可选）
    filtered = [x for x in items if x.get("lang") in ("yue","zh","mixed","en")]
    return filtered

def build_tfidf(items):
    from sklearn.feature_extraction.text import TfidfVectorizer
    from sklearn.preprocessing import normalize
    texts = [it["text"] for it in items]
    vec = TfidfVectorizer(ngram_range=(1,2), min_df=1)
    X = vec.fit_transform(texts)
    X = normalize(X)  # 余弦距离可直接用点积
    # 保存为稀疏简化形式（索引:非零元素）
    indptr = X.indptr.tolist(); indices = X.indices.tolist(); data = X.data.tolist()
    return {"type":"tfidf","vocab":vec.vocabulary_, "indptr":indptr, "indices":indices, "data":data}

def build_sbert(items):
    # 可选：如安装 sentence-transformers，使用 bge-m3 或其他多语模型
    from sentence_transformers import SentenceTransformer
    import numpy as np
    texts = [it["text"] for it in items]
    model_name = "BAAI/bge-m3"
    model = SentenceTransformer(model_name)
    emb = model.encode(texts, normalize_embeddings=True).tolist()
    return {"type":"sbert","model":model_name, "embeddings":emb}

def main():
    items = load_items()
    try:
        index = build_sbert(items)
        used = "sentence-transformers (bge-m3)"
    except Exception as e:
        index = build_tfidf(items)
        used = "TF-IDF"

    out = {
        "built_with": used,
        "count": len(items),
        "items": items,
        "index": index
    }
    VEC_OUT.parent.mkdir(parents=True, exist_ok=True)
    VEC_OUT.write_text(json.dumps(out, ensure_ascii=False, indent=2), encoding="utf-8")
    print(f"[OK] Vector index saved → {VEC_OUT}  ({used})")

if __name__ == "__main__":
    main()
