# Playback access protection (not DRM)

The owner cancelled video encryption/HLS on 2026-10-27. All 27 episodes converted during the pilot/rollout were restored to their original MP4 bytes on R2 and verified against local backups before HLS was deactivated. Upload remains standard MP4. The old episode_hls table is retained only as migration history; no packaging service or job is enabled.

Current protection:
- Private R2; the Worker checks publication and paid/VIP/admin/granted access before issuing a ticket and again on each media request.
- AES-256-GCM authenticated playback tickets expire after 30 minutes, bound to the episode and current HttpOnly login/guest session. PLAYBACK_SECRET stays in Cloudflare Secrets, not source control. This encrypts the ticket, NOT the video.
- Maximum two active player leases per account. Each browser tab has an identifier. A lease expires after four minutes without a heartbeat. The player renews once a minute while playing and releases on unmount. An abruptly closed tab may keep a slot for four minutes.
- Native Worker rate limiting: 40 playback starts/minute per actor, 240 media reads/minute per actor; an IP start limiter also applies. These are approximate per-location limits, not globally strict anti-bot enforcement.
- Cross-origin media requests denied. No CORS allowance. Fetch Metadata/Origin checks supplement authentication; they do not replace it.
- Static JPEG thumbnails replace public video previews. Guest viewing still requires a guest playback ticket. Paid episodes additionally require a logged-in account with viewing rights.
- A moving HTML watermark identifies the account. It can be removed and may disappear in native iPhone fullscreen. It is NOT a watermark embedded in video pixels.
- Download, remote playback and Picture in Picture controls are hidden where supported. Raw MP4 links without a valid ticket/session are denied.

Limits: authorized viewers still receive clear MP4 and can save it with suitable tools, or record the screen. This is NOT DRM, enterprise certification or guaranteed download prevention. No DRM subscription or external paid service was added. Cloudflare requests/storage/operations still follow existing quotas and pricing.

Tests: tests/playback.test.mjs covers encrypted-ticket session/episode/account binding, tamper rejection, cross-site denial, two leases, release and throttling. Existing security tests cover paywalls, private wallets, roles, payment idempotency and CSRF.
