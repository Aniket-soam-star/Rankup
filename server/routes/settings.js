import express from 'express'
import pool from '../db/index.js'
import { logAction } from '../lib/audit.js'

const router = express.Router()

function requireAuth(req, res, next) {
  if (!req.session.userId) return res.status(401).json({ error: 'Not authenticated' })
  next()
}

const VALID_THEMES = ['dark', 'light', 'system', 'midnight', 'solarized']
const VALID_FONT_SIZES = ['small', 'medium', 'large']
const VALID_SIDEBAR = ['left', 'right']
const VALID_LANGUAGES = ['en', 'es', 'fr', 'de', 'pt', 'ja', 'ko', 'zh']
const ACCENT_RE = /^#[0-9a-fA-F]{6}$/

router.get('/', requireAuth, async (req, res) => {
  const uid = req.session.userId
  try {
    let r = await pool.query('SELECT * FROM user_settings WHERE user_id=$1', [uid])
    if (!r.rows[0]) {
      // Create defaults
      await pool.query(
        `INSERT INTO user_settings (user_id) VALUES ($1) ON CONFLICT DO NOTHING`,
        [uid]
      )
      r = await pool.query('SELECT * FROM user_settings WHERE user_id=$1', [uid])
    }
    res.json({ settings: r.rows[0] })
  } catch (err) {
    console.error(err)
    res.status(500).json({ error: 'Server error' })
  }
})

router.patch('/', requireAuth, async (req, res) => {
  const uid = req.session.userId
  const allowed = ['theme', 'accent_color', 'font_size', 'compact_mode', 'show_online_status', 'sound_effects', 'sidebar_position', 'language']
  const updates = []
  const values = []
  let idx = 1

  for (const key of allowed) {
    if (req.body[key] === undefined) continue
    const val = req.body[key]

    // Validate
    if (key === 'theme' && !VALID_THEMES.includes(val)) return res.status(400).json({ error: `Invalid theme. Must be one of: ${VALID_THEMES.join(', ')}` })
    if (key === 'font_size' && !VALID_FONT_SIZES.includes(val)) return res.status(400).json({ error: `Invalid font_size. Must be one of: ${VALID_FONT_SIZES.join(', ')}` })
    if (key === 'sidebar_position' && !VALID_SIDEBAR.includes(val)) return res.status(400).json({ error: `Invalid sidebar_position. Must be one of: ${VALID_SIDEBAR.join(', ')}` })
    if (key === 'language' && !VALID_LANGUAGES.includes(val)) return res.status(400).json({ error: `Invalid language. Must be one of: ${VALID_LANGUAGES.join(', ')}` })
    if (key === 'accent_color' && !ACCENT_RE.test(val)) return res.status(400).json({ error: 'Invalid accent_color. Must be a hex color like #7c3aed' })
    if (['compact_mode', 'show_online_status', 'sound_effects'].includes(key) && typeof val !== 'boolean') {
      return res.status(400).json({ error: `${key} must be a boolean` })
    }

    updates.push(`${key}=$${idx++}`)
    values.push(val)
  }

  if (updates.length === 0) return res.status(400).json({ error: 'No valid fields to update' })

  values.push(uid)
  try {
    // Upsert
    await pool.query(
      `INSERT INTO user_settings (user_id) VALUES ($1) ON CONFLICT (user_id) DO NOTHING`,
      [uid]
    )
    const result = await pool.query(
      `UPDATE user_settings SET ${updates.join(', ')}, updated_at=NOW() WHERE user_id=$${idx} RETURNING *`,
      values
    )

    const userRes = await pool.query('SELECT username FROM users WHERE id=$1', [uid])
    await logAction(pool, {
      userId: uid,
      username: userRes.rows[0]?.username,
      action: 'settings.updated',
      details: req.body,
      ip: req.ip,
      userAgent: req.headers['user-agent']
    })

    res.json({ settings: result.rows[0] })
  } catch (err) {
    console.error(err)
    res.status(500).json({ error: 'Server error' })
  }
})

export default router
