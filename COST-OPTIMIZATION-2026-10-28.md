# Cloudflare cost optimization — 2026-10-28

Live app: https://hotai.bro.io.vn/
Deployed version: 73e406f7-5798-49fa-90a4-426d167a5277
Migration: `0016_cost_optimizations.sql`.

## Implemented

- **D1 catalog:** cache only non-personal film/episode/pricing/ranking metadata in bounded Worker-isolate memory. Every request checks a live revision row; database triggers invalidate catalog changes immediately. A 30-second TTL ages rolling rankings. A single in-flight load is shared. Account identity, roles, purchases and complimentary access are hydrated fresh and never shared through this cache.
- **D1 wallet:** backfill a small `wallet_balances` table from the existing ledger. SQLite triggers maintain it in the same transaction as ledger changes. Balance reads and purchase checks use indexed lookups. The full ledger remains authoritative and retained. Both isolated rollback/idempotency tests and a production aggregate consistency check passed with zero mismatches.
- **D1 writes:** skip unchanged progress updates; watched markers update only when completion advances. Heartbeats use UPDATE RETURNING rather than update plus select. Playback issuance uses INSERT/UPSERT RETURNING. Add an expiry index for session cleanup. Existing payment codes are read rather than issuing an INSERT OR IGNORE on every QR refresh.
- **R2:** cache immutable video metadata for five minutes in bounded isolate memory, coalescing concurrent HEADs. Every range request still authorizes against current D1 data and reads the private video from R2. Unexpected ETag replacement invalidates metadata. Process already-approved cleanup keys with bulk R2 deletion and one queue-delete statement; retain failed entries for retry.
- **Poster/thumbnail traffic:** lazy-load both uploaded posters and first-frame images. Version image URLs when film metadata changes; permit private browser caching for versioned images of published films. Draft artwork remains non-cacheable. Authentication, wallet JSON and video responses stay non-cacheable. Replacing a poster or thumbnail bumps the catalog revision.
- **Client requests:** include the existing account summary in the catalog response, removing the duplicate identity request. Load orders on the account page and wallet balance for checkout/on the wallet page. Coalesce simultaneous GET requests without retaining cached balances/rights. Throttle catalog refresh on focus and poll only old pending orders instead of refetching the entire app state.
- **Wallet polling:** no idle interval; poll only while waiting with a generated QR and a visible page. Use 5s intervals for the first minute, 15s up to five minutes, 30s up to ten minutes; stop after a balance increase or ten minutes. Manual balance checking remains available. Handle unknown initial balance conservatively.
- **Admin:** load the selected section's data, so account management does not preload all episodes, and film management does not preload payment history. Preserve navigation and ignore stale section responses.
- **JS/CSS:** split Home, Admin, Login and Terms into lazy route chunks with a retry screen for loading failures. Hashed assets use immutable year-long browser caching. HTML revalidates; its existing no-transform rule remains limited to HTML to prevent duplicate analytics injection. Removing no-transform from JS/CSS enables normal CDN compression. Production requests confirmed Brotli.

## Measured checks (not an invoice forecast)

| Scenario | Before | After |
|---|---:|---:|
| Warm guest catalog, catalog-specific SQL excluding authentication | 4 full-data reads | 1 revision lookup |
| Warm signed-in catalog, excluding authentication | 4 base reads + access query | revision + live access query |
| Repeated seeks for the same immutable object in a warm worker | 8 R2 HEADs + GETs | 1 HEAD + GETs |
| Queue cleanup for 120 ordinary objects | 120 R2 delete calls plus per-key SQL | 1 R2 bulk delete plus 1 SQL delete |
| Wallet waiting continuously for ten minutes | 120 polls at 5s | 38 polls before timeout; zero idle polls |
| Playing for ten continuous minutes, heartbeat-only model | up to 10 writes and 20 heartbeat SQL statements | up to 5 writes and 5 heartbeat SQL statements |
| Approximate homepage JS, raw build bytes including static dependencies | 285,880 single bundle | 241,326; admin/login/terms excluded |

Cold isolates and changed revisions still load the base data. Memory cache reuse depends on Worker routing/lifetime; actual invoice changes depend on traffic and cache hits. The derived balance and revision triggers add small write/storage overhead to avoid repeated history/catalog scans. These are tradeoffs, not a claim of zero cloud costs.

## Verification

- All 12 automated test scripts passed, including wallet migration/backfill/rollback, duplicate payment protection, immediate catalog invalidation, cross-user cache isolation, unchanged-progress write suppression and bulk cleanup retry behavior.
- TypeScript and production builds passed.
- Real local workerd/D1/R2 smoke tests passed upload, poster preservation, playback/ranges/paywall, wallet purchase, repeated purchase without another debit, watch history and logout revocation.
- Production checks passed: private catalog policy, guest denial for admin/wallet, poster browser-cache policy, Brotli plus immutable JS/CSS and public preview issue/range/release.
- A pre-migration D1 Time Travel bookmark was recorded privately in the workspace; the migration's derived balances matched the ledger before deploying.
- The most recent browser-tool attempt reported disabled browser use in Work settings. This round was verified by code, runtime and HTTP checks; no fresh visual/browser interaction pass or screenshot is claimed.

## Preserved and deferred

No plan upgrade, public R2 bucket, paid CDN/video/image service, retention purge, video recompression or extra third-party dependency was enabled. Existing film GB and visual quality remain unchanged. Financial ledger/history were not deleted. For code rollback, deploy commit `2beb490` while keeping the additive migration; whole-database restoration would also roll back later payments and requires reconciliation.

Reducing the stored film GB further requires a separate choice about compression quality or media retention. A measured production load test and usage/billing trend comparison remain separate work. Cache improvements do not provide a verified CCU or guaranteed cost percentage.

## Pricing/documentation checked

- [R2 pricing](https://developers.cloudflare.com/r2/pricing/): storage and operations are billed separately; Standard egress is free. Request reductions target Class B reads and application requests, while stored GB are unchanged.
- [D1 pricing](https://developers.cloudflare.com/d1/platform/pricing/): rows scanned/read and written drive usage; indexed point lookups reduce scans.
- [Workers static asset billing](https://developers.cloudflare.com/workers/static-assets/billing-and-limitations/): requests served as static assets are free; dynamic API requests still invoke the Worker.
- [Static asset headers](https://developers.cloudflare.com/workers/static-assets/headers/) and [cache control](https://developers.cloudflare.com/cache/concepts/cache-control/): hashed-asset caching and compression policy.

No customer records, video files, receipt images, session cookies or secret values are included in source or this report.
