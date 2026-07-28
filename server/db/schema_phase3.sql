-- ── Phase 3 Schema ─────────────────────────────────────────────────────────

-- Clans
CREATE TABLE IF NOT EXISTS clans (
  id SERIAL PRIMARY KEY,
  name VARCHAR(64) UNIQUE NOT NULL,
  description TEXT DEFAULT '',
  tag VARCHAR(5) UNIQUE NOT NULL,
  owner_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
  avatar_url TEXT DEFAULT '',
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Clan Members
CREATE TABLE IF NOT EXISTS clan_members (
  id SERIAL PRIMARY KEY,
  clan_id INTEGER REFERENCES clans(id) ON DELETE CASCADE,
  user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
  role VARCHAR(16) DEFAULT 'member' CHECK (role IN ('owner','admin','member')),
  joined_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(clan_id, user_id)
);

-- Clan Posts
CREATE TABLE IF NOT EXISTS clan_posts (
  id SERIAL PRIMARY KEY,
  clan_id INTEGER REFERENCES clans(id) ON DELETE CASCADE,
  user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
  content TEXT NOT NULL,
  image_url TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Clan Chat Messages
CREATE TABLE IF NOT EXISTS clan_chat_messages (
  id SERIAL PRIMARY KEY,
  clan_id INTEGER REFERENCES clans(id) ON DELETE CASCADE,
  user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
  content TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Admin Logs
CREATE TABLE IF NOT EXISTS admin_logs (
  id SERIAL PRIMARY KEY,
  admin_action TEXT NOT NULL,
  target_type VARCHAR(16),
  target_id INTEGER,
  notes TEXT DEFAULT '',
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Add ban columns to users if not present
ALTER TABLE users ADD COLUMN IF NOT EXISTS is_banned BOOLEAN DEFAULT FALSE;
ALTER TABLE users ADD COLUMN IF NOT EXISTS ban_reason TEXT;

-- Add status/notes columns to reports if not present
ALTER TABLE reports ADD COLUMN IF NOT EXISTS status VARCHAR(16) DEFAULT 'pending';
ALTER TABLE reports ADD COLUMN IF NOT EXISTS notes TEXT DEFAULT '';

-- Back-fill resolved → status
UPDATE reports SET status = CASE WHEN resolved THEN 'reviewed' ELSE 'pending' END WHERE status IS NULL;
