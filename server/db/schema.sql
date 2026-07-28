-- Users
CREATE TABLE IF NOT EXISTS users (
  id SERIAL PRIMARY KEY,
  username VARCHAR(32) UNIQUE NOT NULL,
  email VARCHAR(255) UNIQUE NOT NULL,
  password_hash VARCHAR(255),
  avatar_url TEXT DEFAULT 'https://api.dicebear.com/7.x/avataaars/svg?seed=default',
  bio TEXT DEFAULT '',
  favorite_games TEXT[] DEFAULT '{}',
  platform VARCHAR(32) DEFAULT 'PC',
  replit_id VARCHAR(255) UNIQUE,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Posts
CREATE TABLE IF NOT EXISTS posts (
  id SERIAL PRIMARY KEY,
  user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
  content TEXT NOT NULL,
  image_url TEXT,
  tags TEXT[] DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Comments
CREATE TABLE IF NOT EXISTS comments (
  id SERIAL PRIMARY KEY,
  post_id INTEGER REFERENCES posts(id) ON DELETE CASCADE,
  user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
  content TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Likes
CREATE TABLE IF NOT EXISTS likes (
  id SERIAL PRIMARY KEY,
  post_id INTEGER REFERENCES posts(id) ON DELETE CASCADE,
  user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
  UNIQUE(post_id, user_id)
);

-- Chat Rooms
CREATE TABLE IF NOT EXISTS chat_rooms (
  id SERIAL PRIMARY KEY,
  name VARCHAR(64) UNIQUE NOT NULL,
  description TEXT DEFAULT '',
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Chat Messages
CREATE TABLE IF NOT EXISTS chat_messages (
  id SERIAL PRIMARY KEY,
  room_id INTEGER REFERENCES chat_rooms(id) ON DELETE CASCADE,
  sender_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
  recipient_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
  content TEXT NOT NULL,
  is_dm BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Game Results
CREATE TABLE IF NOT EXISTS game_results (
  id SERIAL PRIMARY KEY,
  user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
  game_name VARCHAR(64) NOT NULL,
  result VARCHAR(16) NOT NULL,
  score INTEGER DEFAULT 0,
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Reports
CREATE TABLE IF NOT EXISTS reports (
  id SERIAL PRIMARY KEY,
  reporter_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
  target_type VARCHAR(32) NOT NULL,
  target_id INTEGER NOT NULL,
  reason TEXT NOT NULL,
  resolved BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Blocks
CREATE TABLE IF NOT EXISTS blocks (
  id SERIAL PRIMARY KEY,
  blocker_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
  blocked_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(blocker_id, blocked_id)
);

-- Trivia Questions
CREATE TABLE IF NOT EXISTS trivia_questions (
  id SERIAL PRIMARY KEY,
  question TEXT NOT NULL,
  option_a TEXT NOT NULL,
  option_b TEXT NOT NULL,
  option_c TEXT NOT NULL,
  option_d TEXT NOT NULL,
  correct_answer CHAR(1) NOT NULL,
  category VARCHAR(64) DEFAULT 'General',
  difficulty VARCHAR(16) DEFAULT 'medium'
);

-- Seed default chat rooms
INSERT INTO chat_rooms (name, description) VALUES
  ('general', 'Talk about anything gaming related'),
  ('looking-for-group', 'Find teammates and game partners'),
  ('off-topic', 'Chill out and chat about anything')
ON CONFLICT (name) DO NOTHING;

-- Seed trivia questions
INSERT INTO trivia_questions (question, option_a, option_b, option_c, option_d, correct_answer, category, difficulty) VALUES
('What year was the original PlayStation released in Japan?','1992','1993','1994','1995','c','History','easy'),
('Which game features a character named Master Chief?','Halo','Call of Duty','Battlefield','Gears of War','a','FPS','easy'),
('What is the best-selling video game of all time (standalone)?','Grand Theft Auto V','Minecraft','Tetris','Wii Sports','b','General','medium'),
('In which game do you play as a plumber rescuing a princess?','Donkey Kong','Super Mario Bros','Kirby','Yoshi','b','Classic','easy'),
('What gaming company made The Witcher 3?','Bethesda','CD Projekt Red','BioWare','Obsidian','b','RPG','easy'),
('Which game popularized the battle royale genre in 2017?','Fortnite','PUBG','Apex Legends','Warzone','b','Battle Royale','medium'),
('What does RPG stand for?','Real Player Game','Role Playing Game','Rapid Play Genre','Random Progression Game','b','General','easy'),
('Which franchise features the characters Pikachu and Charizard?','Digimon','Yu-Gi-Oh','Pokemon','Monster Hunter','c','Classic','easy'),
('What is the in-game currency called in Fortnite?','V-Bucks','Gold','Coins','Credits','a','Battle Royale','easy'),
('Which company created the Doom franchise?','Valve','id Software','Bungie','Epic Games','b','FPS','medium'),
('What game engine powers Minecraft?','Unity','Unreal','Custom Java engine','CryEngine','c','General','hard'),
('In Dark Souls, what do you lose when you die?','Health','Weapons','Souls','All equipment','c','RPG','easy'),
('Which game is known for its "Fatality" finishing moves?','Street Fighter','Tekken','Mortal Kombat','Injustice','c','Fighting','easy'),
('What year was World of Warcraft first released?','2001','2002','2003','2004','d','MMO','medium'),
('Which console introduced motion controls to the mainstream?','PlayStation 3','Xbox 360','Wii','GameCube','c','Hardware','easy'),
('What is the max level cap in the original Diablo?','30','50','99','100','c','RPG','hard'),
('GTA V is set in which fictional city?','Vice City','Liberty City','San Andreas / Los Santos','Carcer City','c','Open World','easy'),
('Which game popularized the MOBA genre?','Warcraft 3 DotA mod','League of Legends','Heroes of the Storm','Smite','a','MOBA','medium'),
('What is the name of Link''s home village in Ocarina of Time?','Hyrule Village','Kokiri Forest','Kakariko Village','Death Mountain','b','RPG','medium'),
('In chess-inspired game Teamfight Tactics, what are units placed on?','Board','Hex grid','Square grid','Arena','b','Strategy','medium'),
('Which battle royale game is made by Respawn Entertainment?','Fortnite','PUBG','Apex Legends','Warzone','c','Battle Royale','easy'),
('What does FPS stand for in gaming?','Fast Play Simulator','Frames Per Second / First Person Shooter','Full Polygon Scene','Forward Player System','b','General','easy'),
('Which game has the catchphrase "War. War never changes."?','Doom','Wolfenstein','Fallout','Bioshock','c','RPG','easy'),
('Who is the main villain in the original Super Mario Bros?','Wario','Bowser','Kamek','Donkey Kong','b','Classic','easy'),
('What card game was Hearthstone based on?','Magic: The Gathering','Yu-Gi-Oh','Pokémon TCG','Warcraft TCG (Wow lore)','d','Card Games','hard'),
('Which studio developed Red Dead Redemption 2?','Ubisoft','Rockstar Games','Naughty Dog','Insomniac','b','Open World','easy'),
('In Minecraft, what material is required to craft a Nether Portal?','Gold','Diamond','Obsidian','Bedrock','c','Survival','easy'),
('What fighting game features characters from multiple Nintendo franchises?','Street Fighter X Nintendo','Super Smash Bros','Nintendo Fighters','Mario Combat','b','Fighting','easy'),
('Which game series features the Spartan race of warriors in a sci-fi setting?','Gears of War','Halo','Mass Effect','Destiny','b','FPS','easy'),
('What is the highest tier rank called in most competitive games?','Diamond','Master','Grandmaster','Radiant / Challenger (varies)','d','Competitive','medium'),
('Which company developed Fortnite?','Blizzard','Epic Games','Valve','Riot Games','b','Battle Royale','easy'),
('What is the name of the open world in The Legend of Zelda: Breath of the Wild?','Hyrule','Termina','Holodrum','Koholint','a','RPG','easy'),
('Overwatch is developed by which company?','Riot Games','Valve','Blizzard Entertainment','Bungie','c','FPS','easy'),
('What does MMORPG stand for?','Massive Multiplayer Online Role Playing Game','Mostly Mobile Online Realistic Play Game','Multi Mode Online Racing and Play Game','Major Multiplayer Organized RPG','a','General','medium'),
('In Among Us, what are the non-Impostors called?','Survivors','Crewmates','Innocents','Players','b','Social','easy'),
('Which game features a character named Kratos?','Dante''s Inferno','Bayonetta','God of War','Darksiders','c','Action','easy'),
('What is the name of the city in Cyberpunk 2077?','Neo Tokyo','Night City','Future Haven','Neon District','b','RPG','easy'),
('Which company created Valorant?','Blizzard','Ubisoft','Riot Games','Valve','c','FPS','easy'),
('In which year was the Nintendo Switch released?','2015','2016','2017','2018','c','Hardware','easy'),
('What is the term for when a player eliminates all opponents in a battle royale?','Clean Sweep','Victory Royale / Chicken Dinner (varies)','Final Kill','Solo Wipe','b','Battle Royale','medium'),
('Which stealth game series features agent 47?','Splinter Cell','Dishonored','Hitman','Deus Ex','c','Stealth','easy'),
('What is the maximum number of players in a standard Minecraft server (vanilla)?','100','No hard limit','20','50','b','Survival','hard'),
('In Stardew Valley, what do you inherit at the start of the game?','A bakery','A mine','A farm','A fishing boat','c','Simulation','easy'),
('Which rhythm game uses colored tiles falling to music?','Guitar Hero','Just Dance','Beat Saber','osu!','c','Rhythm','medium'),
('What Pokemon has the Pokedex number 001?','Pikachu','Eevee','Bulbasaur','Charmander','c','Classic','easy'),
('Which game is set on the planet Pandora and features procedurally generated loot?','No Man''s Sky','Borderlands','Destiny','Outer Worlds','b','Shooter','easy'),
('In competitive FPS, what does "flick shot" mean?','Shooting while moving','Quickly snapping aim to a target','Spray and pray','Shooting through walls','b','FPS','medium'),
('What is a "GG" in gaming?','Get Going','Good Game','Gank and Go','Guard and Go','b','General','easy'),
('Which game popularized the "soulslike" genre?','Dark Souls','Hollow Knight','Demon''s Souls','Bloodborne','c','RPG','medium'),
('What does "ping" refer to in online gaming?','Player rank','Network latency in milliseconds','A special attack','In-game map marker','b','General','easy')
ON CONFLICT DO NOTHING;
