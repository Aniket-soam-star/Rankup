import express from 'express'
import pool from '../db/index.js'
import { logAction } from '../lib/audit.js'

const router = express.Router()

function requireAuth(req, res, next) {
  if (!req.session.userId) return res.status(401).json({ error: 'Not authenticated' })
  next()
}

// GET /api/users/search?q=:query — up to 8 users whose username starts with q
router.get('/search', requireAuth, async (req, res) => {
  const { q } = req.query
  if (!q || q.length < 1) return res.json({ users: [] })
  try {
    const result = await pool.query(
      `SELECT id, username, avatar_url FROM users
       WHERE username ILIKE $1 AND id != $2
       ORDER BY username ASC LIMIT 8`,
      [`${q}%`, req.session.userId]
    )
    res.json({ users: result.rows })
  } catch (err) {
    res.status(500).json({ error: 'Server error' })
  }
})

router.get('/:id', async (req, res) => {
  try {
    const result = await pool.query(
      'SELECT id, username, avatar_url, bio, favorite_games, platform, created_at FROM users WHERE id=$1',
      [req.params.id]
    )
    if (!result.rows[0]) return res.status(404).json({ error: 'User not found' })
    res.json({ user: result.rows[0] })
  } catch (err) {
    res.status(500).json({ error: 'Server error' })
  }
})

// GET /api/users/:id/clan
router.get('/:id/clan', requireAuth, async (req, res) => {
  try {
    const result = await pool.query(`
      SELECT c.id, c.name, c.description, c.tag, c.avatar_url, c.created_at,
        cm.role, cm.joined_at,
        (SELECT COUNT(*) FROM clan_members WHERE clan_id = c.id)::int AS member_count
      FROM clan_members cm
      JOIN clans c ON c.id = cm.clan_id
      WHERE cm.user_id = $1
      LIMIT 1
    `, [req.params.id])
    res.json({ clan: result.rows[0] || null })
  } catch (err) {
    res.status(500).json({ error: 'Server error' })
  }
})

// PUT /api/users/me
router.put('/me', requireAuth, async (req, res) => {
  const { username, avatar_url, bio, favorite_games, platform } = req.body
  try {
    const updates = []
    const values = []
    let idx = 1
    if (username !== undefined) { updates.push(`username=$${idx++}`); values.push(username) }
    if (avatar_url !== undefined) { updates.push(`avatar_url=$${idx++}`); values.push(avatar_url) }
    if (bio !== undefined) { updates.push(`bio=$${idx++}`); values.push(bio) }
    if (favorite_games !== undefined) { updates.push(`favorite_games=$${idx++}`); values.push(favorite_games) }
    if (platform !== undefined) { updates.push(`platform=$${idx++}`); values.push(platform) }
    if (updates.length === 0) return res.status(400).json({ error: 'Nothing to update' })
    values.push(req.session.userId)
    const result = await pool.query(
      `UPDATE users SET ${updates.join(', ')} WHERE id=$${idx} RETURNING id, username, email, avatar_url, bio, favorite_games, platform, created_at`,
      values
    )
    req.session.username = result.rows[0].username

    await logAction(pool, {
      userId: req.session.userId,
      username: result.rows[0].username,
      action: 'user.update_profile',
      targetType: 'user',
      targetId: req.session.userId,
      details: { fields: Object.keys(req.body) },
      ip: req.ip,
      userAgent: req.headers['user-agent']
    })

    res.json({ user: result.rows[0] })
  } catch (err) {
    if (err.code === '23505') return res.status(409).json({ error: 'Username already taken' })
    res.status(500).json({ error: 'Server error' })
  }
})

export default router
