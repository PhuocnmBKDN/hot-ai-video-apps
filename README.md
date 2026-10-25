# Hot AI Drama — independent Cloudflare deployment

React + Vite frontend, Cloudflare Worker API, D1 database, private R2 media. This directory has no dependency on Sites or ChatGPT sign-in. The original `../web` deployment remains the rollback until cutover completes.

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
9. Verify admin upload, anonymous preview, protected episodes, deposits, wallet debit and purchase ownership. The PBKDF2 work factor is intentionally fixed; test it on the actual Free Worker. If the runtime/CPU quota rejects it, do not lower the work factor silently: resolve the hosting/authentication choice first.
10. Add a Worker Custom Domain for `hotai.bro.io.vn` only after the new site passes checks. Remove/replace the previous CNAME as required by Cloudflare's domain flow. Verify TLS, registration, login, upload and playback on the real domain. Old sessions are not transferable.

## Authentication

Usernames are normalized to lowercase, 3–32 ASCII letters/digits/underscores. Passwords are 12–128 characters, salted and hashed with PBKDF2-SHA256 at 600,000 iterations. Sessions use random 256-bit tokens; only their SHA-256 hashes are stored. Cookies are host-only, HttpOnly, Secure and SameSite=Lax. Mutations require the same Origin. Login/registration are throttled by IP hash and username; expired counters/sessions are cleaned daily.

No password or default admin is bundled. No email verification or email password recovery is implemented. Owner-assisted password reset must verify the requester independently, replace their password hash and revoke all their sessions. Never accept a screenshot or a claimed username as proof of account ownership.

## Data and backups

Preserve old user IDs when migrating existing purchases. Existing ChatGPT IDs must be explicitly linked to a verified new account; do not map them solely by a matching username or email. The initial migration snapshot had no purchases, deposits, grants or wallet entries.

Export D1 regularly (`wrangler d1 export DB --remote --output <private-backup.sql>`), and copy private R2 files to a second location. Keep source in a repository you own. Database exports contain password hashes, session hashes and payment data; exclude them from Git and public storage. Test restore into a separate local/test database.

Changing the hostname requires users to sign in again and reinstall the PWA if needed. Free usage quotas can change; R2 can bill for overages. No permanent-free guarantee is made.

## Schema maintenance

Use append-only SQL migrations in `drizzle/` with `wrangler d1 migrations create DB <name>`. Do not regenerate or modify the imported historical migrations. The directory name is retained for continuity; the standalone app uses direct prepared D1 SQL, not a Sites schema service.
