# Development status

Reviewed against the working tree on 2026-11-02.

## Production baseline

- Domain: `https://hotai.bro.io.vn/`
- Git branch/revision: `main` at `7efd65f` (`Highlight catalog pagination controls`)
- Last known deployed Worker version: `38676378-22f5-4b8d-bc3a-c64e01403ed7`
- Cloudflare Worker: `hot-ai-drama`
- D1: `hot-ai-drama` (`e9851475-1da7-4599-8760-ecbcb6febbb6`)
- Private R2: `hot-ai-drama-media`
- Schema migrations present: `0000`–`0020`
- Verification on current local tree: `npm run typecheck` and all scripted unit/security/cost tests passed on 2026-11-02.

The live revision contains the pagination emphasis change, admin-only view-count display, public information/privacy/contact pages, admin film deep links, PWA release detection/recovery, permanent public film share IDs, protected playback, affiliate gates, wallet/SePay, and the features listed below.

## Completed features

### Viewer experience

- Responsive two-column mobile catalog and desktop grid; search, category tabs, genre filter, pagination.
- HOT, ranking by day/week/month/year, newest, all films, and genre discovery.
- Followed films, watch history, watched/completed episode markers, resume-or-start-over prompt.
- Film dialog with compact description, episode grid, next/previous, fullscreen, automatic next episode, and share action.
- Public source-independent film share URLs with film-specific Open Graph metadata.
- PWA manifest, install/open-app prompt, safe-area mobile navigation, network-first navigation, release update prompt, blank-screen recovery.
- Public About, Contact, Privacy, and Terms pages plus footer navigation, robots, and sitemap.

### Accounts and access

- Username/password registration and login without email.
- Viewer, VIP, and admin roles; admin role management.
- Durable account watch history and per-episode watched markers; guest local fallback.
- Purchased grants and film-specific complimentary access.
- Configurable paid-from episode; global paid-lock toggle.
- Affiliate milestone gates supporting multiple episode numbers per rule and guest/account persistence.

### Payments

- Private wallet, ledger, balance, transaction history, and film purchase.
- TPBank/VietQR transfer details with unique user memo.
- Authenticated SePay webhook with exact memo matching and idempotent wallet credit.
- Configurable wallet toggle and legacy receipt/manual confirmation fallback.
- Zalo support link and account wallet UI.

### Admin and content

- Film create/edit/publish/hide/soft-delete; price, lock point, title, description, genres, source view count.
- Compact searchable/sortable/paginated film library and direct “Quản lý phim này” links from viewer catalog for admin.
- Multi-file ascending filename upload; episode delete; poster upload/paste; default first-frame poster with explicit source toggle.
- Genre add/rename/delete and propagation to films.
- User list/search/filter/role management and paginated wallet, purchase, and watched-film activity.
- Single selected-episode direct MP4 download.
- Resumable VideoLink draft import with checksums, deduplication, variants, posters, ordered episodes, and Vietnamese genre registration.
- View counters and Bangkok-day ranking buckets; counts are hidden from normal users and visible to admin.

### Security, reliability, and cost

- Same-origin CSRF checks, bounded body/file reads, content signature validation, secure cookies, private R2.
- Sealed playback tokens, active leases, two-device concurrency control, rate limits, Safari byte ranges, no-download browser hints.
- Soft deletion with queued/batched media cleanup and daily expired-session/lease cleanup.
- Catalog revision caching, derived wallet balance, bounded pagination, suppressed duplicate progress writes, versioned poster caching.
- PWA does not cache personalized APIs or media.

## Local working tree: not deployed

The tree is intentionally dirty. Preserve these files and do not represent them as production:

- Modified: `app/admin/page.tsx`, `components/admin-affiliate.tsx`, `components/admin-payment-features.tsx` — label cleanup (`Affiliate`, `Nạp tiền`).
- Modified: `app/api/[...path]/route.ts`, `server/imports.ts`, `tests/imports.test.mjs` — remove the old 32-bit ceiling for imported/admin view counts and add `viewImportVersion: 1` plus initial source-view import tests.
- Untracked drafts: `server/ads.ts`, `components/admin-ads.tsx`, `components/ad-break.tsx` — proposed self-hosted inter-episode ad configuration/media UI. These files are not routed, not rendered, not tested, and not deployed.

Before continuing, split these into focused commits. Do not accidentally deploy the unconnected ad draft.

## Pending tasks, in recommended order

1. Finish and commit source view-count import: validate SQLite/D1 safe-integer behavior, update the VideoLink client protocol, run tests, and deploy only after the desktop importer is compatible.
2. Decide the advertising product before wiring the draft: self-hosted house/sponsor media versus an approved network. Do not call forced banner AdSense a video ad. Add consent/privacy changes only for the provider actually selected.
3. Complete admin multi-episode download. One episode downloads directly; the ZIP64 streamer exists in `server/download-zip.ts`, but the active route currently rejects multi-file requests and no complete ZIP action is documented as production-ready.
4. Add automated deployment only after establishing staging, secret handling, migration gates, and rollback. Current manual deployment is safer than an unreviewed production auto-deploy.
5. Add operational backups/restore drill for D1 and R2, plus quota/cost alerts.
6. Add observability for Worker errors, R2 latency, webhook failures, unmatched SePay transfers, and playback failure rate without logging personal credentials.

## Known bugs and limitations

- No reproducible blocking test failure is known at this review; typecheck and the full scripted suite pass.
- The working ad draft is incomplete and must not be enabled.
- Initial posters can still be network-bound on cold mobile caches. The app normalizes future poster/frame inputs, but existing oversized source assets may need a one-time verified normalization pass.
- View count increments per film-open action and has no unique actor/day deduplication; it is a popularity signal, not audited analytics.
- Period rankings include only app opens recorded since daily counters were introduced. Imported historical views affect the total counter/tie-breaking, not past daily buckets.
- Guest follows/history/affiliate unlocks are browser/device scoped. Clearing storage/cookies loses them.
- No password recovery or verified contact channel is attached to accounts.
- No login cooldown/application rate limit. This is a known security trade-off, not an accidental omission.
- MP4 playback is not DRM and has no adaptive bitrate. Authorized capture/screen recording cannot be prevented.
- Public social previews may remain stale in Facebook/Shopee caches after deployment until the external platform refreshes them.
- `episode_hls` is legacy/reserved and not used by the current player.
- Legacy manual receipt/direct-order endpoints increase maintenance surface while SePay is primary.
- R2 can incur cost above the included allowance; “free forever” is not guaranteed.

## Important decisions and constraints

- Keep customer data in D1 and media/receipts in private R2; never in Git.
- Keep public share IDs independent from TikTok/Douyin/source IDs.
- Keep wallet ledger immutable and use SePay idempotency; never infer money from screenshots automatically.
- Keep non-GET browser mutations same-origin and admin/VIP capabilities separate.
- Do not promise download prevention or enterprise DRM; describe current controls accurately.
- Do not deploy from the dirty primary checkout. Use a reviewed clean worktree at the intended commit.
- Pushing GitHub does not update production; deployment and migration are separate explicit actions.

## Handoff checklist

For the next conversation:

1. Read `AGENTS.md` and this file.
2. Run `git status --short`; preserve the local work listed above.
3. Confirm whether the requested change targets production behavior or the unfinished local branch.
4. Run `npm run typecheck` and `npm test` before committing.
5. Update this file with the commit and Worker version after any production deployment.

