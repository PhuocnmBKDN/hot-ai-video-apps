# Hot AI Drama — independent Cloudflare deployment

React + Vite frontend, Cloudflare Worker API, D1 database, private R2 media. This directory has no dependency on Sites or ChatGPT sign-in. Production runs at https://hotai.bro.io.vn on the owner's Cloudflare account. The original `../web` source is outside this repository.

## Prerequisites

- Your own Cloudflare account, email verified, with account recovery and MFA configured.
- Node.js 22+ and npm. Run `npm ci` after installing from the lockfile.
- R2 enabled in your own account. R2 requires a billing subscription; its free allowance is not a hard zero-cost guarantee. Do not select paid Workers or Stream for this deployment without reviewing cost.
- An active Cloudflare zone for `bro.io.vn` if using a Worker Custom Domain. Import **all** existing DNS records before changing nameservers. Keep the old site's DNS until the new deployment and sign-in are verified.

## Provision and deploy

1. `npx wrangler login`, then `npx wrangler whoami`. Select the correct account; never put API credentials in source.
2. `npx wrangler d1 create hot-ai-drama`. Put its returned database ID into `wrangler.jsonc`. Add `account_id` from your verified Cloudflare account.
3. `npx wrangler r2 bucket create hot-ai-drama-media`. Keep the bucket private. Do not enable public `r2.dev` access.
4. `npm run db:remote` applies all schema migrations.
5. Import the validated old-site snapshot into the **new empty database only**, using `npx wrangler d1 execute DB --remote --file ../work/migration-backup/data.sql`. Re-export the live data at cutover if any writes occurred since this snapshot. Never replay the snapshot on a populated database.
6. Copy original R2 objects without changing keys. Current snapshot: `episodes/0e5625a9-7e0f-41f8-a320-5517a64dd363.mp4` and `payment/qr`. Backups are in `../work/migration-backup`. Use `wrangler r2 object put hot-ai-drama-media/<key> --file <path> --content-type <type> --remote`.
7. `npm run typecheck`, `npm test`, `npm run build`, then `npm run deploy`. Test the returned workers.dev URL before attaching the real domain.
8. Create the owner's username/password through `/login` on the new deployment. Password entry stays with the owner. Only then promote the exact username with the trusted Cloudflare CLI: `wrangler d1 execute DB --remote --command "UPDATE accounts SET role='admin' WHERE username='<owner username>'"`. Registration always creates a viewer; never promote based on the first account or a public bootstrap request.
9. Verify admin upload, anonymous preview, protected episodes, deposits, wallet debit and purchase ownership. Test the complete browser proof + server hash flow on the actual Free Worker; local workerd may accept crypto parameters rejected by hosted Workers.
10. Add a Worker Custom Domain for `hotai.bro.io.vn` only after the new site passes checks. Remove/replace the previous CNAME as required by Cloudflare's domain flow. Verify TLS, registration, login, upload and playback on the real domain. Old sessions are not transferable.

## Authentication

Usernames are normalized to lowercase, 3–32 ASCII letters/digits/underscores. Passwords must be nonempty and may contain up to 30 characters; there is no minimum-length rule. The browser derives a password-equivalent proof with standard PBKDF2-SHA256 at 600,000 iterations and a per-account client salt. The server independently salts/hashes this proof with PBKDF2-SHA256 at 100,000 iterations, within the hosted Workers WebCrypto limit. Only the final hash and salts are stored. Proofs are credentials: transmit only over HTTPS; never log or store proofs. Raw passwords are not sent to the API. Non-browser clients must implement the same versioned proof protocol. Sessions use random 256-bit tokens; only their SHA-256 hashes are stored. Cookies are host-only, HttpOnly, Secure and SameSite=Lax. Mutations require the same Origin. Login/registration/challenge retries have no application cooldown or per-user/IP lockout, as requested by the owner. Historical auth_limits rows are no longer consulted. Expired sessions are cleaned daily.

No password or default admin is bundled. No email verification or email password recovery is implemented. Owner-assisted password reset must verify the requester independently, replace their password hash and revoke all their sessions. Never accept a screenshot or a claimed username as proof of account ownership.

## Data and backups

Preserve old user IDs when migrating existing purchases. Existing ChatGPT IDs must be explicitly linked to a verified new account; do not map them solely by a matching username or email. The initial migration snapshot had no purchases, deposits, grants or wallet entries.

Export D1 regularly (`wrangler d1 export DB --remote --output <private-backup.sql>`), and copy private R2 files to a second location. Keep source in a repository you own. Database exports contain password hashes, session hashes and payment data; exclude them from Git and public storage. Test restore into a separate local/test database.

Changing the hostname requires users to sign in again and reinstall the PWA if needed. Free usage quotas can change; R2 can bill for overages. No permanent-free guarantee is made.

## Schema maintenance

Use append-only SQL migrations in `drizzle/` with `wrangler d1 migrations create DB <name>`. Do not regenerate or modify the imported historical migrations. The directory name is retained for continuity; the standalone app uses direct prepared D1 SQL, not a Sites schema service.

## Source control

Canonical private repository: https://github.com/PhuocnmBKDN/hot-ai-video-apps

Use `main` for the current production source. Commit and push changes after verification so the deployed code has a recoverable source revision. Deployment currently uses `npm run deploy` from an authenticated local checkout; pushing to GitHub alone does not deploy the app.

For a fresh checkout: `npm ci`, `npm run typecheck`, `npm test`, then authenticate Wrangler before deployment. The configured Cloudflare resources already exist; do not recreate or re-import them during routine deployment. See [SePay setup](SEPAY-SETUP.md) for wallet webhook configuration. Secrets stay in Cloudflare, media in R2, and live data in D1; Git backs up source only.

Customer records and transactions belong only in the live D1 database. Receipt images and media belong in private R2. Never commit production data exports, customer records, session data or credentials. SQL files in `drizzle/` define schema migrations only, not a copy of customer data. Test fixtures are synthetic.

## VideoLink desktop import

VideoLink 0.11 connects with an existing admin session through the normal HotAI sign-in flow. No new storage/API secret is distributed. Migration `0013_videolink_imports.sql` adds source/episode receipts; apply it before deploying this API.

`POST /api/admin/imports` accepts a TikTok drama ID, immutable render variant, English title, Vietnamese description and expected episode count. It creates one **draft** per TikTok drama ID, with supplied canonical genre labels and the usual first-quarter-free boundary. Existing movie metadata, payment settings and published status are not changed by retries. Admin reviews price/access and publishes from the normal admin page.

The desktop waits for the complete local film and validates all final MP4s before creating a remote record. It uploads the TikTok poster, then sequentially calls `/api/admin/imports/:sourceId/episodes/:number`. GET on the episode route confirms an existing stored file so resume can skip its body. R2 verifies the supplied SHA-256 while receiving each stream. The server acknowledges each episode only after R2 and the episode database record succeed. Limits: 90 MiB per MP4, 8 MiB per poster (JPEG/PNG/WebP/AVIF). Differing content or render variants return 409 rather than overwrite an existing episode.

`POST /api/admin/imports/:sourceId/complete` checks poster, contiguous episode numbers, sizes and checksums against the complete client manifest. Completion does not publish the draft. Deleted films are not silently recreated. All routes require a live admin cookie; mutations also enforce the existing same-Origin rule. The client encrypts its session using Windows DPAPI, outside its source repo; passwords and sessions never enter Git.

`npm test` includes import authorization, CSRF, checksums, deduplication, interrupted resume, missing/deleted episodes and draft visibility. For a real disposable workerd/D1/R2 integration test, build first, set `TEST_MEDIA` to a small real MP4 fixture, then run `node tests/imports-runtime-smoke.mjs`. It starts an isolated Miniflare instance on port 5188, creates only synthetic local data, and verifies uploaded playback/poster bytes and checksum rejection. `TEST_DESKTOP_PROBE` and `TEST_DESKTOP_ROOT` may optionally connect a local-only Windows test harness; no production origin is accepted by this test.

## Vietnamese TikTok genre imports (VideoLink 0.12)

These API/test changes are integrated into main alongside the current playback-session protection and admin film sorting. No new database migration is required for genre imports.

`GET /api/admin/imports` (admin only) now advertises `genreImportVersion: 1`. The desktop checks this before sending genre-bearing imports. `POST /api/admin/imports` accepts an optional `genres: string[]`, up to 20 labels, 60 characters/label and 500 characters combined. Old 0.11 clients that omit genres remain compatible. Commas/control characters are rejected because film genres use comma-separated storage.

The desktop obtains Vietnamese TikTok theme labels by `tagKey` from the Vietnamese Webapp UI dictionary, retains them in the manifest, and includes them with the English film title and Vietnamese introduction. The API normalizes Unicode NFC, whitespace and case to reuse existing labels, registers missing names in the shared `settings.genres` registry, and attaches canonical labels to the film. Existing manually assigned film labels are retained; retries neither duplicate nor clear them. A compare-and-swap of the registry and a guarded film update share a D1 transaction; bounded retries preserve independent concurrent genre changes.

Import responses and status include canonical `genres`. VideoLink requires the acknowledgement before uploading videos. Unit tests cover new/existing Vietnamese labels, decomposed Unicode/case duplicates, invalid inputs, old clients, manual-label retention and a simulated concurrent registry edit. The disposable workerd/D1/R2 test also verifies registered labels in the catalog and exercises the Windows uploader with genre metadata. These tests do not alter production movie records.

Deployment verified on 2026-10-28 at https://hotai.bro.io.vn: genreImportVersion=1, authenticated admin access, anonymous denial and invalid-metadata rejection. Cloudflare Worker version: 7ff46c69-3bed-4306-a9a0-300c10d1a288. The merged release retains playback-session protection and the latest admin film sorting. No production film/test upload was created during verification.
