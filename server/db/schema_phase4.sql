-- ── Phase 4 Schema ─────────────────────────────────────────────────────────

-- Age verification columns
ALTER TABLE users ADD COLUMN IF NOT EXISTS date_of_birth DATE DEFAULT NULL;
ALTER TABLE users ADD COLUMN IF NOT EXISTS age_verified BOOLEAN DEFAULT false;

-- Mute system
ALTER TABLE users ADD COLUMN IF NOT EXISTS muted_until TIMESTAMP DEFAULT NULL;
ALTER TABLE users ADD COLUMN IF NOT EXISTS mute_reason TEXT DEFAULT NULL;

-- Soft-ban system
ALTER TABLE users ADD COLUMN IF NOT EXISTS soft_banned BOOLEAN DEFAULT false;
ALTER TABLE users ADD COLUMN IF NOT EXISTS soft_ban_reason TEXT DEFAULT NULL;

-- Game modes
ALTER TABLE game_results ADD COLUMN IF NOT EXISTS mode VARCHAR(30) DEFAULT 'normal';
ALTER TABLE game_results ADD COLUMN IF NOT EXISTS difficulty VARCHAR(10) DEFAULT NULL;

-- User Settings
CREATE TABLE IF NOT EXISTS user_settings (
  user_id INTEGER PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
  theme VARCHAR(20) DEFAULT 'dark',
  accent_color VARCHAR(7) DEFAULT '#7c3aed',
  font_size VARCHAR(10) DEFAULT 'medium',
  compact_mode BOOLEAN DEFAULT false,
  show_online_status BOOLEAN DEFAULT true,
  sound_effects BOOLEAN DEFAULT true,
  sidebar_position VARCHAR(10) DEFAULT 'left',
  language VARCHAR(10) DEFAULT 'en',
  updated_at TIMESTAMP DEFAULT NOW()
);

-- Audit Logs
CREATE TABLE IF NOT EXISTS audit_logs (
  id SERIAL PRIMARY KEY,
  user_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
  username VARCHAR(50),
  action VARCHAR(100) NOT NULL,
  target_type VARCHAR(50),
  target_id INTEGER,
  details JSONB DEFAULT '{}',
  ip_address VARCHAR(45),
  user_agent TEXT,
  created_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS audit_logs_user_idx ON audit_logs(user_id);
CREATE INDEX IF NOT EXISTS audit_logs_action_idx ON audit_logs(action);
CREATE INDEX IF NOT EXISTS audit_logs_created_idx ON audit_logs(created_at DESC);

-- API Bans
CREATE TABLE IF NOT EXISTS api_bans (
  id SERIAL PRIMARY KEY,
  user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
  ip_address VARCHAR(45),
  reason TEXT NOT NULL,
  created_by INTEGER REFERENCES users(id),
  created_at TIMESTAMP DEFAULT NOW(),
  expires_at TIMESTAMP DEFAULT NULL
);

CREATE INDEX IF NOT EXISTS api_bans_user_idx ON api_bans(user_id);

-- ── 150+ New Trivia Questions ────────────────────────────────────────────────

INSERT INTO trivia_questions (question, option_a, option_b, option_c, option_d, correct_answer, category, difficulty) VALUES

-- FPS category
('Which game introduced the "battle royale" mode that popularized the genre?', 'PUBG', 'Fortnite', 'H1Z1', 'DayZ', 'c', 'fps', 'medium'),
('What is the maximum number of players in a standard PUBG match?', '50', '75', '100', '150', 'c', 'fps', 'easy'),
('In Counter-Strike, what does CT stand for?', 'Combat Team', 'Counter-Terrorists', 'Central Tactics', 'Critical Threat', 'b', 'fps', 'easy'),
('Which game features the "Wingsuit" traversal mechanic prominently?', 'Far Cry 5', 'Just Cause 3', 'Battlefield 4', 'Ghost Recon', 'b', 'fps', 'medium'),
('What year was the original Call of Duty released?', '2001', '2002', '2003', '2004', 'c', 'fps', 'medium'),
('In Halo, what species are the Covenant enemies?', 'Human-alien hybrids', 'A collection of alien races', 'A single alien species', 'Robots', 'b', 'fps', 'medium'),
('What is the name of the main protagonist in Doom (2016)?', 'Doom Slayer', 'Marine', 'Doomguy', 'Doom Hunter', 'a', 'fps', 'easy'),
('Which FPS introduced the "iron sights" aiming mechanic to mainstream gaming?', 'GoldenEye', 'Medal of Honor: Allied Assault', 'Call of Duty 2', 'Battlefield 1942', 'b', 'fps', 'hard'),
('What is the name of the anti-cheat system used in Valorant?', 'EasyAntiCheat', 'BattleEye', 'Vanguard', 'Fairfight', 'c', 'fps', 'medium'),
('In which game do players fight on the planet Reach?', 'Halo: Combat Evolved', 'Halo 3: ODST', 'Halo: Reach', 'Halo 4', 'c', 'fps', 'easy'),
('What does "AWP" stand for in Counter-Strike?', 'Automatic Weapon Platform', 'Arctic Warfare Police', 'Advanced Warfare Precision', 'Anti-Warfare Pistol', 'b', 'fps', 'medium'),
('Which studio developed Titanfall?', 'Infinity Ward', 'Respawn Entertainment', 'Bungie', 'Digital Illusions', 'b', 'fps', 'easy'),
('What is the headshot multiplier in most FPS games?', '1.5x', '2x', '2.5x', '3x', 'b', 'fps', 'medium'),
('Which FPS game popularized the killstreak reward system?', 'Battlefield 2', 'Call of Duty 4: Modern Warfare', 'Unreal Tournament', 'Quake', 'b', 'fps', 'medium'),
('In Apex Legends, how many players are in a standard squad?', '2', '3', '4', '5', 'b', 'fps', 'easy'),

-- RPG category
('In The Witcher 3, what is the name of Geralt''s adopted daughter figure?', 'Yennefer', 'Triss', 'Ciri', 'Shani', 'c', 'rpg', 'easy'),
('What is the term for the mechanic in RPGs where actions affect story outcomes?', 'Consequence system', 'Morality system', 'Karma system', 'Choice and consequence', 'd', 'rpg', 'medium'),
('Which RPG series features the "SPECIAL" attribute system?', 'Elder Scrolls', 'Mass Effect', 'Fallout', 'Dragon Age', 'c', 'rpg', 'easy'),
('In Dark Souls, what currency is also used as experience points?', 'Gold', 'Souls', 'Ember', 'Estus', 'b', 'rpg', 'easy'),
('What is the maximum level cap in the original Diablo 2?', '75', '85', '90', '99', 'd', 'rpg', 'hard'),
('Which Final Fantasy game introduced the Active Time Battle system?', 'Final Fantasy IV', 'Final Fantasy VI', 'Final Fantasy VII', 'Final Fantasy VIII', 'a', 'rpg', 'hard'),
('In Skyrim, what is the name of the main storyline faction the player joins?', 'The Companions', 'The College of Winterhold', 'The Blades', 'The Dawnguard', 'c', 'rpg', 'medium'),
('What does "JRPG" stand for?', 'Just Really Pretty Game', 'Japanese Role-Playing Game', 'Joystick RPG', 'Joint Role-Playing Game', 'b', 'rpg', 'easy'),
('In Elden Ring, who is the main boss of Leyndell?', 'Margit', 'Malenia', 'Morgott', 'Radahn', 'c', 'rpg', 'medium'),
('Which game coined the term "Loot Box" before it became mainstream?', 'Team Fortress 2', 'Battlefield Heroes', 'FIFA Ultimate Team', 'Counter-Strike GO', 'a', 'rpg', 'hard'),
('In Dragon Age: Origins, what is the darkspawn taint called?', 'The Blight', 'The Taint', 'The Corruption', 'The Fade', 'a', 'rpg', 'medium'),
('What is the main currency in most Monster Hunter games?', 'Gold', 'Zenny', 'Rupees', 'Coins', 'b', 'rpg', 'medium'),
('In Persona 5, what is the protagonist''s codename?', 'Joker', 'Fox', 'Ryuji', 'Crow', 'a', 'rpg', 'easy'),
('Which RPG features the "Nemesis System" for enemy AI?', 'Middle-earth: Shadow of Mordor', 'The Witcher 3', 'Assassin''s Creed', 'Dragon Age', 'a', 'rpg', 'easy'),
('In Path of Exile, what are the in-game currencies called?', 'Gold', 'Coins', 'Orbs', 'Shards', 'c', 'rpg', 'easy'),

-- Retro category
('What was the original name of Donkey Kong''s main character before he became Donkey Kong?', 'Jumpman', 'Mario', 'Super Jumper', 'Kong Man', 'a', 'retro', 'medium'),
('Which console was released first: Super Nintendo or Sega Genesis?', 'Super Nintendo', 'Sega Genesis', 'They released the same year', 'Neither came before the other', 'b', 'retro', 'medium'),
('What is the highest possible score in Pac-Man?', '999,990', '3,333,360', '1,000,000', '999,999', 'b', 'retro', 'hard'),
('Which game is widely credited as the first video game ever?', 'Pong', 'Spacewar!', 'Tennis for Two', 'OXO', 'c', 'retro', 'hard'),
('In the original Legend of Zelda, how many dungeons are in the first quest?', '6', '8', '9', '12', 'c', 'retro', 'medium'),
('What was the first game to feature a continue option?', 'Centipede', 'Tapper', 'Q*bert', 'Lunar Lander', 'b', 'retro', 'hard'),
('Which classic arcade game features a character named Q*bert?', 'Frogger', 'Q*bert', 'Pitfall!', 'Dig Dug', 'b', 'retro', 'easy'),
('What year was Space Invaders released?', '1976', '1977', '1978', '1979', 'c', 'retro', 'medium'),
('In the original Street Fighter II, how many playable characters were there?', '6', '8', '10', '12', 'b', 'retro', 'medium'),
('Which console featured the "Blast Processing" marketing claim?', 'Super Nintendo', 'Sega Genesis', 'Atari Jaguar', '3DO', 'b', 'retro', 'medium'),
('What is the name of the princess in the original Donkey Kong arcade game?', 'Pauline', 'Peach', 'Daisy', 'Rosalina', 'a', 'retro', 'medium'),
('Which game introduced the concept of "saving" progress in a cartridge?', 'Legend of Zelda', 'Final Fantasy', 'Dragon Quest', 'Metroid', 'a', 'retro', 'medium'),
('What was the first commercially successful home video game console?', 'Atari 2600', 'Magnavox Odyssey', 'Pong Home', 'Colecovision', 'a', 'retro', 'medium'),
('In which year did Nintendo release the original Game Boy?', '1987', '1988', '1989', '1990', 'c', 'retro', 'easy'),
('Which iconic game studio created the original Sonic the Hedgehog?', 'Sega', 'Sonic Team', 'Naughty Dog', 'Rare', 'b', 'retro', 'medium'),

-- Esports category
('Which game has the largest prize pool in esports history (The International)?', 'League of Legends', 'CS:GO', 'Dota 2', 'Fortnite', 'c', 'esports', 'easy'),
('What does "GG WP" mean in esports?', 'Good Game, Well Played', 'Great Game, Win Pending', 'Good Guy, Well Protected', 'Game Goes, We Play', 'a', 'esports', 'easy'),
('Which team won the first League of Legends World Championship?', 'Cloud9', 'SK Telecom T1', 'Fnatic', 'Team Solo Mid', 'c', 'esports', 'medium'),
('What is the name of the annual Dota 2 championship?', 'The Grand Finals', 'The International', 'The World Series', 'The Open Championship', 'b', 'esports', 'easy'),
('In competitive Starcraft, what race is known for "Zerg rush"?', 'Terran', 'Protoss', 'Zerg', 'Xel''Naga', 'c', 'esports', 'easy'),
('How many players are on each team in a standard League of Legends match?', '3', '4', '5', '6', 'c', 'esports', 'easy'),
('What does "meta" mean in esports?', 'Most Effective Tactics Available', 'Maximum Efficiency Tactical Advantage', 'Master Esports Training Academy', 'Minimum Effort To Achieve', 'a', 'esports', 'medium'),
('Which player is nicknamed "The God" in the Smash Bros community?', 'Mango', 'Armada', 'Mew2King', 'Hungrybox', 'a', 'esports', 'hard'),
('In Rocket League, how many players are on each team by default?', '2', '3', '4', '5', 'b', 'esports', 'easy'),
('Which Counter-Strike team is famous for the "coldzera two-tap jump shot"?', 'Astralis', 'Luminosity', 'NaVi', 'FaZe', 'b', 'esports', 'hard'),
('What is the highest rank in Valorant esports ladder?', 'Diamond', 'Immortal', 'Radiant', 'Ascendant', 'c', 'esports', 'easy'),
('Which city hosted the first official Overwatch League season?', 'Los Angeles', 'Seoul', 'New York', 'London', 'a', 'esports', 'medium'),
('In Fighting games, what does "Frame Data" refer to?', 'Game graphics quality', 'Timing measurements of attacks in animation frames', 'Player movement speed', 'Input lag measurement', 'b', 'esports', 'medium'),
('What is the term for quickly canceling an attack animation to do another?', 'Cancel', 'Chain combo', 'Combo extension', 'Super cancel', 'a', 'esports', 'medium'),
('How long is a standard round in CS:GO/CS2?', '1 minute 55 seconds', '2 minutes', '2 minutes 15 seconds', '1 minute 30 seconds', 'a', 'esports', 'medium'),

-- Mobile category
('Which mobile game features a bird launched from a slingshot?', 'Cut the Rope', 'Angry Birds', 'Where''s My Water', 'Fruit Ninja', 'b', 'mobile', 'easy'),
('What year was Clash of Clans released?', '2010', '2011', '2012', '2013', 'c', 'mobile', 'easy'),
('In Candy Crush, what is the maximum level as of the game''s early years?', '35', '65', '135', '500', 'd', 'mobile', 'hard'),
('Which mobile game uses the slogan "It''s a match!"?', 'Tinder', 'Clash Royale', 'Hearthstone', 'Pokemon GO', 'c', 'mobile', 'hard'),
('What is the most downloaded mobile game of all time (as of 2023)?', 'PUBG Mobile', 'Subway Surfers', 'Temple Run', 'Candy Crush', 'b', 'mobile', 'medium'),
('In Pokemon GO, what do you use to catch Pokemon?', 'Pokeballs', 'Berries', 'Poke Lure', 'Incense', 'a', 'mobile', 'easy'),
('Which company developed Clash Royale?', 'King', 'Supercell', 'Kabam', 'Gameloft', 'b', 'mobile', 'easy'),
('What is the term for spending real money on in-game items in mobile games?', 'Microtransactions', 'Digital spending', 'Game purchases', 'Token spending', 'a', 'mobile', 'easy'),
('In Among Us, how many impostors are there in a standard 10-player game?', '1', '2', '3', 'It varies', 'b', 'mobile', 'easy'),
('What platform did Genshin Impact NOT launch on originally?', 'iOS', 'Android', 'Nintendo Switch', 'PC', 'c', 'mobile', 'medium'),
('Which mobile game features the character "Brawl Stars"?', 'Clash Royale', 'Supercell', 'Brawl Stars itself', 'Boom Beach', 'c', 'mobile', 'easy'),
('What type of game is "Alto''s Adventure"?', 'Match-3 puzzle', 'Endless runner', 'Tower defense', 'Battle royale', 'b', 'mobile', 'easy'),
('In Royal Match, what is the main gameplay mechanic?', 'Tower defense', 'Match-3 puzzle', 'Card strategy', 'City building', 'b', 'mobile', 'easy'),
('Which mobile game had a crossover with "the real world" using GPS/maps?', 'Ingress', 'Pokemon GO', 'Jurassic World Alive', 'Walking Dead: Our World', 'b', 'mobile', 'easy'),
('What year was Fortnite Mobile released?', '2017', '2018', '2019', '2020', 'b', 'mobile', 'medium'),

-- General (additional)
('What does "FPS" stand for in gaming performance context?', 'First Person Shooter', 'Frames Per Second', 'Fast Processor Speed', 'Frame Processing System', 'b', 'general', 'easy'),
('What is "input lag" in gaming?', 'Delay between controller input and on-screen response', 'The time to load a game', 'Network packet loss', 'Frame rate drops', 'a', 'general', 'easy'),
('Which gaming company owns the IP for "The Last of Us"?', 'Microsoft', 'Naughty Dog / Sony', 'Electronic Arts', 'Activision', 'b', 'general', 'easy'),
('What does "DLC" stand for?', 'Digital Level Content', 'Downloadable Content', 'Dedicated Live Content', 'Disc Level Content', 'b', 'general', 'easy'),
('What is a "speedrun"?', 'Playing a game at max difficulty', 'Completing a game as fast as possible', 'Rushing multiplayer matches', 'A special game mode', 'b', 'general', 'easy'),
('What does "P2W" mean in gaming?', 'Player to Win', 'Pay to Win', 'Power to Win', 'Play to Win', 'b', 'general', 'easy'),
('In gaming, what is a "softlock"?', 'A save file that blocks progress', 'A game state where progress is impossible without restarting', 'A locked difficulty mode', 'An anti-cheat lockout', 'b', 'general', 'medium'),
('What does "RNG" stand for in gaming?', 'Random Number Generator', 'Rage and Greed', 'Rotational Number Game', 'Random Nerfed Gear', 'a', 'general', 'easy'),
('Which game engine powers games like PUBG and Fortnite?', 'Unity', 'Unreal Engine', 'CryEngine', 'Frostbite', 'b', 'general', 'medium'),
('What is a "No Hitter" achievement typically called in gaming?', 'Deathless run', 'Perfect run', 'No-hit run', 'Flawless victory', 'c', 'general', 'medium'),
('Which company created the PlayStation console?', 'Microsoft', 'Nintendo', 'Sony', 'Sega', 'c', 'general', 'easy'),
('What is "latency" in online gaming?', 'Graphics quality', 'Network delay in milliseconds', 'Frame rate', 'Audio delay', 'b', 'general', 'easy'),
('In gaming, what does "buff" mean?', 'To make something weaker', 'To make something stronger', 'To add a new feature', 'To remove a character', 'b', 'general', 'easy'),
('What is "teabagging" in gaming slang?', 'Making tea while gaming', 'Crouching repeatedly over a defeated enemy', 'A type of in-game item', 'Camping in one spot', 'b', 'general', 'easy'),
('Which company developed the Xbox console?', 'Apple', 'Microsoft', 'Sony', 'Google', 'b', 'general', 'easy'),
('What is "AFK" short for in gaming?', 'A Familiar Kill', 'Away From Keyboard', 'After First Kill', 'Actively Fighting Killers', 'b', 'general', 'easy'),
('What does "WASD" refer to in PC gaming?', 'A gaming organization', 'Keyboard movement keys', 'A type of controller', 'A game title', 'b', 'general', 'easy'),
('In gaming, what is "grinding"?', 'Performing a skateboard trick', 'Repetitively playing to earn resources or levels', 'Playing at maximum difficulty', 'Cheating using exploits', 'b', 'general', 'easy'),
('What is a "hitbox" in gaming?', 'A loot container', 'The invisible collision area that registers hits', 'A melee weapon type', 'A game mode arena', 'b', 'general', 'medium'),
('What does "nerfed" mean in game balance context?', 'Made more powerful', 'Made weaker or less effective', 'Added new features', 'Removed from the game', 'b', 'general', 'easy'),
('Which gaming event is known as "the Olympics of esports"?', 'The International', 'World Cyber Games', 'ESL One', 'Intel Extreme Masters', 'b', 'general', 'medium'),
('What is "FOV" in gaming?', 'Frame of View', 'Field of View', 'Focus of Vision', 'Field of Vantage', 'b', 'general', 'easy'),
('What gaming genre is "Among Us"?', 'Battle Royale', 'Social Deduction', 'Tower Defense', 'Real-Time Strategy', 'b', 'general', 'easy'),
('Which company made the GameCube console?', 'Sega', 'Sony', 'Nintendo', 'Microsoft', 'c', 'general', 'easy'),
('In gaming, what is a "permadeath" mode?', 'Infinite respawns', 'One life only — death ends the run', 'Respawning with penalty', 'Auto-save disabled', 'b', 'general', 'easy')

ON CONFLICT DO NOTHING;
