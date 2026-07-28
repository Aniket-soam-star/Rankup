import { api } from '../api.js'
import { state, toast, timeAgo, avatar, showModal, navigate } from '../app.js'
import { clanWs } from '../ws.js'

// Active clan chat cleanup
let chatUnsub = null

export async function renderClans(container, path) {
  const params = new URLSearchParams(path.split('?')[1] || '')
  const clanId = params.get('clan')

  // Disconnect any leftover clan chat
  if (chatUnsub) { chatUnsub(); chatUnsub = null }
  clanWs.offAll()

  if (clanId) {
    await renderClanDetail(container, clanId)
  } else {
    await renderClanBrowser(container)
  }
}

// ── Browse ──────────────────────────────────────────────────────────────────
async function renderClanBrowser(container) {
  container.innerHTML = `
    <div class="page-header">
      <h1 class="page-title"><i class="bi bi-shield-fill"></i> Clans</h1>
      <button class="btn btn-primary" id="create-clan-btn">
        <i class="bi bi-plus-lg"></i> Create Clan
      </button>
    </div>

    <div style="display:flex;gap:10px;margin-bottom:20px;align-items:center;flex-wrap:wrap">
      <div class="search-wrap" style="max-width:300px;flex:1">
        <i class="bi bi-search"></i>
        <input type="text" class="input" id="clan-search" placeholder="Search clans…" autocomplete="off">
      </div>
    </div>

    <div id="clans-grid" class="clan-grid">
      <div class="state-container" style="grid-column:1/-1"><div class="spinner"></div></div>
    </div>
  `

  container.querySelector('#create-clan-btn').addEventListener('click', () => showCreateClanModal())

  let debounce
  container.querySelector('#clan-search').addEventListener('input', e => {
    clearTimeout(debounce)
    debounce = setTimeout(() => loadClans(container, e.target.value.trim()), 280)
  })

  await loadClans(container, '')
}

async function loadClans(container, search) {
  const grid = container.querySelector('#clans-grid')
  if (!grid) return
  grid.innerHTML = `<div class="state-container" style="grid-column:1/-1"><div class="spinner"></div></div>`

  try {
    const q = search ? `?search=${encodeURIComponent(search)}` : ''
    const { clans } = await api.get(`/clans${q}`)

    if (!clans || !clans.length) {
      grid.innerHTML = `
        <div class="state-container" style="grid-column:1/-1">
          <div class="state-icon">🛡️</div>
          <p class="state-title">${search ? 'No clans found' : 'No clans yet'}</p>
          <p class="state-desc">${search ? 'Try a different search term' : 'Be the first to create a clan!'}</p>
        </div>
      `
      return
    }

    grid.innerHTML = clans.map(c => `
      <div class="clan-card" data-id="${c.id}" tabindex="0" role="button" aria-label="View ${c.name}">
        <div style="display:flex;align-items:center;gap:10px;margin-bottom:10px">
          <div class="clan-avatar-sm">
            ${c.avatar_url
              ? `<img src="${c.avatar_url}" alt="${c.name}" style="width:100%;height:100%;object-fit:cover;border-radius:var(--r-sm)">`
              : c.name.slice(0, 2).toUpperCase()
            }
          </div>
          <div style="flex:1;min-width:0">
            <div style="font-weight:700;font-size:14px;display:flex;align-items:center;gap:6px;flex-wrap:wrap">
              <span style="overflow:hidden;text-overflow:ellipsis;white-space:nowrap;max-width:120px">${c.name}</span>
              <span class="clan-tag">${c.tag}</span>
            </div>
            <div style="font-size:11.5px;color:var(--text-3)">by ${c.owner_username}</div>
          </div>
        </div>
        ${c.description
          ? `<p style="font-size:13px;color:var(--text-2);margin-bottom:10px;line-height:1.5;display:-webkit-box;-webkit-line-clamp:2;-webkit-box-orient:vertical;overflow:hidden">${c.description}</p>`
          : ''
        }
        <div style="display:flex;align-items:center;justify-content:space-between;padding-top:8px;border-top:1px solid var(--border-2);margin-top:auto">
          <span style="font-size:12px;color:var(--text-3);display:flex;align-items:center;gap:4px">
            <i class="bi bi-people-fill"></i> ${c.member_count} member${c.member_count !== 1 ? 's' : ''}
          </span>
          <span style="font-size:11px;color:var(--text-3)">${timeAgo(c.created_at)}</span>
        </div>
      </div>
    `).join('')

    grid.querySelectorAll('[data-id]').forEach(el => {
      const go = () => navigate(`/clans?clan=${el.dataset.id}`)
      el.addEventListener('click', go)
      el.addEventListener('keydown', e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); go() } })
    })
  } catch (e) {
    grid.innerHTML = `
      <div class="state-container" style="grid-column:1/-1">
        <p class="state-desc">Failed to load clans. Please try again.</p>
      </div>
    `
  }
}

// ── Detail view ─────────────────────────────────────────────────────────────
async function renderClanDetail(container, clanId) {
  container.innerHTML = `<div class="state-container"><div class="spinner"></div></div>`

  try {
    const { clan, members, myRole } = await api.get(`/clans/${clanId}`)

    container.innerHTML = `
      <div style="margin-bottom:14px">
        <button class="btn btn-ghost btn-sm" id="back-btn">
          <i class="bi bi-arrow-left"></i> All Clans
        </button>
      </div>

      <div class="clan-header-card">
        <div class="clan-banner"></div>
        <div class="clan-info-area">
          <div class="clan-avatar" ${clan.avatar_url ? 'style="padding:0"' : ''}>
            ${clan.avatar_url
              ? `<img src="${clan.avatar_url}" alt="${clan.name}" style="width:100%;height:100%;object-fit:cover">`
              : clan.name.slice(0, 2).toUpperCase()
            }
          </div>
          <div class="clan-name-area">
            <div class="clan-name">
              ${clan.name}
              <span class="clan-tag">${clan.tag}</span>
              ${myRole ? `<span class="member-role ${myRole}">${myRole}</span>` : ''}
            </div>
            ${clan.description ? `<p class="clan-desc">${clan.description}</p>` : ''}
            <div class="clan-meta">
              <span><i class="bi bi-people-fill"></i> ${clan.member_count} member${clan.member_count !== 1 ? 's' : ''}</span>
              <span><i class="bi bi-person-fill"></i> Owner: ${clan.owner_username}</span>
              <span><i class="bi bi-calendar3"></i> Founded ${timeAgo(clan.created_at)}</span>
            </div>
          </div>
          <div style="display:flex;gap:8px;flex-shrink:0;flex-wrap:wrap;align-self:flex-end;padding-bottom:2px">
            ${!myRole ? `<button class="btn btn-primary" id="join-btn"><i class="bi bi-plus-lg"></i> Join Clan</button>` : ''}
            ${myRole && myRole !== 'owner' ? `<button class="btn btn-secondary btn-sm" id="leave-btn"><i class="bi bi-box-arrow-left"></i> Leave</button>` : ''}
            ${myRole === 'owner' || myRole === 'admin' ? `<button class="btn btn-secondary btn-sm" id="edit-btn"><i class="bi bi-pencil"></i> Edit</button>` : ''}
            ${myRole === 'owner' ? `<button class="btn btn-danger btn-sm" id="delete-btn" title="Delete clan"><i class="bi bi-trash3"></i></button>` : ''}
          </div>
        </div>
      </div>

      ${myRole ? `
        <div class="tabs" id="detail-tabs">
          <button class="tab-btn active" data-tab="feed"><i class="bi bi-newspaper"></i> Feed</button>
          <button class="tab-btn" data-tab="chat"><i class="bi bi-chat-dots"></i> Chat</button>
          <button class="tab-btn" data-tab="members"><i class="bi bi-people"></i> Members (${members.length})</button>
        </div>
      ` : `
        <div class="card">
          <div class="state-container" style="padding:48px 20px">
            <div class="state-icon">🔒</div>
            <p class="state-title">Members only</p>
            <p class="state-desc">Join this clan to access the feed, live chat, and member list.</p>
            <button class="btn btn-primary mt" id="join-btn-2">
              <i class="bi bi-plus-lg"></i> Join ${clan.name}
            </button>
          </div>
        </div>
      `}

      <div id="tab-content"></div>
    `

    // Back button
    container.querySelector('#back-btn').addEventListener('click', () => navigate('/clans'))

    // Join handlers
    const doJoin = async () => {
      try {
        await api.post(`/clans/${clanId}/join`)
        toast('Joined clan!', 'success')
        navigate(`/clans?clan=${clanId}`)
      } catch (e) { toast(e.message || 'Could not join clan', 'error') }
    }
    container.querySelector('#join-btn')?.addEventListener('click', doJoin)
    container.querySelector('#join-btn-2')?.addEventListener('click', doJoin)

    // Leave
    container.querySelector('#leave-btn')?.addEventListener('click', async () => {
      if (!confirm('Leave this clan?')) return
      try {
        await api.post(`/clans/${clanId}/leave`)
        toast('Left clan', 'info')
        navigate('/clans')
      } catch (e) { toast(e.message || 'Could not leave', 'error') }
    })

    // Edit
    container.querySelector('#edit-btn')?.addEventListener('click', () => showEditClanModal(clan, clanId))

    // Delete
    container.querySelector('#delete-btn')?.addEventListener('click', async () => {
      if (!confirm(`Delete "${clan.name}"? This cannot be undone.`)) return
      try {
        await api.delete(`/clans/${clanId}`)
        toast('Clan deleted', 'info')
        navigate('/clans')
      } catch (e) { toast(e.message || 'Could not delete', 'error') }
    })

    // Tabs (only if member)
    if (myRole) {
      const tabsEl  = container.querySelector('#detail-tabs')
      const content = container.querySelector('#tab-content')
      let active = 'feed'

      const switchTab = (tab) => {
        if (tab === active) return
        if (active === 'chat') {
          if (chatUnsub) { chatUnsub(); chatUnsub = null }
          clanWs.offAll()
          clanWs.disconnect()
        }
        active = tab
        tabsEl.querySelectorAll('.tab-btn').forEach(b => b.classList.toggle('active', b.dataset.tab === tab))
        if (tab === 'feed')    renderFeedTab(content, clanId, myRole)
        if (tab === 'chat')    renderChatTab(content, clanId)
        if (tab === 'members') renderMembersTab(content, clan, members, myRole, clanId)
      }

      tabsEl.addEventListener('click', e => {
        const btn = e.target.closest('.tab-btn')
        if (btn) switchTab(btn.dataset.tab)
      })

      renderFeedTab(content, clanId, myRole)
    }

  } catch (e) {
    if (e.status === 404 || e.status === 403) {
      container.innerHTML = `
        <div class="state-container">
          <div class="state-icon">🛡️</div>
          <p class="state-title">Clan not found</p>
          <p class="state-desc">This clan may have been deleted or doesn't exist.</p>
          <button class="btn btn-secondary mt" id="err-back">Browse Clans</button>
        </div>
      `
      container.querySelector('#err-back').addEventListener('click', () => navigate('/clans'))
    } else {
      container.innerHTML = `<div class="state-container"><p class="state-desc">Failed to load clan. Try again later.</p></div>`
    }
  }
}

// ── Feed tab ────────────────────────────────────────────────────────────────
async function renderFeedTab(container, clanId, myRole) {
  container.innerHTML = `
    <div class="card" style="margin-bottom:14px">
      <div style="display:flex;gap:10px;align-items:flex-start">
        ${avatar(state.user?.avatar_url, state.user?.username, 'avatar-md')}
        <div style="flex:1">
          <textarea class="input" id="clan-post-input" placeholder="Share something with the clan…" rows="2" style="min-height:60px"></textarea>
          <div style="display:flex;justify-content:flex-end;margin-top:8px">
            <button class="btn btn-primary btn-sm" id="clan-post-btn">
              <i class="bi bi-send-fill"></i> Post
            </button>
          </div>
        </div>
      </div>
    </div>
    <div id="clan-posts-list"></div>
  `

  const input = container.querySelector('#clan-post-input')
  container.querySelector('#clan-post-btn').addEventListener('click', async () => {
    const content = input.value.trim()
    if (!content) { toast('Write something first', 'error'); return }
    const btn = container.querySelector('#clan-post-btn')
    btn.disabled = true
    try {
      await api.post(`/clans/${clanId}/posts`, { content })
      input.value = ''
      toast('Posted!', 'success')
      await loadPosts(container.querySelector('#clan-posts-list'), clanId, myRole)
    } catch (e) { toast(e.message || 'Failed to post', 'error') }
    btn.disabled = false
  })

  await loadPosts(container.querySelector('#clan-posts-list'), clanId, myRole)
}

async function loadPosts(el, clanId, myRole) {
  if (!el) return
  el.innerHTML = `<div class="state-container"><div class="spinner"></div></div>`
  try {
    const { posts } = await api.get(`/clans/${clanId}/posts`)
    if (!posts?.length) {
      el.innerHTML = `
        <div class="state-container">
          <div class="state-icon">📝</div>
          <p class="state-title">No posts yet</p>
          <p class="state-desc">Be the first to share something!</p>
        </div>
      `
      return
    }
    el.innerHTML = posts.map(p => `
      <div class="post-card" style="margin-bottom:12px">
        <div class="post-header">
          ${avatar(p.avatar_url, p.username, 'avatar-md')}
          <div class="post-meta">
            <div class="post-username">${p.username}</div>
            <div class="post-time">${timeAgo(p.created_at)}</div>
          </div>
          ${p.user_id === state.user?.id || myRole === 'owner' || myRole === 'admin'
            ? `<button class="btn btn-ghost btn-icon btn-sm" data-del-post="${p.id}" title="Delete post">
                <i class="bi bi-trash3" style="color:var(--text-3)"></i>
               </button>`
            : ''}
        </div>
        <div class="post-content">${p.content}</div>
        ${p.image_url ? `<img class="post-image" src="${p.image_url}" alt="">` : ''}
      </div>
    `).join('')

    el.querySelectorAll('[data-del-post]').forEach(btn => {
      btn.addEventListener('click', async () => {
        if (!confirm('Delete this post?')) return
        try {
          await api.delete(`/clans/${clanId}/posts/${btn.dataset.delPost}`)
          toast('Post deleted', 'info')
          await loadPosts(el, clanId, myRole)
        } catch (e) { toast(e.message || 'Failed', 'error') }
      })
    })
  } catch {
    el.innerHTML = `<div class="state-container"><p class="state-desc">Failed to load posts</p></div>`
  }
}

// ── Chat tab ────────────────────────────────────────────────────────────────
async function renderChatTab(container, clanId) {
  container.innerHTML = `
    <div class="card" style="padding:0;overflow:hidden;display:flex;flex-direction:column;height:500px">
      <div style="padding:10px 14px;border-bottom:1px solid var(--border);font-size:13px;font-weight:600;color:var(--text-2);display:flex;align-items:center;gap:6px;flex-shrink:0">
        <i class="bi bi-chat-dots-fill" style="color:var(--accent-3)"></i> Clan Chat
        <span style="font-size:11px;font-weight:400;color:var(--text-3)">— live · members only</span>
        <span id="ws-status" style="margin-left:auto;font-size:11px;color:var(--text-3)">connecting…</span>
      </div>
      <div id="clan-msgs" style="flex:1;overflow-y:auto;padding:10px 14px;display:flex;flex-direction:column;gap:2px">
        <div class="state-container"><div class="spinner"></div></div>
      </div>
      <div style="border-top:1px solid var(--border);padding:10px 12px;display:flex;gap:8px;flex-shrink:0;align-items:flex-end">
        <textarea class="input" id="clan-msg-input" placeholder="Message the clan…" rows="1" style="min-height:36px;max-height:100px;resize:none;flex:1;padding-top:8px;padding-bottom:8px"></textarea>
        <button class="btn btn-primary btn-icon" id="clan-msg-send" title="Send message">
          <i class="bi bi-send-fill"></i>
        </button>
      </div>
    </div>
  `

  const msgsEl   = container.querySelector('#clan-msgs')
  const input    = container.querySelector('#clan-msg-input')
  const statusEl = container.querySelector('#ws-status')

  // Load history
  try {
    const { messages } = await api.get(`/clans/${clanId}/chat`)
    msgsEl.innerHTML = ''
    if (!messages?.length) {
      msgsEl.innerHTML = `<div class="state-container" style="padding:30px 0"><p class="state-desc">No messages yet. Say hi 👋</p></div>`
    } else {
      messages.forEach(m => appendMsg(msgsEl, m))
      msgsEl.scrollTop = msgsEl.scrollHeight
    }
  } catch {
    msgsEl.innerHTML = `<div class="state-container"><p class="state-desc">Failed to load chat history</p></div>`
  }

  // WebSocket connect
  clanWs.connect()
  clanWs.send({ type: 'clan:join', clanId: Number(clanId) })

  clanWs.on('clan:joined', () => { statusEl.textContent = '● live'; statusEl.style.color = 'var(--green)' })
  clanWs.on('clan:error', msg => { statusEl.textContent = 'disconnected'; toast(msg.error || 'Chat error', 'error') })

  chatUnsub = clanWs.on('clan:message', msg => {
    if (String(msg.clanId) !== String(clanId)) return
    const nearBottom = msgsEl.scrollHeight - msgsEl.scrollTop - msgsEl.clientHeight < 80
    const emptyState = msgsEl.querySelector('.state-container')
    if (emptyState) emptyState.remove()
    appendMsg(msgsEl, msg)
    if (nearBottom) msgsEl.scrollTop = msgsEl.scrollHeight
  })

  const send = () => {
    const content = input.value.trim()
    if (!content) return
    clanWs.send({ type: 'clan:message', content })
    input.value = ''
    input.style.height = ''
  }

  container.querySelector('#clan-msg-send').addEventListener('click', send)
  input.addEventListener('keydown', e => {
    if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); send() }
  })
  input.addEventListener('input', () => {
    input.style.height = 'auto'
    input.style.height = Math.min(input.scrollHeight, 100) + 'px'
  })
}

function appendMsg(container, msg) {
  const isMe = (msg.userId ?? msg.user_id) === state.user?.id
  const el = document.createElement('div')
  el.className = 'chat-msg'
  el.innerHTML = `
    ${avatar(msg.avatarUrl ?? msg.avatar_url, msg.username, 'avatar-sm')}
    <div class="chat-msg-body">
      <div class="chat-msg-top">
        <span class="chat-msg-user" ${isMe ? 'style="color:var(--accent-2)"' : ''}>${msg.username}</span>
        <span class="chat-msg-time">${timeAgo(msg.createdAt ?? msg.created_at)}</span>
      </div>
      <div class="chat-msg-text">${msg.content}</div>
    </div>
  `
  container.appendChild(el)
}

// ── Members tab ──────────────────────────────────────────────────────────────
function renderMembersTab(container, clan, members, myRole, clanId) {
  container.innerHTML = `
    <div class="card">
      <div class="section-title" style="margin-bottom:14px">
        <i class="bi bi-people-fill"></i> ${members.length} Member${members.length !== 1 ? 's' : ''}
      </div>
      <div id="member-list">
        ${members.map((m, i) => `
          <div class="member-row" data-idx="${i}">
            ${avatar(m.avatar_url, m.username, 'avatar-md')}
            <div style="flex:1;min-width:0">
              <div style="font-weight:600;font-size:13.5px">${m.username}</div>
              <div style="font-size:11.5px;color:var(--text-3)">Joined ${timeAgo(m.joined_at)}</div>
            </div>
            <span class="member-role ${m.role}">${m.role}</span>
            <div style="display:flex;gap:4px">${getMemberActions(m, myRole)}</div>
          </div>
        `).join('')}
      </div>
    </div>
  `

  container.querySelectorAll('.member-row').forEach(row => {
    const m = members[Number(row.dataset.idx)]

    row.querySelector('.btn-kick')?.addEventListener('click', async () => {
      if (!confirm(`Kick ${m.username}?`)) return
      try {
        await api.post(`/clans/${clanId}/members/${m.id}/kick`)
        toast(`${m.username} was kicked`, 'info')
        navigate(`/clans?clan=${clanId}`)
      } catch (e) { toast(e.message || 'Failed', 'error') }
    })

    row.querySelector('.btn-promote')?.addEventListener('click', async () => {
      try {
        await api.post(`/clans/${clanId}/members/${m.id}/promote`)
        toast(`${m.username} promoted to admin`, 'success')
        navigate(`/clans?clan=${clanId}`)
      } catch (e) { toast(e.message || 'Failed', 'error') }
    })

    row.querySelector('.btn-demote')?.addEventListener('click', async () => {
      try {
        await api.post(`/clans/${clanId}/members/${m.id}/demote`)
        toast(`${m.username} demoted to member`, 'info')
        navigate(`/clans?clan=${clanId}`)
      } catch (e) { toast(e.message || 'Failed', 'error') }
    })
  })
}

function getMemberActions(m, myRole) {
  if (m.id === state.user?.id || m.role === 'owner') return ''
  let html = ''
  if (myRole === 'owner') {
    html += m.role === 'member'
      ? `<button class="btn btn-ghost btn-icon btn-sm btn-promote" title="Promote to Admin"><i class="bi bi-arrow-up-circle" style="color:var(--accent-3)"></i></button>`
      : `<button class="btn btn-ghost btn-icon btn-sm btn-demote" title="Demote to Member"><i class="bi bi-arrow-down-circle" style="color:var(--text-3)"></i></button>`
    html += `<button class="btn btn-ghost btn-icon btn-sm btn-kick" title="Kick Member"><i class="bi bi-person-dash" style="color:var(--red)"></i></button>`
  } else if (myRole === 'admin' && m.role === 'member') {
    html += `<button class="btn btn-ghost btn-icon btn-sm btn-kick" title="Kick Member"><i class="bi bi-person-dash" style="color:var(--red)"></i></button>`
  }
  return html
}

// ── Modals ───────────────────────────────────────────────────────────────────
function showCreateClanModal() {
  const close = showModal(`
    <div class="modal-title"><i class="bi bi-shield-plus" style="color:var(--accent-3)"></i> Create a Clan</div>
    <div class="form-field">
      <label class="form-label">Clan Name</label>
      <input type="text" class="input" id="mc-name" placeholder="e.g. Shadow Warriors" maxlength="100" autocomplete="off">
    </div>
    <div class="form-field">
      <label class="form-label">
        Tag
        <span style="font-weight:400;text-transform:none;letter-spacing:0;color:var(--text-3)"> — 2 to 5 characters, shown as [TAG]</span>
      </label>
      <input type="text" class="input" id="mc-tag" placeholder="SW" maxlength="5"
        style="text-transform:uppercase;font-family:var(--font-m);letter-spacing:.1em">
    </div>
    <div class="form-field">
      <label class="form-label">Description <span style="font-weight:400;text-transform:none;color:var(--text-3)">(optional)</span></label>
      <textarea class="input" id="mc-desc" placeholder="What's your clan about?" rows="3"></textarea>
    </div>
    <div class="form-field">
      <label class="form-label">Avatar Image URL <span style="font-weight:400;text-transform:none;color:var(--text-3)">(optional)</span></label>
      <input type="url" class="input" id="mc-avatar" placeholder="https://…">
    </div>
    <div id="mc-err" class="form-error" style="display:none"></div>
    <div style="display:flex;gap:8px;justify-content:flex-end;margin-top:6px">
      <button class="btn btn-secondary" id="mc-cancel">Cancel</button>
      <button class="btn btn-primary" id="mc-submit"><i class="bi bi-shield-plus"></i> Create Clan</button>
    </div>
  `)

  const tagEl = document.getElementById('mc-tag')
  tagEl.addEventListener('input', () => {
    tagEl.value = tagEl.value.toUpperCase().replace(/[^A-Z0-9]/g, '')
  })

  document.getElementById('mc-cancel').addEventListener('click', close)
  document.getElementById('mc-submit').addEventListener('click', async () => {
    const name       = document.getElementById('mc-name').value.trim()
    const tag        = document.getElementById('mc-tag').value.trim()
    const description = document.getElementById('mc-desc').value.trim()
    const avatar_url = document.getElementById('mc-avatar').value.trim()
    const errEl      = document.getElementById('mc-err')
    const btn        = document.getElementById('mc-submit')

    if (!name) { showErr(errEl, 'Clan name is required'); return }
    if (!tag || tag.length < 2) { showErr(errEl, 'Tag must be 2–5 characters'); return }

    btn.disabled = true; errEl.style.display = 'none'
    try {
      const { clan } = await api.post('/clans', { name, tag, description, avatar_url })
      close()
      toast(`${clan.name} created!`, 'success')
      navigate(`/clans?clan=${clan.id}`)
    } catch (e) {
      showErr(errEl, e.message || 'Failed to create clan')
      btn.disabled = false
    }
  })
}

function showEditClanModal(clan, clanId) {
  const close = showModal(`
    <div class="modal-title"><i class="bi bi-pencil-fill" style="color:var(--accent-3)"></i> Edit Clan</div>
    <div class="form-field">
      <label class="form-label">Clan Name</label>
      <input type="text" class="input" id="me-name" value="${clan.name}" maxlength="100">
    </div>
    <div class="form-field">
      <label class="form-label">Tag</label>
      <input type="text" class="input" id="me-tag" value="${clan.tag}" maxlength="5"
        style="text-transform:uppercase;font-family:var(--font-m);letter-spacing:.1em">
    </div>
    <div class="form-field">
      <label class="form-label">Description</label>
      <textarea class="input" id="me-desc" rows="3">${clan.description || ''}</textarea>
    </div>
    <div class="form-field">
      <label class="form-label">Avatar Image URL</label>
      <input type="url" class="input" id="me-avatar" value="${clan.avatar_url || ''}">
    </div>
    <div id="me-err" class="form-error" style="display:none"></div>
    <div style="display:flex;gap:8px;justify-content:flex-end;margin-top:6px">
      <button class="btn btn-secondary" id="me-cancel">Cancel</button>
      <button class="btn btn-primary" id="me-submit"><i class="bi bi-check-lg"></i> Save Changes</button>
    </div>
  `)

  const tagEl = document.getElementById('me-tag')
  tagEl.addEventListener('input', () => {
    tagEl.value = tagEl.value.toUpperCase().replace(/[^A-Z0-9]/g, '')
  })

  document.getElementById('me-cancel').addEventListener('click', close)
  document.getElementById('me-submit').addEventListener('click', async () => {
    const name        = document.getElementById('me-name').value.trim()
    const tag         = document.getElementById('me-tag').value.trim()
    const description = document.getElementById('me-desc').value.trim()
    const avatar_url  = document.getElementById('me-avatar').value.trim()
    const errEl       = document.getElementById('me-err')
    const btn         = document.getElementById('me-submit')

    if (!name) { showErr(errEl, 'Clan name is required'); return }
    if (!tag || tag.length < 2) { showErr(errEl, 'Tag must be 2–5 characters'); return }

    btn.disabled = true; errEl.style.display = 'none'
    try {
      await api.patch(`/clans/${clanId}`, { name, tag, description, avatar_url })
      close()
      toast('Clan updated!', 'success')
      navigate(`/clans?clan=${clanId}`)
    } catch (e) {
      showErr(errEl, e.message || 'Failed to update clan')
      btn.disabled = false
    }
  })
}

function showErr(el, msg) {
  el.textContent = msg
  el.style.display = 'block'
}
