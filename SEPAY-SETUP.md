# SePay wallet integration

Production webhook: https://hotai.bro.io.vn/api/sepay/webhook

- Receive incoming transactions only, JSON, selected TPBank account 54906021995, retry enabled.
- Authentication: API Key. The matching secret must be stored as Worker secret SEPAY_WEBHOOK_KEY, never source code or public frontend variables.
- settings.sepay_enabled must be 1 after configuration. Missing secret or flag disables QR and credits.
- Each user receives a stable payment code plus username in memo. Use the full generated memo; username alone is not sufficient for reliable matching.
- Credits are based on authenticated bank incoming amount, not the requested QR amount. No receipt uploads for new deposits.
- D1 batch writes transaction, approved deposit and wallet ledger atomically. Unique transaction id, bank reference and ledger source prevent duplicate credits.
- Unknown/ambiguous codes are recorded unmatched without credit. Review those transactions with SePay if a customer contacts support.
- Check balance refreshes the app ledger, not a client-side bank query. While wallet is open, it refreshes every 5 seconds in the foreground.
- TPBank/SePay latency is external; 5–30 seconds is a UI estimate, not a guaranteed SLA.
- Old pending receipts remain available to the admin for manual resolution. Existing purchased movies and wallet balances remain unchanged.

Verification: node tests/sepay.test.mjs; node tests/security.test.mjs; node tests/auth.test.mjs; tsc --noEmit.
