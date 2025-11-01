export default {
  async fetch(request, env, ctx) {
    const url = new URL(request.url);
    if (!url.pathname.startsWith('/api/')) {
      return new Response(JSON.stringify({ error: 'not_found' }), { status: 404, headers: { 'content-type': 'application/json' } });
    }
    const fn = url.searchParams.get('fn') || '';
    const headers = {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET,POST,OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type, Authorization'
    };
    if (request.method === 'OPTIONS') return new Response(null, { status: 204, headers });
    if (fn === 'ping') {
      return new Response(JSON.stringify({ ok: true, ts: Date.now() }), { headers: { ...headers, 'content-type': 'application/json' } });
    }
    return new Response(JSON.stringify({ error: 'fn_not_found', hint: 'try /api/route?fn=ping' }), { status: 404, headers: { ...headers, 'content-type': 'application/json' } });
  }
};