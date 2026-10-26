CREATE TABLE watch_history (user_id TEXT NOT NULL REFERENCES accounts(id) ON DELETE CASCADE, series_id TEXT NOT NULL, episode_id TEXT NOT NULL, episode_number INTEGER NOT NULL, position REAL NOT NULL DEFAULT 0, completed INTEGER NOT NULL DEFAULT 0, updated_at INTEGER NOT NULL, PRIMARY KEY(user_id,series_id));
CREATE INDEX watch_history_user_date ON watch_history(user_id,updated_at);
