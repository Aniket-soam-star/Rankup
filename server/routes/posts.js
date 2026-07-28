import express from 'express'
import pool from '../db/index.js'
import { filterContent } from '../lib/filter.js'
import { checkAndAwardAchievements } from './achievements.js'
import { logAction } from '../lib/audit.js'
import { checkMuted } from '../middleware/checkMuted.js'
import { checkSoftBanned } from '../middleware/checkSoftBanned.js'

const router = express.Router()

function requireAuth(req, res, next) {
  if (!req.session.userId) return res.status(401).json({ error: 'Not authenticated' })
  next()
}

const MENTION_RE = /@([a-zA-Z0-9_]+)/g
const TAG_RE = /^[a-zA-Z0-9-]+$/
const MAX_TAGS = 5
const MAX_TAG_LEN = 30

async function processMentions(db, content, fromUserId, postId) {
  const matches = [...content.matchAll(MENTION_RE)]
  if (!matches.length) return
  const usernames = [...new Set(matches.map(m => m[1].toLowerCase()))]
  for (const uname of usernames) {
    try {
      const r = await db.query('SELECT id, username FROM users WHERE LOWER(username)=$1', [uname])
      if (!r.rows[0]) continue
      const mentionedUser = r.rows[0]
      if (mentionedUser.id === fromUserId) continue
      const sender = await db.query('SELECT username FROM users WHERE id=$1', [fromUserId])
      await db.query(
        `INSERT INTO notifications (user_id, type, content, link, actor_id)
         VALUES ($1,'mention',$2,$3,$4)`,
        [
          mentionedUser.id,
          `@${sender.rows[0]?.username} mentioned you in a post`,
          `/posts/${postId}`,
          fromUserId
        ]
      )
    } catch {}
  }
}

function normalizeTags(tags) {
  if (!Array.isArray(tags)) return []
  const normalized = []
  for (let tag of tags.slice(0, MAX_TAGS)) {
    tag = String(tag).toLowerCase().replace(/^#+/, '')
    if (!tag || tag.length > MAX_TAG_LEN) continue
    if (!TAG_RE.test(tag)) continue
    normalized.push(`#${tag}`)
  }
  return normalized
}

// GET /api/posts
router.get('/', async (req, res) => {
  const { tag, limit = 20, offset = 0 } = req.query
  try {
    let query = `
      SELECT p.*, u.username, u.avatar_url,
        COUNT(DISTINCT l.id) AS like_count,
        COUNT(DISTINCT c.id) AS comment_count,
        MAX(CASE WHEN l.user_id=$1 THEN 1 ELSE 0 END) AS user_liked
      FROM posts p
      JOIN users u ON u.id = p.user_id
      LEFT JOIN likes l ON l.post_id = p.id
      LEFT JOIN comments c ON c.post_id = p.id
    `
    const values = [req.session.userId || 0]
    if (tag) {
      const t = tag.startsWith('#') ? tag : `#${tag}`
      query += ` WHERE $2=ANY(p.tags)`
      values.push(t)
    }
    query += ` GROUP BY p.id, u.username, u.avatar_url ORDER BY p.created_at DESC LIMIT $${values.length+1} OFFSET $${values.length+2}`
    values.push(Number(limit), Number(offset))
    const result = await pool.query(query, values)
    res.json({ posts: result.rows })
  } catch (err) {
    console.error(err)
    res.status(500).json({ error: 'Server error' })
  }
})

// GET /api/posts/trending-tags
router.get('/trending-tags', async (req, res) => {
  try {
    const result = await pool.query(`
      SELECT tag, COUNT(*) AS count
      FROM (
        SELECT UNNEST(tags) AS tag FROM posts
        WHERE created_at > NOW() - INTERVAL '7 days'
      ) t
      GROUP BY tag
      ORDER BY count DESC
      LIMIT 20
    `)
    res.json({ tags: result.rows })
  } catch (err) {
    console.error(err)
    res.status(500).json({ error: 'Server error' })
  }
})

// POST /api/posts
router.post('/', requireAuth, checkSoftBanned, checkMuted, async (req, res) => {
  let { content, image_url, tags } = req.body
  if (!content?.trim()) return res.status(400).json({ error: 'Content required' })
  content = filterContent(content)

  const normalizedTags = normalizeTags(tags || [])

  try {
    const result = await pool.query(
      `INSERT INTO posts (user_id, content, image_url, tags) VALUES ($1,$2,$3,$4)
       RETURNING *, (SELECT username FROM users WHERE id=$1) as username, (SELECT avatar_url FROM users WHERE id=$1) as avatar_url`,
      [req.session.userId, content, image_url || null, normalizedTags]
    )
    const post = result.rows[0]
    checkAndAwardAchievements(req.session.userId).catch(() => {})

    // Process @mentions asynchronously
    processMentions(pool, content, req.session.userId, post.id).catch(() => {})

    const userRes = await pool.query('SELECT username FROM users WHERE id=$1', [req.session.userId])
    await logAction(pool, {
      userId: req.session.userId,
      username: userRes.rows[0]?.username,
      action: 'post.create',
      targetType: 'post',
      targetId: post.id,
      ip: req.ip,
      userAgent: req.headers['user-agent']
    })

    res.json({ post: { ...post, like_count: 0, comment_count: 0, user_liked: 0 } })
  } catch (err) {
    console.error(err)
    res.status(500).json({ error: 'Server error' })
  }
})

// DELETE /api/posts/:id
router.delete('/:id', requireAuth, async (req, res) => {
  try {
    const r = await pool.query('DELETE FROM posts WHERE id=$1 AND user_id=$2 RETURNING id', [req.params.id, req.session.userId])
    if (r.rowCount === 0) return res.status(404).json({ error: 'Post not found or not yours' })

    const userRes = await pool.query('SELECT username FROM users WHERE id=$1', [req.session.userId])
    await logAction(pool, {
      userId: req.session.userId,
      username: userRes.rows[0]?.username,
      action: 'post.delete',
      targetType: 'post',
      targetId: Number(req.params.id),
      ip: req.ip,
      userAgent: req.headers['user-agent']
    })

    res.json({ ok: true })
  } catch (err) {
    res.status(500).json({ error: 'Server error' })
  }
})

// POST /api/posts/:id/like
router.post('/:id/like', requireAuth, async (req, res) => {
  try {
    const existing = await pool.query('SELECT id FROM likes WHERE post_id=$1 AND user_id=$2', [req.params.id, req.session.userId])
    const userRes = await pool.query('SELECT username FROM users WHERE id=$1', [req.session.userId])

    if (existing.rows[0]) {
      await pool.query('DELETE FROM likes WHERE post_id=$1 AND user_id=$2', [req.params.id, req.session.userId])
      await logAction(pool, {
        userId: req.session.userId,
        username: userRes.rows[0]?.username,
        action: 'post.unlike',
        targetType: 'post',
        targetId: Number(req.params.id),
        ip: req.ip,
        userAgent: req.headers['user-agent']
      })
      res.json({ liked: false })
    } else {
      await pool.query('INSERT INTO likes (post_id, user_id) VALUES ($1,$2)', [req.params.id, req.session.userId])
      await logAction(pool, {
        userId: req.session.userId,
        username: userRes.rows[0]?.username,
        action: 'post.like',
        targetType: 'post',
        targetId: Number(req.params.id),
        ip: req.ip,
        userAgent: req.headers['user-agent']
      })
      res.json({ liked: true })
    }
  } catch (err) {
    res.status(500).json({ error: 'Server error' })
  }
})

// GET /api/posts/:id/comments
router.get('/:id/comments', async (req, res) => {
  try {
    const result = await pool.query(
      `SELECT c.*, u.username, u.avatar_url FROM comments c
       JOIN users u ON u.id=c.user_id WHERE c.post_id=$1 ORDER BY c.created_at ASC`,
      [req.params.id]
    )
    res.json({ comments: result.rows })
  } catch (err) {
    res.status(500).json({ error: 'Server error' })
  }
})

// POST /api/posts/:id/comments
router.post('/:id/comments', requireAuth, checkSoftBanned, checkMuted, async (req, res) => {
  let { content } = req.body
  if (!content?.trim()) return res.status(400).json({ error: 'Content required' })
  content = filterContent(content)
  try {
    const result = await pool.query(
      `INSERT INTO comments (post_id, user_id, content) VALUES ($1,$2,$3)
       RETURNING *, (SELECT username FROM users WHERE id=$2) as username, (SELECT avatar_url FROM users WHERE id=$2) as avatar_url`,
      [req.params.id, req.session.userId, content]
    )
    const comment = result.rows[0]

    // Process @mentions in comments
    processMentions(pool, content, req.session.userId, req.params.id).catch(() => {})

    const userRes = await pool.query('SELECT username FROM users WHERE id=$1', [req.session.userId])
    await logAction(pool, {
      userId: req.session.userId,
      username: userRes.rows[0]?.username,
      action: 'comment.create',
      targetType: 'post',
      targetId: Number(req.params.id),
      ip: req.ip,
      userAgent: req.headers['user-agent']
    })

    res.json({ comment })
  } catch (err) {
    res.status(500).json({ error: 'Server error' })
  }
})

// DELETE /api/posts/:id/comments/:commentId
router.delete('/:id/comments/:commentId', requireAuth, async (req, res) => {
  try {
    await pool.query('DELETE FROM comments WHERE id=$1 AND user_id=$2', [req.params.commentId, req.session.userId])

    const userRes = await pool.query('SELECT username FROM users WHERE id=$1', [req.session.userId])
    await logAction(pool, {
      userId: req.session.userId,
      username: userRes.rows[0]?.username,
      action: 'comment.delete',
      targetType: 'comment',
      targetId: Number(req.params.commentId),
      ip: req.ip,
      userAgent: req.headers['user-agent']
    })
    res.json({ ok: true })
  } catch (err) {
    res.status(500).json({ error: 'Server error' })
  }
})

// POST /api/posts/:id/report
router.post('/:id/report', requireAuth, async (req, res) => {
  const { reason } = req.body
  if (!reason) return res.status(400).json({ error: 'reason required' })
  try {
    await pool.query(
      'INSERT INTO reports (reporter_id, target_type, target_id, reason) VALUES ($1,$2,$3,$4)',
      [req.session.userId, 'post', req.params.id, reason]
    )
    const userRes = await pool.query('SELECT username FROM users WHERE id=$1', [req.session.userId])
    await logAction(pool, {
      userId: req.session.userId,
      username: userRes.rows[0]?.username,
      action: 'post.report',
      targetType: 'post',
      targetId: Number(req.params.id),
      details: { reason },
      ip: req.ip,
      userAgent: req.headers['user-agent']
    })
    res.json({ ok: true })
  } catch (err) {
    res.status(500).json({ error: 'Server error' })
  }
})

export default router
