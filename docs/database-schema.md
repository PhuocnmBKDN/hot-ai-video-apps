# Database schema

The production database is Cloudflare D1/SQLite. Migrations `0000` through `0020` in `drizzle/` are the schema source of truth. All timestamps are Unix milliseconds unless stated otherwise; money is integer VND. Do not modify an applied migration.

## Core catalog

### `series`

Film metadata: `id` PK, `title`, `description`, comma-separated `genre`, historical `total`, `published`, `created_at`, `updated_at`, `paid_from`, soft-delete `deleted_at`, first-publication fields `first_published_at` and `publication_seen`, non-negative `view_count`, and source-independent unique `public_share_id`.

Important behavior:

- A trigger assigns a 24-hex-character public share ID after insert.
- Publication time is captured only on the first transition to published.
- Catalog-relevant changes increment `settings.catalog_revision`.
- `total` is historical metadata; actual episode count should come from `episodes`.

### `episodes`

`id` PK, `series_id`, unique `(series_id, number)`, `number`, display/internal `title`, and private R2 `object_key`.

### `film_daily_views`

Primary key `(series_id, day)`, with `views`. `day` is a `YYYY-MM-DD` string calculated for UTC+7. It powers period rankings; `series.view_count` is the total counter.

### `settings`

Generic key/value configuration. Active key families include:

- `catalog_revision`
- `price:<seriesId>`
- `poster:<seriesId>`, `preview:<seriesId>`, `poster:frame:<seriesId>`
- `genres`, `payment_recipient`, `qr`, `sepay_enabled`
- `payment_features`
- `affiliate`
- `affiliate-preview:<sha256>` cache entries

Configuration is JSON where the owning feature expects JSON. Do not store secrets in this table; webhook/playback secrets are Worker secrets.

## Accounts and sessions

### `accounts`

`id` PK, case-insensitive unique `username`, server `password_hash`, `client_salt`, role constrained to `viewer|admin`, `vip` flag, and `created_at`. Effective role is admin first, then VIP, otherwise viewer.

### `sessions`

`token_hash` PK, `user_id` FK with cascade delete, and `expires_at`. Indexed by user and expiry. Raw session tokens exist only in secure cookies.

### `auth_limits`

Legacy/cleanup-compatible `key`, `count`, `expires_at`. Current login and registration intentionally do not enforce application cooldown/lockout.

## Access, orders, and wallet

### `grants`

Purchased access: `id` PK, `user_id`, `series_id`, `order_id`, unique `(user_id, series_id)`.

### `complimentary_access`

Admin-granted free access: primary key `(series_id, user_id)`, `created_at`.

### `orders`

`id` PK, user/email snapshot, `series_id`, integer `amount`, `status`, unique optional bank `reference`, and `created_at`. A partial unique index permits only one pending order per user/film.

### `deposits`

Wallet funding record: user/email, amount, status, optional R2 receipt key/hash, unique optional reference, and timestamp. Receipt uploads are a legacy/manual-review fallback.

### `wallet_ledger`

Append-only wallet entries: `id`, `user_id`, signed `amount`, `kind`, `source_id`, `created_at`. Unique `(kind, source_id)` provides idempotency.

### `wallet_balances`

Derived current balance keyed by `user_id`. Insert/delete/update triggers on `wallet_ledger` maintain it. The ledger, not this table, is the financial source of truth.

### `payment_codes` and `sepay_transactions`

`payment_codes` maps one unique `HOTAI…` memo code to each user. `sepay_transactions` stores unique SePay transaction ID, optional unique bank reference, resolved user, amount, status (`credited` or `unmatched`), and timestamp.

## Viewing and playback

### `watch_history`

One latest position per `(user_id, series_id)`: episode ID/number, seconds `position`, completion flag, and `updated_at`.

### `watched_episodes`

Per-episode watched/completed markers keyed by `(user_id, episode_id)`, with series and update time.

### `playback_leases`

Active playback control: primary key `(actor, device)`, unique lease `id`, episode, session hash, and expiry. Scheduled cleanup removes expired rows.

### `episode_hls`

Legacy/reserved HLS prefix mapping. The active player is MP4 and does not read this table.

## Imports, affiliate, and cleanup

### `videolink_imports`

One resumable import per external numeric `source_id`: internal `series_id`, immutable render `variant`, expected count, poster checksum, completion timestamp, created timestamp.

### `videolink_episodes`

Receipt for each imported episode: `(series_id, number)` PK, unique episode ID, SHA-256, byte size.

The source ID is import provenance only. Public links use `series.public_share_id`.

### `affiliate_clicks`

Primary key `(actor, series_id, rule_id)`, plus timestamp. Guest actors are backed by a one-year host-only cookie; logged-in actors use user ID.

### `media_cleanup`

Queued private R2 object keys or prefixes. Film/episode deletion writes here before asynchronous/best-effort R2 deletion, allowing the daily job to retry.

## Integrity and known schema constraints

- Several early tables predate foreign keys and rely on application validation; do not assume referential cascades outside the explicitly declared account history/session FKs.
- `series.genre` is intentionally denormalized as comma-separated labels. The canonical editable registry is `settings.genres`.
- Soft-deleted films remain for financial/history integrity while episodes and media are removed.
- Migrations use triggers for catalog revision, edit timestamps, first publication, public IDs, and derived wallet balances. Schema changes must account for these triggers.

