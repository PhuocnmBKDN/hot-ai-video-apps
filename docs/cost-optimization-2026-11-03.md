# Cloudflare cost optimization — 2026-11-03

Implementation is prepared locally. Production deployment requires an authenticated Wrangler session and migration `0021_cost_artwork.sql` before deploying the Worker. Do not claim an invoice saving until usage is measured.

## Implemented

- Catalog API performs filtering/sorting/pagination before sending results. Normal pages contain at most 100 compact film summaries; episode IDs are loaded through `/api/film` only when opening a film. TOP 10 genre discovery retains its complete summary pool and lazy images.
- The shared metadata cache remains revision-aware. `episode_count`, maintained by insert/delete/move triggers, replaces repeated scans of every episode. Obsolete whole-order buyer aggregation was removed from catalog rebuilding.
- Published poster bytes use the Cloudflare Cache API with an artwork-specific version. Publication/soft deletion is checked before reading edge cache; drafts remain admin-only and non-cacheable. Public poster requests skip session lookup entirely. Conditional ETags support 304 responses.
- `series.artwork_version` changes only when poster/frame settings change, not for title edits or episode uploads. A first-frame upload invalidates an earlier uploaded-poster fallback. Existing images start at version 1.
- Playback combines current paywall settings and purchased/complimentary access into its episode lookup; session and lease revocation checks remain live. AES-GCM CryptoKey import is reused in the isolate. Video metadata cache and byte-range behavior are retained.
- Period ranking aggregates have a bounded 30-second cache and concurrent reads coalesce.
- Admin film and user lists return bounded pages. Film metadata and episode detail are scoped to the selected film. Affiliate/payment-setting tabs no longer request the entire film/episode/payment dashboard.
- Account refresh loads recent history at most once per minute per user in the current page. Watched markers are queried per film rather than loading every watched episode at startup; an indexed `(user_id,series_id)` lookup supports it.
- Repeat film opens by the same actor/film are suppressed for 30 minutes using a bounded isolate-local map. This is best-effort cost/abuse suppression, not a globally exact unique-view metric. Cold isolates/regions can count another open; shared guest IPs can undercount.
- Existing wallet polling, O(1) derived balances, unchanged-progress suppression, static assets, streaming responses and batched cleanup remain in place.

## Media tools

- `GET /api/admin/storage?audit=1&cursor=…` lists 500 R2 objects per page, counts bytes, and reports large posters and potentially unreferenced episode/poster/preview keys. Follow `nextCursor` until null. It never deletes anything and is admin-only. Imports in progress can appear unreferenced; verify before deletion.
- `node scripts/optimize-upload.mjs <input.mp4> <new-output-directory>` uses local FFmpeg H.264/AAC, CRF 22, up to 1080×1920 within the original aspect ratio and fast-start MP4. It never overwrites inputs/cloud files. A larger output is discarded; smaller output requires visual/audio/subtitle review before upload. `FFMPEG_PATH` overrides the workspace tool path. No transcoding library is loaded into customers' browsers.
- The existing poster normalization script now walks all catalog pages and increments artwork versions after replacing objects. It retains private original backups. It is an explicit maintenance operation, not an automatic recurring download of the entire bucket.

## Compatibility and trade-offs

- Pre-deployment public baseline measured on 2026-11-03: `/api/catalog?page=1&size=12` still returned 353,737 JSON bytes, 72 films and 4,554 episode entries. This is a payload measurement, not a billing measurement.
- New clients request `/api/watch-history?summary=1`; old clients retain complete watched-marker responses until they update.

- Old clients calling `/api/catalog` without pagination/filter parameters still receive episode arrays temporarily; new clients always send page/size. Remove this fallback only after old PWAs have updated. Old admin requests without a film ID also retain their previous behavior.
- Catalog summaries are still rebuilt as a shared in-memory snapshot on revision changes / 30-second expiry. This intentionally retains Vietnamese accent-insensitive search and natural sorting. It is not SQL LIMIT/OFFSET for catalog scans; user-list pagination is SQL-based. At a much larger film count, measure snapshot size and consider sharded summaries/search indexes.
- Cache API is per data center, best effort, and can evict objects. It reduces R2 reads but still executes the authorization Worker and publication query. Private R2 is unchanged.
- No balance, financial ledger, user entitlement, session, or draft image is stored in shared caches.
- No customer/financial history was purged; existing cloud videos were not recompressed or deleted. Video quality, distribution rights, and retention choices require explicit operational review.
- The full upload/import runtime smoke on this host encounters a Node 24/Miniflare stream `ECONNRESET`; the original test remains unchanged. The focused cost runtime test passes on real Worker/D1/R2, and import/checksum unit tests pass. Do not represent the full upload runtime smoke as passed in this review.

## Validation

`npm run typecheck`, `npm test` (including cost-v2), production build, and `node tests/cost-runtime.mjs`. Added tests cover disjoint pages, bounded admin lists, lazy episodes, trigger counts, source-specific artwork versions, cross-user rights isolation, warm-cache draft denial, coalescing, and repeat-view suppression. Local encoding was tested on the synthetic sample: because encoding was larger, the tool retained the original.

Fresh desktop/mobile visual verification and before/after production Usage/Billing comparison are not claimed. Wrangler `whoami` reported unauthenticated at the deployment check.
