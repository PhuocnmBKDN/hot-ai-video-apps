CREATE TABLE payment_codes (user_id text PRIMARY KEY NOT NULL, code text NOT NULL UNIQUE);
CREATE TABLE sepay_transactions (id text PRIMARY KEY NOT NULL, reference text UNIQUE, user_id text, amount integer NOT NULL, status text NOT NULL, created_at integer NOT NULL);
