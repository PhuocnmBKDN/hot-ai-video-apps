-- Artwork identity must survive unrelated film edits and episode uploads.
ALTER TABLE series ADD COLUMN artwork_version INTEGER NOT NULL DEFAULT 1;
CREATE TRIGGER artwork_insert AFTER INSERT ON settings
WHEN NEW.key LIKE 'poster:%' OR NEW.key LIKE 'preview:%' BEGIN
 UPDATE series SET artwork_version=artwork_version+1 WHERE id=CASE WHEN NEW.key LIKE 'poster:frame:%' THEN substr(NEW.key,14) ELSE substr(NEW.key,instr(NEW.key,':')+1) END;
END;
CREATE TRIGGER artwork_update AFTER UPDATE OF value ON settings
WHEN NEW.key LIKE 'poster:%' OR NEW.key LIKE 'preview:%' BEGIN
 UPDATE series SET artwork_version=artwork_version+1 WHERE id=CASE WHEN NEW.key LIKE 'poster:frame:%' THEN substr(NEW.key,14) ELSE substr(NEW.key,instr(NEW.key,':')+1) END;
END;
CREATE TRIGGER artwork_delete AFTER DELETE ON settings
WHEN OLD.key LIKE 'poster:%' OR OLD.key LIKE 'preview:%' BEGIN
 UPDATE series SET artwork_version=artwork_version+1 WHERE id=CASE WHEN OLD.key LIKE 'poster:frame:%' THEN substr(OLD.key,14) ELSE substr(OLD.key,instr(OLD.key,':')+1) END;
END;
CREATE TRIGGER artwork_catalog AFTER UPDATE OF artwork_version ON series BEGIN
 UPDATE settings SET value=CAST(value AS INTEGER)+1 WHERE key='catalog_revision';
END;
CREATE INDEX watched_user_series ON watched_episodes(user_id,series_id);
ALTER TABLE series ADD COLUMN episode_count INTEGER NOT NULL DEFAULT 0;
UPDATE series SET episode_count=(SELECT count(*) FROM episodes WHERE series_id=series.id);
CREATE TRIGGER episode_count_insert AFTER INSERT ON episodes BEGIN
 UPDATE series SET episode_count=episode_count+1 WHERE id=NEW.series_id;
END;
CREATE TRIGGER episode_count_delete AFTER DELETE ON episodes BEGIN
 UPDATE series SET episode_count=max(0,episode_count-1) WHERE id=OLD.series_id;
END;
CREATE TRIGGER episode_count_move AFTER UPDATE OF series_id ON episodes WHEN OLD.series_id<>NEW.series_id BEGIN
 UPDATE series SET episode_count=max(0,episode_count-1) WHERE id=OLD.series_id;
 UPDATE series SET episode_count=episode_count+1 WHERE id=NEW.series_id;
END;
