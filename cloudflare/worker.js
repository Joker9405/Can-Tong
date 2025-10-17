export default {
  async fetch(request, env, ctx) {
    if (request.method === "OPTIONS") {
      return new Response(null, { headers: corsHeaders() });
    }
    if (new URL(request.url).pathname !== "/tts") {
      return new Response("Not found", { status: 404 });
    }
    try {
      const body = await request.json();
      const text = (body && body.text) || "你好";
      const q = new URLSearchParams({ ie: "UTF-8", tl: "zh-CN", client: "tw-ob", q: text });
      const r = await fetch("https://translate.google.com/translate_tts?" + q.toString(), { headers: { "User-Agent": "Mozilla/5.0" } });
      if (!r.ok) return new Response("Upstream error", { status: 502 });
      const buf = await r.arrayBuffer();
      return new Response(buf, { headers: { "Content-Type": "audio/mpeg", ...corsHeaders(), "Cache-Control": "no-store" } });
    } catch (e) {
      return new Response(JSON.stringify({ error: String(e) }), { status: 500, headers: { "Content-Type": "application/json", ...corsHeaders() } });
    }
  }
};
function corsHeaders(){ return { "Access-Control-Allow-Origin": "*", "Access-Control-Allow-Headers": "Content-Type, Authorization", "Access-Control-Allow-Methods": "POST, OPTIONS" }; }