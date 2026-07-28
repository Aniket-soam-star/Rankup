import pool from '../db/index.js'

export async function checkApiBan(req, res, next) {
  if (!req.session?.userId) return next()
  try {
    const r = await pool.query(
      `SELECT id FROM api_bans
       WHERE user_id=$1
         AND (expires_at IS NULL OR expires_at > NOW())
       LIMIT 1`,
      [req.session.userId]
    )
    if (r.rows[0]) {
      return res.status(403).json({ error: 'Your API access has been revoked.' })
    }
    next()
  } catch (err) {
    next()
  }
}
