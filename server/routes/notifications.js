import express from 'express'
import pool from '../db/index.js'

const router = express.Router()

function requireAuth(req, res, next) {
  if (!req.session.userId) return res.status(401).json({ error: 'Not authenticated' })
  next()
}

export async function createNotification(userId, type, content, link = null, actorId = null) {
  try {
    await pool.query(
      `INSERT INTO notifications (user_id, type, content, link, actor_id) VALUES ($1,$2,$3,$4,$5)`,
      [userId, type, content, link, actorId]
    )
  } catch (err) {
    console.error('Notification error:', err.message)
  }
}

router.get('/', requireAuth, async (req, res) => {
  try {
    const result = await pool.query(`
      SELECT n.*, u.username AS actor_username, u.avatar_url AS actor_avatar
      FROM notifications n
      LEFT JOIN users u ON u.id = n.actor_id
      WHERE n.user_id = $1
      ORDER BY n.created_at DESC LIMIT 30
    `, [req.session.userId])
    res.json({ notifications: result.rows })
  } catch (err) {
    res.status(500).json({ error: 'Server error' })
  }
})

router.get('/unread-count', requireAuth, async (req, res) => {
  try {
    const result = await pool.query(
      `SELECT COUNT(*) FROM notifications WHERE user_id=$1 AND read=false`,
      [req.session.userId]
    )
    res.json({ count: Number(result.rows[0].count) })
  } catch (err) {
    res.status(500).json({ error: 'Server error' })
  }
})

router.post('/read-all', requireAuth, async (req, res) => {
  try {
    await pool.query(`UPDATE notifications SET read=true WHERE user_id=$1`, [req.session.userId])
    res.json({ ok: true })
  } catch (err) {
    res.status(500).json({ error: 'Server error' })
  }
})

router.delete('/:id', requireAuth, async (req, res) => {
  try {
    await pool.query(`DELETE FROM notifications WHERE id=$1 AND user_id=$2`, [req.params.id, req.session.userId])
    res.json({ ok: true })
  } catch (err) {
    res.status(500).json({ error: 'Server error' })
  }
})

export default router
