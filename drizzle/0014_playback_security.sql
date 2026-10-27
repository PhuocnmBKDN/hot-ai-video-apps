CREATE TABLE playback_leases(actor TEXT NOT NULL,device TEXT NOT NULL,id TEXT NOT NULL UNIQUE,episode_id TEXT NOT NULL,session_hash TEXT NOT NULL,expires_at INTEGER NOT NULL,PRIMARY KEY(actor,device));
CREATE INDEX playback_actor_expiry ON playback_leases(actor,expires_at);
CREATE TABLE episode_hls(episode_id TEXT PRIMARY KEY NOT NULL,prefix TEXT NOT NULL,created_at INTEGER NOT NULL);
