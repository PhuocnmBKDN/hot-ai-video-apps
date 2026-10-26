ALTER TABLE series ADD COLUMN updated_at integer;
CREATE TRIGGER series_edit_time AFTER UPDATE OF title,description,genre,total,published ON series BEGIN UPDATE series SET updated_at=CAST(unixepoch('subsec')*1000 AS INTEGER) WHERE id=NEW.id; END;
CREATE TRIGGER episode_edit_time AFTER INSERT ON episodes BEGIN UPDATE series SET updated_at=CAST(unixepoch('subsec')*1000 AS INTEGER) WHERE id=NEW.series_id; END;
CREATE TRIGGER poster_edit_time AFTER INSERT ON settings WHEN NEW.key LIKE 'poster:%' OR NEW.key LIKE 'price:%' BEGIN UPDATE series SET updated_at=CAST(unixepoch('subsec')*1000 AS INTEGER) WHERE id=substr(NEW.key,instr(NEW.key,':')+1); END;
CREATE TRIGGER poster_update_time AFTER UPDATE ON settings WHEN NEW.key LIKE 'poster:%' OR NEW.key LIKE 'price:%' BEGIN UPDATE series SET updated_at=CAST(unixepoch('subsec')*1000 AS INTEGER) WHERE id=substr(NEW.key,instr(NEW.key,':')+1); END;
