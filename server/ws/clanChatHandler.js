import pool from '../db/index.js'
import { logAction } from '../lib/audit.js'

const clanRooms = new Map()

function joinRoom(clanId, ws) {
  if (!clanRooms.has(clanId)) clanRooms.set(clanId, new Set())
  clanRooms.get(clanId).add(ws)
}

function leaveRoom(ws) {
  for (const [clanId, members] of clanRooms.entries()) {
    members.delete(ws)
    if (members.size === 0) clanRooms.delete(clanId)
  }
}

function broadcast(clanId, payload) {
  const room = clanRooms.get(clanId)
  if (!room) return
  const msg = JSON.stringify(payload)
  for (const client of room) {
    if (client.readyState === 1) client.send(msg)
  }
}

async function isUserMuted(userId) {
  const r = await pool.query('SELECT muted_until, mute_reason FROM users WHERE id=$1', [userId])
  const user = r.rows[0]
  if (user?.muted_until && new Date(user.muted_until) > new Date()) {
    return { muted: true, until: user.muted_until, reason: user.mute_reason }
  }
  return { muted: false }
}

export async function handleClanConnection(ws, userId, username, avatarUrl) {
  ws.on('message', async (raw) => {
    let data
    try { data = JSON.parse(raw) } catch { return }

    if (data.type === 'clan:join') {
      const { clanId } = data
      if (!clanId) return

      try {
        const r = await pool.query(
          'SELECT role FROM clan_members WHERE clan_id=$1 AND user_id=$2',
          [clanId, userId]
        )
        if (!r.rows[0]) {
          ws.send(JSON.stringify({ type: 'clan:error', error: 'You are not a member of this clan' }))
          return
        }
      } catch { return }

      ws.clanId = clanId
      joinRoom(clanId, ws)
      ws.send(JSON.stringify({ type: 'clan:joined', clanId }))
    }

    if (data.type === 'clan:message') {
      const clanId = ws.clanId
      if (!clanId) {
        ws.send(JSON.stringify({ type: 'clan:error', error: 'Join a clan room first' }))
        return
      }

      // Check mute
      const muteCheck = await isUserMuted(userId).catch(() => ({ muted: false }))
      if (muteCheck.muted) {
        const date = new Date(muteCheck.until).toLocaleString()
        ws.send(JSON.stringify({ type: 'clan:error', error: `You are muted until ${date}. Reason: ${muteCheck.reason || 'No reason'}` }))
        return
      }

      const content = data.content?.trim()
      if (!content || content.length > 500) return

      try {
        const r = await pool.query(
          'SELECT role FROM clan_members WHERE clan_id=$1 AND user_id=$2',
          [clanId, userId]
        )
        if (!r.rows[0]) return
      } catch { return }

      let saved
      try {
        const result = await pool.query(
          `INSERT INTO clan_chat_messages (clan_id, user_id, content)
           VALUES ($1,$2,$3) RETURNING id, created_at`,
          [clanId, userId, content]
        )
        saved = result.rows[0]
      } catch { return }

      broadcast(clanId, {
        type: 'clan:message',
        id: saved.id,
        clanId,
        userId,
        username,
        avatarUrl,
        content,
        createdAt: saved.created_at
      })

      await logAction(pool, {
        userId,
        username,
        action: 'chat.message_sent',
        targetType: 'clan',
        targetId: clanId,
        details: { clanId, messageId: saved.id }
      }).catch(() => {})
    }
  })

  ws.on('close', () => {
    leaveRoom(ws)
  })
}
