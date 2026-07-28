# RankUp — Full API Reference

Base URL (dev): `http://localhost:3001`  
All endpoints are prefixed with `/api`.  
Auth = session cookie set on login.  
Admin Auth = `Authorization: Bearer <admin_jwt>` header.

---

## Authentication

| Method | URL | Auth | Description |
|--------|-----|------|-------------|
| POST | `/api/auth/register` | No | Register a new account. Body: `{ username, email, password }` |
| POST | `/api/auth/login` | No | Log in. Body: `{ identifier, password }` → sets session cookie |
| POST | `/api/auth/logout` | Yes | Destroy session |
| GET | `/api/auth/me` | Yes | Get the currently logged-in user |

---

## Users

| Method | URL | Auth | Description |
|--------|-----|------|-------------|
| GET | `/api/users/:id` | Yes | Get public profile of a user |
| PUT | `/api/users/me` | Yes | Update own profile. Body: `{ username?, avatar_url?, bio?, favorite_games?, platform? }` |
| GET | `/api/users/:id/clan` | Yes | Get the clan a specific user belongs to (null if none) |

---

## Posts (Community Feed)

| Method | URL | Auth | Description |
|--------|-----|------|-------------|
| GET | `/api/posts` | Yes | List posts. Query: `?tag=`, `?limit=`, `?offset=` |
| POST | `/api/posts` | Yes | Create a post. Body: `{ content, image_url?, tags? }` |
| DELETE | `/api/posts/:id` | Yes | Delete own post |
| POST | `/api/posts/:id/like` | Yes | Toggle like on a post |
| GET | `/api/posts/:id/comments` | Yes | Get comments on a post |
| POST | `/api/posts/:id/comments` | Yes | Add a comment. Body: `{ content }` |

---

## Chat

| Method | URL | Auth | Description |
|--------|-----|------|-------------|
| GET | `/api/chat/rooms` | Yes | List all chat rooms |
| GET | `/api/chat/rooms/:id/messages` | Yes | Get recent messages for a room |
| GET | `/api/chat/dm/:userId` | Yes | Get DM history with a user |

**WebSocket** — connect to `ws://<host>/ws?type=chat`

| Event (Client→Server) | Payload | Description |
|----------------------|---------|-------------|
| `chat:message` | `{ roomId, content }` | Send a message to a room |
| `chat:dm` | `{ recipientId, content }` | Send a direct message |

| Event (Server→Client) | Payload | Description |
|----------------------|---------|-------------|
| `chat:message` | `{ id, roomId, senderId, username, avatarUrl, content, createdAt }` | New room message broadcast |
| `chat:dm` | `{ id, senderId, recipientId, username, avatarUrl, content, createdAt }` | New DM |

---

## Games

| Method | URL | Auth | Description |
|--------|-----|------|-------------|
| POST | `/api/games/results` | Yes | Save a game result. Body: `{ game_name, result, score?, metadata? }` |
| GET | `/api/games/results` | Yes | Get own game history |
| GET | `/api/games/stats` | Yes | Get own aggregated game stats per game |

**WebSocket** — connect to `ws://<host>/ws?type=game`

| Event (Client→Server) | Payload | Description |
|----------------------|---------|-------------|
| `ttt_find_game` | `{ gameCode }` | Join / create a Tic-Tac-Toe room |
| `ttt_move` | `{ cell }` | Make a TTT move (0-8) |
| `c4_find_game` | `{ gameCode }` | Join / create a Connect 4 room |
| `c4_move` | `{ col }` | Drop a Connect 4 piece (0-6) |
| `rps_find_game` | `{ gameCode }` | Join / create an RPS room |
| `rps_choice` | `{ choice }` | Pick 0=Rock, 1=Paper, 2=Scissors |

| Event (Server→Client) | Description |
|----------------------|-------------|
| `ttt_waiting` | Waiting for opponent in that room |
| `ttt_start` | Game started — `{ gameId, symbol, board, currentTurn, opponent }` |
| `ttt_move` | Move made — `{ board, cell, symbol, currentTurn }` |
| `ttt_end` | Game over — `{ board, winner, result }` |
| `ttt_opponent_left` | Opponent disconnected |
| `c4_waiting` | Waiting for opponent |
| `c4_start` | Game started — `{ gameId, playerNum, board, currentTurn, opponent }` |
| `c4_move` | Move made — `{ board, col, playerNum, currentTurn }` |
| `c4_end` | Game over — `{ board, winner, result }` |
| `c4_opponent_left` | Opponent disconnected |
| `rps_waiting` | Waiting for opponent |
| `rps_start` | Game started — `{ gameId, opponent }` |
| `rps_waiting_opponent` | Your pick received, waiting for other player |
| `rps_result` | Round result — `{ yourChoice, opponentChoice, result }` |
| `rps_opponent_left` | Opponent disconnected |

---

## Friends

| Method | URL | Auth | Description |
|--------|-----|------|-------------|
| GET | `/api/friends` | Yes | List friends + pending requests (with direction: sent/received) |
| GET | `/api/friends/search?q=` | Yes | Search users by username |
| POST | `/api/friends/request` | Yes | Send a friend request. Body: `{ addressee_id }` |
| POST | `/api/friends/respond` | Yes | Accept or decline. Body: `{ requester_id, action: 'accept'|'decline' }` |
| DELETE | `/api/friends/:friendId` | Yes | Remove a friend |

---

## Leaderboard

| Method | URL | Auth | Description |
|--------|-----|------|-------------|
| GET | `/api/leaderboard` | Yes | Global leaderboard. Query: `?game=`, `?limit=`, `?offset=` |

---

## Notifications

| Method | URL | Auth | Description |
|--------|-----|------|-------------|
| GET | `/api/notifications` | Yes | Get notifications for current user |
| POST | `/api/notifications/read-all` | Yes | Mark all notifications as read |
| DELETE | `/api/notifications/:id` | Yes | Delete a notification |

---

## Achievements

| Method | URL | Auth | Description |
|--------|-----|------|-------------|
| GET | `/api/achievements` | Yes | List all achievements + which ones the user has earned |

---

## Moderation

| Method | URL | Auth | Description |
|--------|-----|------|-------------|
| POST | `/api/moderation/report` | Yes | Report content. Body: `{ target_type, target_id, reason }` |
| POST | `/api/moderation/block` | Yes | Block a user. Body: `{ blocked_id }` |
| DELETE | `/api/moderation/block/:id` | Yes | Unblock a user |
| GET | `/api/moderation/blocks` | Yes | List blocked users |

---

## Clans & Guilds

| Method | URL | Auth | Description |
|--------|-----|------|-------------|
| GET | `/api/clans` | Yes | List all clans. Query: `?search=`, `?tag=`, `?page=` |
| POST | `/api/clans` | Yes | Create a clan (max 1 owned per user, must not already be in a clan). Body: `{ name, description?, tag, avatar_url? }` |
| GET | `/api/clans/:id` | Yes | Clan detail + member list + recent 10 posts + caller's role |
| PATCH | `/api/clans/:id` | Yes (Owner/Admin) | Edit clan. Body: `{ name?, description?, tag?, avatar_url? }` |
| DELETE | `/api/clans/:id` | Yes (Owner) | Delete clan and all its content |
| POST | `/api/clans/:id/join` | Yes | Join a clan (must not be in any clan already) |
| POST | `/api/clans/:id/leave` | Yes | Leave a clan (owner cannot leave) |
| POST | `/api/clans/:id/members/:userId/promote` | Yes (Owner) | Promote member → admin |
| POST | `/api/clans/:id/members/:userId/demote` | Yes (Owner) | Demote admin → member |
| POST | `/api/clans/:id/members/:userId/kick` | Yes (Owner/Admin) | Remove a member from the clan |
| GET | `/api/clans/:id/posts` | Yes (Member) | Paginated clan feed. Query: `?page=` |
| POST | `/api/clans/:id/posts` | Yes (Member) | Create a clan post. Body: `{ content, image_url? }` |
| DELETE | `/api/clans/:id/posts/:postId` | Yes (Author or Owner/Admin) | Delete a clan post |
| GET | `/api/clans/:id/chat` | Yes (Member) | Get last 50 clan chat messages |

**WebSocket** — connect to `ws://<host>/ws?type=clan`

| Event (Client→Server) | Payload | Description |
|----------------------|---------|-------------|
| `clan:join` | `{ clanId }` | Subscribe to a clan's real-time chat |
| `clan:message` | `{ content }` | Send a message to the joined clan room |

| Event (Server→Client) | Payload | Description |
|----------------------|---------|-------------|
| `clan:joined` | `{ clanId }` | Confirmed subscription to the room |
| `clan:message` | `{ id, clanId, userId, username, avatarUrl, content, createdAt }` | New message broadcast to all room members |
| `clan:error` | `{ error }` | Not a member / invalid action |

---

## Admin

> All admin endpoints require `Authorization: Bearer <token>` where the token is obtained from `POST /api/admin/login`.  
> The token expires after **2 hours**.

### Auth

| Method | URL | Auth | Description |
|--------|-----|------|-------------|
| POST | `/api/admin/login` | None | Two-factor admin login. Body: `{ password, totpCode }` → `{ token, expiresIn }`. Rate-limited: 5 attempts per 15 min per IP |

### Dashboard

| Method | URL | Auth | Description |
|--------|-----|------|-------------|
| GET | `/api/admin/stats` | Admin | Total users, posts, games played, active users today, clans, pending reports |

### User Management

| Method | URL | Auth | Description |
|--------|-----|------|-------------|
| GET | `/api/admin/users` | Admin | Paginated user list. Query: `?search=`, `?banned=true/false`, `?page=` |
| GET | `/api/admin/users/:id` | Admin | Full profile: join date, post count, game stats, ban status, clan |
| POST | `/api/admin/users/:id/ban` | Admin | Ban a user. Body: `{ reason }` |
| POST | `/api/admin/users/:id/unban` | Admin | Unban a user |
| DELETE | `/api/admin/users/:id` | Admin | Permanently delete a user and all their content |

### Content Moderation

| Method | URL | Auth | Description |
|--------|-----|------|-------------|
| GET | `/api/admin/reports` | Admin | Paginated reports. Query: `?status=pending/reviewed/dismissed`, `?page=` |
| GET | `/api/admin/reports/:id` | Admin | Single report with full context (reported content + reporter info) |
| PATCH | `/api/admin/reports/:id` | Admin | Update report. Body: `{ status: 'pending'|'reviewed'|'dismissed', notes? }` |
| DELETE | `/api/admin/posts/:id` | Admin | Delete any post from the platform |
| DELETE | `/api/admin/clans/:id` | Admin | Delete any clan |

### Admin Logs

| Method | URL | Auth | Description |
|--------|-----|------|-------------|
| GET | `/api/admin/logs` | Admin | Paginated admin action log. Query: `?action=`, `?targetType=user/post/clan`, `?page=` |

---

## Pagination

All paginated endpoints return:

```json
{
  "data": [...],
  "total": 100,
  "page": 1,
  "totalPages": 5
}
```

The array key name matches the resource (e.g. `users`, `clans`, `posts`, `reports`, `logs`).

---

## Error format

```json
{ "error": "Human-readable message" }
```

HTTP status codes: `400` bad input · `401` not authenticated · `403` forbidden · `404` not found · `409` conflict · `429` rate limited · `500` server error
