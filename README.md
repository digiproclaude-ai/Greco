# Greco

**A global marketplace for AI services.** Clients describe a business problem in plain language, get help understanding which AI service they need, and hire verified experts and agencies, with protected payments, structured delivery and fair dispute handling. Direct search and category browsing are always available.

## Status

**Phase 1: Discovery and Architecture.** Delivered on 2026-11-01. **Waiting for product owner approval.** No application code has been written yet.

## Documents

| Document | What it covers |
|---|---|
| [PRODUCT_DECISIONS.md](PRODUCT_DECISIONS.md) | Decisions already made, decisions needing approval, legal/financial questions, critique of the spec, risk register. **Start here.** |
| [ARCHITECTURE.md](ARCHITECTURE.md) | System architecture, stack, modules, roles and role switching, folder structure, search, messaging, notifications, files, i18n |
| [DATABASE_SCHEMA.md](DATABASE_SCHEMA.md) | Proposed schema, relationships, RLS strategy, indexes, retention |
| [PAYMENT_ARCHITECTURE.md](PAYMENT_ARCHITECTURE.md) | Payment models, fund flow, PSP options, commission, refunds, disputes, ledger, blockers |
| [SECURITY.md](SECURITY.md) | Threat model, controls, privacy and GDPR design |
| [docs/AI_DISCOVERY.md](docs/AI_DISCOVERY.md) | AI Discovery experience, architecture, matching, safety, cost |
| [docs/USER_JOURNEYS.md](docs/USER_JOURNEYS.md) | Main user journeys and edge cases |
| [docs/DESIGN_SYSTEM.md](docs/DESIGN_SYSTEM.md) | UI/UX direction, tokens, components, accessibility |
| [IMPLEMENTATION_PLAN.md](IMPLEMENTATION_PLAN.md) | Phased roadmap with exit criteria |
| [ENVIRONMENT_SETUP.md](ENVIRONMENT_SETUP.md) | Environments, variables, accounts (planned) |
| [CLAUDE.md](CLAUDE.md) | Working rules for AI-assisted development |

## Planned stack

Next.js (App Router) · React · TypeScript · Tailwind CSS · shadcn/ui · Supabase (Postgres, Auth, Storage, Realtime) · Anthropic Claude behind a provider-independent adapter · payment provider to be selected · Vercel.

## Getting started

Not available yet. Phase 2 will add setup instructions to [ENVIRONMENT_SETUP.md](ENVIRONMENT_SETUP.md).
