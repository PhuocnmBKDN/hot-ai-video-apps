ALTER TABLE series ADD COLUMN deleted_at integer;
CREATE TABLE media_cleanup (object_key text PRIMARY KEY NOT NULL);
