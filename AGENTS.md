# Hot AI Drama contributor instructions

These instructions apply to the entire repository. Read `docs/development-status.md` before changing behavior; it separates the deployed production revision from unfinished local work.

## Source of truth and ownership

- This repository is the canonical application source. Production is `https://hotai.bro.io.vn/` on the owner's Cloudflare account.
- Application code lives in `app/`, `components/`, `lib/`, `server/`, `src/`, `scripts/`, and `public/`. D1 migrations live in `drizzle/`.
- Customer records, credentials, balances, orders, viewing history, and production media must never be committed. D1 is the source of truth for application data; private R2 is the source of truth for media objects.
- Do not infer production state from a conversation. Verify source, migrations, Git status, and Cloudflare deployment output.
- Preserve unrelated working-tree changes. Never reset, clean, or overwrite files merely to make a task easier.

## Architecture invariants

- Runtime: React 19 + Vite 8 client, Cloudflare Worker API, D1, and private R2. There is no Next.js runtime even though route-like source paths are retained.
- `server/index.ts` is the Worker entry point. `app/api/[...path]/route.ts` is the main API router; specialized auth, import, SePay, share, storage, playback, and affiliate logic lives in `server/`.
- Static assets are served through the Worker `ASSETS` binding. `/api/*` and `/share/*` always run Worker code first.
- D1 access uses prepared statements directly. Do not introduce an ORM or a second database abstraction without a documented decision.
- Schema changes are append-only migrations. Never edit or renumber an applied migration. Create the next migration in `drizzle/` and update `docs/database-schema.md`.
- R2 stays private. A database row or an authenticated/authorized API response must mediate access to video, posters, receipts, QR images, and admin downloads.

## Security and money rules

- Never log raw passwords, client password proofs, cookies, session tokens, webhook keys, payment codes, or receipt content.
- All non-GET API mutations must enforce same-origin CSRF protection unless the endpoint has its own authenticated webhook contract.
- Keep request bodies and file uploads explicitly bounded. Validate content type and magic bytes where applicable.
- Viewer, VIP, and admin are distinct capabilities. VIP may watch all films but must not gain admin APIs. Registration always creates a viewer.
- Wallet credit and debit must be idempotent and ledger-backed. `wallet_ledger` is immutable financial history; `wallet_balances` is derived by triggers. Never update a balance directly.
- SePay credit requires the configured API key, incoming TPBank transfer, exact recipient account, exactly one issued `HOTAI…` payment code, and idempotent transaction IDs.
- Private playback requires a valid access decision, same-origin request, encrypted playback token, active lease, byte-range validation, and private/no-store responses.
- Browser controls and signed sessions reduce casual downloading; they are not DRM and cannot prevent screen recording or a determined authorized viewer from capturing bytes.

## Product and UI conventions

- User-facing copy is Vietnamese. Error messages should be specific and actionable without exposing internal IDs, object keys, filenames, or secrets.
- Mobile/PWA is a primary target. Keep controls usable at 320 px, account for safe-area insets, avoid iOS input zoom (16 px form controls), and keep essential close/navigation actions visible.
- Use the existing dark palette and pink accent. Reuse existing components and CSS classes before adding a new design system.
- Preserve guest usability. Guest history/follows may use local storage; account-backed durable history uses D1.
- Poster priority is controlled per film: first-frame preview by default, uploaded poster as fallback or explicit selection. Do not fetch full video files merely to render catalog cards.
- Keep the PWA shell network-first for navigation and do not cache personalized API/video responses in the service worker.

## API and data conventions

- Return JSON errors as `{ "error": "Vietnamese message" }` with an appropriate status code.
- Personal and financial API responses use `Cache-Control: private, no-store`. Catalog base data may be cached only when account entitlements are applied afterward.
- Use UUIDs for internal mutable entities unless an existing protocol specifies another ID. Public film shares use `series.public_share_id`, never a source-specific import ID.
- Times are Unix milliseconds unless a table explicitly documents another representation. Money is integer VND.
- Soft-deleted films use `series.deleted_at`; media deletion is queued through `media_cleanup` and retried by the scheduled Worker.

## Required verification

- Before committing: `npm run typecheck` and `npm test`.
- For build/deployment changes: also run `npm run build`.
- Add or update focused tests for authorization, CSRF, idempotency, range requests, upload bounds, and data isolation whenever those areas change.
- Do not claim a UI was visually verified unless it was actually inspected at desktop and mobile widths.
- Deploy only from a clean, reviewed checkout/worktree. Pushing Git does not deploy. Record the resulting Worker version in `docs/development-status.md` when production changes.

## Documentation maintenance

- Architecture: `docs/architecture.md`
- Database: `docs/database-schema.md`
- API: `docs/api-design.md`
- Decisions and constraints: `docs/technical-decisions.md`
- Live/development handoff: `docs/development-status.md`
- Update the relevant document in the same change whenever behavior, schema, infrastructure, security, or deployment conventions change.

