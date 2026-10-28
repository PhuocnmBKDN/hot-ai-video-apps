# Second audit — 2026-10-28

Deployed to https://hotai.bro.io.vn/ on the existing owner-controlled Cloudflare Worker.
Version: `1776f970-d88d-4eaa-913f-2a5004006ace`.
No production database migration or new paid service was required.

## Updates

- Upload batches: choosing a new batch after an upload uses the next available episode number, rather than reusing the previous batch's starting number. Add a warning before leaving the admin page while an upload/action is busy.
- Media validation: reject empty or incorrectly labelled PNG/JPEG/WebP images before overwriting a poster, thumbnail, receipt or QR image. Verify the R2 video upload's received size before creating an episode; remove an incomplete new object on failure. Guard concurrent legacy receipt submissions with a conditional update and clean up the losing new object.
- API body limits: use one bounded stream reader for JSON endpoints, reading limits in actual UTF-8 bytes even without Content-Length. Cancel oversized streams, reject truncated input and non-object/malformed JSON. Auth, playback control, imports and authenticated SePay messages follow the same validation. Do not buffer full videos for this check.
- Login/logout: validate return destinations by parsed URL origin, including control-character/backslash bypasses; retain the intended film when login is requested from checkout. Disable login fields during submission, clear stale errors and explain network failures. Logout remains on the account page with a retry message if the request fails.
- Catalog/player: sort the New category by first publication time, with creation-time fallback for legacy films with no known release time. Resume buttons use the saved position. Scroll to the top when changing the main tab/category.
- Local state: validate browser-stored following/history/episode markers so malformed JSON, wrong data shapes or blocked storage do not crash the app. Preserve the last known wallet/order state on API errors instead of falsely resetting it to zero.
- Admin account activity: clamp requests to existing pages and show the server's actual current page; reject invalid transaction filters. The deletion dialog now handles Escape and locks background scrolling without performing a deletion.
- Legacy order creation now uses the film's configured price rather than a fixed 10,000 VND. Existing orders and their historical amounts were not rewritten.
- Handle rejected PWA install prompts by showing the existing manual installation instructions.

## Validation completed

- All 11 automated test scripts passed: new streaming/body, local state and redirect tests plus the existing security/paywall/payment/SePay/import/playback/sorting/episode-order suites.
- TypeScript check and production build passed.
- Real local workerd auth smoke passed registration, password proof/hash, session authorization and logout.
- New local media runtime smoke passed: upload and retain a real synthetic PNG, reject invalid poster without replacing it, upload two generated MP4 videos, publish, issue guest playback, read a byte range, reject a locked episode, save watch history, clamp its page and revoke playback after logout. All fixtures and test accounts were local only.
- Production HTTP smoke passed homepage/catalog availability, absence of internal object keys, anonymous rejection for admin/imports/wallet history, and a public preview issue/range/release cycle. Only two video bytes were read; no purchase, bank event, role change or media change was performed on production.
- Local-only test secrets were not embedded in the Worker or public client bundle. Audit-created local configuration was removed after testing.

## Deferred / limitations

- Fresh browser visual verification could not run: the computer-use tool reports “Local browser use is disabled in Work settings”. No alternative browser channel was used to bypass that setting, and no visual pass or new screenshot is claimed for this round. The previous audit's mobile screenshot is not evidence for these new changes.
- Production stress testing, independent penetration testing, live payment simulations, permission changes and destructive media tests remain deferred because they can disrupt real customers, consume quota or alter financial/access records. Their isolated logic tests passed; no CCU guarantee or security certification is claimed.
- Stronger password/retry requirements and admin 2FA remain unchanged under the owner's earlier preferences. External backup destination/retention and restore drills still need an owner decision. DRM/video encryption remains off as requested.
- Full conflict management for simultaneous admin genre renames and ongoing imports has not been redesigned in this round. Genre edits can still race with registry updates; avoid simultaneous category maintenance/import until a versioned admin-edit workflow is implemented. That change can rewrite multiple films and warrants a separate focused migration/concurrency test.
- Browser-refresh-resumable upload sessions and checksum-based recovery from a lost upload response are not added. Interrupted uploads must be checked in the uploaded-episode list before retrying; the current server rejects an existing episode number instead of overwriting it.

No customer records, videos, receipt images, passwords, session cookies or secret values are included in this source/report commit.

## Reproducing the optional local media smoke test

1. Apply D1 migrations locally and run the Vite server against local D1/R2. Configure a local-only `PLAYBACK_SECRET` in the ignored `.dev.vars` file; never copy production credentials into test fixtures.
2. Generate a short H.264 MP4 called `sample.mp4` and a PNG called `poster.png` in a private fixture directory outside the source checkout. These may be synthetic test patterns, not customer media.
3. Set `TEST_ORIGIN` to the localhost server and `TEST_FIXTURE_DIR` to that directory; run `node tests/media-runtime-smoke.mjs` from the checkout. The script rejects non-localhost origins, seeds only the local D1 database using `--local`, and writes a local test seed SQL file in the fixture directory.
