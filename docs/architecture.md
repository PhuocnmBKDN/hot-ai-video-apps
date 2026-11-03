# Architecture

Last reviewed: 2026-11-02. This document describes the checked-in code, with local unfinished work called out in `development-status.md`.

## System overview

```text
Browser / installed PWA
  ├─ static React/Vite assets ───────────────┐
  ├─ same-origin JSON API                    │
  ├─ private poster/video byte ranges        │
  └─ public film share URLs                  │
                                             ▼
Cloudflare Worker: hot-ai-drama
  ├─ ASSETS binding → generated client bundle and public information pages
  ├─ DB binding     → D1 hot-ai-drama
  ├─ BUCKET binding → private R2 hot-ai-drama-media
  ├─ rate limits    → playback issuance/read limits
  ├─ SePay webhook  → verified wallet credit
  └─ daily cron     → session/lease cleanup and queued media deletion
```

Production domain: `https://hotai.bro.io.vn/`. Worker preview URL: `https://hot-ai-drama.hotai-bro.workers.dev/`. The custom domain, D1 database, and R2 bucket belong to the owner's Cloudflare account; the app has no ChatGPT/Sites runtime dependency.

## Client

Prepared 2026-11-03 cost release changes: paged compact catalog, on-demand `/api/film` episodes/markers, derived episode counts, versioned published-artwork edge byte caching with live publication checks, and bounded per-period ranking caches. Sessions, leases, balances and entitlements remain live checks. See `cost-optimization-2026-11-03.md` for deployment state and legacy-client compatibility.

- `src/main.tsx` selects the home, admin, login, and information-page entry experience.
- `app/page.tsx` owns catalog tabs, search/filter/pagination, film dialogs, resume choice, playback, checkout, history, follows, and account navigation.
- `app/admin/page.tsx` owns admin sections and film management. Large features are split into `components/admin-*`, upload, poster, role, history, wallet, and episode components.
- `components/protected-video.tsx` opens a playback lease, supplies the `<video>` source, renews the lease, releases it, and renders affiliate gates.
- `components/app-updater.tsx`, `public/sw.js`, `public/version.json`, and `public/app-recovery.js` handle PWA updates and stale/blank-screen recovery.
- Guest watch history and watched markers use local storage. Logged-in durable progress uses D1 through `/api/watch-history`.

The service worker is deliberately small: navigation is network-first, offline fallback is static, icons may be cached, and `/api/*`, login, media, and release-version responses are never stored by the service worker.

## Worker routing

`server/index.ts` is the only Worker entry. Routing order matters:

1. `/share/film/*` → dynamic social/share HTML.
2. `/api/admin/imports*` → resumable VideoLink import API.
3. `/api/sepay/webhook` and `/api/wallet/transfer` → SePay integration.
4. `/api/admin/storage` → storage status.
5. `/api/auth/*` → username/password authentication.
6. Other `/api/*` → main router in `app/api/[...path]/route.ts`.
7. Everything else → static `ASSETS` binding.

The Worker adds clickjacking/content-sniffing/referrer protections. HTML is no-cache; API responses default to private/no-store.

## Authentication and authorization

- Username: normalized lowercase, 3–32 ASCII letters/digits/underscore.
- Password: 1–30 characters in the UI. The browser produces a PBKDF2-SHA256 600k proof using a per-account client salt. The server applies an independent PBKDF2-SHA256 100k salt/hash.
- Session: random 256-bit token; only its SHA-256 hash is stored. Cookie is `__Host-hotai_session`, HttpOnly, Secure, SameSite=Lax, 30 days.
- Roles: viewer, VIP, admin. VIP receives free playback but no admin privileges. Per-film free access and purchased grants are separate tables.
- There is no email, email verification, self-service password reset, or bundled admin credential.

## Catalog, ranking, and sharing

- `server/catalog.ts` builds the shared catalog base. Account entitlements are applied after shared catalog reads so personal rights are never cached into another user's response.
- `series.view_count` contains the imported/base total plus app opens. `film_daily_views` records app opens by Bangkok calendar day for day/week/month/year ranking.
- A film open calls `/api/series-view`; this is a raw open counter, not unique-user analytics.
- Public links are source-independent: `/share/film/<public_share_id>`. The Worker emits film-specific Open Graph metadata and redirects the client to the correct film.

## Media and playback

- Episode MP4s, uploaded posters, generated frame previews, receipt images, QR image, and future ad media are private R2 objects.
- Catalog posters are served through `/api/poster/:seriesId`; generated JPEG previews are served through `/api/thumbnail/:seriesId`.
- Playback is a two-step same-origin flow: authorize `/api/playback/:episodeId`, then read `/api/video/:episodeId?token=…`.
- The token is AES-GCM sealed and bound to actor, session, episode, and expiry. D1 leases limit an actor to two other devices and are renewed while playing.
- The video endpoint implements open-ended and suffix HTTP byte ranges for Safari seeking. R2 metadata is reused to reduce HEAD operations.
- Current production serves MP4, not HLS. The legacy `episode_hls` table remains but is not on the active path.

## Payments and affiliate gates

- Wallet transfers use a per-user `HOTAI…` memo and VietQR. SePay posts verified incoming TPBank events to the webhook.
- Credited deposits append `wallet_ledger`; D1 triggers update `wallet_balances`. Buying a film atomically creates a paid order, a negative ledger entry, and a grant when the balance is sufficient.
- Legacy receipt-review and direct order-confirmation paths remain available to admin but automatic SePay wallet credit is the primary path.
- Affiliate rules are global milestones. A rule can contain multiple episode numbers. A user/guest must open the configured partner link once per film/rule milestone. Purchasers, complimentary users, VIP, and admin bypass gates.
- The system records the gate click request, not a verified purchase or time spent on the partner site.

## Build and deployment

- Vite produces a Worker bundle and a client bundle. Build plugins generate a release UUID, `version.json`, public information HTML pages, and `sitemap.xml`.
- Wrangler deploys the Worker, assets, bindings, custom domain, and daily cron defined in `wrangler.jsonc`.
- D1 migrations are applied separately; a normal code deployment must not recreate or re-import D1/R2.
- Git push does not deploy. Production deployments are manual from an authenticated, reviewed worktree.

