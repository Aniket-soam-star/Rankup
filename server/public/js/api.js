// API client — all fetch calls go through here
const BASE = '/api'

async function request(path, options = {}) {
  const res = await fetch(`${BASE}${path}`, {
    credentials: 'include',
    headers: { 'Content-Type': 'application/json', ...options.headers },
    ...options,
    body: options.body !== undefined ? JSON.stringify(options.body) : undefined,
  })
  const data = await res.json().catch(() => ({}))
  if (!res.ok) throw Object.assign(new Error(data.error || `HTTP ${res.status}`), { status: res.status })
  return data
}

export const api = {
  get:    (path, opts)       => request(path, { method: 'GET', ...opts }),
  post:   (path, body, opts) => request(path, { method: 'POST', body, ...opts }),
  put:    (path, body)       => request(path, { method: 'PUT',  body }),
  patch:  (path, body)       => request(path, { method: 'PATCH', body }),
  delete: (path)             => request(path, { method: 'DELETE' }),
}

// Admin API — passes Bearer token
export function adminApi(token) {
  async function adminReq(path, options = {}) {
    const res = await fetch(`${BASE}/admin${path}`, {
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
        ...options.headers,
      },
      ...options,
      body: options.body !== undefined ? JSON.stringify(options.body) : undefined,
    })
    const data = await res.json().catch(() => ({}))
    if (!res.ok) throw new Error(data.error || `HTTP ${res.status}`)
    return data
  }
  return {
    get:    (path)       => adminReq(path),
    post:   (path, body) => adminReq(path, { method: 'POST', body }),
    patch:  (path, body) => adminReq(path, { method: 'PATCH', body }),
    delete: (path)       => adminReq(path, { method: 'DELETE' }),
  }
}
