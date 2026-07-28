import { api } from '../api.js'
import { state, toast, timeAgo, avatar, showModal, closeModal } from '../app.js'

const TAGS = ['#tips-and-ideas','#FPS','#RPG','#strategy','#casual','#retro','#mobile','#esports','#highlights']

export async function renderFeed(container) {
  container.innerHTML = `
    <div class="page-header">
      <h1 class="page-title"><i class="bi bi-house-door-fill"></i> Community Feed</h1>
    </div>

    <div style="display:grid;grid-template-columns:1fr 260px;gap:20px;align-items:start">
      <div>
        <!-- Compose area -->
        <div class="card" id="compose-area" style="margin-bottom:16px;border-color:rgba(124,58,237,.15)">
          <div style="display:flex;gap:12px;align-items:flex-start">
            <div style="position:relative;flex-shrink:0">
              ${avatar(state.user.avatar_url, state.user.username, 'avatar-md')}
              <span style="position:absolute;bottom:0;right:0;width:9px;height:9px;background:var(--green);border-radius:50%;border:2px solid var(--surface)"></span>
            </div>
            <div style="flex:1">
              <textarea class="input" id="post-input"
                placeholder="What's going on in your game world, ${state.user.username}?"
                rows="3"
                style="resize:none;background:var(--surface-2);border-color:var(--border-2);font-size:14px"></textarea>

              <!-- Custom tag input -->
              <div style="margin-top:10px;position:relative">
                <div style="font-size:11px;font-weight:600;color:var(--text-3);text-transform:uppercase;letter-spacing:.06em;margin-bottom:6px">
                  Tags <span style="font-weight:400;text-transform:none;letter-spacing:0">— type and press Enter</span>
                </div>
                <div class="tag-input-wrap" id="tag-input-wrap">
                  <input type="text" id="tag-input" placeholder="#gaming or just gaming" autocomplete="off"
                    style="font-size:12.5px">
                </div>
                <div style="display:flex;gap:5px;flex-wrap:wrap;margin-top:6px">
                  ${TAGS.slice(0,5).map(t=>`<span class="tag" style="cursor:pointer;font-size:11px" data-quick-tag="${t}">${t}</span>`).join('')}
                </div>
              </div>
              <div id="selected-tags" style="display:none"></div>

              <!-- Toolbar -->
              <div style="display:flex;align-items:center;justify-content:space-between;margin-top:12px;flex-wrap:wrap;gap:8px;padding-top:12px;border-top:1px solid var(--border-2)">
                <div style="display:flex;gap:8px;align-items:center">
                  <label class="btn btn-ghost btn-sm" style="cursor:pointer;gap:5px" title="Attach image/video">
                    <i class="bi bi-paperclip" style="font-size:15px"></i>
                    <span style="font-size:12px">Attach</span>
                    <input type="file" id="file-input" accept="image/*,video/*,.gif" style="display:none">
                  </label>
                  <span id="attach-name" style="font-size:11.5px;color:var(--text-3)"></span>
                </div>
                <button class="btn btn-primary btn-sm" id="submit-post" style="gap:6px">
                  <i class="bi bi-send-fill"></i> Share Post
                </button>
              </div>
              <div id="attachment-preview" style="display:none;margin-top:8px"></div>
            </div>
          </div>
        </div>

        <!-- Filter tabs -->
        <div style="display:flex;gap:5px;margin-bottom:16px;flex-wrap:wrap;align-items:center">
          <span style="font-size:11.5px;font-weight:600;color:var(--text-3);margin-right:4px">Filter:</span>
          <button class="btn btn-secondary btn-sm active-filter" data-filter="">All</button>
          ${TAGS.map(t=>`<button class="btn btn-ghost btn-sm" data-filter="${t}" style="font-size:11.5px">${t}</button>`).join('')}
        </div>

        <!-- Posts -->
        <div id="posts-list"></div>
        <div id="posts-loading" class="state-container"><div class="spinner"></div></div>
      </div>

      <!-- Sidebar widget -->
      <div class="hidden" id="feed-aside" style="display:flex;flex-direction:column;gap:14px">
        <div class="card card-sm" style="border-color:rgba(124,58,237,.15)">
          <div class="section-title" style="margin-bottom:12px">
            <i class="bi bi-fire" style="color:#f97316"></i> Trending Tags
          </div>
          <div style="display:flex;flex-wrap:wrap;gap:6px">
            ${TAGS.map(t=>`<span class="tag" style="cursor:pointer" data-filter-tag="${t}">${t}</span>`).join('')}
          </div>
        </div>
        <div class="card card-sm">
          <div class="section-title" style="margin-bottom:12px">
            <i class="bi bi-bar-chart-fill" style="color:var(--accent-3)"></i> Your Stats
          </div>
          <div id="mini-stats" style="font-size:13px;color:var(--text-3)">Loading…</div>
        </div>
        <div class="card card-sm" style="background:linear-gradient(135deg,rgba(124,58,237,.1),rgba(139,92,246,.05));border-color:rgba(124,58,237,.2)">
          <div style="font-size:13px;font-weight:700;margin-bottom:6px;display:flex;align-items:center;gap:6px">
            <i class="bi bi-shield-fill" style="color:var(--accent-3)"></i> Got a team?
          </div>
          <p style="font-size:12px;color:var(--text-3);line-height:1.5;margin-bottom:10px">Create or join a clan to compete together and climb the leaderboard.</p>
          <a href="/clans" style="font-size:12px;font-weight:600;color:var(--accent-3);display:flex;align-items:center;gap:4px">
            Browse Clans <i class="bi bi-arrow-right"></i>
          </a>
        </div>
      </div>
    </div>
  `

  // Show aside on wider screens
  if (window.innerWidth >= 900) {
    document.getElementById('feed-aside').classList.remove('hidden')
    document.getElementById('feed-aside').style.display = 'flex'
    loadMiniStats()
  }

  let activeFilter = ''
  let selectedTags = []

  const postsEl  = container.querySelector('#posts-list')
  const loadingEl = container.querySelector('#posts-loading')

  // ── Custom tag input ──────────────────────────────────────────────────────
  const tagInput = container.querySelector('#tag-input')
  const tagWrap  = container.querySelector('#tag-input-wrap')

  function addTag(raw) {
    const tag = '#' + raw.replace(/^#+/, '').replace(/[^a-zA-Z0-9-]/g, '').toLowerCase()
    if (!tag || tag === '#' || selectedTags.includes(tag)) return
    if (selectedTags.length >= 5) { toast('Max 5 tags', 'error'); return }
    selectedTags.push(tag)
    renderTagPills()
  }

  function renderTagPills() {
    const selectedEl = container.querySelector('#selected-tags')
    if (!selectedTags.length) { selectedEl.style.display = 'none'; return }
    selectedEl.style.display = 'flex'
    selectedEl.style.flexWrap = 'wrap'
    selectedEl.style.gap = '4px'
    selectedEl.style.marginTop = '6px'
    selectedEl.innerHTML = selectedTags.map(t => `
      <span class="tag-pill">${t}
        <button data-remove="${t}">×</button>
      </span>
    `).join('')
    selectedEl.querySelectorAll('[data-remove]').forEach(btn => {
      btn.addEventListener('click', () => {
        selectedTags = selectedTags.filter(t => t !== btn.dataset.remove)
        renderTagPills()
      })
    })
  }

  tagInput.addEventListener('keydown', e => {
    if (e.key === 'Enter' || e.key === ',') {
      e.preventDefault()
      addTag(tagInput.value.trim())
      tagInput.value = ''
    } else if (e.key === 'Backspace' && !tagInput.value && selectedTags.length) {
      selectedTags.pop()
      renderTagPills()
    }
  })

  tagWrap.addEventListener('click', () => tagInput.focus())

  // Quick tags
  container.querySelectorAll('[data-quick-tag]').forEach(el => {
    el.addEventListener('click', () => { addTag(el.dataset.quickTag); el.style.opacity = '.4' })
  })

  // ── @ mention autocomplete ─────────────────────────────────────────────────
  const postInput = container.querySelector('#post-input')
  let mentionDropdown = null

  postInput.addEventListener('input', async () => {
    const val    = postInput.value
    const cursor = postInput.selectionStart
    const before = val.slice(0, cursor)
    const match  = before.match(/@(\w+)$/)

    if (!match) { closeMention(); return }
    const q = match[1]
    if (!q) { closeMention(); return }

    try {
      const { users } = await api.get(`/users/search?q=${encodeURIComponent(q)}`)
      if (!users?.length) { closeMention(); return }
      showMentionDropdown(users, match[1])
    } catch { closeMention() }
  })

  function showMentionDropdown(users, query) {
    closeMention()
    mentionDropdown = document.createElement('div')
    mentionDropdown.className = 'mention-dropdown'
    mentionDropdown.style.cssText = 'position:absolute;bottom:calc(100% + 4px);left:0;right:0;z-index:100'
    mentionDropdown.innerHTML = users.slice(0,6).map(u => `
      <div class="mention-item" data-username="${u.username}">
        <img src="${u.avatar_url||''}" onerror="this.style.display='none'" style="width:24px;height:24px;border-radius:50%;object-fit:cover">
        <strong>@${u.username}</strong>
      </div>
    `).join('')
    mentionDropdown.querySelectorAll('[data-username]').forEach(item => {
      item.addEventListener('click', () => {
        const val    = postInput.value
        const cursor = postInput.selectionStart
        const before = val.slice(0, cursor)
        const after  = val.slice(cursor)
        const newBefore = before.replace(/@\w+$/, `@${item.dataset.username} `)
        postInput.value = newBefore + after
        postInput.focus()
        closeMention()
      })
    })
    const compose = container.querySelector('#compose-area')
    const inputWrap = postInput.parentElement
    inputWrap.style.position = 'relative'
    inputWrap.appendChild(mentionDropdown)
  }

  function closeMention() {
    mentionDropdown?.remove()
    mentionDropdown = null
  }

  document.addEventListener('click', e => {
    if (!e.target.closest('#post-input') && !e.target.closest('.mention-dropdown')) closeMention()
  })

  // ── File attachment ────────────────────────────────────────────────────────
  let attachmentUrl = null
  const fileInput = container.querySelector('#file-input')
  const attachName = container.querySelector('#attach-name')
  const attachPreview = container.querySelector('#attachment-preview')

  fileInput.addEventListener('change', async () => {
    const file = fileInput.files[0]
    if (!file) return
    attachName.textContent = 'Uploading…'
    try {
      const formData = new FormData()
      formData.append('file', file)
      const res = await fetch('/api/upload', {
        method: 'POST',
        body: formData,
        credentials: 'include'
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error)
      attachmentUrl = data.url
      attachName.textContent = file.name
      attachPreview.style.display = 'flex'
      attachPreview.innerHTML = `
        <div class="attachment-preview">
          ${file.type.startsWith('image') ? `<img src="${data.url}" alt="">` : `<i class="bi bi-file-earmark" style="font-size:24px;color:var(--text-3)"></i>`}
          <div style="flex:1;min-width:0">
            <div style="font-size:12px;font-weight:600;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">${file.name}</div>
            <div style="font-size:11px;color:var(--text-3)">Ready to attach</div>
          </div>
          <button class="btn btn-ghost btn-icon btn-sm" id="remove-attach" title="Remove">
            <i class="bi bi-x"></i>
          </button>
        </div>
      `
      container.querySelector('#remove-attach').addEventListener('click', () => {
        attachmentUrl = null; attachName.textContent = ''
        attachPreview.style.display = 'none'
        fileInput.value = ''
      })
      toast('File ready to attach!', 'success')
    } catch (e) {
      attachName.textContent = ''
      toast(e.message || 'Upload failed', 'error')
    }
  })

  // ── Submit post ────────────────────────────────────────────────────────────
  container.querySelector('#submit-post').addEventListener('click', async () => {
    const content = container.querySelector('#post-input').value.trim()
    if (!content) { toast('Write something first', 'error'); return }
    const btn = container.querySelector('#submit-post')
    btn.disabled = true
    try {
      const { post } = await api.post('/posts', {
        content,
        image_url: attachmentUrl || null,
        tags: selectedTags
      })
      container.querySelector('#post-input').value = ''
      attachmentUrl = null; attachName.textContent = ''
      attachPreview.style.display = 'none'
      fileInput.value = ''
      selectedTags = []
      renderTagPills()
      container.querySelectorAll('[data-quick-tag]').forEach(el => el.style.opacity = '1')
      postsEl.insertAdjacentHTML('afterbegin', postCard(post))
      bindPostEvents(postsEl.firstElementChild)
      toast('Posted!', 'success')
    } catch (e) { toast(e.message || 'Failed to post', 'error') }
    finally { btn.disabled = false }
  })

  // Filter buttons
  container.querySelectorAll('[data-filter]').forEach(btn => {
    btn.addEventListener('click', () => {
      activeFilter = btn.dataset.filter
      container.querySelectorAll('[data-filter]').forEach(b => b.classList.remove('active-filter', 'btn-primary'))
      btn.classList.add('active-filter')
      loadPosts(activeFilter)
    })
  })

  // Trending tag click
  container.querySelectorAll('[data-filter-tag]').forEach(el => {
    el.addEventListener('click', () => {
      activeFilter = el.dataset.filterTag
      loadPosts(activeFilter)
    })
  })

  // Scroll to compose on mobile when tapping page title
  container.querySelector('.page-title')?.addEventListener('click', () => {
    container.querySelector('#compose-area')?.scrollIntoView({ behavior:'smooth' })
  })

  await loadPosts('')

  async function loadPosts(tag) {
    loadingEl.innerHTML = '<div class="spinner"></div>'
    loadingEl.style.display = 'flex'
    postsEl.innerHTML = ''
    try {
      const params = tag ? `?tag=${encodeURIComponent(tag)}&limit=30` : '?limit=30'
      const { posts } = await api.get(`/posts${params}`)
      loadingEl.style.display = 'none'
      if (!posts.length) {
        postsEl.innerHTML = `<div class="state-container">
          <i class="bi bi-chat-square-text state-icon"></i>
          <div class="state-title">No posts yet</div>
          <p class="state-desc">Be the first to post something!</p>
        </div>`
        return
      }
      posts.forEach(p => {
        const el = document.createElement('div')
        el.innerHTML = postCard(p)
        const card = el.firstElementChild
        postsEl.appendChild(card)
        bindPostEvents(card)
      })
    } catch { loadingEl.innerHTML = '<p class="text-dim">Failed to load posts</p>' }
  }
}

function postCard(p) {
  const tagsHtml = p.tags?.length ? `<div class="post-tags">${p.tags.map(t=>`<span class="tag">${t}</span>`).join('')}</div>` : ''
  const imgHtml  = p.image_url ? `<img class="post-image" src="${p.image_url}" alt="" loading="lazy">` : ''
  const mine     = p.user_id === state.user?.id

  return `
    <div class="post-card" style="margin-bottom:12px" data-id="${p.id}">
      <div class="post-header">
        ${avatar(p.avatar_url, p.username, 'avatar-md')}
        <div class="post-meta">
          <div class="post-username" data-uid="${p.user_id}">${p.username}</div>
          <div class="post-time">${timeAgo(p.created_at)}</div>
        </div>
        ${mine ? `<button class="btn btn-ghost btn-icon btn-sm delete-post" title="Delete post"><i class="bi bi-trash3"></i></button>` : ''}
      </div>
      <div class="post-content">${escHtml(p.content)}</div>
      ${imgHtml}
      ${tagsHtml}
      <div class="post-actions">
        <button class="post-action-btn like-btn ${p.user_liked ? 'liked' : ''}" data-liked="${p.user_liked}">
          <i class="bi bi-heart${p.user_liked ? '-fill' : ''}"></i>
          <span class="like-count">${p.like_count || 0}</span>
        </button>
        <button class="post-action-btn comment-toggle-btn">
          <i class="bi bi-chat"></i>
          <span>${p.comment_count || 0}</span>
        </button>
        <button class="post-action-btn report-btn" style="margin-left:auto">
          <i class="bi bi-flag"></i>
        </button>
      </div>
      <div class="comments-section hidden" style="margin-top:10px;border-top:1px solid var(--border-2);padding-top:10px"></div>
    </div>
  `
}

function bindPostEvents(card) {
  const postId = card.dataset.id

  // Like
  card.querySelector('.like-btn').addEventListener('click', async function() {
    try {
      const { liked } = await api.post(`/posts/${postId}/like`)
      const countEl = this.querySelector('.like-count')
      const icon    = this.querySelector('i')
      const count   = parseInt(countEl.textContent)
      if (liked) {
        countEl.textContent = count + 1
        icon.className = 'bi bi-heart-fill'
        this.classList.add('liked')
        this.dataset.liked = '1'
      } else {
        countEl.textContent = Math.max(0, count - 1)
        icon.className = 'bi bi-heart'
        this.classList.remove('liked')
        this.dataset.liked = '0'
      }
    } catch (e) { toast(e.message, 'error') }
  })

  // Comments toggle
  card.querySelector('.comment-toggle-btn').addEventListener('click', async function() {
    const sec = card.querySelector('.comments-section')
    if (!sec.classList.contains('hidden')) { sec.classList.add('hidden'); return }
    sec.classList.remove('hidden')
    sec.innerHTML = '<div class="spinner" style="margin:8px auto"></div>'
    try {
      const { comments } = await api.get(`/posts/${postId}/comments`)
      renderComments(sec, postId, comments)
    } catch { sec.innerHTML = '<p class="text-dim">Failed to load</p>' }
  })

  // Delete
  card.querySelector('.delete-post')?.addEventListener('click', async function() {
    if (!confirm('Delete this post?')) return
    try { await api.delete(`/posts/${postId}`); card.remove(); toast('Post deleted') } catch (e) { toast(e.message,'error') }
  })

  // Report
  card.querySelector('.report-btn').addEventListener('click', () => {
    showModal(`
      <div class="modal-title"><i class="bi bi-flag-fill text-red"></i> Report Post</div>
      <div class="form-field">
        <label class="form-label">Reason</label>
        <select class="input" id="report-reason">
          <option>Spam</option><option>Harassment</option><option>Inappropriate content</option><option>Misinformation</option><option>Other</option>
        </select>
      </div>
      <div style="display:flex;gap:8px;justify-content:flex-end;margin-top:14px">
        <button class="btn btn-ghost" onclick="document.getElementById('modal-overlay').classList.add('hidden')">Cancel</button>
        <button class="btn btn-danger" id="submit-report"><i class="bi bi-flag"></i> Report</button>
      </div>
    `)
    document.getElementById('submit-report').addEventListener('click', async () => {
      const reason = document.getElementById('report-reason').value
      try {
        await api.post('/moderation/report', { target_type: 'post', target_id: parseInt(postId), reason })
        closeModal()
        toast('Reported — thanks for keeping the community safe', 'info')
      } catch (e) { toast(e.message,'error') }
    })
  })
}

function renderComments(sec, postId, comments) {
  sec.innerHTML = `
    ${comments.map(c => `
      <div style="display:flex;gap:8px;margin-bottom:10px">
        ${avatar(c.avatar_url, c.username, 'avatar-sm')}
        <div style="flex:1">
          <span style="font-weight:600;font-size:12.5px">${c.username}</span>
          <span style="font-size:11px;color:var(--text-3);margin-left:5px">${timeAgo(c.created_at)}</span>
          <p style="font-size:13px;margin-top:2px;color:var(--text)">${escHtml(c.content)}</p>
        </div>
      </div>
    `).join('')}
    <div style="display:flex;gap:8px;margin-top:6px">
      ${avatar(state.user?.avatar_url, state.user?.username, 'avatar-sm')}
      <div style="flex:1;display:flex;gap:6px">
        <input class="input" id="comment-input-${postId}" placeholder="Write a comment…" style="padding:5px 10px;font-size:13px">
        <button class="btn btn-primary btn-sm" id="send-comment-${postId}"><i class="bi bi-send"></i></button>
      </div>
    </div>
  `

  document.getElementById(`send-comment-${postId}`).addEventListener('click', async () => {
    const inp = document.getElementById(`comment-input-${postId}`)
    const content = inp.value.trim()
    if (!content) return
    try {
      const { comment } = await api.post(`/posts/${postId}/comments`, { content })
      inp.value = ''
      const newHtml = `
        <div style="display:flex;gap:8px;margin-bottom:10px">
          ${avatar(comment.avatar_url, comment.username, 'avatar-sm')}
          <div style="flex:1">
            <span style="font-weight:600;font-size:12.5px">${comment.username}</span>
            <p style="font-size:13px;margin-top:2px">${escHtml(comment.content)}</p>
          </div>
        </div>
      `
      sec.insertAdjacentHTML('afterbegin', newHtml)
    } catch (e) { toast(e.message,'error') }
  })
}

function escHtml(str) {
  return String(str).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;')
}

async function loadMiniStats() {
  try {
    const { stats } = await api.get('/games/stats').catch(() => ({ stats: [] }))
    const total = stats.reduce((a,s) => a + (parseInt(s.played)||0), 0)
    const wins  = stats.reduce((a,s) => a + (parseInt(s.wins)||0), 0)
    document.getElementById('mini-stats').innerHTML = `
      <div style="display:flex;flex-direction:column;gap:4px">
        <div class="flex-between"><span>Games Played</span><span class="mono text-accent">${total}</span></div>
        <div class="flex-between"><span>Total Wins</span><span class="mono text-green">${wins}</span></div>
      </div>
    `
  } catch {}
}
