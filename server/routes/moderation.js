import express from 'express'
import pool from '../db/index.js'
import { logAction } from '../lib/audit.js'

const router = express.Router()

function requireAuth(req, res, next) {
  if (!req.session.userId) return res.status(401).json({ error: 'Not authenticated' })
  next()
}

router.post('/report', requireAuth, async (req, res) => {
  const { target_type, target_id, reason } = req.body
  if (!target_type || !target_id || !reason) {
    return res.status(400).json({ error: 'target_type, target_id and reason required' })
  }
  try {
    await pool.query(
      'INSERT INTO reports (reporter_id, target_type, target_id, reason) VALUES ($1,$2,$3,$4)',
      [req.session.userId, target_type, target_id, reason]
    )
    const userRes = await pool.query('SELECT username FROM users WHERE id=$1', [req.session.userId])
    await logAction(pool, {
      userId: req.session.userId,
      username: userRes.rows[0]?.username,
      action: 'user.reported',
      targetType: target_type,
      targetId: target_id,
      details: { reason },
      ip: req.ip,
      userAgent: req.headers['user-agent']
    })
    res.json({ ok: true })
  } catch (err) {
    res.status(500).json({ error: 'Server error' })
  }
})

router.post('/block', requireAuth, async (req, res) => {
  const { blocked_id } = req.body
  if (!blocked_id) return res.status(400).json({ error: 'blocked_id required' })
  if (blocked_id === req.session.userId) return res.status(400).json({ error: 'Cannot block yourself' })
  try {
    await pool.query(
      'INSERT INTO blocks (blocker_id, blocked_id) VALUES ($1,$2) ON CONFLICT DO NOTHING',
      [req.session.userId, blocked_id]
    )
    const userRes = await pool.query('SELECT username FROM users WHERE id=$1', [req.session.userId])
    await logAction(pool, {
      userId: req.session.userId,
      username: userRes.rows[0]?.username,
      action: 'user.blocked',
      targetType: 'user',
      targetId: blocked_id,
      ip: req.ip,
      userAgent: req.headers['user-agent']
    })
    res.json({ ok: true })
  } catch (err) {
    res.status(500).json({ error: 'Server error' })
  }
})

router.post('/unblock', requireAuth, async (req, res) => {
  const { blocked_id } = req.body
  try {
    await pool.query('DELETE FROM blocks WHERE blocker_id=$1 AND blocked_id=$2', [req.session.userId, blocked_id])
    res.json({ ok: true })
  } catch (err) {
    res.status(500).json({ error: 'Server error' })
  }
})

router.get('/blocks', requireAuth, async (req, res) => {
  try {
    const result = await pool.query(
      `SELECT b.blocked_id, u.username FROM blocks b JOIN users u ON u.id=b.blocked_id WHERE b.blocker_id=$1`,
      [req.session.userId]
    )
    res.json({ blocks: result.rows })
  } catch (err) {
    res.status(500).json({ error: 'Server error' })
  }
})

export default router
