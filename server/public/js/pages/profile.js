// ── PROFILE ──────────────────────────────────────────────────────────────────
import { api } from '../api.js'
import { state, toast, timeAgo, avatar, showModal, closeModal, navigate } from '../app.js'

export async function renderProfile(container, path) {
  const uid = path?.split('/profile/')[1]
  const isSelf = !uid || parseInt(uid) === state.user?.id

  container.innerHTML = '<div class="state-container"><div class="spinner"></div></div>'
  try {
    const { user } = uid ? await api.get(`/users/${uid}`) : await api.get('/auth/me')
    container.innerHTML = buildProfileHtml(user, isSelf)
    bindProfileEvents(container, user, isSelf)
    loadProfileStats(container, user.id)
    loadAchievements(container, user.id)
  } catch {
    container.innerHTML = '<div class="state-container"><i class="bi bi-person-x state-icon"></i><div class="state-title">User not found</div></div>'
  }
}

function buildProfileHtml(u, isSelf) {
  return `
    <div class="profile-header-card">
      <div class="profile-banner"></div>
      <div class="profile-info-area">
        <div class="profile-avatar-wrap">
          ${avatar(u.avatar_url, u.username, 'avatar-2xl')}
        </div>
        <div class="profile-name-area">
          <div class="profile-username">${u.username}</div>
          <div class="profile-bio">${u.bio || 'No bio yet.'}</div>
          <div style="display:flex;gap:8px;flex-wrap:wrap;margin-top:6px">
            ${u.platform ? `<span class="tag"><i class="bi bi-device-hdd"></i> ${u.platform}</span>` : ''}
            ${u.favorite_games?.length ? u.favorite_games.map(g=>`<span class="tag"><i class="bi bi-controller"></i> ${g}</span>`).join('') : ''}
          </div>
        </div>
        <div style="margin-left:auto;display:flex;gap:6px;padding-bottom:4px">
          ${isSelf
            ? `<button class="btn btn-secondary btn-sm" id="edit-profile-btn"><i class="bi bi-pencil"></i> Edit Profile</button>`
            : `<button class="btn btn-primary btn-sm" id="add-friend-btn"><i class="bi bi-person-plus"></i> Add Friend</button>
               <button class="btn btn-ghost btn-sm" id="dm-user-btn"><i class="bi bi-chat-dots"></i> DM</button>`
          }
        </div>
      </div>
    </div>

    <div style="display:grid;grid-template-columns:1fr 1fr;gap:20px;align-items:start">
      <div>
        <div class="section">
          <div class="section-title"><i class="bi bi-bar-chart-fill"></i> Stats</div>
          <div class="stat-grid" id="profile-stats"><div class="spinner" style="margin:16px auto"></div></div>
        </div>
        <div class="section">
          <div class="section-title"><i class="bi bi-trophy-fill"></i> Achievements</div>
          <div id="achievements-grid"><div class="spinner" style="margin:16px auto"></div></div>
        </div>
      </div>
      <div class="section">
        <div class="section-title"><i class="bi bi-grid-3x3-gap"></i> Recent Activity</div>
        <div id="recent-games"><div class="spinner" style="margin:16px auto"></div></div>
      </div>
    </div>
  `
}

function bindProfileEvents(container, u, isSelf) {
  if (isSelf) {
    container.querySelector('#edit-profile-btn')?.addEventListener('click', () => showEditModal(u))
  } else {
    container.querySelector('#add-friend-btn')?.addEventListener('click', async function() {
      try { await api.post('/friends/request', { userId: u.id }); toast('Friend request sent!','success'); this.disabled=true; this.textContent='Sent' } catch (e) { toast(e.message,'error') }
    })
    container.querySelector('#dm-user-btn')?.addEventListener('click', () => navigate('/chat'))
  }
}

async function loadProfileStats(container, userId) {
  try {
    const { stats } = await api.get(`/games/stats${userId !== state.user?.id ? `?userId=${userId}` : ''}`)
    const el = container.querySelector('#profile-stats')
    const total = stats?.reduce((a,s)=>a+(parseInt(s.played)||0),0) || 0
    const wins  = stats?.reduce((a,s)=>a+(parseInt(s.wins)||0),0) || 0
    el.innerHTML = `
      <div class="stat-card"><div class="stat-value">${total}</div><div class="stat-label">Played</div></div>
      <div class="stat-card"><div class="stat-value text-green">${wins}</div><div class="stat-label">Wins</div></div>
      <div class="stat-card"><div class="stat-value text-red">${total-wins}</div><div class="stat-label">Losses</div></div>
      <div class="stat-card"><div class="stat-value text-gold">${total?Math.round(wins/total*100):0}%</div><div class="stat-label">Win Rate</div></div>
    `

    const recentEl = container.querySelector('#recent-games')
    if (!stats?.length) { recentEl.innerHTML = '<p class="text-dim center">No games played yet</p>'; return }
    recentEl.innerHTML = stats.slice(0,6).map(s=>`
      <div class="lb-row" style="padding:8px 0">
        <i class="bi bi-controller" style="color:var(--accent-2);width:20px"></i>
        <div style="flex:1"><div style="font-size:13px;font-weight:600">${s.game_name}</div></div>
        <div style="font-size:12px;color:var(--text-2)">${s.played} played</div>
        <div style="font-size:12px;color:var(--green)">${s.wins}W</div>
      </div>
      <div class="divider" style="margin:0"></div>
    `).join('')
  } catch {}
}

async function loadAchievements(container, userId) {
  try {
    const { achievements } = await api.get(`/achievements${userId !== state.user?.id ? `?userId=${userId}` : ''}`)
    const el = container.querySelector('#achievements-grid')
    if (!achievements?.length) { el.innerHTML = '<p class="text-dim center">No achievements yet</p>'; return }
    el.innerHTML = `<div class="achievement-grid">
      ${achievements.map(a=>`
        <div class="achievement-card ${a.earned_at?'earned':'locked'}">
          <div class="achievement-icon">${a.icon||'🏅'}</div>
          <div>
            <div class="achievement-name">${a.name}</div>
            <div class="achievement-desc">${a.description}</div>
            ${a.earned_at?`<div style="font-size:10px;color:var(--gold);margin-top:2px">${timeAgo(a.earned_at)}</div>`:''}
          </div>
        </div>
      `).join('')}
    </div>`
  } catch {}
}

function showEditModal(u) {
  showModal(`
    <div class="modal-title"><i class="bi bi-pencil-fill"></i> Edit Profile</div>
    <div class="form-field"><label class="form-label">Avatar URL</label><input class="input" id="e-avatar" value="${u.avatar_url||''}" placeholder="https://..."></div>
    <div class="form-field"><label class="form-label">Bio</label><textarea class="input" id="e-bio" rows="3">${u.bio||''}</textarea></div>
    <div class="form-field"><label class="form-label">Platform</label>
      <select class="input" id="e-platform">
        ${['','PC','PlayStation','Xbox','Nintendo Switch','Mobile','Multi-platform'].map(p=>`<option ${u.platform===p?'selected':''}>${p}</option>`).join('')}
      </select>
    </div>
    <div class="form-field"><label class="form-label">Favorite Games (comma-separated)</label>
      <input class="input" id="e-games" value="${(u.favorite_games||[]).join(', ')}" placeholder="Minecraft, Valorant…">
    </div>
    <div style="display:flex;gap:8px;justify-content:flex-end;margin-top:14px">
      <button class="btn btn-ghost" id="edit-cancel">Cancel</button>
      <button class="btn btn-primary" id="edit-save"><i class="bi bi-check-lg"></i> Save</button>
    </div>
  `)
  document.getElementById('edit-cancel').addEventListener('click', closeModal)
  document.getElementById('edit-save').addEventListener('click', async () => {
    const body = {
      avatar_url: document.getElementById('e-avatar').value.trim() || null,
      bio: document.getElementById('e-bio').value.trim(),
      platform: document.getElementById('e-platform').value,
      favorite_games: document.getElementById('e-games').value.split(',').map(s=>s.trim()).filter(Boolean),
    }
    try {
      const { user } = await api.put('/users/profile', body)
      state.user = { ...state.user, ...user }
      closeModal(); toast('Profile updated!','success')
      document.querySelector('.sidebar-user-name').textContent = user.username
    } catch (e) { toast(e.message,'error') }
  })
}

// ── FRIENDS ──────────────────────────────────────────────────────────────────
export async function renderFriends(container) {
  container.innerHTML = `
    <div class="page-header">
      <h1 class="page-title"><i class="bi bi-people-fill"></i> Friends</h1>
    </div>
    <div style="display:flex;gap:8px;margin-bottom:16px">
      <input class="input" id="friend-search" placeholder="Search by username…" style="max-width:260px">
      <button class="btn btn-primary btn-sm" id="friend-search-btn"><i class="bi bi-search"></i> Find</button>
    </div>
    <div id="search-results"></div>
    <div class="tabs">
      <button class="tab-btn active" data-tab="friends">Friends</button>
      <button class="tab-btn" data-tab="pending">Pending</button>
      <button class="tab-btn" data-tab="sent">Sent</button>
    </div>
    <div id="friends-tab-content"><div class="state-container"><div class="spinner"></div></div></div>
  `

  let activeTab = 'friends'
  container.querySelectorAll('.tab-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      container.querySelectorAll('.tab-btn').forEach(b=>b.classList.remove('active'))
      btn.classList.add('active'); activeTab=btn.dataset.tab; loadFriends(activeTab)
    })
  })

  container.querySelector('#friend-search-btn').addEventListener('click', searchFriends)
  container.querySelector('#friend-search').addEventListener('keydown', e=>{ if(e.key==='Enter') searchFriends() })

  async function searchFriends() {
    const q = container.querySelector('#friend-search').value.trim()
    if (!q) return
    const el = container.querySelector('#search-results')
    el.innerHTML = '<div class="state-container" style="padding:20px"><div class="spinner"></div></div>'
    try {
      const { users } = await api.get(`/users/search?q=${encodeURIComponent(q)}`)
      el.innerHTML = `
        <div class="section-title" style="margin-bottom:10px"><i class="bi bi-search"></i> Search Results</div>
        <div style="display:flex;flex-direction:column;gap:6px;margin-bottom:16px">
          ${users.filter(u=>u.id!==state.user.id).map(u=>`
            <div class="friend-card">
              ${avatar(u.avatar_url, u.username,'avatar-md')}
              <div class="friend-info">
                <div class="friend-name">${u.username}</div>
                <div class="friend-platform">${u.platform||'Gamer'}</div>
              </div>
              <button class="btn btn-primary btn-sm" data-add="${u.id}"><i class="bi bi-person-plus"></i> Add</button>
            </div>
          `).join('') || '<p class="text-dim">No users found</p>'}
        </div>
      `
      el.querySelectorAll('[data-add]').forEach(btn => {
        btn.addEventListener('click', async () => {
          try { await api.post('/friends/request',{userId:parseInt(btn.dataset.add)}); btn.disabled=true; btn.textContent='Sent ✓'; toast('Request sent!','success') }
          catch (e) { toast(e.message,'error') }
        })
      })
    } catch { el.innerHTML = '' }
  }

  loadFriends('friends')

  async function loadFriends(tab) {
    const el = container.querySelector('#friends-tab-content')
    el.innerHTML = '<div class="state-container"><div class="spinner"></div></div>'
    try {
      const { friends } = await api.get('/friends')
      let list
      if (tab==='friends') list = friends.filter(f=>f.status==='accepted')
      else if (tab==='pending') list = friends.filter(f=>f.status==='pending'&&f.direction==='incoming')
      else list = friends.filter(f=>f.status==='pending'&&f.direction==='outgoing')

      if (!list.length) {
        el.innerHTML = `<div class="state-container"><i class="bi bi-people state-icon"></i>
          <div class="state-title">${tab==='friends'?'No friends yet':tab==='pending'?'No pending requests':'No sent requests'}</div>
          <p class="state-desc">${tab==='friends'?'Search for gamers above and add them as friends!':''}</p>
        </div>`
        return
      }

      el.innerHTML = `<div style="display:flex;flex-direction:column;gap:8px">
        ${list.map(f=>`
          <div class="friend-card">
            ${avatar(f.avatar_url, f.username,'avatar-md')}
            <div class="friend-info">
              <div class="friend-name">${f.username}</div>
              <div class="friend-platform">${f.platform||'Gamer'}</div>
            </div>
            <div style="display:flex;gap:6px">
              ${tab==='friends' ? `
                <button class="btn btn-ghost btn-sm" data-chat="${f.id}" title="DM"><i class="bi bi-chat-dots"></i></button>
                <button class="btn btn-ghost btn-sm text-red" data-remove="${f.id}" title="Remove friend"><i class="bi bi-person-x"></i></button>
              ` : tab==='pending' ? `
                <button class="btn btn-primary btn-sm" data-accept="${f.id}"><i class="bi bi-check-lg"></i> Accept</button>
                <button class="btn btn-ghost btn-sm text-red" data-reject="${f.id}"><i class="bi bi-x-lg"></i></button>
              ` : `
                <span style="font-size:12px;color:var(--text-3)">Pending…</span>
                <button class="btn btn-ghost btn-sm text-red" data-cancel="${f.id}"><i class="bi bi-x-lg"></i></button>
              `}
            </div>
          </div>
        `).join('')}
      </div>`

      el.querySelectorAll('[data-accept]').forEach(btn=>{ btn.addEventListener('click', async()=>{ await api.post(`/friends/accept`,{requestId:btn.dataset.accept}); loadFriends(tab); toast('Friend added!','success') }) })
      el.querySelectorAll('[data-reject]').forEach(btn=>{ btn.addEventListener('click', async()=>{ await api.delete(`/friends/${btn.dataset.reject}`); loadFriends(tab) }) })
      el.querySelectorAll('[data-cancel]').forEach(btn=>{ btn.addEventListener('click', async()=>{ await api.delete(`/friends/${btn.dataset.cancel}`); loadFriends(tab) }) })
      el.querySelectorAll('[data-remove]').forEach(btn=>{ btn.addEventListener('click', async()=>{ if(confirm('Remove friend?')){ await api.delete(`/friends/${btn.dataset.remove}`); loadFriends(tab) } }) })
      el.querySelectorAll('[data-chat]').forEach(btn=>{ btn.addEventListener('click', ()=>navigate('/chat')) })
    } catch (e) { el.innerHTML = `<div class="state-container"><p class="text-dim">${e.message}</p></div>` }
  }
}

// ── CLANS ────────────────────────────────────────────────────────────────────
export async function renderClans(container, path) {
  const clanId = path?.split('/clans/')[1]
  if (clanId) { await renderClanDetail(container, clanId); return }
  renderClanBrowser(container)
}

async function renderClanBrowser(container) {
  container.innerHTML = `
    <div class="page-header">
      <h1 class="page-title"><i class="bi bi-shield-fill"></i> Clans</h1>
      <button class="btn btn-primary btn-sm" id="create-clan-btn"><i class="bi bi-plus-lg"></i> Create Clan</button>
    </div>
    <div style="display:flex;gap:8px;margin-bottom:16px;flex-wrap:wrap">
      <input class="input" id="clan-search" placeholder="Search clans…" style="max-width:240px">
      <button class="btn btn-secondary btn-sm" id="clan-search-btn"><i class="bi bi-search"></i></button>
    </div>
    <div id="clan-list"><div class="state-container"><div class="spinner"></div></div></div>
  `

  container.querySelector('#create-clan-btn').addEventListener('click', showCreateClanModal)
  container.querySelector('#clan-search-btn').addEventListener('click', () => loadClans(container.querySelector('#clan-search').value))
  container.querySelector('#clan-search').addEventListener('keydown', e => { if(e.key==='Enter') loadClans(e.target.value) })

  loadClans()

  async function loadClans(search='') {
    const el = container.querySelector('#clan-list')
    el.innerHTML = '<div class="state-container"><div class="spinner"></div></div>'
    try {
      const { clans } = await api.get(`/clans${search?`?search=${encodeURIComponent(search)}`:''}`)
      if (!clans.length) { el.innerHTML = '<div class="state-container"><i class="bi bi-shield state-icon"></i><div class="state-title">No clans found</div></div>'; return }
      el.innerHTML = `<div style="display:grid;grid-template-columns:repeat(auto-fill,minmax(260px,1fr));gap:12px">
        ${clans.map(c=>`
          <div class="clan-card" data-clan="${c.id}">
            <div style="display:flex;align-items:center;gap:10px;margin-bottom:10px">
              ${avatar(c.avatar_url, c.name, 'avatar-md')}
              <div style="flex:1;min-width:0">
                <div style="font-weight:700;font-size:14px">${c.name} <span class="clan-tag">${c.tag}</span></div>
                <div style="font-size:12px;color:var(--text-2)">${c.member_count||0} members</div>
              </div>
            </div>
            <p style="font-size:13px;color:var(--text-2);line-height:1.5">${c.description||'No description'}</p>
          </div>
        `).join('')}
      </div>`
      el.querySelectorAll('[data-clan]').forEach(card => {
        card.addEventListener('click', () => { history.pushState(null,'',`/clans/${card.dataset.clan}`); renderClanDetail(container, card.dataset.clan) })
      })
    } catch (e) { el.innerHTML = `<div class="state-container"><p class="text-dim">${e.message}</p></div>` }
  }
}

async function renderClanDetail(container, clanId) {
  container.innerHTML = '<div class="state-container"><div class="spinner"></div></div>'
  try {
    const { clan } = await api.get(`/clans/${clanId}`)
    const isMember = clan.members?.some(m=>m.user_id===state.user?.id)
    const myRole   = clan.members?.find(m=>m.user_id===state.user?.id)?.role
    const isOwner  = myRole==='owner'

    container.innerHTML = `
      <div class="page-header">
        <div style="display:flex;align-items:center;gap:10px">
          <button class="btn btn-ghost btn-icon" id="back-clans"><i class="bi bi-arrow-left"></i></button>
          <h1 class="page-title" style="margin:0">${clan.name} <span class="clan-tag">${clan.tag}</span></h1>
        </div>
        <div style="display:flex;gap:6px">
          ${isMember
            ? `${isOwner?`<button class="btn btn-ghost btn-sm" id="delete-clan-btn"><i class="bi bi-trash3"></i></button>`:''}
               <button class="btn btn-ghost btn-sm text-red" id="leave-clan-btn"><i class="bi bi-box-arrow-right"></i> Leave</button>`
            : `<button class="btn btn-primary btn-sm" id="join-clan-btn"><i class="bi bi-person-plus"></i> Join Clan</button>`
          }
        </div>
      </div>
      <p style="color:var(--text-2);font-size:13px;margin-bottom:20px">${clan.description||''}</p>

      <div style="display:grid;grid-template-columns:1fr 240px;gap:20px;align-items:start">
        <div>
          ${isMember ? `
            <div class="section">
              <div class="section-title"><i class="bi bi-chat-dots"></i> Clan Chat</div>
              <div style="background:var(--surface);border:1px solid var(--border);border-radius:var(--r-lg);overflow:hidden">
                <div id="clan-chat-msgs" style="height:240px;overflow-y:auto;padding:12px;display:flex;flex-direction:column;gap:4px"></div>
                <div style="border-top:1px solid var(--border);padding:8px;display:flex;gap:6px">
                  <input class="input" id="clan-chat-input" placeholder="Message the clan…" style="font-size:13px">
                  <button class="btn btn-primary btn-icon" id="clan-chat-send"><i class="bi bi-send-fill"></i></button>
                </div>
              </div>
            </div>
            <div class="section">
              <div class="section-title"><i class="bi bi-newspaper"></i> Clan Feed</div>
              <div style="margin-bottom:10px;display:flex;gap:8px">
                <input class="input" id="clan-post-input" placeholder="Post to the clan…" style="font-size:13px">
                <button class="btn btn-primary btn-sm" id="clan-post-btn"><i class="bi bi-send"></i> Post</button>
              </div>
              <div id="clan-posts"></div>
            </div>
          ` : '<div class="state-container"><i class="bi bi-shield state-icon"></i><div class="state-title">Join to participate</div><p class="state-desc">Join this clan to see the feed and chat</p></div>'}
        </div>

        <div>
          <div class="card card-sm">
            <div class="section-title"><i class="bi bi-people-fill"></i> Members (${clan.members?.length||0})</div>
            <div style="display:flex;flex-direction:column;gap:6px;max-height:400px;overflow-y:auto">
              ${(clan.members||[]).map(m=>`
                <div style="display:flex;align-items:center;gap:8px">
                  ${avatar(m.avatar_url,m.username,'avatar-sm')}
                  <div style="flex:1;min-width:0">
                    <div style="font-size:13px;font-weight:600;white-space:nowrap;overflow:hidden;text-overflow:ellipsis">${m.username}</div>
                    <div style="font-size:11px;color:${m.role==='owner'?'var(--gold)':m.role==='admin'?'var(--accent-3)':'var(--text-3)'}">${m.role}</div>
                  </div>
                  ${isOwner&&m.user_id!==state.user?.id?`<button class="btn btn-ghost btn-icon btn-sm" data-kick="${m.user_id}" title="Kick"><i class="bi bi-person-x"></i></button>`:''}
                </div>
              `).join('')}
            </div>
          </div>
        </div>
      </div>
    `

    container.querySelector('#back-clans').addEventListener('click', () => { history.pushState(null,'','/clans'); renderClanBrowser(container) })
    container.querySelector('#join-clan-btn')?.addEventListener('click', async function() {
      try { await api.post(`/clans/${clanId}/join`); toast('Joined clan!','success'); renderClanDetail(container,clanId) } catch(e){toast(e.message,'error')}
    })
    container.querySelector('#leave-clan-btn')?.addEventListener('click', async()=>{ if(confirm('Leave clan?')){ await api.post(`/clans/${clanId}/leave`); toast('Left clan'); history.pushState(null,'','/clans'); renderClanBrowser(container) } })
    container.querySelector('#delete-clan-btn')?.addEventListener('click', async()=>{ if(confirm('Delete clan permanently?')){ await api.delete(`/clans/${clanId}`); toast('Clan deleted'); history.pushState(null,'','/clans'); renderClanBrowser(container) } })

    container.querySelectorAll('[data-kick]').forEach(btn=>{
      btn.addEventListener('click', async()=>{ if(confirm('Kick member?')){ await api.post(`/clans/${clanId}/members/${btn.dataset.kick}/kick`); renderClanDetail(container,clanId) } })
    })

    if (isMember) {
      loadClanChat(container, clanId)
      loadClanPosts(container, clanId)
      container.querySelector('#clan-chat-send').addEventListener('click', () => sendClanChat(container, clanId))
      container.querySelector('#clan-chat-input').addEventListener('keydown', e=>{ if(e.key==='Enter') sendClanChat(container,clanId) })
      container.querySelector('#clan-post-btn').addEventListener('click', () => postToClan(container,clanId))
    }
  } catch { container.innerHTML = '<div class="state-container"><p class="text-dim">Failed to load clan</p></div>' }
}

async function loadClanChat(container, clanId) {
  try {
    const { messages } = await api.get(`/clans/${clanId}/chat`)
    const el = container.querySelector('#clan-chat-msgs')
    el.innerHTML = messages.map(m=>`
      <div style="display:flex;gap:7px;margin-bottom:4px">
        ${avatar(m.avatar_url,m.username,'avatar-sm')}
        <div><span style="font-size:12px;font-weight:600;color:var(--accent-3)">${m.username}</span>
        <span style="font-size:11px;color:var(--text-3);margin-left:5px">${timeAgo(m.created_at)}</span>
        <div style="font-size:13px">${m.content}</div></div>
      </div>
    `).join('')
    el.scrollTop = el.scrollHeight
  } catch {}
}

async function sendClanChat(container, clanId) {
  const inp = container.querySelector('#clan-chat-input')
  const content = inp.value.trim(); if(!content) return
  inp.value = ''
  try { await api.post(`/clans/${clanId}/chat`, { content }); loadClanChat(container, clanId) } catch (e) { toast(e.message,'error') }
}

async function loadClanPosts(container, clanId) {
  try {
    const { posts } = await api.get(`/clans/${clanId}/posts`)
    const el = container.querySelector('#clan-posts')
    el.innerHTML = posts.map(p=>`
      <div class="post-card" style="margin-bottom:10px">
        <div class="post-header">
          ${avatar(p.avatar_url,p.username,'avatar-sm')}
          <div class="post-meta"><div class="post-username">${p.username}</div><div class="post-time">${timeAgo(p.created_at)}</div></div>
        </div>
        <div class="post-content">${p.content}</div>
      </div>
    `).join('') || '<p class="text-dim center">No posts yet</p>'
  } catch {}
}

async function postToClan(container, clanId) {
  const inp = container.querySelector('#clan-post-input')
  const content = inp.value.trim(); if(!content) return
  inp.value=''
  try { await api.post(`/clans/${clanId}/posts`,{content}); loadClanPosts(container,clanId); toast('Posted!','success') } catch(e){toast(e.message,'error')}
}

function showCreateClanModal() {
  showModal(`
    <div class="modal-title"><i class="bi bi-shield-plus"></i> Create Clan</div>
    <div class="form-field"><label class="form-label">Clan Name</label><input class="input" id="cn-name" placeholder="Epic Gamers"></div>
    <div class="form-field"><label class="form-label">Tag (3-5 chars)</label><input class="input" id="cn-tag" placeholder="EG" maxlength="5"></div>
    <div class="form-field"><label class="form-label">Description</label><textarea class="input" id="cn-desc" rows="2" placeholder="What's your clan about?"></textarea></div>
    <div style="display:flex;gap:8px;justify-content:flex-end;margin-top:14px">
      <button class="btn btn-ghost" id="cc-cancel">Cancel</button>
      <button class="btn btn-primary" id="cc-create"><i class="bi bi-check-lg"></i> Create</button>
    </div>
  `)
  document.getElementById('cc-cancel').addEventListener('click', closeModal)
  document.getElementById('cc-create').addEventListener('click', async () => {
    const name=document.getElementById('cn-name').value.trim()
    const tag=document.getElementById('cn-tag').value.trim().toUpperCase()
    const description=document.getElementById('cn-desc').value.trim()
    if(!name||!tag){toast('Name and tag are required','error');return}
    try {
      await api.post('/clans',{name,tag,description})
      closeModal(); toast('Clan created!','success')
      navigate('/clans')
    } catch(e){toast(e.message,'error')}
  })
}

// ── LEADERBOARD ──────────────────────────────────────────────────────────────
export async function renderLeaderboard(container) {
  container.innerHTML = `
    <div class="page-header">
      <h1 class="page-title"><i class="bi bi-trophy-fill"></i> Leaderboard</h1>
    </div>
    <div class="tabs" id="lb-tabs">
      <button class="tab-btn active" data-game="global">Global</button>
      <button class="tab-btn" data-game="Tic-Tac-Toe">Tic-Tac-Toe</button>
      <button class="tab-btn" data-game="Connect 4">Connect 4</button>
      <button class="tab-btn" data-game="Snake">Snake</button>
      <button class="tab-btn" data-game="2048">2048</button>
      <button class="tab-btn" data-game="Gaming Trivia">Trivia</button>
    </div>
    <div id="lb-content"><div class="state-container"><div class="spinner"></div></div></div>
  `

  container.querySelectorAll('#lb-tabs .tab-btn').forEach(btn=>{
    btn.addEventListener('click', ()=>{
      container.querySelectorAll('#lb-tabs .tab-btn').forEach(b=>b.classList.remove('active'))
      btn.classList.add('active')
      loadLb(btn.dataset.game)
    })
  })

  loadLb('global')

  async function loadLb(game) {
    const el = container.querySelector('#lb-content')
    el.innerHTML = '<div class="state-container"><div class="spinner"></div></div>'
    try {
      const path = game==='global' ? '/leaderboard' : `/leaderboard?game=${encodeURIComponent(game)}`
      const { leaderboard } = await api.get(path)
      if (!leaderboard?.length) { el.innerHTML = '<div class="state-container"><i class="bi bi-trophy state-icon"></i><div class="state-title">No data yet</div><p class="state-desc">Play some games to appear here!</p></div>'; return }
      el.innerHTML = `
        <div class="card" style="padding:8px">
          ${leaderboard.map((u,i)=>{
            const rankClass = i===0?'gold':i===1?'silver':i===2?'bronze':''
            const rankIcon  = i===0?'🥇':i===1?'🥈':i===2?'🥉':''
            return `
              <div class="lb-row ${u.user_id===state.user?.id?'active':''}" style="${u.user_id===state.user?.id?'background:var(--accent-dim);border-radius:var(--r-sm);':''}">
                <div class="lb-rank ${rankClass}">${rankIcon||'#'+(i+1)}</div>
                <div class="lb-user">
                  ${avatar(u.avatar_url,u.username,'avatar-sm')}
                  <span class="lb-username">${u.username}${u.user_id===state.user?.id?' (You)':''}</span>
                </div>
                <div class="lb-score">${game==='global'?u.wins+' wins':u.score||u.wins+' pts'}</div>
              </div>
              ${i<leaderboard.length-1?'<div class="divider" style="margin:0"></div>':''}
            `
          }).join('')}
        </div>
      `
    } catch (e) { el.innerHTML = `<div class="state-container"><p class="text-dim">${e.message}</p></div>` }
  }
}
