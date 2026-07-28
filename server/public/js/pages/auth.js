import { api } from '../api.js'
import { onLogin } from '../app.js'

const BG = 'https://images.unsplash.com/photo-1542751371-adc38448a05e?w=1400&q=80'

export function renderAuth() {
  const el = document.getElementById('auth-screen')
  el.style.cssText = 'display:flex;flex-direction:row;min-height:100vh;width:100%;background:var(--bg)'
  showLogin(el)
}

function shell(formHtml) {
  return `
    <!-- Left hero panel -->
    <div class="auth-hero" style="
      flex:1;
      background: linear-gradient(135deg,rgba(7,7,10,.92) 0%,rgba(60,20,120,.7) 60%,rgba(7,7,10,.95) 100%),
                  url('${BG}') center/cover no-repeat;
      display:flex;
      flex-direction:column;
      justify-content:center;
      padding:60px 48px;
      position:relative;
      overflow:hidden;
    ">
      <div style="position:absolute;inset:0;background:radial-gradient(ellipse at 30% 50%,rgba(124,58,237,.18) 0%,transparent 70%)"></div>
      <div style="position:relative;z-index:1;max-width:400px">
        <div style="display:flex;align-items:center;gap:12px;margin-bottom:48px">
          <div style="
            width:40px;height:40px;
            background:linear-gradient(135deg,var(--accent),var(--accent-2));
            border-radius:10px;
            display:flex;align-items:center;justify-content:center;
            font-size:20px;color:#fff;font-weight:700;font-family:var(--font-d);
            box-shadow:0 4px 20px rgba(124,58,237,.5)
          ">↑</div>
          <span style="font-family:var(--font-d);font-size:22px;font-weight:700;letter-spacing:-.3px">RankUp</span>
        </div>
        <h1 style="font-family:var(--font-d);font-size:36px;font-weight:700;line-height:1.15;margin-bottom:16px;letter-spacing:-.5px">
          Your gaming<br>community<br><span style="color:var(--accent-3)">starts here</span>
        </h1>
        <p style="color:var(--text-2);font-size:15px;line-height:1.65;margin-bottom:40px">
          Play built-in games, track your stats, join clans, and connect with gamers who actually get it.
        </p>
        <div style="display:flex;flex-direction:column;gap:14px">
          ${[
            ['bi-controller','Play 8 built-in games','Multiplayer & single player'],
            ['bi-shield-fill','Create or join clans','Compete as a team'],
            ['bi-trophy-fill','Climb leaderboards','Global & per-game rankings'],
          ].map(([icon,title,sub]) => `
            <div style="display:flex;align-items:center;gap:12px">
              <div style="width:36px;height:36px;background:var(--accent-dim);border:1px solid var(--accent-glow);border-radius:8px;display:flex;align-items:center;justify-content:center;flex-shrink:0">
                <i class="bi ${icon}" style="color:var(--accent-3);font-size:15px"></i>
              </div>
              <div>
                <div style="font-weight:600;font-size:13.5px">${title}</div>
                <div style="font-size:12px;color:var(--text-3)">${sub}</div>
              </div>
            </div>
          `).join('')}
        </div>
      </div>
    </div>

    <!-- Right form panel -->
    <div style="
      width:420px;
      min-height:100vh;
      background:var(--surface);
      border-left:1px solid var(--border);
      display:flex;
      align-items:center;
      justify-content:center;
      padding:40px 36px;
      overflow-y:auto;
    ">
      <div style="width:100%;max-width:340px">
        ${formHtml}
      </div>
    </div>

    <style>
      @media (max-width: 768px) {
        .auth-hero { display: none !important; }
        #auth-screen > div:last-child { width: 100% !important; border-left: none !important; }
      }
    </style>
  `
}

function showLogin(el) {
  el.innerHTML = shell(`
    <div style="margin-bottom:32px">
      <h2 style="font-family:var(--font-d);font-size:24px;font-weight:700;margin-bottom:6px">Welcome back</h2>
      <p style="color:var(--text-3);font-size:13.5px">Sign in to your account</p>
    </div>
    <div id="auth-error" class="form-error hidden" style="margin-bottom:14px"></div>
    <div class="form-field">
      <label class="form-label">Email or Username</label>
      <input class="input" id="login-id" type="text" placeholder="you@email.com" autocomplete="username">
    </div>
    <div class="form-field">
      <label class="form-label">Password</label>
      <input class="input" id="login-pw" type="password" placeholder="••••••••" autocomplete="current-password">
    </div>
    <button class="btn btn-primary w-full mt" id="login-btn" style="justify-content:center;height:42px;font-size:14px">
      <i class="bi bi-box-arrow-in-right"></i> Sign In
    </button>
    <div style="text-align:center;margin-top:20px;font-size:13px;color:var(--text-3)">
      Don't have an account? <a id="goto-register" style="color:var(--accent-3);cursor:pointer;font-weight:600">Create one</a>
    </div>
  `)
  el.querySelector('#goto-register').addEventListener('click', () => showRegister(el))
  el.querySelector('#login-btn').addEventListener('click', () => doLogin(el))
  el.querySelectorAll('.input').forEach(inp => inp.addEventListener('keydown', e => { if (e.key === 'Enter') doLogin(el) }))
}

async function doLogin(el) {
  const identifier = el.querySelector('#login-id').value.trim()
  const password   = el.querySelector('#login-pw').value
  const errEl      = el.querySelector('#auth-error')
  const btn        = el.querySelector('#login-btn')

  errEl.classList.add('hidden')
  if (!identifier || !password) { showErr(errEl, 'Please fill in all fields'); return }

  btn.disabled = true
  btn.innerHTML = '<div class="spinner" style="width:16px;height:16px;border-width:2px;margin:0 auto"></div>'

  try {
    const { user } = await api.post('/auth/login', { email: identifier, password })
    onLogin(user)
  } catch (e) {
    showErr(errEl, e.message || 'Login failed — check your details')
    btn.disabled = false
    btn.innerHTML = '<i class="bi bi-box-arrow-in-right"></i> Sign In'
  }
}

function showRegister(el) {
  el.innerHTML = shell(`
    <div style="margin-bottom:28px">
      <h2 style="font-family:var(--font-d);font-size:24px;font-weight:700;margin-bottom:6px">Create account</h2>
      <p style="color:var(--text-3);font-size:13.5px">Join the RankUp community</p>
    </div>
    <div id="auth-error" class="form-error hidden" style="margin-bottom:14px"></div>
    <div class="form-field">
      <label class="form-label">Username</label>
      <input class="input" id="reg-user" type="text" placeholder="CoolGamer99" maxlength="32" autocomplete="username">
    </div>
    <div class="form-field">
      <label class="form-label">Email</label>
      <input class="input" id="reg-email" type="email" placeholder="you@email.com" autocomplete="email">
    </div>
    <div class="form-field">
      <label class="form-label">Password <span style="font-weight:400;color:var(--text-3)">(min 6 chars)</span></label>
      <input class="input" id="reg-pw" type="password" placeholder="••••••••" autocomplete="new-password">
    </div>
    <div class="form-field">
      <label class="form-label">Date of Birth <span style="font-weight:400;color:var(--text-3)">(must be 13+)</span></label>
      <input type="date" class="input" id="reg-dob" max="${new Date().toISOString().split('T')[0]}">
    </div>
    <div class="form-field">
      <label class="form-label">Main Platform</label>
      <select class="input" id="reg-platform">
        <option value="PC">PC</option>
        <option value="PlayStation">PlayStation</option>
        <option value="Xbox">Xbox</option>
        <option value="Nintendo Switch">Nintendo Switch</option>
        <option value="Mobile">Mobile</option>
        <option value="Multi-platform" selected>Multi-platform</option>
      </select>
    </div>
    <button class="btn btn-primary w-full mt" id="reg-btn" style="justify-content:center;height:42px;font-size:14px">
      <i class="bi bi-person-plus-fill"></i> Create Account
    </button>
    <div style="text-align:center;margin-top:20px;font-size:13px;color:var(--text-3)">
      Already have an account? <a id="goto-login" style="color:var(--accent-3);cursor:pointer;font-weight:600">Sign in</a>
    </div>
  `)
  el.querySelector('#goto-login').addEventListener('click', () => showLogin(el))
  el.querySelector('#reg-btn').addEventListener('click', () => doRegister(el))
  el.querySelectorAll('.input').forEach(inp => inp.addEventListener('keydown', e => { if (e.key === 'Enter') doRegister(el) }))
}

async function doRegister(el) {
  const username      = el.querySelector('#reg-user').value.trim()
  const email         = el.querySelector('#reg-email').value.trim()
  const password      = el.querySelector('#reg-pw').value
  const platform      = el.querySelector('#reg-platform').value
  const date_of_birth = el.querySelector('#reg-dob').value
  const errEl         = el.querySelector('#auth-error')
  const btn           = el.querySelector('#reg-btn')

  errEl.classList.add('hidden')
  if (!username || !email || !password) { showErr(errEl, 'Please fill in all fields'); return }
  if (password.length < 6) { showErr(errEl, 'Password must be at least 6 characters'); return }
  if (!date_of_birth) { showErr(errEl, 'Please enter your date of birth'); return }

  btn.disabled = true
  btn.innerHTML = '<div class="spinner" style="width:16px;height:16px;border-width:2px;margin:0 auto"></div>'

  try {
    const { user } = await api.post('/auth/register', { username, email, password, platform, date_of_birth })
    onLogin(user)
  } catch (e) {
    showErr(errEl, e.message || 'Registration failed')
    btn.disabled = false
    btn.innerHTML = '<i class="bi bi-person-plus-fill"></i> Create Account'
  }
}

function showErr(el, msg) {
  el.textContent = msg
  el.classList.remove('hidden')
}
