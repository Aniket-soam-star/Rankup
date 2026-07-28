import pool from '../db/index.js'

export async function checkSoftBanned(req, res, next) {
  if (!req.session?.userId) return next()
  try {
    const r = await pool.query(
      'SELECT soft_banned, soft_ban_reason FROM users WHERE id=$1',
      [req.session.userId]
    )
    const user = r.rows[0]
    if (user?.soft_banned) {
      return res.status(403).json({
        error: `Your account has been restricted. Reason: ${user.soft_ban_reason || 'No reason provided'}`
      })
    }
    next()
  } catch (err) {
    next()
  }
}
