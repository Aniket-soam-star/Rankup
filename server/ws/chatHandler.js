import pool from '../db/index.js'
import { filterContent } from '../lib/filter.js'
import { logAction } from '../lib/audit.js'

const roomClients = new Map()
const dmClients = new Map()

async function isUserMuted(userId) {
  const r = await pool.query('SELECT muted_until, mute_reason FROM users WHERE id=$1', [userId])
  const user = r.rows[0]
  if (user?.muted_until && new Date(user.muted_until) > new Date()) {
    return { muted: true, until: user.muted_until, reason: user.mute_reason }
  }
  return { muted: false }
}

export function handleChatConnection(ws, userId, username, avatarUrl) {
  ws.userId = userId
  ws.username = username
  ws.avatarUrl = avatarUrl
  ws.currentRoom = null

  ws.on('message', async (raw) => {
    let data
    try { data = JSON.parse(raw) } catch { return }

    if (data.type === 'join_room') {
      if (ws.currentRoom) {
        const prev = roomClients.get(ws.currentRoom)
        if (prev) prev.delete(ws)
      }
      ws.currentRoom = data.roomId
      if (!roomClients.has(data.roomId)) roomClients.set(data.roomId, new Set())
      roomClients.get(data.roomId).add(ws)
      ws.send(JSON.stringify({ type: 'room_joined', roomId: data.roomId }))

      await logAction(pool, {
        userId,
        username,
        action: 'chat.room_joined',
        targetType: 'room',
        targetId: data.roomId,
        details: { roomId: data.roomId }
      }).catch(() => {})
    }

    if (data.type === 'room_message') {
      const muteCheck = await isUserMuted(userId).catch(() => ({ muted: false }))
      if (muteCheck.muted) {
        const date = new Date(muteCheck.until).toLocaleString()
        ws.send(JSON.stringify({ type: 'error', error: `You are muted until ${date}. Reason: ${muteCheck.reason || 'No reason'}` }))
        return
      }

      const content = filterContent(data.content?.trim())
      if (!content || content.length > 500) return
      try {
        const result = await pool.query(
          `INSERT INTO chat_messages (room_id, sender_id, content, is_dm) VALUES ($1,$2,$3,false) RETURNING *`,
          [data.roomId, userId, content]
        )
        const row = result.rows[0]
        const msg = {
          type: 'chat:message',
          id: row.id,
          roomId: row.room_id,
          userId: row.sender_id,
          username,
          avatarUrl,
          content: row.content,
          createdAt: row.created_at
        }
        const clients = roomClients.get(data.roomId)
        if (clients) {
          clients.forEach(client => {
            if (client.readyState === 1) client.send(JSON.stringify(msg))
          })
        }

        await logAction(pool, {
          userId,
          username,
          action: 'chat.message_sent',
          targetType: 'room',
          targetId: data.roomId,
          details: { roomId: data.roomId, messageId: row.id }
        }).catch(() => {})
      } catch (err) {
        console.error('Chat error:', err.message)
      }
    }

    if (data.type === 'dm') {
      const muteCheck = await isUserMuted(userId).catch(() => ({ muted: false }))
      if (muteCheck.muted) {
        const date = new Date(muteCheck.until).toLocaleString()
        ws.send(JSON.stringify({ type: 'error', error: `You are muted until ${date}. Reason: ${muteCheck.reason || 'No reason'}` }))
        return
      }

      const content = filterContent(data.content?.trim())
      if (!content || content.length > 500) return
      const recipientId = data.recipientId
      try {
        const result = await pool.query(
          `INSERT INTO chat_messages (sender_id, recipient_id, content, is_dm) VALUES ($1,$2,$3,true) RETURNING *`,
          [userId, recipientId, content]
        )
        const row = result.rows[0]
        const msg = {
          type: 'dm',
          id: row.id,
          userId: row.sender_id,
          recipientId: row.recipient_id,
          username,
          avatarUrl,
          content: row.content,
          createdAt: row.created_at
        }
        // Send to sender
        ws.send(JSON.stringify(msg))
        // Send to recipient if connected
        const recipientWs = dmClients.get(recipientId)
        if (recipientWs && recipientWs.readyState === 1) {
          recipientWs.send(JSON.stringify(msg))
        }

        await logAction(pool, {
          userId,
          username,
          action: 'dm.sent',
          targetType: 'user',
          targetId: recipientId,
          details: { recipientId, messageId: row.id }
        }).catch(() => {})
      } catch (err) {
        console.error('DM error:', err.message)
      }
    }
  })

  dmClients.set(userId, ws)

  ws.on('close', () => {
    if (ws.currentRoom) {
      const clients = roomClients.get(ws.currentRoom)
      if (clients) clients.delete(ws)
    }
    if (dmClients.get(userId) === ws) dmClients.delete(userId)
  })
}
