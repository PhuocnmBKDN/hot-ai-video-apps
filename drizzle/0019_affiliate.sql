CREATE TABLE IF NOT EXISTS affiliate_clicks (
 actor TEXT NOT NULL,
 series_id TEXT NOT NULL,
 rule_id TEXT NOT NULL,
 created_at INTEGER NOT NULL,
 PRIMARY KEY(actor,series_id,rule_id)
);
