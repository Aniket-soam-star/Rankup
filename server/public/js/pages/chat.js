import { api } from '../api.js'
import { state, toast, timeAgo, avatar, showModal } from '../app.js'
import { chatWs } from '../ws.js'

const ROOMS = [
  { id: 'general',   name: 'General',          icon: 'bi-hash' },
  { id: 'lfg',       name: 'Looking for Group', icon: 'bi-people-fill' },
  { id: 'off-topic', name: 'Off Topic',         icon: 'bi-chat-dots' },
]

let currentRoom = null
let currentDm   = null
let unsubRoom   = null

export async function renderChat(container) {
  container.innerHTML = `
    <div class="page-header" style="margin-bottom:12px">
      <h1 class="page-title"><i class="bi bi-chat-dots-fill"></i> Chat</h1>
    </div>
    <div class="chat-layout">
      <div class="chat-sidebar">
        <div style="overflow-y:auto;flex:1">
          <div class="chat-sidebar-section">Rooms</div>
          ${ROOMS.map(r => `
            <div class="chat-room-item" data-room="${r.id}">
              <i class="bi ${r.icon}"></i>${r.name}
            </div>
          `).join('')}
          <div class="chat-sidebar-section" style="margin-top:8px">Direct Messages</div>
          <div id="dm-list"><div style="padding:8px 12px;font-size:12px;color:var(--text-3)">Loading…</div></div>
          <div style="padding:6px 8px">
            <button class="btn btn-ghost btn-sm w-full" id="new-dm-btn" style="justify-content:center">
              <i class="bi bi-plus-lg"></i> New DM
            </button>
          </div>
        </div>
      </div>

      <div class="chat-main">
        <div class="chat-topbar">
          <i class="bi bi-hash" id="chat-icon" style="color:var(--text-2)"></i>
          <span class="chat-topbar-name" id="chat-title">Select a room</span>
          <span id="ws-indicator" style="margin-left:auto;font-size:11px;color:var(--text-3)"></span>
        </div>
        <div class="chat-messages" id="chat-messages">
          <div class="state-container">
            <div class="state-icon">💬</div>
            <p class="state-desc">Select a room or DM to start chatting</p>
          </div>
        </div>
        <div class="chat-input-area" id="chat-input-area" style="display:none">
          <textarea class="input" id="chat-input" placeholder="Message…" rows="1"
            style="min-height:36px;max-height:120px;resize:none;flex:1"></textarea>
          <button class="btn btn-primary btn-icon" id="chat-send" title="Send">
            <i class="bi bi-send-fill"></i>
          </button>
        </div>
      </div>
    </div>
  `

  loadDmList(container)

  container.querySelectorAll('[data-room]').forEach(el => {
    el.addEventListener('click', () => openRoom(el.dataset.room, container))
  })

  container.querySelector('#new-dm-btn').addEventListener('click', () => showNewDmModal(container))
  container.querySelector('#chat-send').addEventListener('click', () => sendMessage(container))
  container.querySelector('#chat-input').addEventListener('keydown', e => {
    if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); sendMessage(container) }
  })
  container.querySelector('#chat-input').addEventListener('input', e => {
    e.target.style.height = 'auto'
    e.target.style.height = Math.min(e.target.scrollHeight, 120) + 'px'
  })

  // Subscribe to incoming room messages (global handler)
  chatWs.connect()
  chatWs.on('chat:message', (msg) => {
    if (!currentRoom) return
    // Normalize fields from server
    const roomId = msg.roomId ?? msg.room_id ?? msg.room
    if (String(roomId) !== String(currentRoom)) return
    const msgsEl = container.querySelector('#chat-messages')
    if (!msgsEl) return
    appendMessage(msgsEl, normalizeMsg(msg))
    scrollBottom(msgsEl)
  })

  chatWs.on('dm', (msg) => {
    if (!currentDm) return
    const fromId = msg.userId ?? msg.user_id
    const toId   = msg.recipientId ?? msg.recipient_id
    if (fromId !== currentDm && toId !== currentDm) return
    const msgsEl = container.querySelector('#chat-messages')
    if (!msgsEl) return
    appendMessage(msgsEl, normalizeMsg(msg))
    scrollBottom(msgsEl)
  })

  chatWs.on('error', msg => toast(msg.error || 'Chat error', 'error'))
  chatWs.on('room_joined', () => {
    const ind = container.querySelector('#ws-indicator')
    if (ind) { ind.textContent = '● live'; ind.style.color = 'var(--green)' }
  })

  openRoom('general', container)
}

async function openRoom(roomId, container) {
  if (unsubRoom) { unsubRoom(); unsubRoom = null }
  currentRoom = roomId
  currentDm   = null

  const room = ROOMS.find(r => r.id === roomId) || { name: roomId, icon: 'bi-hash' }

  container.querySelectorAll('[data-room]').forEach(el =>
    el.classList.toggle('active', el.dataset.room === roomId)
  )
  container.querySelectorAll('[data-dm]').forEach(el => el.classList.remove('active'))
  container.querySelector('#chat-icon').className = `bi ${room.icon}`
  container.querySelector('#chat-title').textContent = room.name
  container.querySelector('#chat-input').placeholder = `Message #${room.name}…`
  container.querySelector('#chat-input-area').style.display = 'flex'

  const ind = container.querySelector('#ws-indicator')
  if (ind) { ind.textContent = 'connecting…'; ind.style.color = 'var(--text-3)' }

  const msgsEl = container.querySelector('#chat-messages')
  msgsEl.innerHTML = '<div class="state-container"><div class="spinner"></div></div>'

  try {
    const { messages } = await api.get(`/chat/rooms/${roomId}/messages`)
    renderMessages(msgsEl, messages || [])
    scrollBottom(msgsEl)
  } catch {
    msgsEl.innerHTML = '<div class="state-container"><p class="state-desc">Failed to load messages</p></div>'
  }

  // ─── KEY FIX: use 'join_room' not 'chat:join' ───
  chatWs.send({ type: 'join_room', roomId })
}

async function openDm(userId, username, avatarUrl, container) {
  if (unsubRoom) { unsubRoom(); unsubRoom = null }
  currentDm   = userId
  currentRoom = null

  container.querySelectorAll('[data-room]').forEach(el => el.classList.remove('active'))
  container.querySelectorAll('[data-dm]').forEach(el =>
    el.classList.toggle('active', el.dataset.dm == userId)
  )

  container.querySelector('#chat-icon').className = 'bi bi-person-fill'
  container.querySelector('#chat-title').textContent = username
  container.querySelector('#chat-input').placeholder = `Message ${username}…`
  container.querySelector('#chat-input-area').style.display = 'flex'

  const ind = container.querySelector('#ws-indicator')
  if (ind) { ind.textContent = ''; }

  const msgsEl = container.querySelector('#chat-messages')
  msgsEl.innerHTML = '<div class="state-container"><div class="spinner"></div></div>'

  try {
    const { messages } = await api.get(`/chat/dm/${userId}`)
    renderMessages(msgsEl, messages || [])
    scrollBottom(msgsEl)
  } catch {
    msgsEl.innerHTML = '<div class="state-container"><p class="state-desc">Failed to load DMs</p></div>'
  }
}

function sendMessage(container) {
  const inp = container.querySelector('#chat-input')
  const content = inp.value.trim()
  if (!content) return
  inp.value = ''
  inp.style.height = ''

  if (currentRoom) {
    // ─── KEY FIX: use 'room_message' not 'chat:message', send 'roomId' not 'room' ───
    chatWs.send({ type: 'room_message', roomId: currentRoom, content })
  } else if (currentDm) {
    // ─── KEY FIX: use 'dm' not 'chat:dm', send 'recipientId' not 'to' ───
    chatWs.send({ type: 'dm', recipientId: currentDm, content })
    // Show optimistically
    const msgsEl = container.querySelector('#chat-messages')
    appendMessage(msgsEl, {
      username:   state.user.username,
      avatar_url: state.user.avatar_url,
      content,
      created_at: new Date().toISOString(),
      user_id:    state.user.id,
    })
    scrollBottom(msgsEl)
  }
}

// Normalize server field names to what our UI expects
function normalizeMsg(m) {
  return {
    user_id:    m.user_id    ?? m.userId,
    username:   m.username,
    avatar_url: m.avatar_url ?? m.avatarUrl,
    content:    m.content,
    created_at: m.created_at ?? m.createdAt,
  }
}

function renderMessages(el, messages) {
  if (!messages.length) {
    el.innerHTML = '<div class="state-container"><div class="state-icon">💬</div><p class="state-desc">No messages yet. Say hi!</p></div>'
    return
  }
  el.innerHTML = ''
  let lastUser = null
  messages.forEach(m => {
    appendMessage(el, normalizeMsg(m), lastUser)
    lastUser = m.username
  })
}

function appendMessage(el, m, prevUser = null) {
  const mine    = m.user_id === state.user?.id || m.username === state.user?.username
  const compact = prevUser === m.username

  // Remove empty state
  const empty = el.querySelector('.state-container')
  if (empty) empty.remove()

  const div = document.createElement('div')
  div.className = 'chat-msg' + (compact ? ' chat-msg-compact' : '')
  div.innerHTML = compact
    ? `
      <div class="chat-msg-compact-spacer"></div>
      <div class="chat-msg-body">
        <div class="chat-msg-text">${escHtml(m.content)}</div>
      </div>
    `
    : `
      ${avatar(m.avatar_url, m.username, 'avatar-sm')}
      <div class="chat-msg-body">
        <div class="chat-msg-top">
          <span class="chat-msg-user" style="${mine ? 'color:var(--accent-3)' : ''}">${m.username}</span>
          <span class="chat-msg-time">${timeAgo(m.created_at)}</span>
        </div>
        <div class="chat-msg-text">${escHtml(m.content)}</div>
      </div>
    `
  el.appendChild(div)
}

async function loadDmList(container) {
  try {
    const { friends } = await api.get('/friends')
    const accepted = friends.filter(f => f.status === 'accepted')
    const dmList = container.querySelector('#dm-list')
    if (!accepted.length) {
      dmList.innerHTML = '<div style="padding:4px 12px;font-size:12px;color:var(--text-3)">Add friends to DM</div>'
      return
    }
    dmList.innerHTML = accepted.map(f => `
      <div class="chat-room-item" data-dm="${f.id}">
        <div style="position:relative;flex-shrink:0">
          ${avatar(f.avatar_url, f.username, 'avatar-sm')}
        </div>
        <span style="font-size:13px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">${f.username}</span>
      </div>
    `).join('')
    dmList.querySelectorAll('[data-dm]').forEach(el => {
      const f = accepted.find(fr => fr.id == el.dataset.dm)
      if (f) el.addEventListener('click', () => openDm(f.id, f.username, f.avatar_url, container))
    })
  } catch {}
}

function showNewDmModal(container) {
  const close = showModal(`
    <div class="modal-title"><i class="bi bi-chat-dots-fill"></i> New Direct Message</div>
    <div class="form-field">
      <input class="input" id="dm-user-search" placeholder="Search username…" autocomplete="off">
    </div>
    <div id="dm-search-results" style="min-height:60px"></div>
    <div style="margin-top:12px;text-align:right">
      <button class="btn btn-secondary" id="dm-close">Cancel</button>
    </div>
  `)
  document.getElementById('dm-close').addEventListener('click', close)

  let t
  document.getElementById('dm-user-search').addEventListener('input', e => {
    clearTimeout(t)
    const q = e.target.value.trim()
    if (!q) return
    t = setTimeout(async () => {
      try {
        const { users } = await api.get(`/users/search?q=${encodeURIComponent(q)}`)
        const res = document.getElementById('dm-search-results')
        const filtered = (users || []).filter(u => u.id !== state.user.id)
        res.innerHTML = filtered.length
          ? filtered.map(u => `
              <div class="member-row" style="cursor:pointer" data-uid="${u.id}" data-uname="${u.username}" data-uavatar="${u.avatar_url||''}">
                ${avatar(u.avatar_url, u.username, 'avatar-sm')}
                <div style="font-weight:600;font-size:13.5px">${u.username}</div>
              </div>
            `).join('')
          : '<p style="padding:12px;text-align:center;font-size:13px;color:var(--text-3)">No users found</p>'

        res.querySelectorAll('[data-uid]').forEach(el => {
          el.addEventListener('click', () => {
            close()
            openDm(parseInt(el.dataset.uid), el.dataset.uname, el.dataset.uavatar, container)
          })
        })
      } catch {}
    }, 350)
  })
}

function scrollBottom(el) { el.scrollTop = el.scrollHeight }
function escHtml(s) {
  return String(s)
    .replace(/&/g,'&amp;')
    .replace(/</g,'&lt;')
    .replace(/>/g,'&gt;')
    .replace(/\n/g,'<br>')
}
