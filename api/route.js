// Bridge to /web/api/route.js so we don't have to move your existing file.
// Works on Edge/Node runtimes with ESM dynamic import.

export default async function handler(req, res) {
  try {
    const mod = await import('../web/api/route.js?ts=' + Date.now());
    const fn = mod.default || mod.handler || mod;
    return fn(req, res);
  } catch (e) {
    res
      .status(500)
      .json({ ok: false, error: 'route-bridge-failed', detail: String(e) });
  }
}
