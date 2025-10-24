export default async function handler(req, res) {
  return res.status(200).json({ ok: true, now: new Date().toISOString(), note: "KV + Embeddings edition running" });
}
