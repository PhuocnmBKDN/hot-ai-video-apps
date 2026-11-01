ALTER TABLE series ADD COLUMN public_share_id TEXT;
UPDATE series SET public_share_id=lower(hex(randomblob(12))) WHERE public_share_id IS NULL;
CREATE UNIQUE INDEX series_public_share_id ON series(public_share_id);
CREATE TRIGGER series_assign_public_share AFTER INSERT ON series WHEN NEW.public_share_id IS NULL BEGIN
 UPDATE series SET public_share_id=lower(hex(randomblob(12))) WHERE id=NEW.id;
END;
UPDATE settings SET value=CAST(value AS INTEGER)+1 WHERE key='catalog_revision';
