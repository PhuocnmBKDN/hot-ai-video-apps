ALTER TABLE series ADD COLUMN first_published_at INTEGER;
ALTER TABLE series ADD COLUMN publication_seen INTEGER NOT NULL DEFAULT 0;
UPDATE series SET publication_seen=1 WHERE published=1;
CREATE TRIGGER series_first_publish AFTER UPDATE OF published ON series WHEN NEW.published=1 AND OLD.published=0 AND NEW.publication_seen=0 BEGIN UPDATE series SET first_published_at=CAST(unixepoch('subsec')*1000 AS INTEGER),publication_seen=1 WHERE id=NEW.id; END;
