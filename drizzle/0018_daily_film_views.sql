CREATE TABLE film_daily_views(series_id TEXT NOT NULL,day TEXT NOT NULL,views INTEGER NOT NULL DEFAULT 0,PRIMARY KEY(series_id,day));
CREATE INDEX film_daily_views_day ON film_daily_views(day);
