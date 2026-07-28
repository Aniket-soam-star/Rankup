# RankUp

An all-in-one social platform for gamers — community feed, real-time chat, browser games, and personal stats. Think Discord meets a gaming community hub.

## Architecture

- **Frontend:** React + Vite + Tailwind CSS (in `/client`)
- **Backend:** Node.js + Express + WebSockets (`ws`) (in `/server`)
- **Database:** Replit PostgreSQL
- **Auth:** Custom session-based auth (express-session + connect-pg-simple)

## Running the app

Two workflows are needed:
1. **Server** — `node server/index.js` on port 3001
2. **Client** — `cd client && npm run dev` on port 5173 (dev proxy → server)

In production, run `cd client && npm run build` then `node server/index.js` which serves the built static files.

## User Preferences

- Dark theme with electric purple (#8B5CF6) accent
- Card-based layouts, clean modern typography
- Phase-based development: build Phase 1 fully before Phase 2
