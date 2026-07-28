// WebSocket manager — auto-reconnect + keep-alive for Railway

const WS_BASE = `${location.protocol === 'https:' ? 'wss:' : 'ws:'}//${location.host}/ws`

class ManagedSocket {
  constructor(type) {
    this.type = type
    this.ws = null
    this.listeners = {}
    this.queue = []
    this.connected = false
    this._shouldReconnect = false
    this._reconnectDelay = 1000
    this._ping = null
  }

  connect() {
    if (this.ws && (this.ws.readyState === WebSocket.OPEN || this.ws.readyState === WebSocket.CONNECTING)) return
    this._shouldReconnect = true
    this.ws = new WebSocket(`${WS_BASE}?type=${this.type}`)

    this.ws.onopen = () => {
      this.connected = true
      this._reconnectDelay = 1000
      this.queue.forEach(m => this.ws.send(JSON.stringify(m)))
      this.queue = []
      // Keep-alive ping every 20s (Railway idles at 60s)
      clearInterval(this._ping)
      this._ping = setInterval(() => {
        if (this.ws?.readyState === WebSocket.OPEN) {
          try { this.ws.send(JSON.stringify({ type: 'ping' })) } catch {}
        }
      }, 20000)
    }

    this.ws.onmessage = (e) => {
      try {
        const msg = JSON.parse(e.data)
        if (msg.type === 'pong') return
        const handlers = this.listeners[msg.type] || []
        handlers.forEach(fn => fn(msg))
      } catch {}
    }

    this.ws.onclose = () => {
      this.connected = false
      clearInterval(this._ping)
      if (this._shouldReconnect) {
        this._reconnectDelay = Math.min(this._reconnectDelay * 1.5, 10000)
        setTimeout(() => { if (this._shouldReconnect) this.connect() }, this._reconnectDelay)
      }
    }

    this.ws.onerror = () => { this.connected = false }
  }

  disconnect() {
    this._shouldReconnect = false
    clearInterval(this._ping)
    if (this.ws) { this.ws.close(); this.ws = null }
    this.connected = false
    this.queue = []
  }

  send(data) {
    if (this.ws && this.ws.readyState === WebSocket.OPEN) {
      this.ws.send(JSON.stringify(data))
    } else {
      this.queue.push(data)
      if (!this.connected && this._shouldReconnect) this.connect()
    }
  }

  on(type, fn) {
    if (!this.listeners[type]) this.listeners[type] = []
    this.listeners[type].push(fn)
    return () => this.off(type, fn)
  }

  off(type, fn) {
    if (this.listeners[type]) {
      this.listeners[type] = this.listeners[type].filter(f => f !== fn)
    }
  }

  offAll() { this.listeners = {} }
}

export const chatWs = new ManagedSocket('chat')
export const clanWs = new ManagedSocket('clan')
export const gameWs = new ManagedSocket('game')

export function connectAll() { chatWs.connect() }
export function disconnectAll() {
  chatWs.disconnect()
  clanWs.disconnect()
  gameWs.disconnect()
}
