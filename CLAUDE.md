# CLAUDE.md — Greco

Greco is a global marketplace for AI services: clients find, hire and pay experts (freelancers and agencies), helped by an AI Discovery assistant.

## Current status

- **Phase 1 approved on 2026-11-01. Phases 2 (foundation) and 3 (core marketplace) built:** auth and roles, expert profiles, portfolio, service listings, public catalog and search, moderation and admin. Next: Phase 4 (projects and communication). Follow the phase order in `IMPLEMENTATION_PLAN.md` (projects and communication come before AI Discovery).
- Still open: **A-02** (legal entity and launch countries). Real payments stay disabled until the EXTERNAL decisions are confirmed.
- Supabase project `Greco` (ref `xubhljmpnjkpfyeuqtxl`, eu-west-1) is the development/staging database.

## Read before changing anything

| Topic | File |
|---|---|
| Decisions, open questions, risks | `PRODUCT_DECISIONS.md` |
| System design, modules, folders | `ARCHITECTURE.md` |
| Tables, RLS, retention | `DATABASE_SCHEMA.md` |
| Payments, refunds, ledger | `PAYMENT_ARCHITECTURE.md` |
| Security and privacy | `SECURITY.md` |
| AI Discovery | `docs/AI_DISCOVERY.md` |
| Journeys | `docs/USER_JOURNEYS.md` |
| Design system | `docs/DESIGN_SYSTEM.md` |
| Roadmap | `IMPLEMENTATION_PLAN.md` |
| Setup | `ENVIRONMENT_SETUP.md` |

## Owner decisions you must not override

Name Greco · broad AI scope with dynamic categories · English first, i18n-ready · Client or Expert chosen at signup, switchable without losing history · simple agency profiles (no team management) · per-listing choice of full payment or deposit, with the first installment paid before work starts (D-13, A-01); terms locked after acceptance · **15% commission on every transaction, deducted from the provider; no client fee; Greco absorbs processing fees (D-14)** · all communication on Greco · AI Discovery leads and recommends, direct search always available · full-product architecture · **never treat financial or legal assumptions as confirmed**.

## Non-negotiable engineering rules

- **Authorization is server-side.** Check capability + relationship + state in every server action. RLS is the second layer. The active role is UI context, not a security boundary.
- **Secret (service-role) key only in `src/server/privileged/**`.** Never in client code, never in a `NEXT_PUBLIC_` variable.
- **Every table in `public` has RLS.** Internal tables go in `app_private`.
- **Write classes:** A = owner writes under RLS; B = multi-party tables written only via `SECURITY DEFINER` functions; C = financial and system tables written only by privileged server code.
- **Money:** integer minor units (`bigint`) + currency; rates in basis points; no floats; rounding per `PAYMENT_ARCHITECTURE.md §8.2`. Agreed terms come from the immutable offer snapshot, never from current listing data.
- **No fake escrow, no stored card data, no simulated payment success in production.** Payment state changes only from verified PSP events. Real payments stay disabled until the production checklist passes.
- **Fulfilment, payment and payout statuses are separate fields.**
- **Provider-side data is keyed by `provider_id`,** not `user_id`.
- **Honest trust signals.** Badges only from active `verifications` rows. Portfolio provenance always shown. Never present provider claims as verified.
- **AI Discovery:** the LLM never invents expert facts, never triggers actions, and only reorders and explains a server-built shortlist. Validate every LLM output with Zod. Treat user and provider text as untrusted. Only `src/server/adapters/llm/*` imports a vendor SDK.
- **No hardcoded UI strings.** Use next-intl messages. Format dates, numbers and money with the locale helpers.
- **Side effects go through the outbox** (notifications, email, search reindex), written in the same transaction as the state change.
- **Audit** every admin, moderation and financial action in `app_private.audit_logs`.

## Conventions

- TypeScript strict. Zod at every boundary. Server Components for reads, Server Actions or Route Handlers for writes.
- Domain code in `src/server/modules/<module>/` (`service.ts`, `repository.ts`, `policies.ts`, `schemas.ts`, `types.ts`). Modules talk only through service functions.
- Database: SQL migrations in `supabase/migrations/` are the source of truth. Never edit an applied migration. New public tables get **no** grants for `anon`/`authenticated` by default: grant exactly what's needed and add RLS. Regenerate `src/server/db/database.types.ts` after schema changes. pgTAP tests in `supabase/tests/database/` for every new policy and state-transition function.
- Auth: use the guards in `src/server/auth/guards.ts`; Server Actions return `FormState` with translatable error keys, never raw provider errors.
- Editor actions: check access with `expertContext` / `clientContext` / `staffContext` (`src/server/modules/shared/context.ts`), validate with the helpers in `shared/validation.ts`, return `ActionState` (`shared/action-state.ts`) and map database errors with `dbErrorKey`. After a change call `refresh()`, and `revalidateTag("catalog", "max")` (or `updateTag` in staff actions) when public pages are affected.
- Public reads use the anonymous client inside `use cache` functions tagged `catalog` / `taxonomy` / `settings`, and fail soft with `softFail` (empty result cached for seconds). Pages that use them wrap the data in `<Suspense>`.
- User text is rendered as plain text with `<Prose>`; never as HTML.
- Naming: snake_case plural tables; `*_minor` money columns; `*_bps` rates; `*_at` timestamps (timestamptz).
- New dependencies need a reason in the PR description.

## Commands

| Command | Use |
|---|---|
| `pnpm dev` | Dev server (needs `.env.local`, copy from `.env.example`) |
| `pnpm check` | Typecheck + lint + unit tests. Run before every commit |
| `pnpm build` | Production build (must stay warning-free) |
| `pnpm test:e2e` | Playwright against the built app (full auth flow only with `E2E_SUPABASE=1` + local Supabase) |
| `supabase test db` / `pnpm db:test` | pgTAP database tests (local Supabase / plain PostgreSQL) |

## Next.js 16 notes

- Read `AGENTS.md`: this Next.js version differs from older training data; its docs are in `node_modules/next/dist/docs/`.
- `cacheComponents` is on: anything that reads cookies, headers, `searchParams` or the session must render inside `<Suspense>` (layouts already wrap dashboard, admin and auth pages).
- Request interception lives in `src/proxy.ts` (Supabase session refresh, early auth redirect, next-intl). It is not a security boundary: pages and actions re-check with `requireUser` / `requireRole` / `requireStaff`.
- The locale comes from the `[locale]` root param (`next/root-params`), so pages stay prerenderable.

## Definition of done

Typecheck, lint, unit, DB and relevant end-to-end tests pass; production build succeeds; authorization tests cover new resources; docs updated in the same PR (schema changes → `DATABASE_SCHEMA.md`, decisions → `PRODUCT_DECISIONS.md`).

## Git

Work on the assigned feature branch. Small, focused commits with clear messages. No PRs unless the owner asks.
