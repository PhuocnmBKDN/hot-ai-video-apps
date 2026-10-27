CREATE TABLE videolink_imports (
 source_id TEXT PRIMARY KEY NOT NULL,
 series_id TEXT UNIQUE NOT NULL,
 variant TEXT NOT NULL,
 expected INTEGER NOT NULL,
 poster_sha256 TEXT,
 completed_at INTEGER,
 created_at INTEGER NOT NULL
);
CREATE TABLE videolink_episodes (
 series_id TEXT NOT NULL,
 number INTEGER NOT NULL,
 episode_id TEXT UNIQUE NOT NULL,
 sha256 TEXT NOT NULL,
 size INTEGER NOT NULL,
 PRIMARY KEY(series_id,number)
);
