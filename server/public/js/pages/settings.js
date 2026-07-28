import { api } from '../api.js'
import { state, toast } from '../app.js'

export async function renderSettings(container) {
  container.innerHTML = `
    <div class="page-header">
      <h1 class="page-title"><i class="bi bi-gear-fill"></i> Settings</h1>
    </div>
    <div style="max-width:680px">
      <div class="state-container"><div class="spinner"></div></div>
    </div>
  `
  try {
    const { settings } = await api.get('/settings')
    buildUI(container, settings)
  } catch {
    container.querySelector('div:last-child').innerHTML =
      '<p class="state-desc">Failed to load settings</p>'
  }
}

function buildUI(container, s) {
  const wrap = container.querySelector('div:last-child')
  wrap.innerHTML = `

    <!-- Appearance -->
    <div class="card settings-section">
      <div class="settings-section-title"><i class="bi bi-palette-fill" style="color:var(--accent-3)"></i> Appearance</div>

      <div class="settings-row">
        <div class="settings-label">
          <div class="settings-label-main">Theme</div>
          <div class="settings-label-sub">Choose your colour scheme</div>
        </div>
        <div class="settings-control">
          <div class="theme-grid" id="theme-grid">
            ${[
              { key:'dark',       label:'Dark',      bg:'#07070a', accent:'#7c3aed' },
              { key:'midnight',   label:'Midnight',  bg:'#000814', accent:'#3b82f6' },
              { key:'solarized',  label:'Solarized', bg:'#002b36', accent:'#2aa198' },
            ].map(t => `
              <button class="theme-btn ${s.theme===t.key?'active':''}" data-theme="${t.key}"
                style="--tbg:${t.bg};--tacc:${t.accent}">
                <div class="theme-preview"></div>
                <span>${t.label}</span>
              </button>
            `).join('')}
          </div>
        </div>
      </div>

      <div class="settings-row">
        <div class="settings-label">
          <div class="settings-label-main">Accent Color</div>
          <div class="settings-label-sub">Main highlight colour across the site</div>
        </div>
        <div class="settings-control" style="flex-direction:row;gap:8px;flex-wrap:wrap">
          ${['#7c3aed','#3b82f6','#10b981','#ef4444','#f59e0b','#ec4899','#06b6d4','#8b5cf6'].map(c => `
            <button class="color-swatch ${s.accent_color===c?'active':''}" data-color="${c}"
              style="background:${c}"></button>
          `).join('')}
          <input type="color" id="custom-color" value="${s.accent_color||'#7c3aed'}"
            style="width:32px;height:32px;border:2px solid var(--border);border-radius:50%;padding:2px;cursor:pointer;background:none">
        </div>
      </div>

      <div class="settings-row">
        <div class="settings-label">
          <div class="settings-label-main">Font Size</div>
          <div class="settings-label-sub">Adjust text size across the site</div>
        </div>
        <div class="settings-control">
          <div style="display:flex;gap:6px">
            ${['small','medium','large'].map(f => `
              <button class="btn ${s.font_size===f?'btn-primary':'btn-secondary'} btn-sm font-btn" data-font="${f}">
                ${f.charAt(0).toUpperCase()+f.slice(1)}
              </button>
            `).join('')}
          </div>
        </div>
      </div>

      <div class="settings-row">
        <div class="settings-label">
          <div class="settings-label-main">Compact Mode</div>
          <div class="settings-label-sub">Reduce spacing for more content on screen</div>
        </div>
        <div class="settings-control">
          <label class="toggle">
            <input type="checkbox" id="compact-toggle" ${s.compact_mode?'checked':''}>
            <span class="toggle-slider"></span>
          </label>
        </div>
      </div>
    </div>

    <!-- Privacy -->
    <div class="card settings-section">
      <div class="settings-section-title"><i class="bi bi-shield-fill" style="color:var(--green)"></i> Privacy</div>

      <div class="settings-row">
        <div class="settings-label">
          <div class="settings-label-main">Show Online Status</div>
          <div class="settings-label-sub">Let others see when you're online</div>
        </div>
        <div class="settings-control">
          <label class="toggle">
            <input type="checkbox" id="online-toggle" ${s.show_online_status?'checked':''}>
            <span class="toggle-slider"></span>
          </label>
        </div>
      </div>
    </div>

    <!-- Sound -->
    <div class="card settings-section">
      <div class="settings-section-title"><i class="bi bi-volume-up-fill" style="color:var(--gold)"></i> Sound</div>

      <div class="settings-row">
        <div class="settings-label">
          <div class="settings-label-main">Sound Effects</div>
          <div class="settings-label-sub">Play sounds for notifications and game events</div>
        </div>
        <div class="settings-control">
          <label class="toggle">
            <input type="checkbox" id="sound-toggle" ${s.sound_effects?'checked':''}>
            <span class="toggle-slider"></span>
          </label>
        </div>
      </div>
    </div>

    <!-- Account -->
    <div class="card settings-section">
      <div class="settings-section-title"><i class="bi bi-person-fill" style="color:var(--accent-3)"></i> Account</div>

      <div class="settings-row">
        <div class="settings-label">
          <div class="settings-label-main">Username</div>
          <div class="settings-label-sub">Your public display name</div>
        </div>
        <div class="settings-control">
          <div style="display:flex;gap:8px;align-items:center">
            <input class="input" id="username-inp" value="${state.user?.username||''}" style="width:180px">
            <button class="btn btn-secondary btn-sm" id="save-username">Save</button>
          </div>
        </div>
      </div>

      <div class="settings-row">
        <div class="settings-label">
          <div class="settings-label-main">Bio</div>
          <div class="settings-label-sub">Tell the community about yourself</div>
        </div>
        <div class="settings-control" style="flex:1">
          <textarea class="input" id="bio-inp" rows="2" style="width:100%;min-width:220px"
            placeholder="Write a short bio…">${state.user?.bio||''}</textarea>
          <button class="btn btn-secondary btn-sm" id="save-bio" style="margin-top:6px">Save Bio</button>
        </div>
      </div>

      <div class="settings-row">
        <div class="settings-label">
          <div class="settings-label-main">Avatar URL</div>
          <div class="settings-label-sub">Link to your profile picture</div>
        </div>
        <div class="settings-control">
          <div style="display:flex;gap:8px;align-items:center">
            <input class="input" id="avatar-inp" value="${state.user?.avatar_url||''}" style="width:180px" placeholder="https://…">
            <button class="btn btn-secondary btn-sm" id="save-avatar">Save</button>
          </div>
        </div>
      </div>
    </div>

    <!-- Danger zone -->
    <div class="card settings-section" style="border-color:rgba(239,68,68,.2)">
      <div class="settings-section-title"><i class="bi bi-exclamation-triangle-fill" style="color:var(--red)"></i> Danger Zone</div>
      <div class="settings-row">
        <div class="settings-label">
          <div class="settings-label-main">Delete Account</div>
          <div class="settings-label-sub">Permanently remove your account and all data</div>
        </div>
        <div class="settings-control">
          <button class="btn btn-danger btn-sm" id="delete-account-btn">Delete Account</button>
        </div>
      </div>
    </div>

    <p style="font-size:11.5px;color:var(--text-3);text-align:center;margin-top:8px">
      Changes to appearance, privacy and sound save automatically
    </p>
  `

  bindEvents(wrap, s)
}

function bindEvents(wrap, s) {
  const save = async (patch) => {
    try {
      await api.patch('/settings', patch)
      applySettings(patch)
    } catch (e) {
      toast(e.message || 'Failed to save', 'error')
    }
  }

  // Theme
  wrap.querySelectorAll('[data-theme]').forEach(btn => {
    btn.addEventListener('click', () => {
      wrap.querySelectorAll('[data-theme]').forEach(b => b.classList.remove('active'))
      btn.classList.add('active')
      save({ theme: btn.dataset.theme })
    })
  })

  // Accent color swatches
  wrap.querySelectorAll('[data-color]').forEach(btn => {
    btn.addEventListener('click', () => {
      wrap.querySelectorAll('[data-color]').forEach(b => b.classList.remove('active'))
      btn.classList.add('active')
      wrap.querySelector('#custom-color').value = btn.dataset.color
      save({ accent_color: btn.dataset.color })
    })
  })

  // Custom color picker
  wrap.querySelector('#custom-color').addEventListener('input', e => {
    wrap.querySelectorAll('[data-color]').forEach(b => b.classList.remove('active'))
    save({ accent_color: e.target.value })
  })

  // Font size
  wrap.querySelectorAll('[data-font]').forEach(btn => {
    btn.addEventListener('click', () => {
      wrap.querySelectorAll('[data-font]').forEach(b => {
        b.classList.remove('btn-primary'); b.classList.add('btn-secondary')
      })
      btn.classList.remove('btn-secondary'); btn.classList.add('btn-primary')
      save({ font_size: btn.dataset.font })
    })
  })

  // Toggles
  wrap.querySelector('#compact-toggle').addEventListener('change', e => save({ compact_mode: e.target.checked }))
  wrap.querySelector('#online-toggle').addEventListener('change', e => save({ show_online_status: e.target.checked }))
  wrap.querySelector('#sound-toggle').addEventListener('change', e => save({ sound_effects: e.target.checked }))

  // Username
  wrap.querySelector('#save-username').addEventListener('click', async () => {
    const username = wrap.querySelector('#username-inp').value.trim()
    if (!username) { toast('Username cannot be empty', 'error'); return }
    try {
      await api.patch('/users/profile', { username })
      state.user.username = username
      toast('Username updated!', 'success')
    } catch (e) { toast(e.message || 'Failed', 'error') }
  })

  // Bio
  wrap.querySelector('#save-bio').addEventListener('click', async () => {
    const bio = wrap.querySelector('#bio-inp').value.trim()
    try {
      await api.patch('/users/profile', { bio })
      state.user.bio = bio
      toast('Bio updated!', 'success')
    } catch (e) { toast(e.message || 'Failed', 'error') }
  })

  // Avatar
  wrap.querySelector('#save-avatar').addEventListener('click', async () => {
    const avatar_url = wrap.querySelector('#avatar-inp').value.trim()
    try {
      await api.patch('/users/profile', { avatar_url })
      state.user.avatar_url = avatar_url
      toast('Avatar updated!', 'success')
    } catch (e) { toast(e.message || 'Failed', 'error') }
  })

  // Delete account
  wrap.querySelector('#delete-account-btn').addEventListener('click', () => {
    if (!confirm('Are you absolutely sure? This will permanently delete your account and all your data. This cannot be undone.')) return
    const code = prompt('Type DELETE to confirm:')
    if (code !== 'DELETE') { toast('Cancelled', 'info'); return }
    api.delete('/users/me').then(() => {
      toast('Account deleted', 'info')
      setTimeout(() => location.reload(), 1000)
    }).catch(e => toast(e.message || 'Failed', 'error'))
  })
}

function applySettings(patch) {
  const root = document.documentElement
  if (patch.accent_color) {
    root.style.setProperty('--accent', patch.accent_color)
    // Derive lighter variants
    root.style.setProperty('--accent-2', patch.accent_color + 'cc')
    root.style.setProperty('--accent-3', patch.accent_color + 'ee')
  }
  if (patch.font_size) {
    const sizes = { small: '13px', medium: '14px', large: '15.5px' }
    root.style.setProperty('--font-size-base', sizes[patch.font_size] || '14px')
  }
  if (patch.compact_mode !== undefined) {
    document.body.classList.toggle('compact', patch.compact_mode)
  }
  if (patch.theme) {
    document.body.dataset.theme = patch.theme
    toast('Theme applied — some changes take full effect on reload', 'info')
  }
}
