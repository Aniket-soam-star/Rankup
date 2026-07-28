import express from 'express'
import pool from '../db/index.js'
import { filterContent } from '../lib/filter.js'
import { createNotification } from './notifications.js'
import { logAction } from '../lib/audit.js'
import { checkSoftBanned } from '../middleware/checkSoftBanned.js'

const router = express.Router()

function requireAuth(req, res, next) {
  if (!req.session.userId) return res.status(401).json({ error: 'Not authenticated' })
  next()
}

async function getMembership(clanId, userId) {
  const r = await pool.query('SELECT role FROM clan_members WHERE clan_id=$1 AND user_id=$2', [clanId, userId])
  return r.rows[0] || null
}

async function getUserClan(userId) {
  const r = await pool.query('SELECT clan_id FROM clan_members WHERE user_id=$1 LIMIT 1', [userId])
  return r.rows[0]?.clan_id || null
}

// ── GET /api/clans ───────────────────────────────────────────────────────────

router.get('/', requireAuth, async (req, res) => {
  const { search, tag, page = 1 } = req.query
  const limit = 20, offset = (Number(page) - 1) * limit
  try {
    const conditions = [], values = []
    if (search) { values.push(`%${search}%`); conditions.push(`(c.name ILIKE $${values.length} OR c.tag ILIKE $${values.length})`) }
    if (tag) { values.push(tag.toUpperCase()); conditions.push(`c.tag = $${values.length}`) }
    const where = conditions.length ? `WHERE ${conditions.join(' AND ')}` : ''
    const countRes = await pool.query(`SELECT COUNT(*) FROM clans c ${where}`, values)
    const total = Number(countRes.rows[0].count)
    values.push(limit, offset)
    const result = await pool.query(`
      SELECT c.*, u.username AS owner_username, u.avatar_url AS owner_avatar, COUNT(cm.id)::int AS member_count
      FROM clans c
      JOIN users u ON u.id = c.owner_id
      LEFT JOIN clan_members cm ON cm.clan_id = c.id
      ${where}
      GROUP BY c.id, u.username, u.avatar_url
      ORDER BY member_count DESC, c.created_at DESC
      LIMIT $${values.length - 1} OFFSET $${values.length}
    `, values)
    res.json({ clans: result.rows, total, page: Number(page), totalPages: Math.ceil(total / limit) })
  } catch (err) {
    console.error(err); res.status(500).json({ error: 'Server error' })
  }
})

// ── GET /api/clans/:id ───────────────────────────────────────────────────────

router.get('/:id', requireAuth, async (req, res) => {
  try {
    const clan = await pool.query(`
      SELECT c.*, u.username AS owner_username, u.avatar_url AS owner_avatar, COUNT(cm.id)::int AS member_count
      FROM clans c JOIN users u ON u.id = c.owner_id LEFT JOIN clan_members cm ON cm.clan_id = c.id
      WHERE c.id = $1 GROUP BY c.id, u.username, u.avatar_url
    `, [req.params.id])
    if (!clan.rows[0]) return res.status(404).json({ error: 'Clan not found' })
    const members = await pool.query(`
      SELECT cm.role, cm.joined_at, u.id, u.username, u.avatar_url, u.platform
      FROM clan_members cm JOIN users u ON u.id = cm.user_id WHERE cm.clan_id = $1
      ORDER BY CASE cm.role WHEN 'owner' THEN 0 WHEN 'admin' THEN 1 ELSE 2 END, cm.joined_at
    `, [req.params.id])
    const posts = await pool.query(`
      SELECT cp.*, u.username, u.avatar_url FROM clan_posts cp JOIN users u ON u.id = cp.user_id
      WHERE cp.clan_id = $1 ORDER BY cp.created_at DESC LIMIT 10
    `, [req.params.id])
    const myMembership = await getMembership(req.params.id, req.session.userId)
    res.json({ clan: clan.rows[0], members: members.rows, recentPosts: posts.rows, myRole: myMembership?.role || null })
  } catch (err) {
    console.error(err); res.status(500).json({ error: 'Server error' })
  }
})

// ── POST /api/clans ──────────────────────────────────────────────────────────

router.post('/', requireAuth, checkSoftBanned, async (req, res) => {
  const { name, description, tag, avatar_url } = req.body
  const uid = req.session.userId
  if (!name?.trim()) return res.status(400).json({ error: 'Clan name required' })
  if (!tag?.trim() || tag.length < 2 || tag.length > 5) return res.status(400).json({ error: 'Tag must be 2-5 characters' })
  try {
    const owned = await pool.query('SELECT id FROM clans WHERE owner_id=$1', [uid])
    if (owned.rows.length > 0) return res.status(400).json({ error: 'You already own a clan' })
    const existing = await getUserClan(uid)
    if (existing) return res.status(400).json({ error: 'Leave your current clan before creating one' })
    const result = await pool.query(
      `INSERT INTO clans (name, description, tag, owner_id, avatar_url) VALUES ($1,$2,$3,$4,$5) RETURNING *`,
      [name.trim(), description?.trim() || '', tag.toUpperCase().trim(), uid, avatar_url || '']
    )
    const clan = result.rows[0]
    await pool.query('INSERT INTO clan_members (clan_id, user_id, role) VALUES ($1,$2,$3)', [clan.id, uid, 'owner'])
    const userRes = await pool.query('SELECT username FROM users WHERE id=$1', [uid])
    await logAction(pool, { userId: uid, username: userRes.rows[0]?.username, action: 'clan.create', targetType: 'clan', targetId: clan.id, ip: req.ip, userAgent: req.headers['user-agent'] })
    res.json({ clan })
  } catch (err) {
    if (err.code === '23505') return res.status(400).json({ error: 'Clan name or tag already taken' })
    console.error(err); res.status(500).json({ error: 'Server error' })
  }
})

// ── PATCH /api/clans/:id ─────────────────────────────────────────────────────

router.patch('/:id', requireAuth, async (req, res) => {
  const uid = req.session.userId
  const { name, description, tag, avatar_url } = req.body
  try {
    const m = await getMembership(req.params.id, uid)
    if (!m || m.role === 'member') return res.status(403).json({ error: 'Only owner or admin can edit the clan' })
    const result = await pool.query(
      `UPDATE clans SET name=COALESCE(NULLIF($1,''),name), description=COALESCE($2,description), tag=COALESCE(NULLIF($3,''),tag), avatar_url=COALESCE($4,avatar_url) WHERE id=$5 RETURNING *`,
      [name?.trim() || '', description ?? null, tag?.toUpperCase().trim() || '', avatar_url ?? null, req.params.id]
    )
    res.json({ clan: result.rows[0] })
  } catch (err) {
    if (err.code === '23505') return res.status(400).json({ error: 'Clan name or tag already taken' })
    console.error(err); res.status(500).json({ error: 'Server error' })
  }
})

// ── DELETE /api/clans/:id ────────────────────────────────────────────────────

router.delete('/:id', requireAuth, async (req, res) => {
  const uid = req.session.userId
  try {
    const m = await getMembership(req.params.id, uid)
    if (!m || m.role !== 'owner') return res.status(403).json({ error: 'Only the owner can delete the clan' })
    const clanRes = await pool.query('SELECT name FROM clans WHERE id=$1', [req.params.id])
    await pool.query('DELETE FROM clans WHERE id=$1', [req.params.id])
    const userRes = await pool.query('SELECT username FROM users WHERE id=$1', [uid])
    await logAction(pool, { userId: uid, username: userRes.rows[0]?.username, action: 'clan.delete', targetType: 'clan', targetId: Number(req.params.id), details: { name: clanRes.rows[0]?.name }, ip: req.ip, userAgent: req.headers['user-agent'] })
    res.json({ ok: true })
  } catch (err) {
    console.error(err); res.status(500).json({ error: 'Server error' })
  }
})

// ── POST /api/clans/:id/join ─────────────────────────────────────────────────

router.post('/:id/join', requireAuth, checkSoftBanned, async (req, res) => {
  const uid = req.session.userId
  try {
    const clan = await pool.query('SELECT id, name FROM clans WHERE id=$1', [req.params.id])
    if (!clan.rows[0]) return res.status(404).json({ error: 'Clan not found' })
    const existing = await getUserClan(uid)
    if (existing) return res.status(400).json({ error: 'Leave your current clan first' })
    await pool.query('INSERT INTO clan_members (clan_id, user_id, role) VALUES ($1,$2,$3) ON CONFLICT DO NOTHING', [req.params.id, uid, 'member'])
    const me = await pool.query('SELECT username FROM users WHERE id=$1', [uid])
    const owner = await pool.query('SELECT owner_id FROM clans WHERE id=$1', [req.params.id])
    await createNotification(owner.rows[0].owner_id, 'clan_join', `${me.rows[0].username} joined your clan ${clan.rows[0].name}`, `/clans/${req.params.id}`, uid).catch(() => {})
    await logAction(pool, { userId: uid, username: me.rows[0]?.username, action: 'clan.join', targetType: 'clan', targetId: Number(req.params.id), ip: req.ip, userAgent: req.headers['user-agent'] })
    res.json({ ok: true })
  } catch (err) {
    console.error(err); res.status(500).json({ error: 'Server error' })
  }
})

// ── POST /api/clans/:id/leave ────────────────────────────────────────────────

router.post('/:id/leave', requireAuth, async (req, res) => {
  const uid = req.session.userId
  try {
    const m = await getMembership(req.params.id, uid)
    if (!m) return res.status(400).json({ error: 'You are not in this clan' })
    if (m.role === 'owner') return res.status(400).json({ error: 'Owners cannot leave — delete the clan or transfer ownership instead' })
    await pool.query('DELETE FROM clan_members WHERE clan_id=$1 AND user_id=$2', [req.params.id, uid])
    const userRes = await pool.query('SELECT username FROM users WHERE id=$1', [uid])
    await logAction(pool, { userId: uid, username: userRes.rows[0]?.username, action: 'clan.leave', targetType: 'clan', targetId: Number(req.params.id), ip: req.ip, userAgent: req.headers['user-agent'] })
    res.json({ ok: true })
  } catch (err) {
    console.error(err); res.status(500).json({ error: 'Server error' })
  }
})

// ── POST /api/clans/:id/members/:userId/promote ──────────────────────────────

router.post('/:id/members/:userId/promote', requireAuth, async (req, res) => {
  const uid = req.session.userId
  try {
    const m = await getMembership(req.params.id, uid)
    if (!m || m.role !== 'owner') return res.status(403).json({ error: 'Owner only' })
    const target = await getMembership(req.params.id, req.params.userId)
    if (!target) return res.status(404).json({ error: 'User not in clan' })
    if (target.role === 'owner') return res.status(400).json({ error: 'Cannot change owner role' })
    await pool.query('UPDATE clan_members SET role=$1 WHERE clan_id=$2 AND user_id=$3', ['admin', req.params.id, req.params.userId])
    const userRes = await pool.query('SELECT username FROM users WHERE id=$1', [uid])
    await logAction(pool, { userId: uid, username: userRes.rows[0]?.username, action: 'clan.member_promote', targetType: 'user', targetId: Number(req.params.userId), details: { clanId: Number(req.params.id) }, ip: req.ip, userAgent: req.headers['user-agent'] })
    res.json({ ok: true })
  } catch (err) {
    console.error(err); res.status(500).json({ error: 'Server error' })
  }
})

// ── POST /api/clans/:id/members/:userId/demote ───────────────────────────────

router.post('/:id/members/:userId/demote', requireAuth, async (req, res) => {
  const uid = req.session.userId
  try {
    const m = await getMembership(req.params.id, uid)
    if (!m || m.role !== 'owner') return res.status(403).json({ error: 'Owner only' })
    const target = await getMembership(req.params.id, req.params.userId)
    if (!target) return res.status(404).json({ error: 'User not in clan' })
    if (target.role !== 'admin') return res.status(400).json({ error: 'User is not an admin' })
    await pool.query('UPDATE clan_members SET role=$1 WHERE clan_id=$2 AND user_id=$3', ['member', req.params.id, req.params.userId])
    const userRes = await pool.query('SELECT username FROM users WHERE id=$1', [uid])
    await logAction(pool, { userId: uid, username: userRes.rows[0]?.username, action: 'clan.member_demote', targetType: 'user', targetId: Number(req.params.userId), details: { clanId: Number(req.params.id) }, ip: req.ip, userAgent: req.headers['user-agent'] })
    res.json({ ok: true })
  } catch (err) {
    console.error(err); res.status(500).json({ error: 'Server error' })
  }
})

// ── POST /api/clans/:id/members/:userId/kick ─────────────────────────────────

router.post('/:id/members/:userId/kick', requireAuth, async (req, res) => {
  const uid = req.session.userId
  try {
    const m = await getMembership(req.params.id, uid)
    if (!m || (m.role !== 'owner' && m.role !== 'admin')) return res.status(403).json({ error: 'Owner or admin only' })
    const target = await getMembership(req.params.id, req.params.userId)
    if (!target) return res.status(404).json({ error: 'User not in clan' })
    if (target.role === 'owner') return res.status(400).json({ error: 'Cannot kick the owner' })
    if (m.role === 'admin' && target.role === 'admin') return res.status(403).json({ error: 'Admins cannot kick other admins' })
    await pool.query('DELETE FROM clan_members WHERE clan_id=$1 AND user_id=$2', [req.params.id, req.params.userId])
    const userRes = await pool.query('SELECT username FROM users WHERE id=$1', [uid])
    await logAction(pool, { userId: uid, username: userRes.rows[0]?.username, action: 'clan.member_kick', targetType: 'user', targetId: Number(req.params.userId), details: { clanId: Number(req.params.id) }, ip: req.ip, userAgent: req.headers['user-agent'] })
    res.json({ ok: true })
  } catch (err) {
    console.error(err); res.status(500).json({ error: 'Server error' })
  }
})

// ── GET /api/clans/:id/posts ─────────────────────────────────────────────────

router.get('/:id/posts', requireAuth, async (req, res) => {
  const { limit = 20, offset = 0 } = req.query
  try {
    const m = await getMembership(req.params.id, req.session.userId)
    if (!m) return res.status(403).json({ error: 'Members only' })
    const result = await pool.query(`
      SELECT cp.*, u.username, u.avatar_url FROM clan_posts cp JOIN users u ON u.id = cp.user_id
      WHERE cp.clan_id = $1 ORDER BY cp.created_at DESC LIMIT $2 OFFSET $3
    `, [req.params.id, Number(limit), Number(offset)])
    res.json({ posts: result.rows })
  } catch (err) {
    console.error(err); res.status(500).json({ error: 'Server error' })
  }
})

// ── POST /api/clans/:id/posts ────────────────────────────────────────────────

router.post('/:id/posts', requireAuth, checkSoftBanned, async (req, res) => {
  const uid = req.session.userId
  let { content, image_url } = req.body
  if (!content?.trim()) return res.status(400).json({ error: 'Content required' })
  content = filterContent(content)
  try {
    const m = await getMembership(req.params.id, uid)
    if (!m) return res.status(403).json({ error: 'Members only' })
    const result = await pool.query(
      `INSERT INTO clan_posts (clan_id, user_id, content, image_url) VALUES ($1,$2,$3,$4)
       RETURNING *, (SELECT username FROM users WHERE id=$2) as username, (SELECT avatar_url FROM users WHERE id=$2) as avatar_url`,
      [req.params.id, uid, content, image_url || null]
    )
    const userRes = await pool.query('SELECT username FROM users WHERE id=$1', [uid])
    await logAction(pool, { userId: uid, username: userRes.rows[0]?.username, action: 'clan.post_create', targetType: 'clan', targetId: Number(req.params.id), ip: req.ip, userAgent: req.headers['user-agent'] })
    res.json({ post: result.rows[0] })
  } catch (err) {
    console.error(err); res.status(500).json({ error: 'Server error' })
  }
})

// ── DELETE /api/clans/:id/posts/:postId ──────────────────────────────────────

router.delete('/:id/posts/:postId', requireAuth, async (req, res) => {
  const uid = req.session.userId
  try {
    const post = await pool.query('SELECT user_id FROM clan_posts WHERE id=$1 AND clan_id=$2', [req.params.postId, req.params.id])
    if (!post.rows[0]) return res.status(404).json({ error: 'Post not found' })
    const m = await getMembership(req.params.id, uid)
    const isAuthor = post.rows[0].user_id === uid
    const isPrivileged = m && (m.role === 'owner' || m.role === 'admin')
    if (!isAuthor && !isPrivileged) return res.status(403).json({ error: 'Not authorised to delete this post' })
    await pool.query('DELETE FROM clan_posts WHERE id=$1', [req.params.postId])
    res.json({ ok: true })
  } catch (err) {
    console.error(err); res.status(500).json({ error: 'Server error' })
  }
})

// ── GET /api/clans/:id/chat ──────────────────────────────────────────────────

router.get('/:id/chat', requireAuth, async (req, res) => {
  try {
    const m = await getMembership(req.params.id, req.session.userId)
    if (!m) return res.status(403).json({ error: 'Members only' })
    const result = await pool.query(`
      SELECT ccm.*, u.username, u.avatar_url FROM clan_chat_messages ccm
      JOIN users u ON u.id = ccm.user_id WHERE ccm.clan_id = $1
      ORDER BY ccm.created_at DESC LIMIT 50
    `, [req.params.id])
    res.json({ messages: result.rows.reverse() })
  } catch (err) {
    console.error(err); res.status(500).json({ error: 'Server error' })
  }
})

export default router
