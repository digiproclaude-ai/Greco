# Greco — Product Decisions Register

**Status:** Approved by the product owner on 2026-11-01. One change (commission 15%, D-14) and one open item (A-02).
**Last updated:** 2026-11-01

This file records every decision that shapes Greco, who owns it, and whether it is settled. It is the first document to update when a decision changes.

| Tag | Meaning |
|---|---|
| **OWNER** | Already decided by the product owner. Engineering must not override it. |
| **ENG** | Engineering decision that the team can safely make. Listed so it is visible. Details are in [ARCHITECTURE.md](ARCHITECTURE.md). |
| **APPROVAL** | Needs product owner approval because it materially affects money, security, architecture or user experience. Each item has a recommendation. |
| **EXTERNAL** | Needs legal, tax, accounting or payment-provider confirmation **in writing**. Never treated as settled until confirmed. |

---

## 1. Decisions already made by the product owner (OWNER)

| ID | Decision | Architectural consequence |
|---|---|---|
| D-01 | Product name: **Greco**. | — |
| D-02 | Global marketplace for a broad, open-ended range of AI services. | Categories and skills are data (hierarchical, admin-managed), never enums in code. |
| D-03 | Launch language is English. Other languages later. | i18n library and locale-aware routing from day one. Translation tables for platform-owned content. No hardcoded UI strings. |
| D-04 | Users choose Client or Expert at signup. | Registration creates the account, the chosen role and its profile shell. |
| D-05 | Users can change role later without losing anything. | One account. Per-role profiles. Data is keyed to the user or provider, never to the "active role". |
| D-06 | Agencies get a simple profile. No team management. | `providers.provider_type = 'agency'`. All provider-side data is keyed by `provider_id` (not `user_id`) so team seats can be added later without a data migration. |
| D-07 | Clients pay the full agreed amount upfront before work starts. | **Amended by D-13.** See note below. |
| D-08 | All client–provider communication happens on Greco. | Internal messaging. No exposed emails or phone numbers. Configurable policy for off-platform attempts. |
| D-09 | AI Discovery leads the conversation, clarifies needs and recommends experts. | Server-side orchestrator, structured project briefs, explainable matching. |
| D-10 | Direct search and category browsing always remain available. | Discovery never blocks the marketplace. Both use the same data and search functions. |
| D-11 | Full-product, extensible architecture, not a narrow MVP. | Complete schema and module boundaries are designed now. Delivery is phased. |
| D-12 | Financial and legal assumptions are never treated as confirmed without verification. | The EXTERNAL class below. Production payments are gated behind it. |
| D-13 | **Flexible payment policy (addendum).** Per listing or custom offer, the provider chooses **Model A (full payment)** or **Model B (deposit + balance)**. Terms cannot change after acceptance without client approval. Collection and payout are separate concepts. No internal escrow. Refund and dispute policy as described in the addendum. Commission is configurable and shown transparently. | Every order has a **payment schedule** (installments) and **milestones**. Offers are immutable snapshots. Changes go through amendments that need both parties' approval. Payment, payout and earnings each have their own status. |

| D-14 | **Commission: 15% on every transaction**, deducted from the provider's earnings. No client fee. Greco absorbs processing fees. Goal: Greco keeps at least 10% net. (Owner, 2026-11-01; replaces the 10% recommendation in A-03.) | Seeded as the global commission policy (1500 bps) when the payments module is built. Net take rate is monitored; a per-order minimum commission is available if small or international payments push net below 10%. |
| D-15 | **All other recommendations in §3 approved** (owner, 2026-11-01), including the phase swap (A-20). A-02 is still open. | Implementation follows [IMPLEMENTATION_PLAN.md](IMPLEMENTATION_PLAN.md). |

> **D-07 vs D-13.** Under Model B the client does not pay the full amount before work starts. D-13 replaces D-07 like this: *the first installment is always paid before work starts; under Model B the rest is paid later at a defined event.* Confirmed by the owner (A-01, 2026-11-01).

---

## 2. Engineering decisions (ENG)

| ID | Decision | Short rationale |
|---|---|---|
| E-01 | **Modular monolith** in one Next.js (App Router, TypeScript strict) app with clear domain modules. No microservices. | One deployable unit, fewer moving parts. Modules can be split out later if needed. |
| E-02 | **Supabase** (Postgres 17, Auth, Storage, Realtime, pg_cron, pgmq) as the backend platform, as proposed in the spec. | Matches the spec. The existing `Greco` project (eu-west-1) is empty and ready. |
| E-03 | **SQL migrations (Supabase CLI) are the source of truth** for schema, RLS, functions and triggers. TypeScript types are generated from the database. | RLS and DB functions are SQL anyway. One source avoids drift between an ORM schema and the real database. |
| E-04 | **Multi-party and financial state changes run inside Postgres functions** (transactional, with invariant checks). Orchestration with outside services (PSP, LLM, email) stays in TypeScript. | supabase-js cannot run multi-statement transactions. Enforcing money and state-machine rules in the database means an app bug cannot create an illegal state. |
| E-05 | **Three table classes for writes:** (A) low-risk user-owned rows can be written under RLS; (B) multi-party workflow tables are written only through `SECURITY DEFINER` functions that check the actor; (C) financial and system tables are written only by privileged server code. | Clear rule for every table. See [SECURITY.md](SECURITY.md). |
| E-06 | The service-role (secret) key is used only in `src/server/privileged/**` (webhooks, jobs, audited admin actions). Enforced by lint rules. | Keeps the most dangerous credential in a small, reviewable place. |
| E-07 | **Money is stored as integer minor units (`bigint`) plus an ISO-4217 currency.** Rates are basis points (integers). No floating point anywhere in money paths. | Avoids rounding errors. |
| E-08 | **Offer → Order.** Every purchase (package checkout, custom offer, accepted proposal) becomes an immutable *offer* that the client accepts. The order references that snapshot. | One checkout path for all purchase types. Agreed terms can never drift from current listing data. |
| E-09 | **Append-only double-entry ledger** recording what Greco knows about money held by the PSP: client payments, commission, provider earnings, refunds, chargebacks, negative balances. Reconciled daily against the PSP. | Needed for deposits, partial refunds, chargebacks, recovery from future earnings and reconciliation. Not a money-holding system. |
| E-10 | **Adapters (ports)** for payment collection, payouts, LLM, embeddings, email, identity verification, file scanning and search. | Providers can be swapped without rewriting the domain. Required by the spec for payments and LLM. |
| E-11 | **Outbox pattern** for side effects (notifications, emails, search reindex, analytics). Events are written in the same transaction as the state change and processed by jobs. | No lost or duplicated side effects when a request fails halfway. |
| E-12 | **Search: Postgres full-text + trigram + taxonomy matching first.** pgvector (hybrid semantic search) later, when catalog size or measured zero-result rates justify it. | At launch the catalog is small. LLM query understanding mapped to the taxonomy gets most of the "semantic" benefit at low cost. |
| E-13 | **One search index (`search_documents`)** and one set of SQL search functions used by both marketplace search and AI Discovery. | Spec §23: no second, inconsistent recommendation database. |
| E-14 | **next-intl**, `[locale]` route segment with `as-needed` prefix (English URLs stay prefix-free). Notifications store message keys plus parameters, not rendered text. | Adding a language later becomes translation work, not refactoring. |
| E-15 | Provider-side entity is named **`providers`** in the database. The UI says "Expert" or "Agency". | Neutral name that covers individuals and agencies. |
| E-16 | **Fulfilment status, payment status and payout status are separate fields** with separate state machines. | Spec addendum requirement. Avoids a single "status" enum that mixes three concerns. |
| E-17 | **Testing stack:** Vitest (unit/integration), pgTAP via `supabase test db` (RLS and DB functions), Playwright (end-to-end). CI runs typecheck, lint, tests and production build on every PR. | Authorization and money logic need automated tests at the database level. |
| E-18 | **Vercel functions run in `dub1` (Dublin)**, next to the Supabase project in `eu-west-1`. | Avoids cross-region latency on every database call. |
| E-19 | Prompts for AI Discovery live in the codebase (versioned in git). Each stored assistant message records the prompt version and model used. | Reviewable changes and traceable behaviour. |
| E-20 | Every financial, moderation and admin action writes to an append-only `audit_logs` table. | Spec §22. |

---

## 3. Decisions that need product owner approval (APPROVAL)

**Owner response (2026-11-01):** all recommendations below are **approved**, except **A-03**, changed to a 15% commission (D-14). **A-02 is still open**: it is not needed until real payments (Phase 6 in production), but PSP conversations depend on it.

The **bold** items block a phase.

| ID | Decision needed | Options | Recommendation |
|---|---|---|---|
| **A-01** | Confirm D-13 replaces D-07. | Yes / No | **Yes.** First installment always before work starts. |
| **A-02** ⚠ open | **Greco's legal entity jurisdiction and launch countries** (where clients can pay, where providers can be paid). | Any | **Decide first. It determines which payment providers are possible.** Launch providers only in countries the chosen PSP can onboard and pay out to. Keep countries in an admin-managed allow-list. *Blocks Phase 6 in production.* |
| **A-03** | Who pays Greco's commission. | Deducted from provider earnings / added to client total as a service fee / split | ~~Deducted from provider earnings (10%)~~ → **Decided: 15% deducted from provider earnings, client fee 0% (D-14).** The engine supports all three models (see [PAYMENT_ARCHITECTURE.md](PAYMENT_ARCHITECTURE.md)). |
| **A-04** | Who bears payment processing fees (roughly 2–4% of the payment, depending on PSP and card). | Greco absorbs from commission / passed to provider / passed to client | **Greco absorbs at launch** (cleaner UX). With the 15% commission (D-14), Greco's net is about 11–12% on typical card payments. Revisit with real data. |
| **A-05** | Deposit model parameters. | — | Allowed deposit percentages: **20, 30, 40, 50%**. Deposit model only for orders above a minimum (for example **300 USD-equivalent**). Balance triggers at launch: **"on milestone acceptance"** and **"before final delivery"**. The client pays the balance themselves (on-session), with reminders. 7-day grace period before the provider can open a non-payment case. |
| **A-06** | When provider earnings become releasable. | (a) on order completion + clearance; (b) per accepted milestone + clearance; (c) deposit released when work starts | **(b)**, which equals (a) for single-milestone orders. Clearance period configurable (recommend **7 days** at launch, tune with chargeback data). **No release-at-start at launch**: if a deposit is released before delivery, any refund has to be clawed back from the provider, and if that fails Greco may be liable to the PSP. |
| **A-07** | Maximum length of a fully prepaid order. | Unlimited / capped by PSP hold limits | **Capped by the PSP's maximum hold period** (setting `payments.max_prepaid_hold_days`, derived from the PSP's capabilities per provider country). Longer work uses Model B with milestone installments. The addendum's "the project may take any agreed amount of time" **cannot be guaranteed** with most PSPs. See [PAYMENT_ARCHITECTURE.md §3](PAYMENT_ARCHITECTURE.md#3-the-core-problem-someone-must-hold-the-money-between-payment-and-payout). |
| A-08 | Commission on refunds. | Refund proportionally / Greco keeps it | **Refund proportionally.** Fair and simpler to account for. Non-refundable processing fees are handled per A-04. |
| A-09 | Currencies at launch. | One currency / small set / many | **USD and EUR** (plus GBP if the entity is in the UK). The provider picks the listing currency. The client is charged in that currency. Greco does no currency conversion itself. |
| A-10 | What "hourly pricing" means when payment is upfront. | Open-ended time tracking / prepaid hour blocks | **Prepaid hour blocks.** "10 hours at 80 USD = 800 USD", delivered like any order. Unused hours are refunded through a partial refund. No weekly billing or time tracking at launch. |
| A-11 | Expert admission policy. | Open self-serve / review before going live | **Review before an expert profile and its first listing go live** (moderation queue). Supports the premium, trust-first positioning. Can be relaxed later. |
| A-12 | Guest use of AI Discovery. | Account required / limited guest use | **Limited guest use** (for example 8 messages per session and 2 sessions per day per device, with bot protection). Guests see recommendations. An account is needed to save a brief, contact an expert or post a project. |
| A-13 | Off-platform contact policy. | Block / mask / warn / allow | **Before the first order between two parties:** detect emails, phone numbers and messenger handles, mask them and show a warning. **After an order exists:** allow links (needed for the work) but warn on payment-related off-platform requests. Repeat attempts go to moderation review. **No automatic bans.** All configurable. |
| A-14 | Review rules. | — | Client → provider public review, only on **completed** orders, within **14 days** of completion. Provider → client feedback is private at launch. If both sides can review, use a double-blind reveal. One review per order per direction. |
| A-15 | Auto-completion window after a delivery. | 3 / 5 / 7 days | **7 days** (AI deliverables often need integration testing). Configurable. Paused while a resolution case is open. |
| A-16 | Resolution timings. | — | **72-hour** response window. Cancellation before work starts and cancellation for non-delivery are **auto-accepted** if the provider doesn't respond in time. Either party can escalate to Greco after the window. |
| A-17 | When providers must finish payout onboarding (KYC with the PSP). | Before listing / before first order / before first payout | **Before they can receive their first order.** Listings can be drafted earlier. Prevents orders that can never be paid out. |
| A-18 | Minimum order value. | — | **25 USD-equivalent** (processing fees make smaller orders uneconomic). |
| A-19 | AI model choice and budget. | — | Launch on **`claude-opus-5-5`** for all Discovery steps, with a global daily spend kill-switch. Whether to move some steps to cheaper models (`claude-sonnet-5-5`, `claude-haiku-5-5`) is a cost/quality decision for the owner, made after running the evaluation set. Rough cost estimate is in [docs/AI_DISCOVERY.md](docs/AI_DISCOVERY.md#10-cost-model-estimate). |
| A-20 | Phase order: swap Phase 4 (AI Discovery) and Phase 5 (Projects & Communication). | Keep spec order / swap | **Swap.** Discovery then ships with working "contact expert", "invite to project" and "post as project" actions instead of dead ends. If not approved, we keep the spec order and wire those actions in later. |
| A-21 | Supply-first private beta. | — | **Invite experts once Phase 3 is done** (profiles and listings, no payments), while payment decisions are resolved in parallel. AI Discovery is only as good as the supply behind it. |
| A-22 | Identity verification vendor and policy. | — | Launch with **email verification** plus a manual **portfolio verification** process. Add vendor-based identity and business verification in Phase 7. Showing PSP KYC status publicly ("payouts verified") only if the PSP's terms allow it. |
| A-23 | Agencies share one login (no team seats). | Accept / build seats now | **Accept at launch**, require MFA for agency accounts, make team seats the first post-launch feature. The schema already supports it (D-06). |
| A-24 | Product analytics and cookie consent. | First-party only / add a tool | First-party server-side KPI data at launch. Optional PostHog (EU cloud) later, behind a consent banner. |
| A-25 | Transactional email provider. | Resend / Postmark / other | Pick one in Phase 2. **Needed at launch** even though email notifications come later: Supabase's built-in email sender is not meant for production auth emails. |
| A-26 | Visual design direction. | — | Approve or adjust [docs/DESIGN_SYSTEM.md](docs/DESIGN_SYSTEM.md). |
| A-27 | Use of the existing Supabase project `Greco` (eu-west-1). | Production / development | **Development and staging.** Create a separate production project before launch. The EU region suits GDPR. |
| A-28 | When the delivery clock starts. | At payment / when requirements are submitted | **When the client submits the listing's requirements** (or at payment if there are none). Reminder after 24 hours. The provider may start earlier. |
| A-29 | Email notifications at launch. | In-app only (spec) / in-app + email for critical events | **In-app plus email for a small set of critical events:** new order, payment confirmed, delivery submitted, revision requested, case opened or about to expire, balance due, unread messages digest. Users who aren't logged in never see in-app notifications, so orders and cases would stall. Other notification types stay in-app first, as the spec says. |

---

## 4. Decisions that need legal, tax, accounting or PSP confirmation (EXTERNAL)

None of these are settled. Phase 6 is built against a sandbox adapter, and real payments stay disabled until X-01 to X-05 and X-11 to X-13 are confirmed in writing.

| ID | Question | Why it matters |
|---|---|---|
| **X-01** | **Which PSP, and which fund-flow model** (connected accounts with delayed payouts, platform balance with transfers, or licensed e-money wallets)? Maximum hold period per provider country? | Upfront payment plus later payout means *someone* holds the funds in between. It must be a licensed party under a structure the PSP explicitly supports for service marketplaces. See [PAYMENT_ARCHITECTURE.md](PAYMENT_ARCHITECTURE.md). |
| **X-02** | Who is the **merchant of record / settlement merchant** for client payments: Greco or the provider? | Decides whose name is on the card statement, who issues receipts or invoices, who handles chargebacks first, and which consumer-law duties apply to whom. |
| **X-03** | Does the chosen flow require Greco to hold a **payment, e-money or money-transmission licence**, or does an exemption or the PSP's licence cover it? | Holding or routing third-party funds without the right structure is a regulatory offence in many jurisdictions. |
| **X-04** | **Tax and invoicing:** VAT/GST on Greco's commission and fees; whether Greco must invoice on behalf of providers (self-billing); **EU DAC7 / OECD platform reporting** (seller data collection and annual reporting for personal services); US information reporting (1099-type forms) if relevant; withholding. | Changes what onboarding must collect from providers and what documents checkout must produce. |
| **X-05** | **Consumer law at checkout**, especially the EU 14-day right of withdrawal for services bought online by consumers from traders, and the required "start work now and acknowledge" consent. | Directly affects the checkout flow, the refund policy for B2C orders and what "full refund before work starts" means. |
| X-06 | **EU Digital Services Act** (notice and action, statements of reasons, trader traceability, transparency of ranking and recommendations, complaint handling; some duties exempt for micro and small companies) and the **EU Platform-to-Business Regulation** (terms of service clarity, ranking parameters, notice periods before suspending providers). | Shapes moderation tooling, provider suspension flows and the "how recommendations work" page. |
| X-07 | **EU AI Act:** transparency duty to tell users they are talking to an AI; whether AI-assisted ranking of individual freelancers touches the high-risk category for "access to self-employment"; current application dates. | Design already discloses AI use and keeps ranking deterministic, with the LLM only explaining and reordering a shortlist. Needs a legal opinion. |
| X-08 | **GDPR:** lawful bases, data processing agreements with sub-processors (Supabase, Vercel, LLM vendor, PSP, email), international transfers, retention schedule, data protection impact assessment for AI Discovery. | Required before processing real user data. |
| X-09 | **Worker classification** and the EU Platform Work Directive (transposition deadline December 2026). Does Greco's level of control keep it out of scope? | Greco doesn't set prices or direct work, which likely keeps it outside, but confirm before launch. |
| X-10 | **Sanctions and restricted countries.** | Which countries cannot register, pay or be paid. Must be enforced in the country allow-list. |
| X-11 | **Terms of Service, Provider Agreement, refund and dispute policy.** Including the contractual right to **deduct refunds and chargebacks from future earnings**. | The addendum's recovery model only works if the provider agreement allows it and local law permits it. |
| X-12 | **Ownership of deliverables** (code, models, prompts, datasets, AI-generated content) and when it transfers (we suggest on full payment). | AI work often has unclear IP. Needs a clear default in the terms. |
| X-13 | **Chargeback and negative-balance liability** between Greco, providers and the PSP. | In most marketplace setups the platform is liable to the PSP if a provider's balance cannot cover a refund or chargeback. Greco therefore carries financial risk whatever its own refund policy says, and needs a risk reserve. |
| X-14 | Statutory **record-retention periods** for financial records, invoices and contracts in launch jurisdictions. | Limits what account deletion can erase. Financial records are kept, pseudonymised. |

---

## 5. Where the specification is weak or risky, and what we propose

1. **"No escrow" vs "pay upfront, pay out after completion".** These pull against each other. The gap between collection and payout *is* fund holding. The fix is not to avoid holding but to make sure a licensed PSP holds the funds, under a structure it explicitly supports. Greco only *instructs* releases and *records* obligations in its ledger. → X-01, X-03.
2. **Model A "any duration".** PSP hold limits are finite. Stripe's manual-payout hold is 90 days in most countries (2 years in the US, 10 days in Thailand). Card disputes can also arrive months later. Very long fully prepaid orders are not safely supported by most PSPs. → A-07: cap prepaid duration by PSP capability; long work uses milestones.
3. **Deposit release timing is undefined.** A deposit that is held until completion is just a partial payment. A deposit released at start creates clawback risk. → A-06 recommends release per accepted milestone.
4. **Hourly pricing contradicts upfront payment.** → A-10: prepaid hour blocks.
5. **"Access only for the active role" as a security rule.** Users can switch roles at will, so the active role is not a real security boundary. Real protection comes from *capabilities* (does the user have an active expert profile?) and *relationships* (is this user a party to this order?). We still enforce the active role as the workspace context for role-scoped pages and actions, but authorization never relies on it alone. See [ARCHITECTURE.md §8](ARCHITECTURE.md#8-accounts-roles-and-role-switching).
6. **"Global" vs payout reality.** A lot of AI talent lives in countries that common marketplace PSPs cannot onboard or pay out to (Stripe Connect covers roughly 45+ countries; payouts outside the platform's region are limited). Launch will be country-limited. Separate collection and payout providers would widen reach but put Greco in the flow of funds (X-03).
7. **"Not an MVP" vs marketplace cold start.** The biggest risk is not technical. It is having too few experts for clients to find (and for Discovery to recommend). We keep the full architecture but recommend a supply-first private beta (A-21) and honest empty states ("No strong match yet. Post this as a project and we'll invite matching experts").
8. **Agencies without team seats** means shared passwords. Accept for launch with MFA (A-23); the schema is ready for seats.
9. **"All communication on Greco" vs how AI work is done.** AI projects need repositories, cloud consoles, API keys and CRM access. Blanket link blocking would break real work and push users off-platform. A-13 differentiates pre-order and post-order. We also propose warning users not to paste secrets in chat, and a secure credential-handover feature later.
10. **pgvector from the start** is premature. → E-12.
11. **Many verification types at launch** are costly and slow. → A-22: start with email plus manual portfolio verification; add vendor checks in Phase 7.
12. **Reviews only from completed orders** (correct) leaves new experts with zero reviews. → Show provenance-labelled evidence instead: Greco-verified portfolio items, external profiles labelled "provided by the expert", response-time stats.
13. **Admin dashboard in Phase 7** is too late for some admin functions. Category management is needed in Phase 3, listing moderation before public listings, dispute handling before payments. → Admin is built incrementally from Phase 3 (see [IMPLEMENTATION_PLAN.md](IMPLEMENTATION_PLAN.md)).
14. **Fiverr's Resolution Center as reference.** We copy its *structure* (typed requests, response windows, escalation) but keep every timing and outcome configurable (A-15, A-16) and subject to consumer law (X-05).
15. **"The assistant leads the conversation"** can become an interrogation. → Bounded clarifying (about 5 questions, 1–3 at a time with quick replies), visible "skip to results", and a live brief the user can edit directly.
16. **Commission "on completed transactions"** is ambiguous with deposits and partial refunds. → Commission is calculated per installment when paid, recognised when the related milestone completes, and reduced proportionally on refunds (A-08).
17. **In-app-only notifications at launch.** Response windows, auto-completion and balance deadlines depend on people noticing events in time. → A-29: email for critical events from launch.
18. **Spec table list.** Some suggested tables are merged or renamed for clarity. For example, `disputes` becomes escalated `resolution_cases`, `skills` and `technologies` become one taxonomy, and `portfolios` is dropped (one implicit portfolio per provider). See [DATABASE_SCHEMA.md §0](DATABASE_SCHEMA.md#0-mapping-from-the-spec-table-list).

---

## 6. Risk register

| ID | Risk | Likelihood | Impact | Mitigation |
|---|---|---|---|---|
| R-01 | No PSP supports the desired upfront-then-release flow for the chosen entity and countries. | Medium | Critical | Decide A-02 now. Open PSP conversations in parallel with Phases 2–5. Adapter design keeps the domain PSP-agnostic. |
| R-02 | Marketplace cold start: too few experts, poor Discovery results. | High | High | Supply-first beta, expert vetting, project posting as fallback, honest empty states. |
| R-03 | Chargeback or refund losses that cannot be recovered from providers. | Medium | High | Release only after acceptance + clearance, PSP fraud tools, limits for new accounts, provider agreement recovery clause, risk reserve. |
| R-04 | Prompt injection through provider profiles manipulates recommendations. | Medium | Medium | Deterministic shortlist, untrusted-data framing, field-cited reasons, injection screening at publish time, anomaly monitoring. |
| R-05 | AI Discovery cost spikes from abuse or bots. | Medium | Medium | Quotas, bot protection, per-user and global budgets, kill-switch. |
| R-06 | Regulatory exposure (payments licensing, DSA/P2B, consumer law, DAC7, AI Act). | Medium | High | EXTERNAL decisions gate launch. Design already supports the likely obligations. |
| R-07 | Off-platform leakage after first contact. | High | Medium | Value-based retention (protection, history, reputation), detection + warnings, measurement. |
| R-08 | RLS misconfiguration exposes private data. | Low–Medium | Critical | Table classes, pgTAP tests for every table, CI check that every exposed table has RLS, private schema for internal tables. |
| R-09 | Fake portfolios or credentials. | High | Medium | Provenance labels, verification records, reporting, moderation. |
| R-10 | Large or malicious deliverable files. | Medium | Medium | Private buckets, size limits, resumable uploads, malware scanning before the counterparty can download. |
| R-11 | Self-dealing or collusion to farm reviews or launder money. | Medium | Medium | Block buying from yourself, linked-account signals, PSP KYC, value limits for new accounts, review anomaly checks. |
| R-12 | Scope creep delays launch. | High | Medium | Phased plan with explicit exit criteria. "Not in first launch" list in [IMPLEMENTATION_PLAN.md](IMPLEMENTATION_PLAN.md). |
