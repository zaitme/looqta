export default async function handler(req, res) {
  console.log('[Health API] Handler called');
  res.status(200).json({ ok: true, message: 'Health check works', timestamp: new Date().toISOString() });
}
