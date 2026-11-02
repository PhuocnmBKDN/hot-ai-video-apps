# Technical decisions and constraints

## Accepted decisions

### Cloudflare-only independent infrastructure

The production application uses the owner's Worker, D1, private R2, DNS/custom domain, and rate-limit bindings. This removes operational dependence on a Codex/Sites-hosted project. GitHub stores source only.

### React/Vite SPA with a Worker API

The existing product is a compact React SPA/PWA. Keeping one Worker entry and direct D1 SQL minimizes infrastructure and deployment complexity. Public information pages are emitted as static HTML during build for crawler reliability; film share pages are generated dynamically for per-film metadata.

### Username/password without email

Registration intentionally needs only username and password. Password proofs are derived in the browser and re-hashed server-side. The trade-off is no automated recovery or identity verification; recovery is owner-assisted and must use an independent proof process.

### Ledger-backed wallet

The immutable ledger is authoritative; balance is derived by D1 triggers. SePay webhook events are idempotent and only exact per-user memos credit a wallet. This design is favored over screen-scraping banking notifications or AI receipt approval.

### Private R2 MP4 with short-lived playback sessions

R2 objects are private and videos are exposed only through same-origin authorized byte-range endpoints. This is inexpensive and Safari-compatible. It is deterrence, not studio DRM. Full DRM, adaptive bitrate streaming, and license servers would require a different media pipeline and likely additional cost.

### Source-independent public links

Import IDs such as TikTok/Douyin IDs are provenance, not public identity. `public_share_id` remains stable even if the source or import pipeline changes.

### Affiliate gates are engagement gates, not attribution verification

The app records that a visitor requested the configured external link. Shopee/TikTok decide affiliate attribution. The app does not claim that a purchase occurred and must not use deceptive copy.

### Cost controls

- Catalog base reads are revision-cached and personal entitlements are applied separately.
- Wallet balance is O(1) through a derived table.
- Progress writes suppress insignificant duplicates.
- Poster/frame images are normalized client-side/import-side and cached only for published versioned assets.
- Video metadata is reused to avoid repeated R2 HEAD calls; deletion batches R2 keys.
- Service worker does not cache API/video/customer data.

## Explicit constraints

- R2 free allowance is not a permanent zero-cost guarantee; storage and operations can incur charges.
- No automatic Cloudflare/GitHub deployment is configured. Deployment is manual.
- No email, phone verification, OAuth, 2FA, or self-service password reset exists.
- No application-level login cooldown/rate limit exists, per product-owner decision. Cloudflare edge protections should be considered before broad promotion.
- A film open increments views every time; it is not unique-view analytics and can be inflated.
- Ranking-period data begins when `film_daily_views` started; imported historical source views live only in total `view_count`.
- MP4-only playback has no adaptive bitrate. Slow mobile networks may buffer more than an HLS/DASH service.
- Facebook and other crawlers cache Open Graph data outside our control; their debugger/refresh tools may be needed after metadata changes.
- Guest progress and affiliate unlocks are device/browser-cookie scoped. Durable cross-device progress needs an account.
- Rights to distribute uploaded/imported media are an operational/legal responsibility, not enforced by code.

## Deferred or rejected approaches

- Google Drive/OneDrive as production video origin: rejected in favor of private R2 and predictable authorization.
- AI validation of payment screenshots: not trusted for automatic credit; SePay is primary.
- Banking/Zalo notification scraping: rejected as brittle and unsafe.
- HLS encryption prototype: not active; MP4 workflow retained for operational simplicity.
- AdSense/video advertising: not integrated. Banner AdSense code cannot be repurposed as a forced mid-roll. A compliant provider/inventory format and approval must be chosen before implementation.

