import { api } from '../api.js'
import { avatar } from '../app.js'

const GAMES = [
  { label: 'All Games',           key: null },
  { label: 'Tic-Tac-Toe',        key: 'Tic-Tac-Toe' },
  { label: 'Connect 4',          key: 'Connect 4' },
  { label: 'Rock Paper Scissors',key: 'Rock Paper Scissors' },
  { label: 'Snake',              key: 'Snake' },
  { label: '2048',               key: '2048' },
  { label: 'Memory Match',       key: 'Memory Match' },
  { label: 'Gaming Trivia',      key: 'Gaming Trivia' },
  { label: 'GameWord',           key: 'GameWord' },
]

const GAME_ICONS = {
  null:                   '🏆',
  'Tic-Tac-Toe':         '✕',
  'Connect 4':           '🔴',
  'Rock Paper Scissors': '✊',
  'Snake':               '🐍',
  '2048':                '🔢',
  'Memory Match':        '🃏',
  'Gaming Trivia':       '❓',
  'GameWord':            '🔤',
}

export async function renderLeaderboard(container) {
  container.innerHTML = `
    <div class="page-header">
      <h1 class="page-title"><i class="bi bi-trophy-fill"></i> Leaderboard</h1>
    </div>

    <div class="lb-page-container">
      <div class="lb-tabs-wrap" id="lb-tabs" role="tablist">
        ${GAMES.map((g, i) => `
          <button class="lb-tab-btn${i === 0 ? ' active' : ''}" data-idx="${i}"
            role="tab" aria-selected="${i === 0}" title="${g.label}">
            ${GAME_ICONS[g.key] ? `<span style="font-size:13px">${GAME_ICONS[g.key]}</span>` : ''}
            ${g.label}
          </button>
        `).join('')}
      </div>

      <div id="lb-content">
        <div class="state-container"><div class="spinner"></div></div>
      </div>
    </div>
  `

  const content = container.querySelector('#lb-content')
  let activeIdx = 0

  const switchTab = async (idx) => {
    if (idx === activeIdx && idx !== 0) return
    activeIdx = idx
    container.querySelectorAll('.lb-tab-btn').forEach((b, i) => {
      b.classList.toggle('active', i === idx)
      b.setAttribute('aria-selected', i === idx)
    })
    await loadLeaderboard(content, GAMES[idx].key, GAMES[idx].label)
  }

  container.querySelector('#lb-tabs').addEventListener('click', e => {
    const btn = e.target.closest('.lb-tab-btn')
    if (btn) switchTab(Number(btn.dataset.idx))
  })

  await loadLeaderboard(content, null, 'All Games')
}

async function loadLeaderboard(el, gameKey, gameLabel) {
  el.innerHTML = `<div class="state-container"><div class="spinner"></div></div>`

  try {
    const url = gameKey
      ? `/leaderboard/game/${encodeURIComponent(gameKey)}`
      : '/leaderboard/global'

    const { leaderboard } = await api.get(url)

    if (!leaderboard?.length) {
      el.innerHTML = `
        <div class="card">
          <div class="state-container" style="padding:56px 20px">
            <div class="state-icon">${GAME_ICONS[gameKey] || '🏆'}</div>
            <p class="state-title">No rankings yet${gameKey ? ` for ${gameLabel}` : ''}</p>
            <p class="state-desc">Play some games to appear here. You need at least 3 games played to qualify.</p>
          </div>
        </div>
      `
      return
    }

    // Columns: rank | player | wins | games | win rate | best score
    el.innerHTML = `
      <div class="lb-table">
        <div class="lb-table-header">
          <span>Rank</span>
          <span>Player</span>
          <span style="text-align:right">Wins</span>
          <span style="text-align:right">Games</span>
          <span style="text-align:right">Win Rate</span>
          <span style="text-align:right">Best Score</span>
        </div>

        ${leaderboard.map((row, i) => {
          const rank = i + 1
          const rankClass = rank === 1 ? 'rank-1' : rank === 2 ? 'rank-2' : rank === 3 ? 'rank-3' : ''
          const medal = rank === 1 ? '🥇' : rank === 2 ? '🥈' : rank === 3 ? '🥉' : null

          return `
            <div class="lb-table-row ${rankClass}">
              <div style="display:flex;align-items:center;justify-content:center">
                ${medal
                  ? `<div class="lb-medal">${medal}</div>`
                  : `<span class="lb-rank-num">${rank}</span>`
                }
              </div>

              <div class="lb-user-cell">
                ${avatar(row.avatar_url, row.username, 'avatar-sm')}
                <div style="min-width:0">
                  <div class="lb-username">${row.username}</div>
                  ${row.platform ? `<div style="font-size:10.5px;color:var(--text-3);line-height:1">${row.platform}</div>` : ''}
                </div>
              </div>

              <div class="lb-stat lb-wins">${row.wins ?? 0}</div>
              <div class="lb-games-count">${row.total_games ?? 0}</div>
              <div class="lb-stat lb-wr">${row.win_rate != null ? row.win_rate + '%' : '—'}</div>
              <div class="lb-stat lb-score">${row.best_score != null ? Number(row.best_score).toLocaleString() : '—'}</div>
            </div>
          `
        }).join('')}
      </div>

      <p style="text-align:center;margin-top:12px;font-size:12px;color:var(--text-3)">
        Showing top ${leaderboard.length} player${leaderboard.length !== 1 ? 's' : ''}
        ${gameKey ? `for ${gameLabel}` : 'across all games'}
        · Minimum 3 games required
      </p>
    `
  } catch {
    el.innerHTML = `
      <div class="card">
        <div class="state-container"><p class="state-desc">Failed to load leaderboard. Please try again.</p></div>
      </div>
    `
  }
}
