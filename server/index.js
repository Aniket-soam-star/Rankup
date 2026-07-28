import express from 'express'
import session from 'express-session'
import connectPgSimple from 'connect-pg-simple'
import cors from 'cors'
import { createServer } from 'http'
import { WebSocketServer } from 'ws'
import path from 'path'
import { fileURLToPath } from 'url'
import dotenv from 'dotenv'
import speakeasy from 'speakeasy'
import pool, { initDB } from './db/index.js'

import authRoutes from './routes/auth.js'
import userRoutes from './routes/users.js'
import postRoutes from './routes/posts.js'
import chatRoutes from './routes/chat.js'
import gameRoutes from './routes/games.js'
import moderationRoutes from './routes/moderation.js'
import friendRoutes from './routes/friends.js'
import leaderboardRoutes from './routes/leaderboard.js'
import notificationRoutes from './routes/notifications.js'
import achievementRoutes from './routes/achievements.js'
import clanRoutes from './routes/clans.js'
import adminRoutes from './routes/admin.js'
import uploadRoutes from './routes/upload.js'
import settingsRoutes from './routes/settings.js'

import { handleChatConnection } from './ws/chatHandler.js'
import { handleGameConnection } from './ws/gameHandler.js'
import { handleClanConnection } from './ws/clanChatHandler.js'
import { checkApiBan } from './middleware/checkApiBan.js'

dotenv.config()

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const app = express()
const server = createServer(app)
const PORT = process.env.PORT || 3001
const SESSION_SECRET = process.env.SESSION_SECRET || 'rankup-dev-secret-2024'

const PgSession = connectPgSimple(session)

const sessionMiddleware = session({
  store: new PgSession({ pool, createTableIfMissing: true }),
  secret: SESSION_SECRET,
  resave: false,
  saveUninitialized: false,
  cookie: {
    maxAge: 7 * 24 * 60 * 60 * 1000,
    httpOnly: true,
    sameSite: 'lax'
  }
})

app.use(cors({ origin: true, credentials: true }))
app.use(express.json({ limit: '5mb' }))
app.use(sessionMiddleware)

// API ban check runs on every authenticated request
app.use(checkApiBan)

app.use('/api/auth', authRoutes)
app.use('/api/users', userRoutes)
app.use('/api/posts', postRoutes)
app.use('/api/chat', chatRoutes)
app.use('/api/games', gameRoutes)
app.use('/api/moderation', moderationRoutes)
app.use('/api/friends', friendRoutes)
app.use('/api/leaderboard', leaderboardRoutes)
app.use('/api/notifications', notificationRoutes)
app.use('/api/achievements', achievementRoutes)
app.use('/api/clans', clanRoutes)
app.use('/api/admin', adminRoutes)
app.use('/api/upload', uploadRoutes)
app.use('/api/settings', settingsRoutes)

if (process.env.NODE_ENV === 'production') {
  app.use(express.static(path.join(__dirname, 'public')))
  app.get('*', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'index.html'))
  })
}

// ── WebSocket ────────────────────────────────────────────────────────────────

const wss = new WebSocketServer({ server, path: '/ws' })

wss.on('connection', (ws, req) => {
  const parseSession = (req) => new Promise((resolve) => {
    sessionMiddleware(req, {}, () => resolve(req.session))
  })

  parseSession(req).then((sess) => {
    if (!sess?.userId) {
      ws.close(4001, 'Unauthorized')
      return
    }
    const { userId, username } = sess
    pool.query('SELECT avatar_url FROM users WHERE id=$1', [userId]).then(r => {
      const avatarUrl = r.rows[0]?.avatar_url || ''
      const url = new URL(req.url, 'http://localhost')
      const type = url.searchParams.get('type')

      if (type === 'game') {
        handleGameConnection(ws, userId, username)
      } else if (type === 'clan') {
        handleClanConnection(ws, userId, username, avatarUrl)
      } else {
        handleChatConnection(ws, userId, username, avatarUrl)
      }
    })
  })
})

// ── Admin setup ──────────────────────────────────────────────────────────────

function adminSetup() {
  let allSet = true

  if (!process.env.ADMIN_TOTP_SECRET) {
    allSet = false
    const secret = speakeasy.generateSecret({ name: 'RankUp Admin', issuer: 'RankUp', length: 20 })
    console.log('\n════════════════════════════════════════════')
    console.log('⚠️  ADMIN_TOTP_SECRET not set. Generated one-time secret:')
    console.log(`   ADMIN_TOTP_SECRET=${secret.base32}`)
    console.log('   Scan this QR in an authenticator app:', secret.otpauth_url)
    console.log('   Set this as an env var to persist it!')
    console.log('════════════════════════════════════════════\n')
  }

  if (!process.env.ADMIN_JWT_SECRET) {
    console.warn('⚠️  ADMIN_JWT_SECRET not set — admin JWT auth disabled')
    allSet = false
  }

  if (!process.env.ADMIN_PASSWORD) {
    console.warn('⚠️  ADMIN_PASSWORD not set — admin login disabled')
    allSet = false
  }

  return allSet
}

// ── Start ────────────────────────────────────────────────────────────────────

async function start() {
  await initDB()
  adminSetup()

  server.listen(PORT, '0.0.0.0', () => {
    console.log(`🚀 RankUp server running on port ${PORT}`)
  })
}

start().catch(console.error)
