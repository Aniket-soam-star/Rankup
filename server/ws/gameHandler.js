import pool from '../db/index.js'
import { logAction } from '../lib/audit.js'

const waitingPlayers = new Map()  // gameCode → { ws, timer }
const activeGames = new Map()

// ── Tic-Tac-Toe helpers ──────────────────────────────────────────────────────

function makeTTTBoard() { return Array(9).fill(null) }

function checkTTTWinner(board) {
  const lines = [[0,1,2],[3,4,5],[6,7,8],[0,3,6],[1,4,7],[2,5,8],[0,4,8],[2,4,6]]
  for (const [a,b,c] of lines) {
    if (board[a] && board[a] === board[b] && board[b] === board[c]) return board[a]
  }
  return board.every(Boolean) ? 'draw' : null
}

function tttMinimax(board, isMax, mySymbol, oppSymbol) {
  const w = checkTTTWinner(board)
  if (w === mySymbol) return 10
  if (w === oppSymbol) return -10
  if (board.every(Boolean)) return 0
  if (isMax) {
    let best = -Infinity
    for (let i = 0; i < 9; i++) {
      if (!board[i]) { board[i] = mySymbol; best = Math.max(best, tttMinimax(board, false, mySymbol, oppSymbol)); board[i] = null }
    }
    return best
  } else {
    let best = Infinity
    for (let i = 0; i < 9; i++) {
      if (!board[i]) { board[i] = oppSymbol; best = Math.min(best, tttMinimax(board, true, mySymbol, oppSymbol)); board[i] = null }
    }
    return best
  }
}

function tttBotMove(board, botSymbol, playerSymbol, difficulty) {
  const empty = board.map((v,i) => v===null ? i : null).filter(v => v !== null)
  if (!empty.length) return -1
  if (difficulty === 'easy') return empty[Math.floor(Math.random() * empty.length)]
  if (difficulty === 'medium') {
    // Win if possible
    for (const i of empty) { board[i] = botSymbol; if (checkTTTWinner(board) === botSymbol) { board[i] = null; return i } board[i] = null }
    // Block opponent win
    for (const i of empty) { board[i] = playerSymbol; if (checkTTTWinner(board) === playerSymbol) { board[i] = null; return i } board[i] = null }
    return empty[Math.floor(Math.random() * empty.length)]
  }
  // hard: minimax
  let best = -Infinity, bestMove = empty[0]
  for (const i of empty) {
    board[i] = botSymbol
    const val = tttMinimax(board, false, botSymbol, playerSymbol)
    board[i] = null
    if (val > best) { best = val; bestMove = i }
  }
  return bestMove
}

// ── Connect 4 helpers ────────────────────────────────────────────────────────

const C4_ROWS = 6, C4_COLS = 7

function makeC4Board() { return Array(C4_ROWS).fill(null).map(() => Array(C4_COLS).fill(null)) }

function c4Drop(board, col, player) {
  for (let r = C4_ROWS - 1; r >= 0; r--) {
    if (!board[r][col]) { board[r][col] = player; return r }
  }
  return -1
}

function checkC4Winner(board, row, col, player) {
  const dirs = [[0,1],[1,0],[1,1],[1,-1]]
  for (const [dr, dc] of dirs) {
    let count = 1
    for (let i = 1; i < 4; i++) {
      const r = row+dr*i, c = col+dc*i
      if (r<0||r>=C4_ROWS||c<0||c>=C4_COLS||board[r][c]!==player) break; count++
    }
    for (let i = 1; i < 4; i++) {
      const r = row-dr*i, c = col-dc*i
      if (r<0||r>=C4_ROWS||c<0||c>=C4_COLS||board[r][c]!==player) break; count++
    }
    if (count >= 4) return true
  }
  return false
}

function c4ValidCols(board) { return Array.from({length: C4_COLS}, (_,i) => i).filter(c => board[0][c] === null) }

function c4ScoreCol(board, col, player, opp) {
  let score = 0
  const testBoard = board.map(r => [...r])
  const row = c4Drop(testBoard, col, player)
  if (row < 0) return -Infinity
  if (checkC4Winner(testBoard, row, col, player)) return 1000
  // Check if opponent would win there
  const blockBoard = board.map(r => [...r])
  const blockRow = c4Drop(blockBoard, col, opp)
  if (blockRow >= 0 && checkC4Winner(blockBoard, blockRow, col, opp)) score += 500
  // Prefer center
  score += (C4_COLS - Math.abs(col - Math.floor(C4_COLS/2))) * 3
  return score
}

function c4BotMove(board, botPlayer, playerOpp, difficulty) {
  const valid = c4ValidCols(board)
  if (!valid.length) return -1
  if (difficulty === 'easy') return valid[Math.floor(Math.random() * valid.length)]
  if (difficulty === 'medium') {
    // Win immediately
    for (const col of valid) {
      const tb = board.map(r => [...r]); const row = c4Drop(tb, col, botPlayer)
      if (row >= 0 && checkC4Winner(tb, row, col, botPlayer)) return col
    }
    // Block player win
    for (const col of valid) {
      const tb = board.map(r => [...r]); const row = c4Drop(tb, col, playerOpp)
      if (row >= 0 && checkC4Winner(tb, row, col, playerOpp)) return col
    }
    return valid[Math.floor(Math.random() * valid.length)]
  }
  // hard: score each column
  let best = -Infinity, bestCol = valid[Math.floor(Math.random() * valid.length)]
  for (const col of valid) {
    const score = c4ScoreCol(board, col, botPlayer, playerOpp)
    if (score > best) { best = score; bestCol = col }
  }
  return bestCol
}

// ── RPS helpers ──────────────────────────────────────────────────────────────

function rpsResult(a, b) {
  if (a === b) return 'draw'
  if ((a===0&&b===2)||(a===1&&b===0)||(a===2&&b===1)) return 'win'
  return 'loss'
}

function rpsBotChoice(playerHistory, difficulty) {
  if (difficulty !== 'hard' || playerHistory.length < 3) return Math.floor(Math.random() * 3)
  // Counter-frequency: find most common player move, counter it
  const freq = [0, 0, 0]
  playerHistory.forEach(c => freq[c]++)
  const mostCommon = freq.indexOf(Math.max(...freq))
  return (mostCommon + 1) % 3  // counter: 0→1, 1→2, 2→0
}

// ── Bot delay helper ─────────────────────────────────────────────────────────

function botDelay(difficulty) {
  const ranges = { easy: [600, 1200], medium: [400, 900], hard: [200, 600] }
  const [min, max] = ranges[difficulty] || [500, 1000]
  return min + Math.floor(Math.random() * (max - min))
}

// ── Log game result ──────────────────────────────────────────────────────────

async function logGameResult(userId, gameName, result, score, details) {
  try {
    await pool.query(
      `INSERT INTO game_results (user_id, game_name, result, score, metadata)
       VALUES ($1,$2,$3,$4,$5)`,
      [userId, gameName, result, score || 0, details || {}]
    )
  } catch {}
}

// ── Main handler ─────────────────────────────────────────────────────────────

export function handleGameConnection(ws, userId, username) {
  ws.userId = userId
  ws.username = username
  ws.gameId = null

  ws.on('message', async (raw) => {
    let data
    try { data = JSON.parse(raw) } catch { return }

    // ─ NEW: game:join — supports vsBot ──────────────────────────────────────

    if (data.type === 'game:join') {
      const { game, vsBot, difficulty = 'medium' } = data
      if (!['tictactoe', 'connect4', 'rps'].includes(game)) return

      if (vsBot) {
        // Immediately start a bot game
        const gameId = `${game}_bot_${userId}_${Date.now()}`
        ws.gameId = gameId

        if (game === 'tictactoe') {
          const board = makeTTTBoard()
          const playerSymbol = 'X', botSymbol = 'O'
          activeGames.set(gameId, {
            id: gameId, type: 'ttt', board, status: 'active',
            players: [{ ws, userId, username, symbol: playerSymbol }],
            botSymbol, difficulty, currentTurn: 0, vsBot: true
          })
          ws.send(JSON.stringify({
            type: 'game:start', gameId, game: 'tictactoe',
            symbol: playerSymbol, board, currentTurn: playerSymbol,
            opponent: 'RankUpBot'
          }))

          await logAction(pool, {
            userId, username, action: 'game.bot_started',
            details: { game: 'tictactoe', difficulty }
          }).catch(() => {})
        }

        if (game === 'connect4') {
          const board = makeC4Board()
          const playerSymbol = '1', botSymbol = '2'
          activeGames.set(gameId, {
            id: gameId, type: 'c4', board, status: 'active',
            players: [{ ws, userId, username, symbol: playerSymbol }],
            botSymbol, difficulty, currentTurn: 0, vsBot: true
          })
          ws.send(JSON.stringify({
            type: 'game:start', gameId, game: 'connect4',
            symbol: playerSymbol, board, currentTurn: playerSymbol,
            opponent: 'RankUpBot'
          }))
        }

        if (game === 'rps') {
          activeGames.set(gameId, {
            id: gameId, type: 'rps', status: 'active',
            players: [{ ws, userId, username }],
            difficulty, vsBot: true, playerHistory: []
          })
          ws.send(JSON.stringify({
            type: 'game:start', gameId, game: 'rps',
            opponent: 'RankUpBot'
          }))
        }
        return
      }

      // Human matchmaking with 10s bot offer
      const gameCode = `${game}_${userId}`
      if (waitingPlayers.has(game)) {
        const { ws: player1, timer } = waitingPlayers.get(game)
        if (timer) clearTimeout(timer)
        waitingPlayers.delete(game)
        const gameId = `${game}_${Date.now()}`
        ws.gameId = gameId; player1.gameId = gameId
        const startPayload = (sym, opp) => JSON.stringify({ type: 'game:start', gameId, game, symbol: sym, opponent: opp })
        if (game === 'tictactoe') {
          activeGames.set(gameId, { id: gameId, type: 'ttt', board: makeTTTBoard(), players: [{ ws: player1, userId: player1.userId, username: player1.username, symbol: 'X' }, { ws, userId, username, symbol: 'O' }], currentTurn: 0, status: 'active', vsBot: false })
          player1.send(startPayload('X', username)); ws.send(startPayload('O', player1.username))
        } else if (game === 'connect4') {
          activeGames.set(gameId, { id: gameId, type: 'c4', board: makeC4Board(), players: [{ ws: player1, userId: player1.userId, username: player1.username, symbol: '1' }, { ws, userId, username, symbol: '2' }], currentTurn: 0, status: 'active', vsBot: false })
          player1.send(startPayload('1', username)); ws.send(startPayload('2', player1.username))
        } else {
          activeGames.set(gameId, { id: gameId, type: 'rps', players: [{ ws: player1, userId: player1.userId, username: player1.username, choice: null }, { ws, userId, username, choice: null }], status: 'active', vsBot: false })
          player1.send(JSON.stringify({ type: 'game:start', gameId, game: 'rps', opponent: username }))
          ws.send(JSON.stringify({ type: 'game:start', gameId, game: 'rps', opponent: player1.username }))
        }
      } else {
        ws.gameId = null
        const timer = setTimeout(() => {
          if (waitingPlayers.has(game) && waitingPlayers.get(game).ws === ws) {
            ws.send(JSON.stringify({ type: 'game:bot_available', game }))
          }
        }, 10000)
        waitingPlayers.set(game, { ws, timer })
        ws.send(JSON.stringify({ type: 'game:waiting', game }))
      }
      return
    }

    // ─ game:move — handles both bot and human games ──────────────────────────

    if (data.type === 'game:move') {
      const game = activeGames.get(ws.gameId)
      if (!game || game.status !== 'active') return

      if (game.type === 'ttt') {
        const pi = game.players.findIndex(p => p.userId === userId)
        if (pi !== game.currentTurn) return
        const { cell } = data
        if (game.board[cell] !== null) return
        const playerSymbol = game.players[pi].symbol
        game.board[cell] = playerSymbol
        const winner = checkTTTWinner(game.board)

        ws.send(JSON.stringify({ type: 'game:move', board: game.board, cell, symbol: playerSymbol, currentTurn: game.vsBot ? 'bot' : game.players[1 - game.currentTurn]?.symbol }))

        if (winner) {
          game.status = 'done'
          const playerResult = winner === 'draw' ? 'draw' : 'win'
          ws.send(JSON.stringify({ type: 'game:over', board: game.board, winner, result: playerResult }))
          await logGameResult(userId, 'Tic-Tac-Toe', playerResult, playerResult === 'win' ? 10 : 0, { opponent: game.vsBot ? 'bot' : game.players[1-pi].username, difficulty: game.difficulty })
          activeGames.delete(ws.gameId)
          return
        }

        if (game.vsBot && winner === null) {
          game.currentTurn = 1 - game.currentTurn
          const oppSymbol = game.botSymbol
          setTimeout(() => {
            if (game.status !== 'active') return
            const botCell = tttBotMove(game.board, oppSymbol, playerSymbol, game.difficulty)
            if (botCell < 0) return
            game.board[botCell] = oppSymbol
            const botWinner = checkTTTWinner(game.board)
            if (botWinner) {
              game.status = 'done'
              ws.send(JSON.stringify({ type: 'game:move', board: game.board, cell: botCell, symbol: oppSymbol, currentTurn: playerSymbol }))
              const result = botWinner === 'draw' ? 'draw' : 'loss'
              ws.send(JSON.stringify({ type: 'game:over', board: game.board, winner: botWinner, result }))
              logGameResult(userId, 'Tic-Tac-Toe', result, 0, { opponent: 'bot', difficulty: game.difficulty })
              activeGames.delete(ws.gameId)
            } else {
              game.currentTurn = 0
              ws.send(JSON.stringify({ type: 'game:move', board: game.board, cell: botCell, symbol: oppSymbol, currentTurn: playerSymbol }))
            }
          }, botDelay(game.difficulty))
        } else if (!game.vsBot) {
          game.currentTurn = 1 - game.currentTurn
          const other = game.players[1 - pi]
          const moveMsg = JSON.stringify({ type: 'game:move', board: game.board, cell, symbol: playerSymbol, currentTurn: game.players[game.currentTurn].symbol })
          if (other?.ws.readyState === 1) other.ws.send(moveMsg)
        }
      }

      if (game.type === 'c4') {
        const pi = game.players.findIndex(p => p.userId === userId)
        if (pi !== game.currentTurn) return
        const { col } = data
        if (col < 0 || col >= C4_COLS || game.board[0][col] !== null) return
        const playerSymbol = game.players[pi].symbol
        const row = c4Drop(game.board, col, playerSymbol)
        const winner = checkC4Winner(game.board, row, col, playerSymbol)

        ws.send(JSON.stringify({ type: 'game:move', board: game.board, col, row, symbol: playerSymbol }))

        if (winner || c4ValidCols(game.board).length === 0) {
          game.status = 'done'
          const result = winner ? 'win' : 'draw'
          ws.send(JSON.stringify({ type: 'game:over', board: game.board, winner: winner ? playerSymbol : 'draw', result }))
          await logGameResult(userId, 'Connect 4', result, result === 'win' ? 10 : 0, { opponent: game.vsBot ? 'bot' : game.players[1-pi].username, difficulty: game.difficulty })
          activeGames.delete(ws.gameId)
          return
        }

        if (game.vsBot) {
          game.currentTurn = 1
          setTimeout(() => {
            if (game.status !== 'active') return
            const botCol = c4BotMove(game.board, game.botSymbol, playerSymbol, game.difficulty)
            if (botCol < 0) return
            const botRow = c4Drop(game.board, botCol, game.botSymbol)
            const botWon = checkC4Winner(game.board, botRow, botCol, game.botSymbol)
            ws.send(JSON.stringify({ type: 'game:move', board: game.board, col: botCol, row: botRow, symbol: game.botSymbol }))
            if (botWon || c4ValidCols(game.board).length === 0) {
              game.status = 'done'
              const result = botWon ? 'loss' : 'draw'
              ws.send(JSON.stringify({ type: 'game:over', board: game.board, winner: botWon ? game.botSymbol : 'draw', result }))
              logGameResult(userId, 'Connect 4', result, 0, { opponent: 'bot', difficulty: game.difficulty })
              activeGames.delete(ws.gameId)
            } else {
              game.currentTurn = 0
            }
          }, botDelay(game.difficulty))
        } else {
          game.currentTurn = 1 - game.currentTurn
          const other = game.players[1 - pi]
          if (other?.ws.readyState === 1) {
            other.ws.send(JSON.stringify({ type: 'game:move', board: game.board, col, row, symbol: playerSymbol }))
          }
        }
      }

      if (game.type === 'rps' && data.choice !== undefined) {
        const pi = game.players.findIndex(p => p.userId === userId)
        if (pi === -1) return

        if (game.vsBot) {
          const playerChoice = data.choice
          game.playerHistory = game.playerHistory || []
          game.playerHistory.push(playerChoice)
          setTimeout(() => {
            const botChoice = rpsBotChoice(game.playerHistory, game.difficulty)
            const result = rpsResult(playerChoice, botChoice)
            ws.send(JSON.stringify({ type: 'game:over', yourChoice: playerChoice, opponentChoice: botChoice, result, opponent: 'RankUpBot' }))
            logGameResult(userId, 'Rock-Paper-Scissors', result, result === 'win' ? 5 : 0, { opponent: 'bot', difficulty: game.difficulty })
          }, botDelay(game.difficulty))
        } else {
          if (game.players[pi].choice !== null) return
          game.players[pi].choice = data.choice
          ws.send(JSON.stringify({ type: 'game:waiting_opponent' }))
          if (game.players.every(p => p.choice !== null)) {
            const [p0, p1] = game.players
            const r0 = rpsResult(p0.choice, p1.choice)
            const r1 = rpsResult(p1.choice, p0.choice)
            p0.ws.send(JSON.stringify({ type: 'game:over', yourChoice: p0.choice, opponentChoice: p1.choice, result: r0 }))
            p1.ws.send(JSON.stringify({ type: 'game:over', yourChoice: p1.choice, opponentChoice: p0.choice, result: r1 }))
            game.players[0].choice = null; game.players[1].choice = null
          }
        }
      }
      return
    }

    // ─ Legacy TTT ───────────────────────────────────────────────────────────

    if (data.type === 'ttt_find_game') {
      const gameCode = data.gameCode
      if (waitingPlayers.has(gameCode)) {
        const { ws: player1, timer } = waitingPlayers.get(gameCode)
        if (timer) clearTimeout(timer)
        waitingPlayers.delete(gameCode)
        const gameId = `ttt_${gameCode}_${Date.now()}`
        const game = { id: gameId, type: 'ttt', board: makeTTTBoard(), players: [{ ws: player1, userId: player1.userId, username: player1.username, symbol: 'X' }, { ws, userId, username, symbol: 'O' }], currentTurn: 0, status: 'active', vsBot: false }
        activeGames.set(gameId, game)
        ws.gameId = gameId; player1.gameId = gameId
        const startMsg = (sym) => JSON.stringify({ type:'ttt_start', gameId, symbol:sym, board:game.board, currentTurn:'X', opponent:sym==='X'?username:player1.username })
        player1.send(startMsg('X')); ws.send(startMsg('O'))
      } else {
        const timer = setTimeout(() => {
          if (waitingPlayers.get(gameCode)?.ws === ws) ws.send(JSON.stringify({ type: 'game:bot_available', game: 'tictactoe' }))
        }, 10000)
        waitingPlayers.set(gameCode, { ws, timer })
        ws.send(JSON.stringify({ type: 'ttt_waiting', gameCode }))
      }
    }

    if (data.type === 'ttt_move') {
      const game = activeGames.get(ws.gameId)
      if (!game || game.type !== 'ttt' || game.status !== 'active') return
      const pi = game.players.findIndex(p => p.userId === userId)
      if (pi !== game.currentTurn) return
      const { cell } = data
      if (game.board[cell] !== null) return
      game.board[cell] = game.players[pi].symbol
      const winner = checkTTTWinner(game.board)
      if (winner) {
        game.status = 'done'
        game.players.forEach((p,i) => {
          const myResult = winner==='draw' ? 'draw' : (i===pi ? 'win' : 'loss')
          p.ws.send(JSON.stringify({ type:'ttt_end', board:game.board, winner, result:myResult }))
        })
        activeGames.delete(ws.gameId)
      } else {
        game.currentTurn = 1 - game.currentTurn
        const msg = JSON.stringify({ type:'ttt_move', board:game.board, cell, symbol:game.players[pi].symbol, currentTurn:game.players[game.currentTurn].symbol })
        game.players.forEach(p => { if (p.ws.readyState===1) p.ws.send(msg) })
      }
    }

    // ─ Legacy Connect 4 ─────────────────────────────────────────────────────

    if (data.type === 'c4_find_game') {
      const gameCode = data.gameCode
      if (waitingPlayers.has(gameCode)) {
        const { ws: player1, timer } = waitingPlayers.get(gameCode)
        if (timer) clearTimeout(timer)
        waitingPlayers.delete(gameCode)
        const gameId = `c4_${gameCode}_${Date.now()}`
        const game = { id: gameId, type: 'c4', board: makeC4Board(), players: [{ ws: player1, userId: player1.userId, username: player1.username, symbol: '1' }, { ws, userId, username, symbol: '2' }], currentTurn: 0, status: 'active', vsBot: false }
        activeGames.set(gameId, game)
        ws.gameId = gameId; player1.gameId = gameId
        player1.send(JSON.stringify({ type:'c4_start', gameId, symbol:'1', board:game.board, currentTurn:'1', opponent:username }))
        ws.send(JSON.stringify({ type:'c4_start', gameId, symbol:'2', board:game.board, currentTurn:'1', opponent:player1.username }))
      } else {
        const timer = setTimeout(() => {
          if (waitingPlayers.get(gameCode)?.ws === ws) ws.send(JSON.stringify({ type: 'game:bot_available', game: 'connect4' }))
        }, 10000)
        waitingPlayers.set(gameCode, { ws, timer })
        ws.send(JSON.stringify({ type: 'c4_waiting', gameCode }))
      }
    }

    if (data.type === 'c4_move') {
      const game = activeGames.get(ws.gameId)
      if (!game || game.type !== 'c4' || game.status !== 'active') return
      const pi = game.players.findIndex(p => p.userId === userId)
      if (pi !== game.currentTurn) return
      const { col } = data
      if (col < 0 || col >= C4_COLS || game.board[0][col] !== null) return
      const row = c4Drop(game.board, col, game.players[pi].symbol)
      const winner = checkC4Winner(game.board, row, col, game.players[pi].symbol)
      if (winner || c4ValidCols(game.board).length === 0) {
        game.status = 'done'
        game.players.forEach((p,i) => {
          const myResult = !winner ? 'draw' : (i===pi ? 'win' : 'loss')
          p.ws.send(JSON.stringify({ type:'c4_end', board:game.board, winner:winner?game.players[pi].symbol:'draw', result:myResult }))
        })
        activeGames.delete(ws.gameId)
      } else {
        game.currentTurn = 1 - game.currentTurn
        const msg = JSON.stringify({ type:'c4_move', board:game.board, col, row, symbol:game.players[pi].symbol, currentTurn:game.players[game.currentTurn].symbol })
        game.players.forEach(p => { if (p.ws.readyState===1) p.ws.send(msg) })
      }
    }

    // ─ Legacy RPS ────────────────────────────────────────────────────────────

    if (data.type === 'rps_find_game') {
      const gameCode = data.gameCode
      if (waitingPlayers.has(gameCode)) {
        const { ws: player1, timer } = waitingPlayers.get(gameCode)
        if (timer) clearTimeout(timer)
        waitingPlayers.delete(gameCode)
        const gameId = `rps_${gameCode}_${Date.now()}`
        const game = { id: gameId, type: 'rps', players: [{ ws: player1, userId: player1.userId, username: player1.username, choice: null }, { ws, userId, username, choice: null }], status: 'active', vsBot: false }
        activeGames.set(gameId, game)
        ws.gameId = gameId; player1.gameId = gameId
        player1.send(JSON.stringify({ type:'rps_start', gameId, opponent:username }))
        ws.send(JSON.stringify({ type:'rps_start', gameId, opponent:player1.username }))
      } else {
        const timer = setTimeout(() => {
          if (waitingPlayers.get(gameCode)?.ws === ws) ws.send(JSON.stringify({ type: 'game:bot_available', game: 'rps' }))
        }, 10000)
        waitingPlayers.set(gameCode, { ws, timer })
        ws.send(JSON.stringify({ type: 'rps_waiting', gameCode }))
      }
    }

    if (data.type === 'rps_choice') {
      const game = activeGames.get(ws.gameId)
      if (!game || game.type !== 'rps' || game.status !== 'active') return
      const pi = game.players.findIndex(p => p.userId === userId)
      if (pi === -1 || game.players[pi].choice !== null) return
      game.players[pi].choice = data.choice
      ws.send(JSON.stringify({ type: 'rps_waiting_opponent' }))
      if (game.players.every(p => p.choice !== null)) {
        const [p0, p1] = game.players
        const r0 = rpsResult(p0.choice, p1.choice)
        const r1 = rpsResult(p1.choice, p0.choice)
        p0.ws.send(JSON.stringify({ type:'rps_result', yourChoice:p0.choice, opponentChoice:p1.choice, result:r0 }))
        p1.ws.send(JSON.stringify({ type:'rps_result', yourChoice:p1.choice, opponentChoice:p0.choice, result:r1 }))
        game.players[0].choice = null; game.players[1].choice = null
      }
    }
  })

  ws.on('close', () => {
    if (ws.gameId) {
      const game = activeGames.get(ws.gameId)
      if (game && game.status === 'active') {
        game.status = 'abandoned'
        if (!game.vsBot) {
          game.players.forEach(p => {
            if (p.userId !== userId && p.ws.readyState === 1) {
              p.ws.send(JSON.stringify({ type: `${game.type}_opponent_left` }))
            }
          })
        }
        activeGames.delete(ws.gameId)
      }
    }
    for (const [code, entry] of waitingPlayers.entries()) {
      if (entry.ws === ws) {
        if (entry.timer) clearTimeout(entry.timer)
        waitingPlayers.delete(code)
      }
    }
  })
}
