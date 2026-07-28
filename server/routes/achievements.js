import express from 'express'
import pool from '../db/index.js'
import { createNotification } from './notifications.js'
import { logAction } from '../lib/audit.js'

const router = express.Router()

function requireAuth(req, res, next) {
  if (!req.session.userId) return res.status(401).json({ error: 'Not authenticated' })
  next()
}

export async function checkAndAwardAchievements(userId) {
  try {
    const [gamesRes, postsRes, friendsRes, msgsRes, statsRes] = await Promise.all([
      pool.query(`SELECT result, game_name, score, created_at, metadata FROM game_results WHERE user_id=$1 ORDER BY created_at DESC`, [userId]),
      pool.query(`SELECT COUNT(*) FROM posts WHERE user_id=$1`, [userId]),
      pool.query(`SELECT COUNT(*) FROM friends WHERE (requester_id=$1 OR addressee_id=$1) AND status='accepted'`, [userId]),
      pool.query(`SELECT COUNT(*) FROM chat_messages WHERE sender_id=$1`, [userId]),
      pool.query(`SELECT achievement_key FROM user_achievements WHERE user_id=$1`, [userId]),
    ])

    const games = gamesRes.rows
    const postCount = Number(postsRes.rows[0].count)
    const friendCount = Number(friendsRes.rows[0].count)
    const msgCount = Number(msgsRes.rows[0].count)
    const earned = new Set(statsRes.rows.map(r => r.achievement_key))

    const toAward = []
    const award = (key) => { if (!earned.has(key)) { toAward.push(key); earned.add(key) } }

    if (games.length >= 1) award('first_game')
    if (games.length >= 10) award('games_10')
    if (games.length >= 50) award('games_50')
    if (postCount >= 1) award('first_post')
    if (postCount >= 5) award('posts_5')
    if (friendCount >= 1) award('first_friend')
    if (friendCount >= 5) award('friends_5')
    if (msgCount >= 50) award('messages_50')

    const lastThree = games.slice(0, 3)
    if (lastThree.length === 3 && lastThree.every(g => g.result === 'win')) award('win_streak_3')

    if (games.some(g => g.game_name === 'Trivia' && g.score >= 90)) award('trivia_ace')
    if (games.some(g => g.game_name === '2048' && g.metadata?.max_tile >= 2048)) award('tile_2048')
    if (games.some(g => g.game_name === 'Snake' && g.score >= 500)) award('snake_500')
    if (games.filter(g => g.game_name === 'Rock-Paper-Scissors' && g.result === 'win').length >= 5) award('rps_win_5')
    if (games.some(g => g.game_name === 'Memory Match' && g.metadata?.perfect)) award('memory_perfect')
    if (games.some(g => g.game_name === 'Connect 4' && g.result === 'win')) award('connect4_win')

    for (const key of toAward) {
      await pool.query(
        `INSERT INTO user_achievements (user_id, achievement_key) VALUES ($1,$2) ON CONFLICT DO NOTHING`,
        [userId, key]
      )
      const ach = await pool.query(`SELECT name, icon FROM achievements WHERE key=$1`, [key])
      if (ach.rows[0]) {
        await createNotification(userId, 'achievement', `${ach.rows[0].icon} Achievement unlocked: ${ach.rows[0].name}`, '/achievements')

        const userRes = await pool.query('SELECT username FROM users WHERE id=$1', [userId])
        await logAction(pool, {
          userId,
          username: userRes.rows[0]?.username,
          action: 'achievement.unlocked',
          targetType: 'achievement',
          details: { key, name: ach.rows[0].name }
        }).catch(() => {})
      }
    }
    return toAward
  } catch (err) {
    console.error('Achievement check error:', err.message)
    return []
  }
}

router.get('/all', async (req, res) => {
  try {
    const result = await pool.query(`SELECT * FROM achievements ORDER BY category, name`)
    res.json({ achievements: result.rows })
  } catch (err) {
    res.status(500).json({ error: 'Server error' })
  }
})

router.get('/me', requireAuth, async (req, res) => {
  try {
    const result = await pool.query(`
      SELECT a.*, ua.earned_at
      FROM achievements a
      LEFT JOIN user_achievements ua ON ua.achievement_key=a.key AND ua.user_id=$1
      ORDER BY a.category, a.name
    `, [req.session.userId])
    res.json({ achievements: result.rows })
  } catch (err) {
    res.status(500).json({ error: 'Server error' })
  }
})

router.get('/user/:id', async (req, res) => {
  try {
    const result = await pool.query(`
      SELECT a.*, ua.earned_at
      FROM achievements a
      LEFT JOIN user_achievements ua ON ua.achievement_key=a.key AND ua.user_id=$1
      ORDER BY ua.earned_at DESC NULLS LAST, a.name
    `, [req.params.id])
    res.json({ achievements: result.rows })
  } catch (err) {
    res.status(500).json({ error: 'Server error' })
  }
})

export default router
