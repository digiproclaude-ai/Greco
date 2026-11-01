# Greco — Environment Setup

**Status:** Planned. The application is not scaffolded yet (Phase 2). This file lists what Phase 2 will set up and will be replaced with exact, tested commands then.
**Last updated:** 2026-11-01

---

## 1. Environments

| Environment | App | Database | Notes |
|---|---|---|---|
| Local | `pnpm dev` | Supabase CLI local stack (Docker) | Seed data, sandbox payment adapter, LLM fixtures by default |
| Preview | Vercel preview deployment per PR | Development Supabase project | Sandbox payments only |
| Staging | Vercel (staging branch) | Existing Supabase project **`Greco`** (A-27) | Production-like configuration, sandbox payments |
| Production | Vercel (main) | New Supabase project, created before launch | Point-in-Time Recovery on; live payments only after the production checklist |

**Existing Supabase project** (checked 2026-11-01): name `Greco`, ref `xubhljmpnjkpfyeuqtxl`, region `eu-west-1` (Ireland), Postgres 17, empty `public` schema, no migrations. Vercel functions should run in `dub1` (Dublin) to stay close to it.

## 2. Prerequisites (local)

- Node.js (current LTS) and pnpm
- Docker (for the local Supabase stack)
- Supabase CLI
- A Vercel account linked to the GitHub repository (for previews)

## 3. Environment variables (names only; values never committed)

| Variable | Scope | Purpose |
|---|---|---|
| `APP_ENV` | server | `local` / `preview` / `staging` / `production` |
| `NEXT_PUBLIC_APP_URL` | public | Canonical app URL |
| `NEXT_PUBLIC_SUPABASE_URL` | public | Supabase project URL |
| `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` | public | Supabase publishable key (safe in the browser; RLS applies) |
| `SUPABASE_SECRET_KEY` | **server, privileged code only** | Service-role access for webhooks, jobs and audited admin actions |
| `JOBS_SECRET` | server | Authenticates pg_cron → job endpoint calls |
| `ANTHROPIC_API_KEY` | server | LLM adapter |
| `LLM_DAILY_BUDGET_USD` | server | Global Discovery spend cap (also mirrored in `platform_settings`) |
| `PAYMENTS_PROVIDER` | server | `sandbox` until a PSP is chosen. Refused as `sandbox` when `APP_ENV=production` |
| `PSP_SECRET_KEY`, `PSP_WEBHOOK_SECRET` | server | Added once X-01 is decided |
| `EMAIL_PROVIDER_API_KEY`, `EMAIL_FROM` | server | Transactional email (A-25); also configured as Supabase Auth SMTP |
| `TURNSTILE_SITE_KEY` / `TURNSTILE_SECRET_KEY` | public / server | Bot protection |
| `SENTRY_DSN`, `SENTRY_AUTH_TOKEN` | public / CI | Error monitoring and source maps |
| `ENCRYPTION_KEY_TAX` | server | Application-level encryption for tax identifiers (from a secret manager) |

Rules: nothing secret ever starts with `NEXT_PUBLIC_`. Each environment has its own keys. `.env.local` is git-ignored, and `.env.example` lists names only.

## 4. Third-party accounts needed

| Service | When | Notes |
|---|---|---|
| Supabase | Now | Development project exists. Production project before launch. |
| Vercel | Phase 2 | Region `dub1` |
| Email provider (Resend or Postmark) | Phase 2 | Domain authentication (SPF, DKIM, DMARC) |
| Sentry | Phase 2 | EU data region if available |
| Cloudflare Turnstile | Phase 2 | |
| Anthropic API | Phase 5 | Review data retention and data processing terms (X-08) |
| Payment provider sandbox | Phase 6 | After X-01. Sandbox adapter until then |
| File scanning service | Phase 4 | Decision in Phase 4 |
| Identity verification vendor | Phase 7 | A-22 |

## 5. Planned commands (to be confirmed in Phase 2)

```bash
pnpm install
```

```bash
supabase start
```

```bash
pnpm db:reset
```

```bash
pnpm dev
```

```bash
pnpm check
```

`pnpm db:reset` will re-apply migrations and seed data locally. `pnpm check` will run typecheck, lint, unit tests and DB tests.
