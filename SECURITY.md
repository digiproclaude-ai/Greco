# Greco — Security and Privacy

**Status:** Approved by the product owner on 2026-11-01.
**Last updated:** 2026-11-01

Related: [ARCHITECTURE.md §6–8](ARCHITECTURE.md) · [DATABASE_SCHEMA.md §20](DATABASE_SCHEMA.md) · [PAYMENT_ARCHITECTURE.md](PAYMENT_ARCHITECTURE.md) · [docs/AI_DISCOVERY.md §7](docs/AI_DISCOVERY.md)

**Reporting a vulnerability:** a security contact address will be published before launch. Until then, report privately to the product owner. Do not open public issues for security problems.

---

## 1. What we protect

| Asset | Why it matters |
|---|---|
| Money flows (payments, refunds, payouts, commission settings) | Direct financial loss, fraud, regulatory exposure |
| Personal data (names, emails, countries, tax data, verification evidence) | GDPR and similar laws; user trust |
| Private messages and attachments | Confidential business information; often contain access details |
| Deliverables (code, models, datasets) | Client intellectual property |
| Admin powers | Can move money, suspend users, read private content |
| AI Discovery | Cost abuse; manipulation of recommendations |
| Reputation data (reviews, badges) | The marketplace's trust signal |

## 2. Threat actors

Malicious clients (refund abuse, chargeback fraud, stolen cards), malicious providers (fake portfolios, prompt injection, off-platform diversion, collusion to farm reviews), account takeover attackers, bots (scraping, signup spam, Discovery cost abuse), insiders (staff misusing access), and supply-chain risks (compromised dependencies).

---

## 3. Authentication

- **Supabase Auth** with secure cookie sessions (`@supabase/ssr`). Server code verifies the user with `getUser()`/`getClaims()`, never by trusting the session cookie alone.
- Email + password (minimum length, leaked-password protection), Google OAuth, optional LinkedIn for experts.
- **Email verification required** before transacting, messaging or publishing.
- **MFA (TOTP):** mandatory for all staff (enforced as `aal2` in the request proxy, server guards and RLS). Strongly encouraged for experts. Required for agency accounts (A-23).
- Production auth emails go through a custom SMTP provider (A-25).
- Security notifications (new sign-in, password or email change, MFA change, payout details change) cannot be turned off.
- Sensitive changes (email, password, payout details) require a fresh sign-in.

## 4. Authorization (defence in depth)

1. **Route guards** in layouts and the request proxy (signed in, role enabled, staff + MFA for `/admin`).
2. **Service-level policies** in every server action: capability + relationship + state ([ARCHITECTURE.md §8.2](ARCHITECTURE.md#82-authorization-rules)).
3. **Database functions** re-check actor and state for every multi-party transition (Class B).
4. **RLS** on every exposed table as the last line of defence.

Rules:
- The **service-role (secret) key** is only importable from `src/server/privileged/**` (lint-enforced) and never reaches the browser. Nothing secret uses a `NEXT_PUBLIC_` variable.
- Internal tables live in the non-exposed `app_private` schema.
- **CI fails** if any table in `public` lacks RLS, or if `anon` has write grants.
- **Authorization test matrix** (pgTAP and Playwright): for each sensitive resource, test owner, counterparty, unrelated user, anonymous user and each staff role.
- No self-dealing: users can't buy from, propose to, or review providers they own.

## 5. Input, output and web protections

- **Validation:** Zod at every boundary. Database constraints as a backstop (lengths, ranges, enums, money ≥ 0).
- **Output encoding:** React escaping. User Markdown is rendered with a sanitizer (no raw HTML, safe link protocols only, `rel="nofollow ugc noopener"`). No `dangerouslySetInnerHTML` for user content.
- **CSRF:** Server Actions check the origin. Route handlers that change state check `Origin` and use same-site cookies.
- **Headers** (set in `next.config.ts`): Content-Security-Policy, HSTS (production), `X-Content-Type-Options: nosniff`, `X-Frame-Options: DENY`, `frame-ancestors 'none'`, strict `Referrer-Policy`, minimal `Permissions-Policy`, `Cross-Origin-Opener-Policy`.
- **CSP trade-off (decided in Phase 2):** Next.js 16 Cache Components prerender a static shell, and nonce-based CSP cannot work with prerendered pages. The CSP therefore allows inline scripts (`script-src 'self' 'unsafe-inline'`) while keeping every other directive strict (`default-src 'self'`, `object-src 'none'`, `base-uri 'self'`, `frame-ancestors 'none'`, `form-action` limited to the app, Supabase and Google). XSS protection relies on React escaping, sanitized Markdown and the ban on `dangerouslySetInnerHTML` for user content. Revisit when Next's hash-based (SRI) CSP is stable.
- **SSRF:** the server never fetches arbitrary user URLs at launch (no link previews). If added later, only through an allowlisted fetcher that blocks private IP ranges.
- **Rate limiting:** Supabase Auth limits for auth endpoints. App-level limits on messaging, proposals, reports, uploads and Discovery (Postgres counters for business quotas; Vercel Firewall rules or a Redis-based limiter for request floods, decided in Phase 2).
- **Bot protection:** Turnstile on signup, guest Discovery and reports.

## 6. Files

- Allowlisted MIME types per purpose, checked by **magic bytes**, plus size limits per purpose.
- Private buckets for anything not intended to be public. Access through short-lived signed URLs only.
- Public images are re-encoded to strip EXIF and GPS metadata.
- **Malware scanning** before a file becomes downloadable by anyone other than the uploader (`file_objects.scan_status`).
- Downloads use `Content-Disposition: attachment`. User files are served from the Supabase storage domain, not the app domain.
- Storage RLS checks paths against database membership (order party, conversation participant, owner).

## 7. Payments

- No card data ever touches Greco (PSP-hosted payment steps).
- Webhooks: signature verification on the raw body, timestamp tolerance, idempotent event store, forward-only state transitions.
- Payment state changes only from verified PSP events or verified API reads.
- Commission and payment settings changes require the `finance` or `admin` role plus MFA, apply only from a future date, and are audited with before/after values.
- Daily reconciliation against the PSP, with alerts on mismatches.
- The sandbox adapter cannot run in production ([PAYMENT_ARCHITECTURE.md §2](PAYMENT_ARCHITECTURE.md#2-principles)).

## 8. Fraud and abuse controls

| Pattern | Controls |
|---|---|
| Card testing, stolen cards | PSP fraud tooling; checkout rate limits; verified email required; value limits for brand-new client accounts |
| Chargeback abuse | Strong evidence from the order timeline; earnings held until acceptance + clearance (A-06) |
| Self-dealing and collusion (fake orders for reviews or laundering) | Can't buy from your own provider; linked-account signals (shared payment method, device, IP patterns) flagged for review; PSP KYC; review anomaly detection |
| Fake portfolio or credentials | Provenance labels; verification records; reporting; moderation |
| Off-platform diversion | Contact policy (A-13); value-based retention; signals logged for moderation |
| Spam and scraping | Turnstile, rate limits, public pages show no private data, robots rules for private areas |
| Prompt injection | [docs/AI_DISCOVERY.md §7](docs/AI_DISCOVERY.md#7-security) |

## 9. Staff and admin

- Least-privilege staff roles: `super_admin`, `admin`, `moderator`, `support`, `finance`.
- MFA mandatory. Sessions time out after inactivity.
- Sensitive actions (refunds, payout holds, suspensions, settings changes, viewing private conversations) require a **reason** and are written to `audit_logs`.
- Staff read private conversations only through a report or resolution case, and every view is audited.
- No "log in as user" at launch.
- Staff role grants and removals are audited and require an `admin`.
- Supabase Studio is not used for business operations in production, because changes there bypass audit logs.

## 10. Audit logs

Append-only `app_private.audit_logs` (no UPDATE or DELETE, enforced by trigger and revoked privileges) for every admin action, financial event, settings change, role change, verification decision, moderation decision and staff access to private content. Includes actor, action, target, before/after (sensitive values redacted), reason, request ID and a hashed IP. Retained 7 years (proposal, X-14). Viewable by `admin` and `super_admin`.

## 11. Secrets and dependencies

- Secrets live in Vercel and Supabase environment settings only, separate per environment, and are rotated on staff changes or suspected exposure.
- `server-only` imports on all server modules. Secret scanning in CI.
- Dependency updates through Dependabot or Renovate. Lockfile committed. New dependencies need a reason in the PR description.
- Logs never include secrets, tokens, message bodies or payment details. Sentry has PII scrubbing turned on.

---

## 12. Privacy (GDPR-conscious design; legal confirmation under X-08)

- **Data minimisation:** collect only what a feature needs. Optional onboarding fields really are optional. The full name stays private; public pages use display or business names.
- **Lawful bases** documented per processing purpose (contract, legal obligation, legitimate interest, consent for optional analytics and marketing).
- **Sub-processors** (Supabase, Vercel, LLM vendor, PSP, email, Sentry, verification vendor) listed publicly, with data processing agreements and transfer safeguards.
- **Transparency:** clear privacy notice, an AI Discovery notice, and a "How recommendations work" page.
- **Data subject rights:**
  - *Export:* a job builds a machine-readable archive (profile, listings, orders, messages the user sent, reviews, Discovery sessions) in the private `exports` bucket. The link expires after 7 days.
  - *Deletion:* the account enters `pending_deletion` (grace period, for example 14 days), then is anonymised. Personal fields are cleared, public content is removed or attributed to "Deleted user", and financial and contractual records are kept pseudonymised for their statutory period (X-14). Deletion is blocked while orders, cases or balances are open.
  - *Rectification and objection* through settings or support.
- **Retention schedule:** [DATABASE_SCHEMA.md §22](DATABASE_SCHEMA.md#22-data-retention-proposal-legal-to-confirm-under-x-08-and-x-14).
- **Cookies:** essential cookies only by default. Analytics only with consent (A-24).
- **Personalisation** is transparent ("Because you saved…") and can be turned off in settings.
- **Encryption:** in transit (TLS) and at rest (platform-level). Tax identifiers and similar sensitive fields get additional application-level encryption with keys outside the database. We will not rely on database-level column encryption extensions that Supabase discourages for new projects.

## 13. Reliability and incident response

- Backups: Supabase daily backups. **Point-in-Time Recovery** in production before real payments.
- Restore drills before launch and quarterly afterwards.
- Incident runbook: triage, contain (feature flags and kill-switches for Discovery, messaging and payments), communicate, fix, review. Personal-data breaches assessed against the 72-hour notification duty.
- Kill-switches in `platform_settings`: `discovery.enabled`, `payments.live_enabled`, `messaging.enabled`, `signups.enabled`.

## 14. Security testing before launch (Phase 8)

- Authorization matrix complete and passing (pgTAP and end-to-end)
- Security review of auth, payments, files, messaging, admin and AI code paths
- Dependency audit and secret scan clean
- External penetration test of the production-like environment
- Headers and CSP verified
- Webhook replay and idempotency tests
- Backup restore drill
