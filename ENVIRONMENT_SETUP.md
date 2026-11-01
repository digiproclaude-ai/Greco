# Greco — Environment Setup

**Status:** Phase 2. Commands below are real and tested.
**Last updated:** 2026-11-01

---

## 1. Environments

| Environment | App | Database | Notes |
|---|---|---|---|
| Local | `pnpm dev` | Supabase CLI stack (`supabase start`, needs Docker) or the development project | Sandbox payments, LLM fixtures |
| CI | GitHub Actions | Supabase CLI stack inside the runner | See `.github/workflows/ci.yml` |
| Preview | Vercel preview deployment per PR | Development project | Sandbox payments only |
| Staging | Vercel | Supabase project **`Greco`** (ref `xubhljmpnjkpfyeuqtxl`, eu-west-1) | Schema applied 2026-11-01 |
| Production | Vercel | New Supabase project, created before launch | Point-in-Time Recovery on; live payments only after the production checklist |

## 2. Prerequisites

- Node.js 22+ and pnpm 10 (the version is pinned in `package.json`)
- Docker, for the local Supabase stack
- Supabase CLI
- Without Docker: PostgreSQL 16+ with pgTAP and pg_prove, to run the database tests (`pnpm db:test`)

## 3. Commands

```bash
pnpm install
```

```bash
cp .env.example .env.local
```

```bash
pnpm dev
```

```bash
pnpm check
```

```bash
pnpm build
```

```bash
pnpm test:e2e
```

```bash
supabase start
```

```bash
supabase test db
```

```bash
pnpm db:test
```

| Command | What it does |
|---|---|
| `pnpm dev` | Development server on http://localhost:3000 |
| `pnpm check` | Typecheck, lint and unit tests (run before every push) |
| `pnpm build` | Production build |
| `pnpm test:e2e` | Builds must exist first. Starts the production server on port 3100 and runs Playwright. The full auth-flow tests only run with `E2E_SUPABASE=1` against a local Supabase stack |
| `supabase start` | Local Supabase with all migrations and `supabase/seed.sql` applied |
| `supabase test db` | pgTAP database tests against the local stack (what CI runs) |
| `pnpm db:test` | The same pgTAP tests on a plain local PostgreSQL, using `scripts/db/supabase-stubs.sql` (for machines without Docker) |
| `pnpm format` | Prettier |

To use a preinstalled Chromium with Playwright, set `PLAYWRIGHT_CHROMIUM_EXECUTABLE`.

## 4. Environment variables

Names only. Values never go into git (`.env*.local` is ignored; `.env.example` lists the names).

| Variable | Scope | Purpose |
|---|---|---|
| `APP_ENV` | server | `local` / `preview` / `staging` / `production` |
| `NEXT_PUBLIC_APP_URL` | public | Canonical app URL, used in auth email links |
| `NEXT_PUBLIC_SUPABASE_URL` | public | Supabase project URL |
| `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` | public | Publishable key (`sb_publishable_…`); RLS applies |
| `NEXT_PUBLIC_AUTH_GOOGLE_ENABLED` | public | `true` once the Google provider is configured in Supabase |
| `SUPABASE_SECRET_KEY` | **server, privileged code only** | Secret key for jobs and webhooks. Never `NEXT_PUBLIC_` |
| `JOBS_SECRET` | server | Bearer token for `/api/jobs/*` (32+ random characters) |
| Later | server | `ANTHROPIC_API_KEY` (Phase 5), `PSP_*` (Phase 6), email provider key (A-25), `SENTRY_DSN` |

## 5. Supabase dashboard settings (development/staging project)

The schema is managed by migrations. These settings live in the dashboard and must be set by the owner:

1. **Authentication → URL Configuration**
   - Site URL: the deployed app URL (for example the Vercel staging URL).
   - Redirect URLs: add `https://<app-domain>/**` and `http://localhost:3000/**`.
2. **Authentication → Email templates** (so confirmation links also work on another device):
   - *Confirm signup*: link to `{{ .SiteURL }}/auth/confirm?token_hash={{ .TokenHash }}&type=email&next=/dashboard`
   - *Reset password*: link to `{{ .SiteURL }}/auth/confirm?token_hash={{ .TokenHash }}&type=recovery&next=/reset-password`
   - *Change email address*: link to `{{ .SiteURL }}/auth/confirm?token_hash={{ .TokenHash }}&type=email_change`
   The default templates also work (through `/auth/callback`), but only in the same browser that started the flow.
3. **Authentication → SMTP**: connect the transactional email provider (A-25: Resend or Postmark). Supabase's built-in sender is rate-limited and not for production.
4. **Authentication → Providers → Email**: confirm email ON, minimum password length 10, leaked-password protection ON (where the plan allows it).
5. **Authentication → Multi-Factor**: TOTP enabled (default).
6. **Authentication → Providers → Google** (optional): add the Google OAuth client, then set `NEXT_PUBLIC_AUTH_GOOGLE_ENABLED=true`.
7. **Project Settings → API keys**: copy the publishable key into Vercel; copy the secret key into Vercel as `SUPABASE_SECRET_KEY` (server only).

## 6. Vercel

1. Import the GitHub repository. Framework: Next.js. Package manager: pnpm.
2. **Settings → Functions → Region:** `dub1` (Dublin), next to the database in eu-west-1.
3. Add the variables from §4 for Preview and Production.

## 7. Background jobs

The outbox processor runs at `POST /api/jobs/process-outbox` with `Authorization: Bearer <JOBS_SECRET>`. Once the app is deployed, schedule it every minute from the database (Supabase Cron + pg_net), keeping the secret in Supabase Vault:

```sql
select vault.create_secret('<JOBS_SECRET>', 'jobs_secret');

select cron.schedule('process-outbox', '* * * * *', $$
  select net.http_post(
    url := 'https://<app-domain>/api/jobs/process-outbox',
    headers := jsonb_build_object(
      'Authorization', 'Bearer ' || (select decrypted_secret from vault.decrypted_secrets where name = 'jobs_secret')
    )
  );
$$);
```

Phase 2 events have no side effects yet, so this can wait until Phase 4 (notifications).

## 8. Database workflow

- Write a new migration in `supabase/migrations/` (never edit one that has been applied), plus pgTAP tests in `supabase/tests/database/`.
- Run `supabase test db` (or `pnpm db:test`).
- Apply to the development project, then rename the local file to the version Supabase recorded so CLI history stays consistent.
- Regenerate `src/server/db/database.types.ts` from the schema.
- Update `DATABASE_SCHEMA.md`.

## 9. Third-party accounts

| Service | When | Notes |
|---|---|---|
| Supabase | Now | Development project ready. Production project before launch |
| Vercel | Now | Region `dub1` |
| Email provider (Resend or Postmark) | Before inviting real users | Domain authentication (SPF, DKIM, DMARC) |
| Sentry | When a DSN exists | Not wired yet; added with the DSN |
| Cloudflare Turnstile | Phase 5 (guest AI Discovery) | Bot protection |
| Anthropic API | Phase 5 | Review data retention and data processing terms (X-08) |
| File scanning service | Phase 4 | Decision in Phase 4 |
| Payment provider sandbox | Phase 6 | After X-01. Sandbox adapter until then |
| Identity verification vendor | Phase 7 | A-22 |
