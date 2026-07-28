import { api } from '../api.js'
import { state, toast, navigate } from '../app.js'
import { gameWs } from '../ws.js'

const GAME_LIST = [
  {
    id: 'tictactoe', name: 'Tic-Tac-Toe', icon: '✕', type: 'Multiplayer',
    desc: 'Classic 3×3 strategy. Outsmart your opponent.',
    gradient: 'linear-gradient(135deg,#1e1b4b 0%,#3730a3 50%,#1e1b4b 100%)',
    accent: '#818cf8', badge: '#4338ca'
  },
  {
    id: 'connect4', name: 'Connect 4', icon: '🔴', type: 'Multiplayer',
    desc: 'Drop pieces and get 4 in a row first.',
    gradient: 'linear-gradient(135deg,#450a0a 0%,#b91c1c 50%,#7c2d12 100%)',
    accent: '#f87171', badge: '#dc2626'
  },
  {
    id: 'rps', name: 'Rock Paper Scissors', icon: '✊', type: 'Multiplayer',
    desc: 'The fastest 1v1 on the platform.',
    gradient: 'linear-gradient(135deg,#052e16 0%,#15803d 50%,#052e16 100%)',
    accent: '#4ade80', badge: '#16a34a'
  },
  {
    id: 'snake', name: 'Snake', icon: '🐍', type: 'Single Player',
    desc: 'Eat, grow, and survive as long as you can.',
    gradient: 'linear-gradient(135deg,#052e1a 0%,#065f46 50%,#022c22 100%)',
    accent: '#34d399', badge: '#059669'
  },
  {
    id: '2048', name: '2048', icon: '🔢', type: 'Single Player',
    desc: 'Merge tiles and reach the legendary 2048.',
    gradient: 'linear-gradient(135deg,#431407 0%,#c2410c 50%,#7c2d12 100%)',
    accent: '#fb923c', badge: '#ea580c'
  },
  {
    id: 'memory', name: 'Memory Match', icon: '🃏', type: 'Single Player',
    desc: 'Flip cards and find every matching pair.',
    gradient: 'linear-gradient(135deg,#2e1065 0%,#7e22ce 50%,#4a044e 100%)',
    accent: '#c084fc', badge: '#9333ea'
  },
  {
    id: 'trivia', name: 'Gaming Trivia', icon: '❓', type: 'Single Player',
    desc: 'How deep does your gaming knowledge go?',
    gradient: 'linear-gradient(135deg,#0c1a3a 0%,#1d4ed8 50%,#0c1a3a 100%)',
    accent: '#60a5fa', badge: '#2563eb'
  },
  {
    id: 'wordle', name: 'GameWord', icon: '🔤', type: 'Single Player',
    desc: 'Guess the hidden 5-letter gaming title.',
    gradient: 'linear-gradient(135deg,#14260a 0%,#4d7c0f 50%,#14260a 100%)',
    accent: '#86efac', badge: '#65a30d'
  },
]

export function renderGames(container, path) {
  const gameId = path?.split('/games/')[1]
  if (gameId) {
    const game = GAME_LIST.find(g => g.id === gameId)
    if (game) { renderGamePage(container, game); return }
  }
  renderHub(container)
}

function renderHub(container) {
  const multi  = GAME_LIST.filter(g => g.type === 'Multiplayer')
  const single = GAME_LIST.filter(g => g.type === 'Single Player')

  container.innerHTML = `
    <div class="page-header">
      <h1 class="page-title"><i class="bi bi-controller"></i> Games</h1>
    </div>

    <!-- Multiplayer section -->
    <div class="section">
      <div class="section-title">
        <i class="bi bi-people-fill" style="color:var(--accent-3)"></i>
        Multiplayer
        <span style="font-size:11px;font-weight:400;color:var(--text-3);text-transform:none;letter-spacing:0;margin-left:6px">Play against real people</span>
      </div>
      <div class="games-grid" id="multi-grid">
        ${multi.map(gameCardHtml).join('')}
      </div>
    </div>

    <!-- Single Player section -->
    <div class="section">
      <div class="section-title">
        <i class="bi bi-person-fill" style="color:var(--gold)"></i>
        Single Player
        <span style="font-size:11px;font-weight:400;color:var(--text-3);text-transform:none;letter-spacing:0;margin-left:6px">Beat your own high score</span>
      </div>
      <div class="games-grid" id="single-grid">
        ${single.map(gameCardHtml).join('')}
      </div>
    </div>

    <!-- Your stats -->
    <div class="section">
      <div class="section-title">
        <i class="bi bi-bar-chart-fill" style="color:var(--green)"></i>
        Your Game Stats
      </div>
      <div id="game-stats-grid" class="stat-grid">
        <div class="spinner" style="margin:20px auto;grid-column:1/-1"></div>
      </div>
    </div>
  `

  container.querySelectorAll('.game-card').forEach(card => {
    card.addEventListener('click', () => {
      const game = GAME_LIST.find(g => g.id === card.dataset.game)
      if (game) { history.pushState(null, '', `/games/${game.id}`); renderGamePage(container, game) }
    })
  })

  loadGameStats(container)
}

function gameCardHtml(g) {
  return `
    <div class="game-card game-card-v2" data-game="${g.id}" style="--game-gradient:${g.gradient};--game-accent:${g.accent}">
      <div class="game-card-bg"></div>
      <div class="game-card-content">
        <div class="game-card-icon-v2">${g.icon}</div>
        <div class="game-card-name-v2">${g.name}</div>
        <div class="game-card-desc-v2">${g.desc}</div>
        <div class="game-card-footer">
          <span class="game-type-badge" style="background:rgba(0,0,0,.35);color:${g.accent};border:1px solid ${g.accent}30">
            <i class="bi ${g.type === 'Multiplayer' ? 'bi-people-fill' : 'bi-person-fill'}"></i>
            ${g.type}
          </span>
          <span class="game-play-btn">Play <i class="bi bi-play-fill"></i></span>
        </div>
      </div>
    </div>
  `
}

async function loadGameStats(container) {
  try {
    const { stats } = await api.get('/games/stats')
    const el = container.querySelector('#game-stats-grid')
    if (!stats?.length) {
      el.innerHTML = `
        <div style="grid-column:1/-1;text-align:center;padding:20px">
          <p style="color:var(--text-3);font-size:13px">Play some games to see your stats here!</p>
        </div>
      `
      return
    }
    el.innerHTML = stats.map(s => `
      <div class="stat-card">
        <div class="stat-value">${s.played || 0}</div>
        <div class="stat-label">${s.game_name}</div>
        <div style="font-size:11px;color:var(--green);margin-top:2px">${s.wins || 0}W / ${s.losses || 0}L</div>
      </div>
    `).join('')
  } catch {}
}

// ── Game page wrapper ─────────────────────────────────────────────────────
function renderGamePage(container, game) {
  container.innerHTML = `
    <div class="page-header">
      <div style="display:flex;align-items:center;gap:12px">
        <button class="btn btn-ghost btn-icon" id="back-to-games">
          <i class="bi bi-arrow-left"></i>
        </button>
        <div style="display:flex;align-items:center;gap:8px">
          <span style="font-size:22px">${game.icon}</span>
          <h1 class="page-title" style="margin:0">${game.name}</h1>
        </div>
        <span class="tag" style="background:${game.badge}22;color:${game.accent};border-color:${game.badge}44">
          ${game.type}
        </span>
      </div>
    </div>
    <div id="game-container"></div>
  `

  container.querySelector('#back-to-games').addEventListener('click', () => {
    history.pushState(null, '', '/games')
    renderHub(container)
  })

  const gc = container.querySelector('#game-container')

  // ── Multiplayer games ────────────────────────────────────────────────────
  if (game.id === 'tictactoe') renderTicTacToe(gc)
  else if (game.id === 'connect4') renderConnect4(gc)
  else if (game.id === 'rps') renderRPS(gc)
  // ── Single player games ──────────────────────────────────────────────────
  else if (game.id === 'snake') renderSnake(gc)
  else if (game.id === '2048') render2048(gc)
  else if (game.id === 'memory') renderMemory(gc)
  else if (game.id === 'trivia') renderTrivia(gc)
  else if (game.id === 'wordle') renderWordle(gc)
}

// ═══════════════════════════════════════════════════════════════════════════
// MULTIPLAYER GAMES
// ═══════════════════════════════════════════════════════════════════════════

function mpWrapper(gc, gameName, boardHtml, statusHtml = '') {
  gc.innerHTML = `
    <div class="game-area">
      <div class="game-status-bar" id="game-status">
        <div class="spinner" style="width:16px;height:16px;border-width:2px"></div>
        <span>Finding a match…</span>
      </div>
      ${statusHtml}
      <div class="game-board-wrap">${boardHtml}</div>
      <button class="btn btn-secondary btn-sm" id="leave-game" style="margin-top:12px">
        <i class="bi bi-door-open"></i> Leave Game
      </button>
    </div>
  `
  gc.querySelector('#leave-game').addEventListener('click', () => {
    gameWs.send({ type: 'game:leave' })
    gameWs.disconnect()
    history.pushState(null, '', '/games')
    renderHub(gc.closest('#main-content') || gc)
  })
}

// Tic Tac Toe ────────────────────────────────────────────────────────────
function renderTicTacToe(gc) {
  mpWrapper(gc, 'Tic-Tac-Toe', `
    <div class="ttt-board" id="ttt-board">
      ${Array(9).fill('').map((_, i) => `<div class="ttt-cell" data-idx="${i}"></div>`).join('')}
    </div>
  `)

  let mySymbol = null, myTurn = false

  gameWs.connect()
  gameWs.send({ type: 'game:join', game: 'tictactoe' })

  const status = gc.querySelector('#game-status')
  const cells  = gc.querySelectorAll('.ttt-cell')

  cells.forEach(cell => {
    cell.addEventListener('click', () => {
      if (!myTurn || cell.textContent) return
      gameWs.send({ type: 'game:move', index: Number(cell.dataset.idx) })
    })
  })

  gameWs.on('game:joined', msg => {
    mySymbol = msg.symbol
    status.innerHTML = `<span>You are <strong>${mySymbol}</strong> · Waiting for opponent…</span>`
  })

  gameWs.on('game:start', msg => {
    myTurn = msg.turn === mySymbol
    status.innerHTML = `<span>${myTurn ? '🟢 Your turn' : '⏳ Opponent\'s turn'} · You are <strong>${mySymbol}</strong></span>`
  })

  gameWs.on('game:move', msg => {
    const cell = gc.querySelector(`[data-idx="${msg.index}"]`)
    if (cell) { cell.textContent = msg.symbol; cell.dataset.sym = msg.symbol }
    myTurn = msg.nextTurn === mySymbol
    status.innerHTML = `<span>${myTurn ? '🟢 Your turn' : '⏳ Opponent\'s turn'}</span>`
  })

  gameWs.on('game:over', msg => {
    myTurn = false
    const won = msg.winner === mySymbol
    const draw = msg.winner === 'draw'
    status.innerHTML = `<span style="color:${draw?'var(--text-2)':won?'var(--green)':'var(--red)'}">${draw ? '🤝 Draw!' : won ? '🏆 You won!' : '😔 You lost!'}</span>`
    if (msg.line) msg.line.forEach(i => gc.querySelector(`[data-idx="${i}"]`)?.classList.add('ttt-win'))
    toast(draw ? 'Draw!' : won ? 'You won! 🏆' : 'Better luck next time', draw ? 'info' : won ? 'success' : 'error')
  })

  gameWs.on('game:opponent_left', () => {
    status.innerHTML = '<span style="color:var(--red)">Opponent left the game</span>'
    toast('Opponent disconnected', 'info')
  })
}

// Connect 4 ──────────────────────────────────────────────────────────────
function renderConnect4(gc) {
  const COLS = 7, ROWS = 6
  mpWrapper(gc, 'Connect 4', `
    <div class="c4-board" id="c4-board">
      ${Array(COLS).fill('').map((_, c) => `
        <div class="c4-col" data-col="${c}">
          ${Array(ROWS).fill('').map((_, r) => `<div class="c4-cell" data-row="${r}" data-col="${c}"></div>`).join('')}
        </div>
      `).join('')}
    </div>
  `)

  let myColor = null, myTurn = false
  const status = gc.querySelector('#game-status')

  gc.querySelectorAll('.c4-col').forEach(col => {
    col.addEventListener('click', () => {
      if (!myTurn) return
      gameWs.send({ type: 'game:move', col: Number(col.dataset.col) })
    })
  })

  gameWs.connect()
  gameWs.send({ type: 'game:join', game: 'connect4' })

  gameWs.on('game:joined', msg => {
    myColor = msg.color
    status.innerHTML = `<span>You are <strong style="color:${myColor==='red'?'#f87171':'#facc15'}">${myColor}</strong> · Waiting…</span>`
  })

  gameWs.on('game:start', msg => {
    myTurn = msg.turn === myColor
    status.innerHTML = `<span>${myTurn ? '🟢 Your turn' : '⏳ Opponent\'s turn'}</span>`
  })

  gameWs.on('game:move', msg => {
    const cell = gc.querySelector(`.c4-cell[data-row="${msg.row}"][data-col="${msg.col}"]`)
    if (cell) { cell.classList.add('c4-' + msg.color) }
    myTurn = msg.nextTurn === myColor
    status.innerHTML = `<span>${myTurn ? '🟢 Your turn' : '⏳ Opponent\'s turn'}</span>`
  })

  gameWs.on('game:over', msg => {
    myTurn = false
    const won = msg.winner === myColor, draw = msg.winner === 'draw'
    status.innerHTML = `<span style="color:${draw?'var(--text-2)':won?'var(--green)':'var(--red)'}">${draw?'🤝 Draw!':won?'🏆 You won!':'😔 You lost!'}</span>`
    toast(draw?'Draw!':won?'You won! 🏆':'Better luck next time', draw?'info':won?'success':'error')
  })

  gameWs.on('game:opponent_left', () => { status.innerHTML = '<span style="color:var(--red)">Opponent left</span>' })
}

// Rock Paper Scissors ────────────────────────────────────────────────────
function renderRPS(gc) {
  mpWrapper(gc, 'RPS', `
    <div class="rps-wrap">
      <div id="rps-result" style="font-size:15px;color:var(--text-2);min-height:24px;text-align:center;margin-bottom:16px"></div>
      <div class="rps-choices">
        <button class="rps-btn" data-choice="rock">✊<span>Rock</span></button>
        <button class="rps-btn" data-choice="paper">✋<span>Paper</span></button>
        <button class="rps-btn" data-choice="scissors">✌️<span>Scissors</span></button>
      </div>
      <div id="rps-score" style="display:flex;gap:20px;justify-content:center;margin-top:20px;font-family:var(--font-m);font-size:13px;color:var(--text-2)">
        <span>You: <strong id="rps-my-score" style="color:var(--green)">0</strong></span>
        <span>Them: <strong id="rps-their-score" style="color:var(--red)">0</strong></span>
      </div>
    </div>
  `)

  let myScore = 0, theirScore = 0
  const status = gc.querySelector('#game-status')
  const resultEl = gc.querySelector('#rps-result')

  gameWs.connect()
  gameWs.send({ type: 'game:join', game: 'rps' })

  gc.querySelectorAll('.rps-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      gameWs.send({ type: 'game:move', choice: btn.dataset.choice })
      gc.querySelectorAll('.rps-btn').forEach(b => b.disabled = true)
      resultEl.textContent = 'Waiting for opponent…'
    })
  })

  gameWs.on('game:joined', () => { status.innerHTML = '<span>Waiting for opponent…</span>' })
  gameWs.on('game:start', () => { status.innerHTML = '<span>🟢 Choose your move!</span>' })

  gameWs.on('game:round', msg => {
    gc.querySelectorAll('.rps-btn').forEach(b => b.disabled = false)
    const won = msg.winner === 'you', draw = msg.winner === 'draw'
    if (!draw) { if (won) myScore++; else theirScore++ }
    gc.querySelector('#rps-my-score').textContent = myScore
    gc.querySelector('#rps-their-score').textContent = theirScore
    const emojis = { rock:'✊', paper:'✋', scissors:'✌️' }
    resultEl.innerHTML = `${emojis[msg.myChoice]} vs ${emojis[msg.theirChoice]} — <strong style="color:${draw?'var(--text-2)':won?'var(--green)':'var(--red)'}">${draw?'Draw':won?'You win this round!':'They win this round'}</strong>`
  })

  gameWs.on('game:over', msg => {
    const won = msg.winner === 'you', draw = msg.winner === 'draw'
    status.innerHTML = `<span style="color:${draw?'var(--text-2)':won?'var(--green)':'var(--red)'}">${draw?'🤝 Match draw!':won?'🏆 You won the match!':'😔 You lost the match'}</span>`
    toast(draw?'Draw!':won?'Match won! 🏆':'Better luck next time', draw?'info':won?'success':'error')
  })

  gameWs.on('game:opponent_left', () => { status.innerHTML = '<span style="color:var(--red)">Opponent left</span>' })
}

// ═══════════════════════════════════════════════════════════════════════════
// SINGLE PLAYER GAMES
// ═══════════════════════════════════════════════════════════════════════════

// Snake ──────────────────────────────────────────────────────────────────
function renderSnake(gc) {
  const GRID = 20, CELL = 20
  gc.innerHTML = `
    <div class="game-area">
      <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:12px;flex-wrap:wrap;gap:8px">
        <div style="font-family:var(--font-m);font-size:13px;color:var(--text-2)">Score: <strong id="snake-score" style="color:var(--green)">0</strong></div>
        <div style="font-family:var(--font-m);font-size:13px;color:var(--text-2)">Best: <strong id="snake-best" style="color:var(--gold)">0</strong></div>
        <button class="btn btn-secondary btn-sm" id="snake-start">▶ Start</button>
      </div>
      <canvas id="snake-canvas" width="${GRID*CELL}" height="${GRID*CELL}" style="border:1px solid var(--border);border-radius:var(--r);display:block;margin:0 auto;background:#0a0a10;touch-action:none"></canvas>
      <div style="text-align:center;margin-top:10px;font-size:12px;color:var(--text-3)">Arrow keys or WASD · Swipe on mobile</div>
    </div>
  `
  const canvas = gc.querySelector('#snake-canvas')
  const ctx = canvas.getContext('2d')
  const scoreEl = gc.querySelector('#snake-score')
  const bestEl = gc.querySelector('#snake-best')
  let snake, dir, food, running, interval, score, best = 0

  function startGame() {
    snake = [{x:10,y:10},{x:9,y:10},{x:8,y:10}]
    dir = {x:1,y:0}
    placeFood()
    score = 0; scoreEl.textContent = 0
    running = true
    clearInterval(interval)
    interval = setInterval(tick, 120)
  }

  function placeFood() {
    do { food = {x:Math.floor(Math.random()*GRID),y:Math.floor(Math.random()*GRID)} }
    while (snake.some(s=>s.x===food.x&&s.y===food.y))
  }

  function tick() {
    const head = {x:snake[0].x+dir.x,y:snake[0].y+dir.y}
    if (head.x<0||head.x>=GRID||head.y<0||head.y>=GRID||snake.some(s=>s.x===head.x&&s.y===head.y)) {
      clearInterval(interval); running = false
      if (score > best) { best = score; bestEl.textContent = best }
      toast(`Game over! Score: ${score}`, score > 0 ? 'info' : 'error')
      if (score > 0) api.post('/games/result', { game: 'Snake', score, won: true }).catch(()=>{})
      return
    }
    snake.unshift(head)
    if (head.x===food.x&&head.y===food.y) { score++; scoreEl.textContent=score; placeFood() }
    else snake.pop()
    draw()
  }

  function draw() {
    ctx.fillStyle = '#0a0a10'; ctx.fillRect(0,0,GRID*CELL,GRID*CELL)
    ctx.fillStyle = '#1a1a2e'
    for(let i=0;i<GRID;i++) for(let j=0;j<GRID;j++) { if((i+j)%2===0) ctx.fillRect(i*CELL,j*CELL,CELL,CELL) }
    // food
    ctx.fillStyle = '#22c55e'; ctx.shadowColor='#22c55e'; ctx.shadowBlur=8
    ctx.fillRect(food.x*CELL+2,food.y*CELL+2,CELL-4,CELL-4)
    ctx.shadowBlur = 0
    // snake
    snake.forEach((s,i) => {
      ctx.fillStyle = i===0?'#4ade80':'#16a34a'
      ctx.fillRect(s.x*CELL+1,s.y*CELL+1,CELL-2,CELL-2)
    })
  }

  gc.querySelector('#snake-start').addEventListener('click', startGame)

  document.addEventListener('keydown', e => {
    if (!running) return
    const keys = {ArrowUp:{x:0,y:-1},ArrowDown:{x:0,y:1},ArrowLeft:{x:-1,y:0},ArrowRight:{x:1,y:0},
      w:{x:0,y:-1},s:{x:0,y:1},a:{x:-1,y:0},d:{x:1,y:0}}
    const d = keys[e.key]
    if (d && !(d.x===-dir.x||d.y===-dir.y)) { dir=d; e.preventDefault() }
  })

  // swipe support
  let touchStart = null
  canvas.addEventListener('touchstart', e => { touchStart = {x:e.touches[0].clientX,y:e.touches[0].clientY} })
  canvas.addEventListener('touchend', e => {
    if (!touchStart || !running) return
    const dx = e.changedTouches[0].clientX - touchStart.x
    const dy = e.changedTouches[0].clientY - touchStart.y
    if (Math.abs(dx) > Math.abs(dy)) { dir = dx>0?{x:1,y:0}:{x:-1,y:0} }
    else { dir = dy>0?{x:0,y:1}:{x:0,y:-1} }
  })

  draw()
}

// 2048 ──────────────────────────────────────────────────────────────────
function render2048(gc) {
  let board, score, best2048 = 0
  gc.innerHTML = `
    <div class="game-area">
      <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:12px;flex-wrap:wrap;gap:8px">
        <div style="font-family:var(--font-m);font-size:13px;color:var(--text-2)">Score: <strong id="score-2048" style="color:var(--gold)">0</strong></div>
        <div style="font-family:var(--font-m);font-size:13px;color:var(--text-2)">Best: <strong id="best-2048" style="color:var(--accent-3)">0</strong></div>
        <button class="btn btn-secondary btn-sm" id="new-2048">New Game</button>
      </div>
      <div id="board-2048" class="board-2048"></div>
      <div style="text-align:center;margin-top:10px;font-size:12px;color:var(--text-3)">Arrow keys or swipe to merge tiles</div>
    </div>
  `
  const boardEl = gc.querySelector('#board-2048')
  const scoreEl = gc.querySelector('#score-2048')
  const bestEl  = gc.querySelector('#best-2048')

  const COLORS = {
    2:'#1e293b',4:'#1e3a5f',8:'#1a4731',16:'#4a1942',32:'#4a2419',64:'#6b2111',
    128:'#7c3a00',256:'#854d00',512:'#3b0764',1024:'#1e1b4b',2048:'#7c2d12'
  }

  function newGame() {
    board = Array(4).fill(null).map(()=>Array(4).fill(0))
    score = 0; scoreEl.textContent = 0
    addRandom(); addRandom(); render()
  }

  function addRandom() {
    const empty = []
    for(let r=0;r<4;r++) for(let c=0;c<4;c++) if(!board[r][c]) empty.push([r,c])
    if (!empty.length) return
    const [r,c] = empty[Math.floor(Math.random()*empty.length)]
    board[r][c] = Math.random()<.9?2:4
  }

  function render() {
    boardEl.innerHTML = board.flat().map(v=>`
      <div class="tile-2048" style="background:${COLORS[v]||'#12121c'};color:${v>4?'#fff':'var(--text-2)'}">
        ${v||''}
      </div>
    `).join('')
  }

  function slide(row) {
    let arr = row.filter(x=>x)
    for(let i=0;i<arr.length-1;i++) {
      if(arr[i]===arr[i+1]) { arr[i]*=2; score+=arr[i]; arr.splice(i+1,1) }
    }
    while(arr.length<4) arr.push(0)
    return arr
  }

  function move(dir) {
    const prev = JSON.stringify(board)
    if(dir==='left')  board = board.map(r=>slide(r))
    if(dir==='right') board = board.map(r=>slide([...r].reverse()).reverse())
    if(dir==='up')    board = transpose(board.map((_,i)=>slide(board.map(r=>r[i]))))
    if(dir==='down')  board = transpose(board.map((_,i)=>slide([...board.map(r=>r[i])].reverse()).reverse()))
    if(JSON.stringify(board)!==prev) { addRandom() }
    scoreEl.textContent = score
    if(score>best2048) { best2048=score; bestEl.textContent=best2048 }
    render()
    if(board.flat().includes(2048)) { toast('🎉 You reached 2048!','success'); api.post('/games/result',{game:'2048',score,won:true}).catch(()=>{}) }
    if(!hasMove()) { toast(`Game over! Score: ${score}`,'info'); api.post('/games/result',{game:'2048',score,won:false}).catch(()=>{}) }
  }

  function transpose(m) { return m[0].map((_,i)=>m.map(r=>r[i])) }
  function hasMove() {
    if(board.flat().includes(0)) return true
    for(let r=0;r<4;r++) for(let c=0;c<4;c++) {
      if(c<3&&board[r][c]===board[r][c+1]) return true
      if(r<3&&board[r][c]===board[r+1][c]) return true
    }
    return false
  }

  gc.querySelector('#new-2048').addEventListener('click', newGame)
  document.addEventListener('keydown', e => {
    const map = {ArrowLeft:'left',ArrowRight:'right',ArrowUp:'up',ArrowDown:'down'}
    if(map[e.key]) { e.preventDefault(); move(map[e.key]) }
  })

  let ts = null
  boardEl.addEventListener('touchstart',e=>{ts={x:e.touches[0].clientX,y:e.touches[0].clientY}})
  boardEl.addEventListener('touchend',e=>{
    if(!ts) return
    const dx=e.changedTouches[0].clientX-ts.x, dy=e.changedTouches[0].clientY-ts.y
    if(Math.abs(dx)>Math.abs(dy)) move(dx>0?'right':'left')
    else move(dy>0?'down':'up')
    ts=null
  })

  newGame()
}

// Memory Match ──────────────────────────────────────────────────────────
function renderMemory(gc) {
  const EMOJIS = ['🎮','🕹️','👾','🏆','⚔️','🛡️','💎','🔥','⚡','🌟','🎯','💀']
  let cards, flipped, matched, moves, timer, time, running

  gc.innerHTML = `
    <div class="game-area">
      <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:12px;flex-wrap:wrap;gap:8px">
        <div style="font-size:13px;color:var(--text-2)">Moves: <strong id="mem-moves" style="color:var(--accent-3)">0</strong></div>
        <div style="font-size:13px;color:var(--text-2)">Time: <strong id="mem-time" style="color:var(--gold)">0s</strong></div>
        <button class="btn btn-secondary btn-sm" id="mem-new">New Game</button>
      </div>
      <div id="mem-board" class="memory-board"></div>
    </div>
  `
  const boardEl  = gc.querySelector('#mem-board')
  const movesEl  = gc.querySelector('#mem-moves')
  const timeEl   = gc.querySelector('#mem-time')

  function newGame() {
    clearInterval(timer); time=0; moves=0; flipped=[]; matched=[]; running=true
    cards = [...EMOJIS,...EMOJIS].sort(()=>Math.random()-.5)
    movesEl.textContent=0; timeEl.textContent='0s'
    timer = setInterval(()=>{ if(running) timeEl.textContent=(++time)+'s' },1000)
    boardEl.innerHTML = cards.map((e,i)=>`
      <div class="mem-card" data-idx="${i}">
        <div class="mem-front">❓</div>
        <div class="mem-back">${e}</div>
      </div>
    `).join('')
    boardEl.querySelectorAll('.mem-card').forEach(c=>c.addEventListener('click',()=>flipCard(c)))
  }

  function flipCard(card) {
    const i = Number(card.dataset.idx)
    if (!running || flipped.length===2 || matched.includes(i) || flipped.includes(i)) return
    card.classList.add('flipped'); flipped.push(i)
    if(flipped.length===2) {
      moves++; movesEl.textContent=moves
      if(cards[flipped[0]]===cards[flipped[1]]) {
        matched.push(...flipped); flipped=[]
        if(matched.length===cards.length) {
          running=false; clearInterval(timer)
          toast(`Completed in ${moves} moves & ${time}s! 🏆`,'success')
          api.post('/games/result',{game:'Memory Match',score:Math.max(100-moves*2,10),won:true}).catch(()=>{})
        }
      } else {
        setTimeout(()=>{
          flipped.forEach(f=>boardEl.querySelector(`[data-idx="${f}"]`)?.classList.remove('flipped'))
          flipped=[]
        },900)
      }
    }
  }

  gc.querySelector('#mem-new').addEventListener('click',newGame)
  newGame()
}

// Gaming Trivia ──────────────────────────────────────────────────────────
async function renderTrivia(gc) {
  gc.innerHTML = `<div class="game-area"><div class="state-container"><div class="spinner"></div></div></div>`
  try {
    const { questions } = await api.get('/games/trivia')
    let q = 0, score = 0
    function showQ() {
      if(q>=questions.length) {
        gc.innerHTML = `
          <div class="game-area">
            <div class="state-container">
              <div class="state-icon">🏆</div>
              <p class="state-title">${score}/${questions.length} correct</p>
              <p class="state-desc">${score>=questions.length*.7?'Great job!':'Keep practising!'}</p>
              <button class="btn btn-primary mt" id="trivia-retry">Play Again</button>
            </div>
          </div>
        `
        gc.querySelector('#trivia-retry').addEventListener('click',()=>renderTrivia(gc))
        api.post('/games/result',{game:'Gaming Trivia',score,won:score>=questions.length*.7}).catch(()=>{})
        return
      }
      const curr = questions[q]
      gc.innerHTML = `
        <div class="game-area">
          <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:16px;flex-wrap:wrap;gap:8px">
            <span style="font-size:13px;color:var(--text-3)">Question ${q+1} of ${questions.length}</span>
            <span style="font-family:var(--font-m);font-size:13px;color:var(--green)">${score} correct</span>
          </div>
          <div class="card" style="margin-bottom:16px">
            <p style="font-size:15px;font-weight:600;line-height:1.5">${curr.question}</p>
            ${curr.difficulty?`<span class="tag" style="margin-top:8px;display:inline-block">${curr.difficulty}</span>`:''}
          </div>
          <div style="display:flex;flex-direction:column;gap:8px" id="trivia-opts">
            ${curr.options.map((o,i)=>`
              <button class="btn btn-secondary" data-opt="${i}" style="justify-content:flex-start;text-align:left;white-space:normal;height:auto;padding:12px 16px;line-height:1.4">${o}</button>
            `).join('')}
          </div>
          <div id="trivia-feedback" style="min-height:32px;margin-top:12px;font-size:13px;font-weight:600"></div>
        </div>
      `
      gc.querySelectorAll('[data-opt]').forEach(btn => {
        btn.addEventListener('click',()=>{
          const i = Number(btn.dataset.opt)
          const feedback = gc.querySelector('#trivia-feedback')
          gc.querySelectorAll('[data-opt]').forEach(b=>b.disabled=true)
          if(i===curr.correctIndex) {
            score++; btn.style.background='var(--green-dim)'; btn.style.borderColor='var(--green)'
            feedback.innerHTML = `<span style="color:var(--green)">✓ Correct!</span>`
          } else {
            btn.style.background='var(--red-dim)'; btn.style.borderColor='var(--red)'
            gc.querySelector(`[data-opt="${curr.correctIndex}"]`).style.background='var(--green-dim)'
            feedback.innerHTML = `<span style="color:var(--red)">✗ The answer was: ${curr.options[curr.correctIndex]}</span>`
          }
          setTimeout(()=>{ q++; showQ() },1400)
        })
      })
    }
    showQ()
  } catch {
    gc.innerHTML = `<div class="game-area"><div class="state-container"><p class="state-desc">Failed to load questions. Try again.</p></div></div>`
  }
}

// GameWord (Wordle) ───────────────────────────────────────────────────────
async function renderWordle(gc) {
  gc.innerHTML = `<div class="game-area"><div class="state-container"><div class="spinner"></div></div></div>`
  try {
    const { word: targetWord } = await api.get('/games/word')
    const target = targetWord.toUpperCase()
    const MAX = 6, LEN = 5
    let row = 0, current = '', guesses = []

    gc.innerHTML = `
      <div class="game-area">
        <div class="wordle-grid" id="wordle-grid">
          ${Array(MAX).fill('').map(()=>`
            <div class="wordle-row">
              ${Array(LEN).fill('').map(()=>`<div class="wordle-cell"></div>`).join('')}
            </div>
          `).join('')}
        </div>
        <div id="wordle-msg" style="text-align:center;min-height:24px;font-size:13px;font-weight:600;margin:10px 0"></div>
        <div class="wordle-keyboard" id="wordle-kb">
          ${['QWERTYUIOP','ASDFGHJKL','ZXCVBNM'].map(r=>`
            <div class="wordle-kb-row">
              ${r.split('').map(k=>`<button class="wordle-key" data-key="${k}">${k}</button>`).join('')}
              ${r==='ZXCVBNM'?'<button class="wordle-key" data-key="ENTER" style="font-size:10px;padding:0 8px;min-width:52px">Enter</button><button class="wordle-key" data-key="BACKSPACE" style="font-size:13px">⌫</button>':''}
            </div>
          `).join('')}
        </div>
      </div>
    `

    const grid = gc.querySelector('#wordle-grid')
    const msg  = gc.querySelector('#wordle-msg')

    function updateRow() {
      const cells = grid.querySelectorAll('.wordle-row')[row].querySelectorAll('.wordle-cell')
      cells.forEach((c,i) => { c.textContent = current[i]||''; c.classList.toggle('filled',!!current[i]) })
    }

    function submitGuess() {
      if(current.length<LEN) { msg.innerHTML='<span style="color:var(--red)">Too short!</span>'; return }
      const cells = grid.querySelectorAll('.wordle-row')[row].querySelectorAll('.wordle-cell')
      const result = Array(LEN).fill('absent')
      const tArr = target.split(''), gArr = current.split('')
      gArr.forEach((l,i)=>{ if(l===tArr[i]) result[i]='correct' })
      const rem = tArr.filter((_,i)=>result[i]!=='correct')
      gArr.forEach((l,i)=>{ if(result[i]!=='correct'&&rem.includes(l)) { result[i]='present'; rem.splice(rem.indexOf(l),1) } })
      cells.forEach((c,i)=>{ c.classList.add(result[i]); c.classList.remove('filled') })
      // Update keyboard
      gArr.forEach((l,i)=>{
        const key = gc.querySelector(`[data-key="${l}"]`)
        if(key&&result[i]==='correct') key.className='wordle-key correct'
        else if(key&&result[i]==='present'&&!key.classList.contains('correct')) key.className='wordle-key present'
        else if(key&&result[i]==='absent'&&!key.classList.contains('correct')&&!key.classList.contains('present')) key.className='wordle-key absent'
      })
      guesses.push(current)
      if(current===target) {
        msg.innerHTML=`<span style="color:var(--green)">🏆 Got it in ${row+1}! The word was ${target}</span>`
        api.post('/games/result',{game:'GameWord',score:MAX-row,won:true}).catch(()=>{})
        return
      }
      row++; current=''
      if(row>=MAX) {
        msg.innerHTML=`<span style="color:var(--red)">The word was: <strong>${target}</strong></span>`
        api.post('/games/result',{game:'GameWord',score:0,won:false}).catch(()=>{})
      }
    }

    function onKey(k) {
      if(row>=MAX) return
      if(k==='BACKSPACE'||k==='DELETE') { current=current.slice(0,-1); updateRow() }
      else if(k==='ENTER') { submitGuess(); updateRow() }
      else if(/^[A-Z]$/.test(k)&&current.length<LEN) { current+=k; updateRow() }
    }

    gc.querySelector('#wordle-kb').addEventListener('click',e=>{
      const key = e.target.closest('[data-key]')
      if(key) onKey(key.dataset.key)
    })
    document.addEventListener('keydown',e=>onKey(e.key.toUpperCase()))
    updateRow()
  } catch {
    gc.innerHTML=`<div class="game-area"><div class="state-container"><p class="state-desc">Failed to load game. Try again.</p></div></div>`
  }
}
