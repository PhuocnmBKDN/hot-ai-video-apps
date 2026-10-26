ALTER TABLE series ADD COLUMN paid_from integer NOT NULL DEFAULT 2;
UPDATE series SET paid_from=max(1,CAST(total/4 AS INTEGER))+1;
CREATE TRIGGER series_paywall_time AFTER UPDATE OF paid_from ON series BEGIN UPDATE series SET updated_at=CAST(unixepoch('subsec')*1000 AS INTEGER) WHERE id=NEW.id; END;
