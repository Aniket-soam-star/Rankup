import express from 'express'
import pool from '../db/index.js'
import { checkAndAwardAchievements } from './achievements.js'
import { logAction } from '../lib/audit.js'

const router = express.Router()

function requireAuth(req, res, next) {
  if (!req.session.userId) return res.status(401).json({ error: 'Not authenticated' })
  next()
}

// POST /api/games/results
router.post('/results', requireAuth, async (req, res) => {
  const { game_name, result, score, metadata, mode, difficulty } = req.body
  if (!game_name || !result) return res.status(400).json({ error: 'game_name and result required' })
  try {
    const r = await pool.query(
      `INSERT INTO game_results (user_id, game_name, result, score, metadata, mode, difficulty)
       VALUES ($1,$2,$3,$4,$5,$6,$7) RETURNING *`,
      [req.session.userId, game_name, result, score || 0, metadata || {}, mode || 'normal', difficulty || null]
    )
    checkAndAwardAchievements(req.session.userId).catch(() => {})

    const userRes = await pool.query('SELECT username FROM users WHERE id=$1', [req.session.userId])
    await logAction(pool, {
      userId: req.session.userId,
      username: userRes.rows[0]?.username,
      action: 'game.completed',
      targetType: 'game',
      details: { game_name, result, score: score || 0, mode: mode || 'normal', difficulty: difficulty || null },
      ip: req.ip,
      userAgent: req.headers['user-agent']
    })

    res.json({ result: r.rows[0] })
  } catch (err) {
    console.error(err)
    res.status(500).json({ error: 'Server error' })
  }
})

// GET /api/games/stats — alias for stats/me for frontend compatibility
router.get('/stats', requireAuth, async (req, res) => {
  const uid = req.session.userId
  try {
    const summary = await pool.query(
      `SELECT
         game_name,
         COUNT(*) AS played,
         SUM(CASE WHEN result='win' THEN 1 ELSE 0 END) AS wins,
         SUM(CASE WHEN result='loss' THEN 1 ELSE 0 END) AS losses,
         SUM(CASE WHEN result='draw' THEN 1 ELSE 0 END) AS draws,
         MAX(score) AS best_score
       FROM game_results WHERE user_id=$1 GROUP BY game_name`,
      [uid]
    )
    res.json({ stats: summary.rows })
  } catch (err) {
    console.error(err)
    res.status(500).json({ error: 'Server error' })
  }
})

// GET /api/games/stats/me
router.get('/stats/me', requireAuth, async (req, res) => {
  const uid = req.session.userId
  try {
    const summary = await pool.query(
      `SELECT game_name,
        COUNT(*) AS total,
        SUM(CASE WHEN result='win' THEN 1 ELSE 0 END) AS wins,
        SUM(CASE WHEN result='loss' THEN 1 ELSE 0 END) AS losses,
        SUM(CASE WHEN result='draw' THEN 1 ELSE 0 END) AS draws,
        MAX(score) AS best_score
       FROM game_results WHERE user_id=$1 GROUP BY game_name`,
      [uid]
    )
    const activity = await pool.query(
      `SELECT DATE(created_at) AS day, COUNT(*) AS games_played
       FROM game_results WHERE user_id=$1
       AND created_at > NOW() - INTERVAL '30 days'
       GROUP BY day ORDER BY day ASC`,
      [uid]
    )
    const recent = await pool.query(
      `SELECT gr.*, u.username FROM game_results gr JOIN users u ON u.id=gr.user_id
       WHERE gr.user_id=$1 ORDER BY gr.created_at DESC LIMIT 10`,
      [uid]
    )
    res.json({ summary: summary.rows, activity: activity.rows, recent: recent.rows })
  } catch (err) {
    console.error(err)
    res.status(500).json({ error: 'Server error' })
  }
})

// GET /api/games/trivia/questions
router.get('/trivia/questions', async (req, res) => {
  const { category, difficulty, count = 10 } = req.query
  const limit = Math.min(Number(count) || 10, 25)

  try {
    const conditions = []
    const values = []

    if (category) {
      values.push(category)
      conditions.push(`category ILIKE $${values.length}`)
    }
    if (difficulty) {
      values.push(difficulty)
      conditions.push(`difficulty = $${values.length}`)
    }

    const where = conditions.length ? `WHERE ${conditions.join(' AND ')}` : ''
    values.push(limit)

    const result = await pool.query(
      `SELECT * FROM trivia_questions ${where} ORDER BY RANDOM() LIMIT $${values.length}`,
      values
    )
    res.json({ questions: result.rows })
  } catch (err) {
    res.status(500).json({ error: 'Server error' })
  }
})

// POST /api/games/trivia/submit — server-side answer validation
router.post('/trivia/submit', requireAuth, async (req, res) => {
  const { answers, questionIds } = req.body
  if (!Array.isArray(answers) || !Array.isArray(questionIds)) {
    return res.status(400).json({ error: 'answers and questionIds must be arrays' })
  }
  if (answers.length !== questionIds.length) {
    return res.status(400).json({ error: 'answers and questionIds must have the same length' })
  }
  if (questionIds.length === 0 || questionIds.length > 25) {
    return res.status(400).json({ error: 'Must submit between 1 and 25 questions' })
  }

  try {
    const r = await pool.query(
      `SELECT id, correct_answer FROM trivia_questions WHERE id = ANY($1::int[])`,
      [questionIds]
    )
    const correctMap = {}
    for (const row of r.rows) correctMap[row.id] = row.correct_answer

    const indexToLetter = ['a', 'b', 'c', 'd']
    let correct = 0
    for (let i = 0; i < questionIds.length; i++) {
      const expected = correctMap[questionIds[i]]
      const given = indexToLetter[answers[i]]
      if (expected && given === expected) correct++
    }

    const total = questionIds.length
    const score = Math.round((correct / total) * 100)
    const xp_earned = correct * 10

    // Save to game_results
    const gameRes = await pool.query(
      `INSERT INTO game_results (user_id, game_name, result, score, metadata)
       VALUES ($1,'Trivia',$2,$3,$4) RETURNING *`,
      [req.session.userId, score >= 60 ? 'win' : 'loss', score, { correct, total }]
    )
    checkAndAwardAchievements(req.session.userId).catch(() => {})

    const userRes = await pool.query('SELECT username FROM users WHERE id=$1', [req.session.userId])
    await logAction(pool, {
      userId: req.session.userId,
      username: userRes.rows[0]?.username,
      action: 'game.completed',
      targetType: 'game',
      details: { game_name: 'Trivia', score, correct, total, xp_earned },
      ip: req.ip,
      userAgent: req.headers['user-agent']
    })

    res.json({ score, total, correct, xp_earned })
  } catch (err) {
    console.error(err)
    res.status(500).json({ error: 'Server error' })
  }
})

export default router
