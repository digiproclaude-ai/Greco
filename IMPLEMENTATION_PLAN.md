# Greco — Implementation Plan

**Status:** Phase 1 approved 2026-11-01 (phase swap A-20 approved). **Phase 2 built 2026-11-01** (see the Phase 2 notes below). Next: Phase 3.
**Last updated:** 2026-11-01

Every phase ends only when its exit criteria pass: typecheck, lint, tests, production build, and documentation updated in the same PRs.

---

## Overview

| Phase | Name | Main outcome | Blocked by |
|---|---|---|---|
| 1 | Discovery and architecture | This document set | — (done, approved 2026-11-01) |
| 2 | Project foundation | Running app skeleton: auth, roles, base schema, RLS framework, design system, CI | Approval of Phase 1; A-25, A-26, A-27 |
| 3 | Core marketplace | Onboarding, profiles, categories, listings, portfolio, search, admin basics | A-11 |
| 4 | Projects and communication | Projects, proposals, messaging, notifications, saved items | A-13, A-29 (approved) |
| 5 | AI Discovery | Discovery workspace, briefs, matching | A-12, A-19 (approved) |
| 6 | Transactions and order management | Offers, checkout, orders, milestones, installments, deliveries, resolution, ledger, payouts (**sandbox**) | A-03 to A-08, A-15 to A-18, A-28. **Production: X-01 to X-05, X-11 to X-13** |
| 7 | Reputation and administration | Reviews, verification, full admin, analytics, audit viewer, DSA tooling | A-14, A-22, A-24 |
| 8 | Quality and launch preparation | Full test, security, accessibility and performance passes; launch | All blockers above |

**Approved change (A-20):** projects and communication now come **before** AI Discovery (spec order swapped), so Discovery ships with working "message expert", "post as project" and "invite" actions.

**Parallel tracks that should start now:**
- **Payments and legal track** (product owner + advisers): decide A-02, contact PSP candidates with the questionnaire in [PAYMENT_ARCHITECTURE.md §17](PAYMENT_ARCHITECTURE.md#17-questions-to-send-to-psp-candidates), engage counsel and tax advice for X-02 to X-14. This is the longest lead-time item and blocks real payments.
- **Supply track** (A-21): after Phase 3, invite a first group of experts into a private beta to build profiles and listings while later phases are built.

---

## Phase 2: Project foundation

**Scope**
- Next.js (latest stable, App Router), TypeScript strict, pnpm, ESLint (including `no-restricted-imports` for privileged code and a literal-string rule for i18n), Prettier, path aliases.
- Tailwind v4 + shadcn/ui with Greco design tokens. Fonts. Base layout shells (marketing, marketplace, dashboard, admin). Error, loading and not-found conventions.
- next-intl with the `[locale]` segment and English messages.
- Supabase CLI setup, local stack, migrations workflow, type generation, seed script.
- **Base schema migrations:** extensions; `profiles`, `user_roles`, `staff_roles`, `countries`, `legal_*`, `client_profiles`, `providers` (+ details), `categories` (+ translations, relations), `taxonomy_*`, `platform_settings` (+ history), `feature_flags`, `file_objects`, `app_private.audit_logs`, `app_private.outbox_events`; RLS helper functions; table-class conventions.
- **Auth:** signup with role selection and legal acceptance, email verification (custom SMTP), login, logout, password reset, Google OAuth, MFA enrolment, staff `aal2` enforcement; session handling with `@supabase/ssr`; guards (`requireUser`, `requireRole`, `requireStaff`).
- Outbox processor and job endpoint skeleton (pg_cron → job route with secret).
- Adapters scaffolding with interfaces only (LLM, payments, payouts, email, scanning).
- Sentry, structured logging, request IDs, security headers and CSP.
- **CI** (GitHub Actions): typecheck, lint, Vitest, `supabase test db`, Playwright smoke test, `next build`, RLS coverage check, secret scanning.
- Vercel project with `dub1` region, preview deployments, environment variables.

**Phase 2 delivery notes (2026-11-01)**
- Done: Next.js 16.4 + React 19 + Tailwind 4 + hand-built shadcn-style components with Greco tokens; next-intl (`[locale]`, root params); auth (register with role, country and legal acceptance, email confirmation via `/auth/callback` and `/auth/confirm`, login, logout, password reset, optional Google, TOTP MFA enrolment and challenge, terms re-acceptance); guards; client and expert workspaces with role switching; staff-only admin shell (MFA required); jobs endpoint + outbox processor; adapter interfaces; security headers; 7 migrations live on the development project; 88 pgTAP tests, 36 unit tests, 13 Playwright tests; GitHub Actions CI.
- Changed from the plan: CSP without nonces (incompatible with Cache Components, SECURITY.md §5); Sentry not wired until a DSN exists; email SMTP, Vercel project and Supabase auth URL/template settings must be configured by the owner (ENVIRONMENT_SETUP.md §5–6).
- Not testable from the build sandbox: its network policy blocks the Supabase project, so the full signup flow is exercised in CI against a local Supabase stack.

**Exit criteria:** a new user can sign up as client or expert, verify email, log in and see the right empty dashboard. Staff need MFA for `/admin`. pgTAP tests prove RLS on every base table. CI green. [ENVIRONMENT_SETUP.md](ENVIRONMENT_SETUP.md) and [CLAUDE.md](CLAUDE.md) have real commands.

## Phase 3: Core marketplace

**Scope**
- Client and expert onboarding (progressive, resumable). Agency details.
- Role switching (enable second role, switch workspace, badges for the other role).
- Provider profile editor and public profile page. Languages, skills and technologies, links. Profile completeness.
- **Admin shell** + **category and taxonomy management** (tree editor, translations, relations, deactivate and reassign, term suggestions and merging).
- Service listings: full editor (pricing models, payment model settings, packages, deliverables, add-ons, requirements, FAQs, media), versions, statuses.
- **Moderation queue** for providers and listings (approve or reject with a statement of reasons), plus injection-pattern screening.
- Portfolio items with provenance (self-reported only at this stage) and media.
- File uploads (public media) with type and size checks.
- `search_documents` refresh pipeline, search and filter UI, category pages, expert directory, SEO metadata, sitemaps.
- Homepage (real data, with graceful states when supply is thin), How it works, Become an expert.
- Saved experts, services and categories (small, and useful early).

**Exit criteria:** an expert can onboard, pass review and publish listings. A visitor can browse, filter, search and open profiles and listings. Admins manage categories without code changes. End-to-end tests for onboarding, role switch, listing publication and search pass. Lighthouse and axe checks on public pages pass.

## Phase 4: Projects and communication

**Scope**
- Projects (create, edit, publish, invite-only), attachments, invitations, proposals (with payment model and milestones), comparison view, shortlist, decline and withdraw.
- Messaging: direct and order conversations, realtime private channels, read status, attachments (private bucket + scanning adapter), blocks, reports, contact-policy engine (A-13), secret-sharing warning.
- Notifications: catalog, in-app feed and realtime bell, preferences, and **email for critical events** (A-29).
- Saved searches with optional alerts.
- Trust and safety basics: reports queue and moderation actions for messages and users.

**Exit criteria:** a client can post a project, receive and compare proposals, and talk to experts in realtime. Authorization tests prove only participants read conversations. The contact policy works as configured.

## Phase 5: AI Discovery

**Scope**
- `LlmProvider` with the Anthropic adapter (structured outputs, streaming, caching, refusal handling), route configuration, usage logging.
- Discovery orchestrator: turn step, brief patching and versioning, matching (retrieval, scoring, rerank and explain, validation), provenance labelling.
- Discovery workspace UI (desktop and mobile), brief editing, quick replies, matches, actions (view, save, post as project, message, invite).
- Guest sessions, quotas, bot protection, budgets and kill-switch.
- Admin Discovery monitoring.
- Evaluation harness with the golden set and fixtures in CI.

**Exit criteria:** the golden set passes the automated checks. Cost per session is measured and reported for A-19. Recommendations always come from real catalog data with valid evidence. The fallback to search works when the LLM is unavailable.

## Phase 6: Transactions and order management

**Scope (sandbox only until the production checklist passes)**
- Commission policies and fee snapshots. Money utilities with exhaustive rounding tests.
- Offers (package checkout, custom offers in chat, proposal acceptance), immutability, expiry.
- Checkout with full terms disclosure and explicit acceptance.
- `PaymentProvider` / `PayoutProvider` sandbox adapters; webhook ingestion with idempotency.
- Orders: milestones, installments (Model A and B), requirements, deliveries (files, links, repositories, notes), revisions, auto-completion, late detection, amendments.
- Resolution center: all case types, response windows, auto-outcomes, escalation, staff decisions with statements of reasons.
- Refunds (full and partial), chargeback records, recovery tracking.
- Ledger with invariants. Provider earnings lifecycle. Payouts. Daily reconciliation (against the sandbox).
- Admin finance views: orders, payments, refunds, cases, payouts, reconciliation.
- Client payments page and expert earnings and payouts pages.
- **Real PSP adapter** once X-01 is decided, tested in the PSP's test mode.

**Exit criteria:** every money path is covered by pgTAP and end-to-end tests (Model A, Model B with both triggers, each case type, partial refunds, refund after payout, chargeback won and lost). Ledger always balances. Payments stay disabled in production until the [production checklist](PAYMENT_ARCHITECTURE.md#18-production-enablement-checklist) passes.

## Phase 7: Reputation and administration

**Scope**
- Reviews (eligibility, window, double-blind if both directions are enabled, rating dimensions, responses, reports, moderation). Provider stats refresh.
- Verification: types, requests, manual portfolio verification, vendor identity and business verification (A-22), badges and "What's verified" UI, `greco_order` portfolio items with client consent.
- Full admin dashboard: users, providers, agencies, listings, projects, verification queue, orders, transactions, refunds, cases, reviews, reports, commission and platform settings UI, Discovery monitoring, KPI analytics, audit log viewer.
- DSA and P2B tooling: statements of reasons, appeals, "How recommendations work" page (X-06).
- Data export and account deletion flows.

**Exit criteria:** reviews can only come from eligible completed orders (tested). Badges render only from verification records (tested). Admin actions are all audited. KPIs available.

## Phase 8: Quality and launch preparation

- Full regression: unit, integration, pgTAP, end-to-end on all critical flows.
- Security review and external penetration test. Authorization matrix complete. Dependency and secret audits ([SECURITY.md §14](SECURITY.md#14-security-testing-before-launch-phase-8)).
- Accessibility audit (WCAG 2.2 AA). Responsive testing on real devices.
- Performance: load test search, messaging and Discovery. Query plans for hot paths. Caching verified.
- Production Supabase project with Point-in-Time Recovery. Restore drill. Runbooks (incidents, payments, moderation). Monitoring and alerts.
- Legal documents published. Payments production checklist complete. Country allow-list set.
- Launch checklist sign-off by the product owner.

---

## Not in the first launch (designed for, built later)

- Agency team seats and permissions (schema ready)
- Additional languages and machine translation of listings (i18n ready)
- Semantic (vector) search (planned trigger in [ARCHITECTURE.md §10](ARCHITECTURE.md#10-search-and-recommendation-architecture))
- Open-ended hourly billing and time tracking
- Paid placement or promoted listings
- Subscriptions or retainers
- Native mobile apps
- Public API
- Instant payouts (only if the PSP supports them)
- Public provider-to-client reviews
- Video calls
- Secure credential vault for handing over API keys
