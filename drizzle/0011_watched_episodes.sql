CREATE TABLE watched_episodes(user_id TEXT NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,episode_id TEXT NOT NULL,series_id TEXT NOT NULL,completed INTEGER NOT NULL DEFAULT 0,updated_at INTEGER NOT NULL,PRIMARY KEY(user_id,episode_id));
CREATE INDEX watched_episodes_user ON watched_episodes(user_id,series_id);
INSERT INTO watched_episodes(user_id,episode_id,series_id,completed,updated_at) SELECT user_id,episode_id,series_id,completed,updated_at FROM watch_history;
