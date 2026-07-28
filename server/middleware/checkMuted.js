import pool from '../db/index.js'

export async function checkMuted(req, res, next) {
  if (!req.session?.userId) return next()
  try {
    const r = await pool.query(
      'SELECT muted_until, mute_reason FROM users WHERE id=$1',
      [req.session.userId]
    )
    const user = r.rows[0]
    if (user?.muted_until && new Date(user.muted_until) > new Date()) {
      const date = new Date(user.muted_until).toLocaleString()
      return res.status(403).json({
        error: `You are muted until ${date}. Reason: ${user.mute_reason || 'No reason provided'}`
      })
    }
    next()
  } catch (err) {
    next()
  }
}
