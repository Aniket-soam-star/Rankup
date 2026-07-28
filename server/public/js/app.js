import { api } from './api.js'
import { connectAll, disconnectAll } from './ws.js'
import { renderAuth } from './pages/auth.js'
import { renderFeed } from './pages/feed.js'
import { renderChat } from './pages/chat.js'
import { renderGames } from './pages/games.js'
import { renderProfile } from './pages/profile.js'
import { renderFriends } from './pages/friends.js'
import { renderClans } from './pages/clans.js'
import { renderLeaderboard } from './pages/leaderboard.js'
import { renderSettings } from './pages/settings.js'

// ── App state ──────────────────────────────────────────────────────────────
export const state = {
  user: null,
  notifCount: 0,
  currentPage: null,
}

// ── Toast ──────────────────────────────────────────────────────────────────
export function toast(message, type = 'info', duration = 3000) {
  const el = document.createElement('div')
  el.className = `toast ${type}`
  const icons = { success: 'bi-check-circle-fill', error: 'bi-x-circle-fill', info: 'bi-info-circle-fill' }
  el.innerHTML = `<i class="bi ${icons[type] || icons.info}"></i><span>${message}</span>`
  document.getElementById('toasts').appendChild(el)
  setTimeout(() => el.remove(), duration)
}

// ── Modal ──────────────────────────────────────────────────────────────────
export function showModal(html, onClose) {
  const overlay = document.getElementById('modal-overlay')
  const box = document.getElementById('modal-box')
  box.innerHTML = html
  overlay.classList.remove('hidden')
  const close = () => {
    overlay.classList.add('hidden')
    if (onClose) onClose()
  }
  overlay.onclick = (e) => { if (e.target === overlay) close() }
  return close
}

export function closeModal() {
  document.getElementById('modal-overlay').classList.add('hidden')
}

// ── Time helper ────────────────────────────────────────────────────────────
export function timeAgo(dateStr) {
  const diff = (Date.now() - new Date(dateStr)) / 1000
  if (diff < 60)    return 'just now'
  if (diff < 3600)  return `${Math.floor(diff/60)}m ago`
  if (diff < 86400) return `${Math.floor(diff/3600)}h ago`
  return `${Math.floor(diff/86400)}d ago`
}

// ── Avatar helper ──────────────────────────────────────────────────────────
export function avatar(url, username, size = 'avatar-md') {
  const src = url || `https://api.dicebear.com/7.x/avataaars/svg?seed=${encodeURIComponent(username || 'user')}`
  return `<img class="avatar ${size}" src="${src}" alt="${username || ''}" onerror="this.src='https://api.dicebear.com/7.x/initials/svg?seed=${encodeURIComponent(username||'U')}'">`
}

// ── Router ─────────────────────────────────────────────────────────────────
const routes = {
  '/':            { render: renderFeed,        nav: 'feed' },
  '/feed':        { render: renderFeed,        nav: 'feed' },
  '/games':       { render: renderGames,       nav: 'games' },
  '/chat':        { render: renderChat,        nav: 'chat' },
  '/profile':     { render: renderProfile,     nav: 'profile' },
  '/friends':     { render: renderFriends,     nav: 'friends' },
  '/clans':       { render: renderClans,       nav: 'clans' },
  '/leaderboard': { render: renderLeaderboard, nav: 'leaderboard' },
  '/settings':    { render: renderSettings,    nav: 'settings' },
}

export function navigate(path) {
  history.pushState(null, '', path)
  route(path)
}

function route(path) {
  // strip query params for matching
  const clean = path.split('?')[0]
  const match = routes[clean] || routes['/feed']
  state.currentPage = match.nav
  updateNavActive(match.nav)
  const main = document.getElementById('main-content')
  main.innerHTML = '<div class="state-container"><div class="spinner"></div></div>'
  main.scrollTop = 0
  match.render(main, path)
}

window.addEventListener('popstate', () => route(location.pathname))

// ── Notifications ──────────────────────────────────────────────────────────
async function loadNotifCount() {
  try {
    const { notifications } = await api.get('/notifications')
    state.notifCount = notifications.filter(n => !n.read).length
    updateNotifBadge(state.notifCount)
  } catch {}
}

function updateNotifBadge(count) {
  document.querySelectorAll('.notif-badge').forEach(el => {
    el.textContent = count || ''
    el.classList.toggle('hidden', !count)
  })
}

// ── Nav shell ──────────────────────────────────────────────────────────────
const NAV_ITEMS = [
  { id: 'feed',        label: 'Feed',        icon: 'bi-house-door',      path: '/feed' },
  { id: 'games',       label: 'Games',       icon: 'bi-controller',      path: '/games' },
  { id: 'chat',        label: 'Chat',        icon: 'bi-chat-dots',       path: '/chat' },
  { id: 'clans',       label: 'Clans',       icon: 'bi-shield-fill',     path: '/clans' },
  { id: 'leaderboard', label: 'Ranks',       icon: 'bi-trophy',          path: '/leaderboard' },
  { id: 'friends',     label: 'Friends',     icon: 'bi-people',          path: '/friends' },
  { id: 'profile',     label: 'Profile',     icon: 'bi-person-circle',   path: '/profile' },
  { id: 'settings',    label: 'Settings',    icon: 'bi-gear',            path: '/settings' },
]

// Bottom nav shows only primary items
const BOTTOM_ITEMS = ['feed', 'games', 'chat', 'clans', 'profile']

function renderSidebar() {
  const u = state.user
  const links = NAV_ITEMS.map(item => `
    <a class="nav-link" data-nav="${item.id}" data-path="${item.path}" href="${item.path}">
      <i class="bi ${item.icon}"></i>
      <span>${item.label}</span>
      ${item.id === 'notifications' ? `<span class="nav-badge notif-badge hidden"></span>` : ''}
    </a>
  `).join('')

  document.getElementById('sidebar').innerHTML = `
    <div class="sidebar-logo">
      <div class="sidebar-logo-icon" style="
        background:linear-gradient(135deg,#7c3aed,#8b5cf6);
        box-shadow:0 0 16px rgba(124,58,237,.4);
        font-size:18px;
      ">↑</div>
      <div>
        <div class="sidebar-logo-text">RankUp</div>
        <div style="font-size:10px;color:var(--text-3);font-weight:500;letter-spacing:.04em;margin-top:-1px">Gaming Community</div>
      </div>
    </div>
    <nav class="sidebar-nav">
      <span class="nav-section-label">Navigate</span>
      ${links}
      <span class="nav-section-label" style="margin-top:8px">Account</span>
      <a class="nav-link" id="notif-trigger" style="cursor:pointer">
        <i class="bi bi-bell"></i>
        <span>Notifications</span>
        <span class="nav-badge notif-badge hidden"></span>
      </a>
      <a class="nav-link" id="logout-btn" style="cursor:pointer">
        <i class="bi bi-box-arrow-right"></i>
        <span>Sign Out</span>
      </a>
      <a class="nav-link nav-link-admin" href="/admin.html" target="_blank" rel="noopener" title="Admin Panel">
        <i class="bi bi-shield-lock-fill"></i>
        <span>Admin Panel</span>
      </a>
    </nav>
    <div class="sidebar-user" data-path="/profile" data-nav="profile">
      <div style="position:relative;flex-shrink:0">
        ${avatar(u.avatar_url, u.username, 'avatar-sm')}
        <span style="
          position:absolute;bottom:0;right:0;
          width:9px;height:9px;
          background:var(--green);
          border-radius:50%;
          border:2px solid var(--surface);
        "></span>
      </div>
      <div class="sidebar-user-info">
        <div class="sidebar-user-name">${u.username}</div>
        <div class="sidebar-user-status" style="display:flex;align-items:center;gap:4px">
          <span style="color:var(--green);font-size:9px">●</span> Online
        </div>
      </div>
      <i class="bi bi-chevron-right" style="color:var(--text-3);font-size:11px"></i>
    </div>
  `

  // Nav link clicks
  document.getElementById('sidebar').addEventListener('click', e => {
    const link = e.target.closest('[data-path]')
    if (link) { e.preventDefault(); navigate(link.dataset.path) }
    if (e.target.closest('#logout-btn')) logout()
    if (e.target.closest('#notif-trigger')) toggleNotifPanel()
  })
}

function renderMobileHeader() {
  document.getElementById('mobile-header').innerHTML = `
    <div class="mh-logo">
      <div class="mh-logo-icon">↑</div>
      <span>RankUp</span>
    </div>
    <div class="mh-actions">
      <button class="btn btn-ghost btn-icon" id="mh-notif" title="Notifications">
        <i class="bi bi-bell" style="font-size:18px"></i>
        <span class="nav-badge notif-badge hidden" style="position:absolute;top:3px;right:3px"></span>
      </button>
      <button class="btn btn-ghost btn-icon" id="mh-search" title="Search">
        <i class="bi bi-search" style="font-size:16px"></i>
      </button>
    </div>
  `
  document.getElementById('mh-notif').style.position = 'relative'
  document.getElementById('mh-notif').addEventListener('click', toggleNotifPanel)
}

function renderBottomNav() {
  const items = NAV_ITEMS.filter(i => BOTTOM_ITEMS.includes(i.id))
  document.getElementById('bottom-nav').innerHTML = `
    <div class="bnav-inner">
      ${items.map(item => `
        <div class="bnav-item" data-nav="${item.id}" data-path="${item.path}">
          <i class="bi ${item.icon}"></i>
          <span>${item.label}</span>
          ${item.id === 'notifications' ? `<span class="nav-badge notif-badge hidden"></span>` : ''}
        </div>
      `).join('')}
    </div>
  `
  document.getElementById('bottom-nav').addEventListener('click', e => {
    const item = e.target.closest('[data-path]')
    if (item) navigate(item.dataset.path)
  })
}

function updateNavActive(pageId) {
  document.querySelectorAll('[data-nav]').forEach(el => {
    el.classList.toggle('active', el.dataset.nav === pageId)
  })
}

// ── Notification panel ─────────────────────────────────────────────────────
function toggleNotifPanel() {
  const panel = document.getElementById('notif-panel')
  const backdrop = document.getElementById('notif-backdrop')
  const isHidden = panel.classList.contains('hidden')
  if (isHidden) {
    loadNotifPanel()
    panel.classList.remove('hidden')
    backdrop.classList.remove('hidden')
  } else {
    panel.classList.add('hidden')
    backdrop.classList.add('hidden')
  }
}

document.getElementById('notif-backdrop').addEventListener('click', () => {
  document.getElementById('notif-panel').classList.add('hidden')
  document.getElementById('notif-backdrop').classList.add('hidden')
})

async function loadNotifPanel() {
  const panel = document.getElementById('notif-panel')
  panel.innerHTML = `
    <div class="notif-header">
      <span><i class="bi bi-bell"></i> Notifications</span>
      <button class="btn btn-ghost btn-sm" id="mark-all-read">Mark all read</button>
    </div>
    <div class="notif-list"><div class="state-container" style="padding:30px 20px"><div class="spinner"></div></div></div>
  `
  try {
    const { notifications } = await api.get('/notifications')
    const list = panel.querySelector('.notif-list')
    if (!notifications.length) {
      list.innerHTML = `<div class="state-container" style="padding:30px 20px">
        <i class="bi bi-bell-slash state-icon"></i>
        <p class="state-desc">No notifications yet</p>
      </div>`
      return
    }
    list.innerHTML = notifications.map(n => `
      <div class="notif-item ${n.read ? '' : 'unread'}" data-id="${n.id}" data-link="${n.link || ''}">
        ${avatar(null, n.actor_username || 'sys', 'avatar-sm')}
        <div class="notif-text">
          <div>${n.message}</div>
          <div class="notif-time">${timeAgo(n.created_at)}</div>
        </div>
      </div>
    `).join('')

    list.addEventListener('click', e => {
      const item = e.target.closest('.notif-item')
      if (item?.dataset.link) { navigate(item.dataset.link); toggleNotifPanel() }
    })

    panel.querySelector('#mark-all-read').addEventListener('click', async () => {
      await api.post('/notifications/read-all').catch(() => {})
      state.notifCount = 0
      updateNotifBadge(0)
      toggleNotifPanel()
    })

    state.notifCount = notifications.filter(n => !n.read).length
    updateNotifBadge(state.notifCount)
  } catch {
    panel.querySelector('.notif-list').innerHTML = '<div class="state-container" style="padding:20px"><p class="text-dim">Failed to load</p></div>'
  }
}

// ── Logout ─────────────────────────────────────────────────────────────────
async function logout() {
  await api.post('/auth/logout').catch(() => {})
  disconnectAll()
  state.user = null
  document.getElementById('shell').classList.add('hidden')
  document.getElementById('auth-screen').classList.remove('hidden')
  renderAuth()
}

// ── Boot ───────────────────────────────────────────────────────────────────
async function boot() {
  try {
    const { user } = await api.get('/auth/me')
    state.user = user
    document.getElementById('auth-screen').classList.add('hidden')
    document.getElementById('shell').classList.remove('hidden')
    renderSidebar()
    renderMobileHeader()
    renderBottomNav()
    connectAll()
    loadNotifCount()
    setInterval(loadNotifCount, 30_000)
    route(location.pathname === '/' ? '/feed' : location.pathname)
  } catch (e) {
    if (e.status === 401) {
      document.getElementById('shell').classList.add('hidden')
      document.getElementById('auth-screen').classList.remove('hidden')
      renderAuth()
    }
  }
}

// Called after login/register
export function onLogin(user) {
  state.user = user
  document.getElementById('auth-screen').classList.add('hidden')
  document.getElementById('shell').classList.remove('hidden')
  renderSidebar()
  renderMobileHeader()
  renderBottomNav()
  connectAll()
  loadNotifCount()
  navigate('/feed')
}

boot()
