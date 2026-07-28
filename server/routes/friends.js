import express from 'express'
import pool from '../db/index.js'
import { createNotification } from './notifications.js'
import { logAction } from '../lib/audit.js'
import { checkSoftBanned } from '../middleware/checkSoftBanned.js'

const router = express.Router()

function requireAuth(req, res, next) {
  if (!req.session.userId) return res.status(401).json({ error: 'Not authenticated' })
  next()
}

// Get friends list + pending requests
router.get('/', requireAuth, async (req, res) => {
  const uid = req.session.userId
  try {
    const friends = await pool.query(`
      SELECT u.id, u.username, u.avatar_url, u.platform,
        f.status,
        CASE WHEN f.requester_id = $1 THEN 'sent' ELSE 'received' END AS direction
      FROM friends f
      JOIN users u ON u.id = CASE WHEN f.requester_id=$1 THEN f.addressee_id ELSE f.requester_id END
      WHERE (f.requester_id=$1 OR f.addressee_id=$1)
      ORDER BY f.status, u.username
    `, [uid])
    res.json({ friends: friends.rows })
  } catch (err) {
    res.status(500).json({ error: 'Server error' })
  }
})

// Send friend request
router.post('/request', requireAuth, checkSoftBanned, async (req, res) => {
  const { addressee_id } = req.body
  const uid = req.session.userId
  if (!addressee_id || addressee_id === uid) return res.status(400).json({ error: 'Invalid target' })
  try {
    await pool.query(
      `INSERT INTO friends (requester_id, addressee_id, status) VALUES ($1,$2,'pending')
       ON CONFLICT (requester_id, addressee_id) DO NOTHING`,
      [uid, addressee_id]
    )
    const sender = await pool.query('SELECT username FROM users WHERE id=$1', [uid])
    await createNotification(addressee_id, 'friend_request', `${sender.rows[0].username} sent you a friend request`, `/friends`, uid)

    await logAction(pool, {
      userId: uid,
      username: sender.rows[0]?.username,
      action: 'friend.request_sent',
      targetType: 'user',
      targetId: addressee_id,
      ip: req.ip,
      userAgent: req.headers['user-agent']
    })
    res.json({ ok: true })
  } catch (err) {
    res.status(500).json({ error: 'Server error' })
  }
})

// Accept / decline
router.post('/respond', requireAuth, async (req, res) => {
  const { requester_id, action } = req.body
  const uid = req.session.userId
  if (!['accept', 'decline'].includes(action)) return res.status(400).json({ error: 'Invalid action' })
  try {
    const userRes = await pool.query('SELECT username FROM users WHERE id=$1', [uid])
    if (action === 'accept') {
      await pool.query(
        `UPDATE friends SET status='accepted' WHERE requester_id=$1 AND addressee_id=$2`,
        [requester_id, uid]
      )
      await createNotification(requester_id, 'friend_accept', `${userRes.rows[0].username} accepted your friend request`, `/friends`, uid)
      await logAction(pool, {
        userId: uid,
        username: userRes.rows[0]?.username,
        action: 'friend.request_accepted',
        targetType: 'user',
        targetId: requester_id,
        ip: req.ip,
        userAgent: req.headers['user-agent']
      })
    } else {
      await pool.query(
        `DELETE FROM friends WHERE requester_id=$1 AND addressee_id=$2`,
        [requester_id, uid]
      )
      await logAction(pool, {
        userId: uid,
        username: userRes.rows[0]?.username,
        action: 'friend.request_rejected',
        targetType: 'user',
        targetId: requester_id,
        ip: req.ip,
        userAgent: req.headers['user-agent']
      })
    }
    res.json({ ok: true })
  } catch (err) {
    res.status(500).json({ error: 'Server error' })
  }
})

// Remove friend
router.delete('/:friendId', requireAuth, async (req, res) => {
  const uid = req.session.userId
  const fid = req.params.friendId
  try {
    await pool.query(
      `DELETE FROM friends WHERE (requester_id=$1 AND addressee_id=$2) OR (requester_id=$2 AND addressee_id=$1)`,
      [uid, fid]
    )
    const userRes = await pool.query('SELECT username FROM users WHERE id=$1', [uid])
    await logAction(pool, {
      userId: uid,
      username: userRes.rows[0]?.username,
      action: 'friend.removed',
      targetType: 'user',
      targetId: Number(fid),
      ip: req.ip,
      userAgent: req.headers['user-agent']
    })
    res.json({ ok: true })
  } catch (err) {
    res.status(500).json({ error: 'Server error' })
  }
})

// Search users
router.get('/search', requireAuth, async (req, res) => {
  const { q } = req.query
  if (!q || q.length < 2) return res.json({ users: [] })
  try {
    const result = await pool.query(
      `SELECT u.id, u.username, u.avatar_url, u.platform,
        f.status,
        CASE WHEN f.requester_id=$1 THEN 'sent' WHEN f.addressee_id=$1 THEN 'received' ELSE NULL END AS direction
       FROM users u
       LEFT JOIN friends f ON (f.requester_id=$1 AND f.addressee_id=u.id) OR (f.addressee_id=$1 AND f.requester_id=u.id)
       WHERE u.username ILIKE $2 AND u.id != $1
       LIMIT 10`,
      [req.session.userId, `%${q}%`]
    )
    res.json({ users: result.rows })
  } catch (err) {
    res.status(500).json({ error: 'Server error' })
  }
})

export default router
