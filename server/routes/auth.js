import express from 'express'
import pool from '../db/index.js'
import crypto from 'crypto'
import { logAction } from '../lib/audit.js'

const router = express.Router()

function hashPassword(password) {
  return crypto.createHash('sha256').update(password + process.env.SESSION_SECRET).digest('hex')
}

function generateAvatar(username) {
  return `https://api.dicebear.com/7.x/avataaars/svg?seed=${encodeURIComponent(username)}`
}

router.post('/register', async (req, res) => {
  const { username, email, password, date_of_birth } = req.body
  if (!username || !email || !password) {
    return res.status(400).json({ error: 'All fields required' })
  }
  if (username.length < 3 || username.length > 32) {
    return res.status(400).json({ error: 'Username must be 3-32 characters' })
  }
  if (password.length < 6) {
    return res.status(400).json({ error: 'Password must be at least 6 characters' })
  }

  // Age validation
  let dob = null
  if (date_of_birth) {
    dob = new Date(date_of_birth)
    if (isNaN(dob.getTime())) {
      return res.status(400).json({ error: 'Invalid date_of_birth format. Use YYYY-MM-DD' })
    }
    const today = new Date()
    let age = today.getFullYear() - dob.getFullYear()
    const m = today.getMonth() - dob.getMonth()
    if (m < 0 || (m === 0 && today.getDate() < dob.getDate())) age--
    if (age < 13) {
      return res.status(400).json({ error: 'You must be at least 13 years old to register' })
    }
  }

  try {
    const hash = hashPassword(password)
    const avatar = generateAvatar(username)
    const result = await pool.query(
      `INSERT INTO users (username, email, password_hash, avatar_url, date_of_birth)
       VALUES ($1, $2, $3, $4, $5)
       RETURNING id, username, email, avatar_url, bio, favorite_games, platform, date_of_birth, created_at`,
      [username.trim(), email.toLowerCase().trim(), hash, avatar, dob]
    )
    const user = result.rows[0]
    req.session.userId = user.id
    req.session.username = user.username

    await logAction(pool, {
      userId: user.id,
      username: user.username,
      action: 'user.register',
      targetType: 'user',
      targetId: user.id,
      details: { email: user.email },
      ip: req.ip,
      userAgent: req.headers['user-agent']
    })

    res.json({ user })
  } catch (err) {
    if (err.code === '23505') {
      const field = err.constraint?.includes('email') ? 'Email' : 'Username'
      return res.status(409).json({ error: `${field} already taken` })
    }
    console.error(err)
    res.status(500).json({ error: 'Server error' })
  }
})

router.post('/login', async (req, res) => {
  const { email, password } = req.body
  if (!email || !password) return res.status(400).json({ error: 'All fields required' })
  try {
    const hash = hashPassword(password)
    const result = await pool.query(
      `SELECT id, username, email, avatar_url, bio, favorite_games, platform, date_of_birth, created_at,
              soft_banned, soft_ban_reason
       FROM users WHERE (email=$1 OR username=$1) AND password_hash=$2`,
      [email.toLowerCase().trim(), hash]
    )
    if (!result.rows[0]) return res.status(401).json({ error: 'Invalid credentials' })
    const user = result.rows[0]
    req.session.userId = user.id
    req.session.username = user.username

    await logAction(pool, {
      userId: user.id,
      username: user.username,
      action: 'user.login',
      targetType: 'user',
      targetId: user.id,
      ip: req.ip,
      userAgent: req.headers['user-agent']
    })

    res.json({ user })
  } catch (err) {
    console.error(err)
    res.status(500).json({ error: 'Server error' })
  }
})

router.post('/logout', async (req, res) => {
  const userId = req.session.userId
  const username = req.session.username
  req.session.destroy()

  await logAction(pool, {
    userId,
    username,
    action: 'user.logout',
    ip: req.ip,
    userAgent: req.headers['user-agent']
  }).catch(() => {})

  res.json({ ok: true })
})

router.get('/me', async (req, res) => {
  if (!req.session.userId) return res.status(401).json({ error: 'Not authenticated' })
  try {
    const result = await pool.query(
      `SELECT id, username, email, avatar_url, bio, favorite_games, platform, date_of_birth,
              soft_banned, soft_ban_reason, created_at
       FROM users WHERE id=$1`,
      [req.session.userId]
    )
    if (!result.rows[0]) return res.status(404).json({ error: 'User not found' })
    res.json({ user: result.rows[0] })
  } catch (err) {
    res.status(500).json({ error: 'Server error' })
  }
})

export default router
