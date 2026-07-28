import express from 'express'
import pool from '../db/index.js'

const router = express.Router()

function requireAuth(req, res, next) {
  if (!req.session.userId) return res.status(401).json({ error: 'Not authenticated' })
  next()
}

router.get('/rooms', async (req, res) => {
  const result = await pool.query('SELECT * FROM chat_rooms ORDER BY id ASC')
  res.json({ rooms: result.rows })
})

router.get('/rooms/:id/messages', requireAuth, async (req, res) => {
  const { limit = 50 } = req.query
  const result = await pool.query(
    `SELECT m.*, u.username, u.avatar_url FROM chat_messages m
     JOIN users u ON u.id=m.sender_id
     WHERE m.room_id=$1 AND m.is_dm=false ORDER BY m.created_at DESC LIMIT $2`,
    [req.params.id, Number(limit)]
  )
  res.json({ messages: result.rows.reverse() })
})

router.get('/dm/:userId', requireAuth, async (req, res) => {
  const myId = req.session.userId
  const otherId = req.params.userId
  const result = await pool.query(
    `SELECT m.*, u.username, u.avatar_url FROM chat_messages m
     JOIN users u ON u.id=m.sender_id
     WHERE m.is_dm=true
       AND ((m.sender_id=$1 AND m.recipient_id=$2) OR (m.sender_id=$2 AND m.recipient_id=$1))
     ORDER BY m.created_at ASC LIMIT 100`,
    [myId, otherId]
  )
  res.json({ messages: result.rows })
})

router.get('/dm-list', requireAuth, async (req, res) => {
  const myId = req.session.userId
  const result = await pool.query(
    `SELECT DISTINCT ON (other_user)
       CASE WHEN m.sender_id=$1 THEN m.recipient_id ELSE m.sender_id END AS other_user,
       u.username, u.avatar_url,
       m.content AS last_message, m.created_at
     FROM chat_messages m
     JOIN users u ON u.id = CASE WHEN m.sender_id=$1 THEN m.recipient_id ELSE m.sender_id END
     WHERE m.is_dm=true AND (m.sender_id=$1 OR m.recipient_id=$1)
     ORDER BY other_user, m.created_at DESC`,
    [myId]
  )
  res.json({ dms: result.rows })
})

export default router
