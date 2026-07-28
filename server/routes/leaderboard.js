import express from 'express'
import pool from '../db/index.js'

const router = express.Router()

router.get('/global', async (req, res) => {
  const { mode } = req.query
  try {
    const modeFilter = mode ? `AND gr.mode = $1` : ''
    const values = mode ? [mode] : []

    const result = await pool.query(`
      SELECT
        u.id,
        u.username,
        u.avatar_url,
        u.platform,
        COUNT(*) AS total_games,
        SUM(CASE WHEN gr.result = 'win' THEN 1 ELSE 0 END) AS wins,
        SUM(CASE WHEN gr.result = 'loss' THEN 1 ELSE 0 END) AS losses,
        ROUND(
          SUM(CASE WHEN gr.result = 'win' THEN 1 ELSE 0 END)::numeric
          / NULLIF(COUNT(*), 0) * 100
        ) AS win_rate,
        MAX(gr.score) AS best_score
      FROM game_results gr
      JOIN users u ON u.id = gr.user_id
      ${modeFilter}
      GROUP BY u.id, u.username, u.avatar_url, u.platform
      HAVING COUNT(*) >= 1
      ORDER BY wins DESC, win_rate DESC, total_games DESC
      LIMIT 50
    `, values)

    res.json({ leaderboard: result.rows })
  } catch (err) {
    console.error(err)
    res.status(500).json({ error: 'Server error' })
  }
})

router.get('/game/:gameName', async (req, res) => {
  const game = decodeURIComponent(req.params.gameName)
  const { mode } = req.query
  try {
    const values = [game]
    const modeFilter = mode ? `AND gr.mode = $2` : ''
    if (mode) values.push(mode)

    const result = await pool.query(`
      SELECT
        u.id,
        u.username,
        u.avatar_url,
        COUNT(*) AS total_games,
        SUM(CASE WHEN gr.result = 'win' THEN 1 ELSE 0 END) AS wins,
        SUM(CASE WHEN gr.result = 'loss' THEN 1 ELSE 0 END) AS losses,
        MAX(gr.score) AS best_score,
        ROUND(
          SUM(CASE WHEN gr.result = 'win' THEN 1 ELSE 0 END)::numeric
          / NULLIF(COUNT(*), 0) * 100
        ) AS win_rate
      FROM game_results gr
      JOIN users u ON u.id = gr.user_id
      WHERE gr.game_name = $1 ${modeFilter}
      GROUP BY u.id, u.username, u.avatar_url
      HAVING COUNT(*) >= 1
      ORDER BY wins DESC, best_score DESC
      LIMIT 25
    `, values)

    res.json({ leaderboard: result.rows })
  } catch (err) {
    console.error(err)
    res.status(500).json({ error: 'Server error' })
  }
})

export default router
