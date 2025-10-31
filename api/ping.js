export default function handler(req, res) {
  res.status(200).json({
    ok: true,
    message: "CanTong API alive",
    time: new Date().toISOString()
  });
}
