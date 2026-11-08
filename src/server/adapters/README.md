# Adapters

Vendor integrations live behind these interfaces so providers can change without touching
domain code (ARCHITECTURE.md §3, E-10). Only files in this folder may import vendor SDKs
(enforced by ESLint). Implementations arrive with their phase:

| Adapter | Phase | Notes |
|---|---|---|
| `email` | 4 | Resend over HTTP (`resend.ts`); skipped without `RESEND_API_KEY` and `EMAIL_FROM` (E-34) |
| `scanning` | 4 | ClamAV REST service (`clamav-rest.ts`); uploads stay pending without `CLAMAV_URL` (E-33) |
| `llm` | 5 | Anthropic first (`claude-opus-5-5`), docs/AI_DISCOVERY.md §5 |
| `payments`, `payouts` | 6 | Sandbox first; real PSP after X-01 (PAYMENT_ARCHITECTURE.md §12) |
