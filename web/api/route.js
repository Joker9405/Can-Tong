
// Edge runtime single-entry API for Cantong
export const config = { runtime: "edge" };

const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_ANON_KEY = process.env.SUPABASE_ANON_KEY;
const SUPABASE_SERVICE_ROLE = process.env.SUPABASE_SERVICE_ROLE; // optional for ingest
const UPSTASH_REDIS_REST_URL = process.env.UPSTASH_REDIS_REST_URL;
const UPSTASH_REDIS_REST_TOKEN = process.env.UPSTASH_REDIS_REST_TOKEN;
const ADMIN_TOKEN = process.env.ADMIN_TOKEN; // for protected endpoints

async function redisGet(key) {
  if (!UPSTASH_REDIS_REST_URL || !UPSTASH_REDIS_REST_TOKEN) return null;
  const r = await fetch(`${UPSTASH_REDIS_REST_URL}/get/${encodeURIComponent(key)}`, {
    headers: { Authorization: `Bearer ${UPSTASH_REDIS_REST_TOKEN}` }
  });
  if (!r.ok) return null;
  const data = await r.json();
  return data.result ?? null;
}

async function redisSetex(key, ttl, value) {
  if (!UPSTASH_REDIS_REST_URL || !UPSTASH_REDIS_REST_TOKEN) return;
  await fetch(`${UPSTASH_REDIS_REST_URL}/setex/${encodeURIComponent(key)}/${ttl}/${encodeURIComponent(value)}`, {
    headers: { Authorization: `Bearer ${UPSTASH_REDIS_REST_TOKEN}` }
  });
}

function json(data, init = 200) {
  return new Response(JSON.stringify(data), {
    status: typeof init === 'number' ? init : (init.status || 200),
    headers: {
      "content-type": "application/json; charset=utf-8",
      "cache-control": "s-maxage=60, stale-while-revalidate=60"
    }
  });
}

function bad(msg, code=400){ return json({error: msg}, code); }

async function supabaseQuery(path, opts={}) {
  const url = `${SUPABASE_URL}/rest/v1/${path}`;
  const headers = {
    apikey: SUPABASE_ANON_KEY,
    Authorization: `Bearer ${SUPABASE_ANON_KEY}`,
    "content-type": "application/json"
  };
  const res = await fetch(url, { ...opts, headers: { ...headers, ...(opts.headers||{}) }});
  if (!res.ok) throw new Error(await res.text());
  return res.json();
}

async function supabaseService(path, body) {
  const url = `${SUPABASE_URL}/rest/v1/${path}`;
  const headers = {
    apikey: SUPABASE_SERVICE_ROLE,
    Authorization: `Bearer ${SUPABASE_SERVICE_ROLE}`,
    "content-type": "application/json",
    "prefer": "resolution=merge-duplicates"
  };
  const res = await fetch(url, { method:"POST", headers, body: JSON.stringify(body) });
  if (!res.ok) throw new Error(await res.text());
  return res.json();
}

async function fnLookup(q, lang="zhh") {
  if (!q) return bad("q required");
  const key = `lookup:${lang}:${q}`;
  const cached = await redisGet(key);
  if (cached) return new Response(cached, { headers: { "content-type":"application/json"}});

  // exact headword, then fuzzy + fts
  const exact = await supabaseQuery(`lexeme?headword=eq.${encodeURIComponent(q)}&lang=eq.${lang}&select=id,headword,lang,jyutping,audio_url`);
  let best = exact[0] || null;

  let candidates = exact;
  if (!best) {
    // fuzzy via ilike
    const fuzzy = await supabaseQuery(`lexeme?headword=ilike.*${encodeURIComponent(q)}*&lang=eq.${lang}&select=id,headword,lang,jyutping,audio_url`);
    candidates = fuzzy;
    best = fuzzy[0] || null;
  }

  if (best) {
    const senses = await supabaseQuery(`sense?lexeme_id=eq.${best.id}&select=id,register,gloss_chs,gloss_en,example,example_translation`);
    best.senses = senses;
  }

  // normalize suggestion
  let normalize = null;
  try {
    const rules = await supabaseQuery(`rules?wrong_form=eq.${encodeURIComponent(q)}&select=correct_form`);
    if (rules.length) normalize = { suggestion: rules[0].correct_form, confidence: 0.9 };
  } catch {}

  const payload = {
    query: q,
    lang,
    best,
    candidates,
    normalize,
  };
  const out = JSON.stringify(payload);
  await redisSetex(key, 60, out);
  return new Response(out, { headers: { "content-type":"application/json" }});
}

async function fnAlign(q, src="en", tgt="zhh") {
  if (!q) return bad("q required");
  // very naive baseline: look up headword in src, map via crossmap to tgt
  const srcRows = await supabaseQuery(`lexeme?headword=eq.${encodeURIComponent(q)}&lang=eq.${src}&select=id,headword`);
  if (!srcRows.length) return json({ query:q, src, tgt, results: [] });
  const srcId = srcRows[0].id;
  const maps = await supabaseQuery(`crossmap?src_lexeme_id=eq.${srcId}&select=tgt_lexeme_id`);
  if (!maps.length) return json({ query:q, src, tgt, results: [] });
  const tgtIds = maps.map(x => x.tgt_lexeme_id).join(",");
  const tgts = await supabaseQuery(`lexeme?id=in.(${tgtIds})&lang=eq.${tgt}&select=id,headword,lang,audio_url`);
  return json({ query:q, src, tgt, results: tgts });
}

async function fnNormalize(q) {
  if (!q) return bad("q required");
  const rules = await supabaseQuery(`rules?wrong_form=eq.${encodeURIComponent(q)}&select=wrong_form,correct_form,note`);
  if (rules.length) return json({ query:q, normalized: rules[0].correct_form, note: rules[0].note, confidence: 0.9 });
  return json({ query:q, normalized: q, confidence: 0.5 });
}

async function fnIngest(req) {
  // Protected by ADMIN_TOKEN
  const token = req.headers.get("x-admin-token") || "";
  if (!ADMIN_TOKEN || token !== ADMIN_TOKEN) return bad("unauthorized", 401);
  const body = await req.json();
  // body = { lexeme:[], sense:[], crossmap:[], rules:[] }
  const out = {};
  if (body.lexeme?.length) out.lexeme = await supabaseService("lexeme", body.lexeme);
  if (body.sense?.length) out.sense = await supabaseService("sense", body.sense);
  if (body.crossmap?.length) out.crossmap = await supabaseService("crossmap", body.crossmap);
  if (body.rules?.length) out.rules = await supabaseService("rules", body.rules);
  return json({ ok:true, inserted: Object.keys(out) });
}

export default async function handler(req) {
  try {
    const { searchParams } = new URL(req.url);
    const fn = searchParams.get("fn") || "lookup";
    if (!SUPABASE_URL || !SUPABASE_ANON_KEY) return bad("Supabase env not set", 500);

    if (fn === "lookup")  return fnLookup(searchParams.get("q"), searchParams.get("lang") || "zhh");
    if (fn === "align")   return fnAlign(searchParams.get("q"), searchParams.get("src") || "en", searchParams.get("tgt") || "zhh");
    if (fn === "normalize") return fnNormalize(searchParams.get("q"));
    if (fn === "ingest")  return fnIngest(req);

    return bad("unknown fn");
  } catch (e) {
    return json({ error: String(e && e.message or e) }, 500);
  }
}


// --- UGC helpers ---
async function fnContribList(){
  const items = await supabaseQuery(`user_contrib?status=eq.pending&select=id,headword,lang,gloss_chs,gloss_en,source_url,license,created_at`);
  return json({items});
}

async function fnContribSubmit(req){
  const body = await req.json();
  const payload = [{
    user_name: body.user_name || null,
    headword: body.headword,
    lang: body.lang || 'zhh',
    gloss_chs: body.gloss_chs || null,
    gloss_en: body.gloss_en || null,
    source_url: body.source_url || null,
    license: body.license || 'CC0',
    status: 'pending'
  }];
  const url = `${SUPABASE_URL}/rest/v1/user_contrib`;
  const headers = {
    apikey: SUPABASE_ANON_KEY,
    Authorization: `Bearer ${SUPABASE_ANON_KEY}`,
    "content-type": "application/json"
  };
  const res = await fetch(url, { method:'POST', headers, body: JSON.stringify(payload) });
  if (!res.ok) return bad(await res.text(), 500);
  return json({ok:true});
}

async function fnContribApprove(req){
  const token = req.headers.get("x-admin-token") || "";
  if (!ADMIN_TOKEN || token !== ADMIN_TOKEN) return bad("unauthorized", 401);
  const body = await req.json();
  const id = body.id;
  if (!id) return bad("id required");
  // move from user_contrib -> lexeme/sense (simple insert)
  const rows = await supbaseGetRow(`user_contrib?id=eq.${id}&select=*`);
  const row = rows && rows[0];
  if (!row) return bad("not found", 404);
  // insert lexeme + sense
  const lx = await supabaseService("lexeme", [{ headword: row.headword, lang: row.lang }]);
  const lexeme_id = lx[0].id;
  const sensePayload = [{ lexeme_id, gloss_chs: row.gloss_chs, gloss_en: row.gloss_en }];
  await supabaseService("sense", sensePayload);
  // mark approved
  const upd = await fetch(`${SUPABASE_URL}/rest/v1/user_contrib?id=eq.${id}`, {
    method:'PATCH',
    headers:{
      apikey: SUPABASE_SERVICE_ROLE,
      Authorization: `Bearer ${SUPABASE_SERVICE_ROLE}`,
      "content-type":"application/json"
    },
    body: JSON.stringify({ status: 'approved' })
  });
  if (!upd.ok) return bad(await upd.text(), 500);
  return json({ok:true, lexeme_id});
}

async function supbaseGetRow(path) {
  const url = `${SUPABASE_URL}/rest/v1/${path}`;
  const headers = {
    apikey: SUPABASE_ANON_KEY,
    Authorization: `Bearer ${SUPABASE_ANON_KEY}`
  };
  const res = await fetch(url, { headers });
  if (!res.ok) throw new Error(await res.text());
  return res.json();
}

// UGC endpoints
if (fn === 'contrib_list') return fnContribList();
if (fn === 'contrib_submit') return fnContribSubmit(req);
if (fn === 'contrib_approve') return fnContribApprove(req);
