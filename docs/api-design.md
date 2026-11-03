# API design

All browser APIs are same-origin under `/api`. JSON errors use `{ "error": "…" }`. Unless documented otherwise, mutations require an exact same-origin `Origin` header. Personalized, financial, admin, playback, and webhook responses are not cacheable.

## Authentication

| Method | Path | Purpose |
|---|---|---|
| GET | `/api/auth/challenge?username=` | Return per-account client salt and proof scheme. Unknown users receive a random salt to reduce enumeration timing differences. |
| POST | `/api/auth/register` | Create a viewer and secure session. |
| POST | `/api/auth/login` | Verify browser proof and create a secure session. |
| POST | `/api/auth/logout` | Revoke session and its playback leases. |
| GET | `/api/me` | Current public account/role summary. |

The API never accepts a raw password. See `docs/architecture.md` for the versioned proof scheme.

## Catalog, progress, ranking, and sharing

Deployed cost release (2026-11-03): `/api/catalog?page=1&size=12&query=&genre=&category=&period=` returns `{films,total,page,pages,...}` with compact summaries. `ids` optionally filters followed film IDs. `/api/film?id=<internal-or-public-id>` or `?episode=<episodeId>` returns one authorized film with ordered episode IDs and caller-scoped watched markers. Startup `/api/watch-history` returns recent history, with markers loaded via film detail. Legacy catalog calls without list parameters retain episode arrays for old PWAs.

Admin `/api/admin/film-list` accepts query, genre, status, sort, direction, page and size; `/api/admin/user-list` accepts query, role, sort, page and size. Existing film detail and dashboard endpoints accept `id` to restrict metadata/episodes. Read-only `/api/admin/storage?audit=1&cursor=` reports a bounded R2 inventory page, never deletion. See the dated cost report for compatibility and cache policies.

New startup history calls use `/api/watch-history?summary=1`; calls without this flag retain watched markers for old PWA clients.

| Method | Path | Purpose |
|---|---|---|
| GET | `/api/catalog?drafts=1` | Public catalog plus caller entitlements; drafts only for admin with explicit flag. |
| POST | `/api/series-view` | Increment total and current-day app-open counters for a published film. |
| GET | `/api/rankings?period=day|week|month|year` | Period app-open counts for published films. |
| GET/POST | `/api/watch-history` | Read or upsert durable account progress and watched markers. Login required. |
| GET | `/share/film/:publicShareId` | Film-specific Open Graph HTML and app deep link. Legacy internal IDs are accepted only for backward compatibility. |

Guests keep progress locally in the browser; there is no guest progress API.

## Playback and artwork

| Method | Path | Purpose |
|---|---|---|
| POST | `/api/playback/:episodeId` | Check publication, paywall, affiliate gate, concurrency and rate limits; issue a sealed token/lease. |
| GET/HEAD | `/api/video/:episodeId?token=` | Private MP4 stream with RFC-style single byte ranges. |
| POST | `/api/playback-control/heartbeat` | Renew a live lease. |
| POST | `/api/playback-control/release` | Release a lease. |
| GET | `/api/poster/:seriesId?v=` | Selected/fallback poster. |
| GET | `/api/thumbnail/:seriesId?v=` | Generated JPEG frame preview. |
| GET | `/api/qr` | Private/no-store configured payment QR. |

Affiliate gate responses use HTTP 428 with an `affiliate` payload. Paid/granted/VIP/admin access bypasses the affiliate gate.

## Affiliate

| Method | Path | Purpose |
|---|---|---|
| GET | `/api/affiliate/preview?ruleId=` | Sanitized cached title/image preview for an active rule. |
| POST | `/api/affiliate/click` | Record the required film/rule click and return the external HTTPS URL. |
| GET/POST | `/api/admin/affiliate` | Read/write global milestone rules. Admin only. |
| POST | `/api/admin/affiliate-preview` | Fetch allow-listed Shopee/TikTok Open Graph preview. Admin only. |

This proves that the app recorded a click request. It does not prove a purchase, partner attribution, or time spent outside the app.

## Wallet, orders, and SePay

| Method | Path | Purpose |
|---|---|---|
| GET | `/api/wallet` | Balance plus bounded recent ledger/deposit history. |
| GET | `/api/wallet?summary=1` | Balance only for polling after transfer. |
| GET | `/api/wallet/history?type=&kind=&page=&size=` | Paginated private wallet/deposit history. |
| POST | `/api/wallet/buy` | Atomically debit balance and grant a film. |
| POST | `/api/wallet/deposit` | Legacy manual deposit request. |
| POST | `/api/wallet/receipt?id=` | Legacy receipt upload. |
| GET/POST | `/api/orders` | List caller orders or create a legacy pending direct-payment order. |
| GET | `/api/wallet/transfer?amount=` | Build personalized VietQR transfer details and memo. |
| POST | `/api/sepay/webhook` | API-key-authenticated incoming TPBank event; idempotently credit matched user. |

Wallet feature flags can independently disable paid episode locks and the wallet UI/API. Money is always integer VND.

## Admin film and account APIs

Admin-only endpoints handled by the main router:

- `GET /api/admin?section=films|users|payments` — lazy dashboard data.
- `GET /api/admin/films` — film metadata, poster state, genres, optional deposit summary.
- `GET /api/admin/user-list`, `/api/admin/users?username=`, `/api/admin/user-activity` — account lookup, role/activity/purchases/history.
- `POST /api/admin/user-role`, `/api/admin/free-access` — role and film-specific access management.
- `POST /api/admin/series`, `/api/admin/edit`, `/api/admin/publish`, `/api/admin/delete-film` — film lifecycle.
- `POST /api/admin/upload`, `/api/admin/delete-episodes` — episode lifecycle.
- `POST /api/admin/poster`, `/api/admin/thumbnail`, `/api/admin/poster-source` — artwork lifecycle.
- `POST /api/admin/genres` — add, rename, or remove a genre and propagate affected film labels.
- `GET /api/admin/download` — direct MP4 for one selected episode. Multiple-episode ZIP UI/route is not complete in the current production source.
- `POST /api/admin/payment`, `/api/admin/qr`, `/api/admin/deposit-confirm`, `/api/admin/deposit-reject`, `/api/admin/confirm` — payment administration/legacy review.
- `GET/POST /api/admin/payment-features` — paid-lock and wallet toggles.
- `GET /api/admin/receipt/:id` — private receipt image.
- `GET /api/admin/storage` — configured storage status.

## VideoLink import API

All routes are under `/api/admin/imports`, require admin cookie and same-origin mutations, and are resumable/idempotent:

- `GET /api/admin/imports` — feature versions.
- `POST /api/admin/imports` — create or resume a draft using external source metadata.
- Per-source status, poster upload, episode status/upload, and completion endpoints are implemented in `server/imports.ts`.
- MP4 maximum is 90 MiB; poster upload is bounded and checksum-verified. An import never auto-publishes.

The local dirty work adds `viewImportVersion: 1` and source view-count import, but this is not part of the documented production revision until committed and deployed.

## Limits and response behavior

- Main JSON bodies are bounded by feature, typically 1–128 KiB.
- Admin episode MP4: 90 MiB. Poster: 5 MiB. Generated thumbnail: 1 MiB. QR: 2 MiB. Receipt: 5 MiB.
- Playback issuance: 40 actor requests/minute. Playback reads: 240 actor requests/minute; issue IP is also bounded.
- Two other active devices per actor are allowed by the playback lease query.
- Unknown endpoints return 404; unsupported methods return 405 where the router distinguishes them.

