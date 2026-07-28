-- Friends
CREATE TABLE IF NOT EXISTS friends (
  id SERIAL PRIMARY KEY,
  requester_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
  addressee_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
  status VARCHAR(16) DEFAULT 'pending',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(requester_id, addressee_id)
);

-- Achievements
CREATE TABLE IF NOT EXISTS achievements (
  id SERIAL PRIMARY KEY,
  key VARCHAR(64) UNIQUE NOT NULL,
  name VARCHAR(128) NOT NULL,
  description TEXT NOT NULL,
  icon VARCHAR(8) NOT NULL,
  category VARCHAR(32) DEFAULT 'general'
);

CREATE TABLE IF NOT EXISTS user_achievements (
  id SERIAL PRIMARY KEY,
  user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
  achievement_key VARCHAR(64) REFERENCES achievements(key) ON DELETE CASCADE,
  earned_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(user_id, achievement_key)
);

-- Notifications
CREATE TABLE IF NOT EXISTS notifications (
  id SERIAL PRIMARY KEY,
  user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
  type VARCHAR(32) NOT NULL,
  content TEXT NOT NULL,
  link VARCHAR(255),
  read BOOLEAN DEFAULT FALSE,
  actor_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Seed achievements
INSERT INTO achievements (key, name, description, icon, category) VALUES
  ('first_game',       'First Blood',      'Play your first game',                  '🎮', 'games'),
  ('win_streak_3',     'Hat Trick',        'Win 3 games in a row',                  '🔥', 'games'),
  ('games_10',         'Veteran',          'Play 10 games total',                   '🏅', 'games'),
  ('games_50',         'Road Warrior',     'Play 50 games total',                   '🚀', 'games'),
  ('trivia_ace',       'Brain Blast',      'Score 90%+ in a trivia round',          '🧠', 'games'),
  ('tile_2048',        '2048 Master',      'Reach the 2048 tile',                   '🔢', 'games'),
  ('first_post',       'Voice of the Feed','Post something for the first time',     '📝', 'social'),
  ('posts_5',          'Storyteller',      'Make 5 posts',                          '📖', 'social'),
  ('first_friend',     'Not Alone',        'Add your first friend',                 '🤝', 'social'),
  ('friends_5',        'Squad Up',         'Have 5 friends',                        '👥', 'social'),
  ('messages_50',      'Chatterbox',       'Send 50 chat messages',                 '💬', 'social'),
  ('snake_500',        'Snake Charmer',    'Score 500+ in Snake',                   '🐍', 'games'),
  ('rps_win_5',        'Rock Solid',       'Win 5 Rock-Paper-Scissors matches',     '✊', 'games'),
  ('memory_perfect',   'Photographic',     'Complete Memory Match without a miss',  '🃏', 'games'),
  ('connect4_win',     'Connect Master',   'Win a game of Connect 4',               '🔴', 'games')
ON CONFLICT (key) DO NOTHING;
