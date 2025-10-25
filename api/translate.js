import fs from 'fs/promises';
import path from 'path';
import { kvGet, keyOf, scanEmbKeys } from './kv.js';
import { embed, cosine } from './openai.js';

const normalize = s => (s || '').trim().toLowerCase();

function pickBest(group, lang) {
  const arr = (group.items && group.items[lang]) || [];
  return arr.length ? arr[0] : '';
}

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });
  const { text, src = 'chs', withRelated = true } = req.body || {};
  const t = normalize(text || '');
  let matched = false;
  let best = { zhh: '', en: '' };
  let related = [];

  try {
    const exact = await kvGet(keyOf(src, t));
    if (exact) {
      matched = true;
      best = { zhh: exact.zhh || '', en: exact.en || '' };
      if (withRelated) {
        related.push({ group: 'exact', items: { [src]: [text], zhh: exact.zhh ? [exact.zhh] : [], en: exact.en ? [exact.en] : [] } });
      }
    }
  } catch {}

  if (withRelated || !matched) {
    try {
      const qvec = await embed(text);
      const keys = await scanEmbKeys(400);
      const cands = [];
      for (const k of keys) {
        const obj = await kvGet(k);
        if (obj && Array.isArray(obj.vec)) {
          const sim = cosine(qvec, obj.vec);
          cands.push({ sim, ref: obj });
        }
      }
      cands.sort((a,b)=>b.sim-a.sim);
      const top = cands.filter(x=>x.sim>=0.78).slice(0,8);
      const groupMap = new Map();
      for (const c of top) {
        const id = c.ref.group || c.ref.text;
        if (!groupMap.has(id)) groupMap.set(id, { group: id, items: {}, bestSim: c.sim });
        const pack = groupMap.get(id);
        const { lang, text } = c.ref;
        (pack.items[lang] ||= []).push(text);
      }
      const groups = [...groupMap.values()].sort((a,b)=>b.bestSim-a.bestSim);
      if (!matched && groups.length) {
        best = { zhh: pickBest(groups[0], 'zhh'), en: pickBest(groups[0], 'en') };
        matched = !!(best.zhh || best.en);
      }
      if (withRelated) related = groups;
    } catch {}
  }

  if (!matched) {
    try {
      const base = path.join(process.cwd(), 'public', 'lexicon.json');
      const raw = await fs.readFile(base, 'utf8');
      const lex = JSON.parse(raw);
      const arr = Object.values(lex);
      const item = arr.find(it => normalize(it[src]) === t);
      if (item) {
        best = { zhh: item.zhh || '', en: item.en || '' };
        matched = !!(best.zhh || best.en);
      }
    } catch {}
  }

  return res.status(200).json({ best, meta: { src, matched }, related });
}