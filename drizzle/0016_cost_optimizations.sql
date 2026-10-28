-- Derived balance; the immutable ledger remains the source of truth.
CREATE TABLE wallet_balances(user_id TEXT PRIMARY KEY NOT NULL,balance INTEGER NOT NULL DEFAULT 0);
INSERT INTO wallet_balances(user_id,balance) SELECT user_id,sum(amount) FROM wallet_ledger GROUP BY user_id;
CREATE TRIGGER wallet_balance_insert AFTER INSERT ON wallet_ledger BEGIN
 INSERT INTO wallet_balances(user_id,balance) VALUES(NEW.user_id,NEW.amount) ON CONFLICT(user_id) DO UPDATE SET balance=balance+NEW.amount;
END;
CREATE TRIGGER wallet_balance_delete AFTER DELETE ON wallet_ledger BEGIN
 UPDATE wallet_balances SET balance=balance-OLD.amount WHERE user_id=OLD.user_id;
END;
CREATE TRIGGER wallet_balance_update AFTER UPDATE OF amount,user_id ON wallet_ledger BEGIN
 UPDATE wallet_balances SET balance=balance-OLD.amount WHERE user_id=OLD.user_id;
 INSERT INTO wallet_balances(user_id,balance) VALUES(NEW.user_id,NEW.amount) ON CONFLICT(user_id) DO UPDATE SET balance=balance+NEW.amount;
END;
CREATE INDEX sessions_expiry ON sessions(expires_at);

-- Only non-personal catalog data is cached; version checks are always live.
INSERT INTO settings(key,value) VALUES('catalog_revision','0');
CREATE TRIGGER catalog_series_insert AFTER INSERT ON series BEGIN
 UPDATE settings SET value=CAST(value AS INTEGER)+1 WHERE key='catalog_revision';
END;
CREATE TRIGGER catalog_series_delete AFTER DELETE ON series BEGIN
 UPDATE settings SET value=CAST(value AS INTEGER)+1 WHERE key='catalog_revision';
END;
CREATE TRIGGER catalog_series_update AFTER UPDATE OF title,description,genre,total,published,paid_from,deleted_at,first_published_at ON series
 WHEN NEW.title IS NOT OLD.title OR NEW.description IS NOT OLD.description OR NEW.genre IS NOT OLD.genre OR NEW.total IS NOT OLD.total OR NEW.published IS NOT OLD.published OR NEW.paid_from IS NOT OLD.paid_from OR NEW.deleted_at IS NOT OLD.deleted_at OR NEW.first_published_at IS NOT OLD.first_published_at BEGIN
 UPDATE settings SET value=CAST(value AS INTEGER)+1 WHERE key='catalog_revision';
END;
CREATE TRIGGER catalog_episode_insert AFTER INSERT ON episodes BEGIN
 UPDATE settings SET value=CAST(value AS INTEGER)+1 WHERE key='catalog_revision';
END;
CREATE TRIGGER catalog_episode_delete AFTER DELETE ON episodes BEGIN
 UPDATE settings SET value=CAST(value AS INTEGER)+1 WHERE key='catalog_revision';
END;
CREATE TRIGGER catalog_episode_update AFTER UPDATE ON episodes BEGIN
 UPDATE settings SET value=CAST(value AS INTEGER)+1 WHERE key='catalog_revision';
END;
CREATE TRIGGER catalog_setting_insert AFTER INSERT ON settings
 WHEN NEW.key LIKE 'price:%' OR NEW.key LIKE 'poster:%' OR NEW.key IN ('genres','payment_recipient','qr') BEGIN
 UPDATE settings SET value=CAST(value AS INTEGER)+1 WHERE key='catalog_revision';
END;
CREATE TRIGGER catalog_setting_update AFTER UPDATE ON settings
 WHEN NEW.key LIKE 'poster:%' OR (NEW.value IS NOT OLD.value AND (NEW.key LIKE 'price:%' OR NEW.key IN ('genres','payment_recipient','qr'))) BEGIN
 UPDATE settings SET value=CAST(value AS INTEGER)+1 WHERE key='catalog_revision';
END;
CREATE TRIGGER catalog_setting_delete AFTER DELETE ON settings
 WHEN OLD.key LIKE 'price:%' OR OLD.key LIKE 'poster:%' OR OLD.key IN ('genres','payment_recipient','qr') BEGIN
 UPDATE settings SET value=CAST(value AS INTEGER)+1 WHERE key='catalog_revision';
END;
CREATE TRIGGER catalog_paid_order_insert AFTER INSERT ON orders WHEN NEW.status='paid' BEGIN
 UPDATE settings SET value=CAST(value AS INTEGER)+1 WHERE key='catalog_revision';
END;
CREATE TRIGGER catalog_paid_order_update AFTER UPDATE ON orders WHEN NEW.status='paid' OR OLD.status='paid' BEGIN
 UPDATE settings SET value=CAST(value AS INTEGER)+1 WHERE key='catalog_revision';
END;
CREATE TRIGGER catalog_paid_order_delete AFTER DELETE ON orders WHEN OLD.status='paid' BEGIN
 UPDATE settings SET value=CAST(value AS INTEGER)+1 WHERE key='catalog_revision';
END;
