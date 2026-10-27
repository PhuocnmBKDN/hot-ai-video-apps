CREATE INDEX IF NOT EXISTS wallet_user_date ON wallet_ledger(user_id,created_at DESC);
CREATE INDEX IF NOT EXISTS deposits_user_date ON deposits(user_id,created_at DESC);
CREATE INDEX IF NOT EXISTS orders_user_date ON orders(user_id,created_at DESC);
CREATE INDEX IF NOT EXISTS orders_paid_series_date ON orders(status,series_id,created_at);
