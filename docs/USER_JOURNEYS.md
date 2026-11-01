# Greco — Main User Journeys

**Status:** Phase 1 proposal. Awaiting approval.
**Last updated:** 2026-11-01

Each journey lists the steps, what the system does, and the main edge cases. Decision IDs refer to [PRODUCT_DECISIONS.md](../PRODUCT_DECISIONS.md).

---

## J1. Visitor becomes a client

1. Visitor lands on the homepage, browses or tries Discovery as a guest (A-12).
2. Clicks **Sign up** and enters full name, email, password (or Google), country, chooses **Client**, and accepts the Terms and Privacy Policy.
   - System: creates the account, profile, `client` role and an empty client profile. Records legal acceptances with document versions. Sends a verification email.
3. Verifies email. Short onboarding (skippable steps): individual or business → business name and industry → what they want to use Greco for → optional website and current challenges.
4. Lands on the client dashboard with suggested next steps: "Describe your problem", "Browse categories", "Post a project".
- **Edge cases:** country not allowed to buy (`countries.can_buy = false`) → can browse but not purchase, with an explanation. A guest Discovery session in progress is attached to the new account.

## J2. Visitor becomes an expert (individual or agency)

1. Signs up choosing **Expert**.
2. Onboarding wizard, saved after each step:
   1. Individual or agency → display or business name, country, time zone.
   2. Headline and description.
   3. Skills, technologies, tools and industries (taxonomy pickers; can suggest new terms).
   4. Experience level, languages, availability, indicative rate.
   5. Portfolio: at least one item recommended (self-reported, clearly labelled).
   6. Website and professional links.
   7. Agencies: founded year, team size range, office locations.
3. **Submit for review** (A-11). The profile shows as "In review". The expert can draft services meanwhile.
4. Payout onboarding with the PSP's hosted KYC flow (A-17). Status visible: not started, in progress, needs information, active.
5. Creates the first service listing (J3), submits it for review, and gets approval → profile and listing go live and are indexed for search.
- **Edge cases:** country can't receive payouts (`can_sell = false`) → can build a profile but can't publish purchasable listings; shown as waitlisted. Rejected profile → statement of reasons and option to fix and resubmit.

## J3. Expert creates a service listing

1. Title, summary, description, primary category (plus up to 2 secondary), skills and technologies.
2. Pricing model: fixed, packages (up to 3 tiers), hourly (prepaid block, A-10) or custom quote.
3. **Payment model** (D-13): full payment, or deposit with a percentage from the allowed set and a balance trigger (A-05). A preview shows exactly what clients will see at checkout.
4. Deliverables per package, delivery time, included revisions, add-ons, requirements questionnaire, FAQs, media.
5. Preview → submit for review → published. Edits to a published listing create a new version. Existing offers and orders keep their snapshot.
- **Edge cases:** pause (hidden from search, existing orders continue), archive, rejected with reasons.

## J4. Client searches directly and buys a package (Model A)

1. Searches "RAG chatbot for internal docs" or browses a category → results with filters (category, price, delivery time, provider type, rating, languages, country, verified, availability).
2. Compares services. Opens a listing: packages, deliverables, payment model, revisions, provider summary with badges and provenance labels, reviews, FAQs.
3. Optional: **Contact** → direct conversation with context "about this service". The contact policy applies (A-13).
4. Chooses a package and add-ons → **Checkout**: the system creates a `package_checkout` offer (immutable snapshot) and shows due now, deadline, revisions, cancellation terms. The client ticks acceptance and pays through the PSP.
5. Payment confirmed by webhook → order `awaiting_requirements` → client answers the requirements → `in_progress`, and the deadline clock starts (A-28).
6. Provider delivers (files, links, repository, notes) → `delivered`, with an auto-complete timer (A-15).
7. Client **requests a revision** (within included revisions) → `revision_requested` → new delivery → client **accepts** → `completed`.
8. Earnings: `pending` → `clearing` → `available` → `paid_out` (A-06).
9. Client is invited to leave a review within the review window (A-14). Provider can reply publicly.
- **Edge cases:** payment needs 3-D Secure → handled in the hosted step; payment fails → offer stays open until it expires; requirements not submitted → reminders; client doesn't respond to a delivery → auto-completes (timer paused while a case is open).

## J5. Client uses AI Discovery, then hires

1. Types the problem on the homepage → Discovery workspace (guest or signed in).
2. Answers a few questions. The brief fills in. Edits the budget field directly.
3. Confirms the brief → sees about 5 matches, each with "Why this match" reasons and provenance labels.
4. Options (all explicit clicks):
   - **View profile or service** → continues as in J4.
   - **Message the expert** → pre-filled draft with the brief summary → reviews → sends.
   - **Post as project** → pre-filled project form → publishes → **invites** chosen experts (J6).
   - **Save brief** → stored on the client dashboard.
5. Guest → asked to sign up at the save, message or post step. The session is attached on signup.
- **Edge cases:** no strong matches → honest message + post as project or browse category; assistant unavailable → search pre-filled with the user's text.

## J6. Client posts a custom project and accepts a proposal (Model B)

1. Creates a project (manually or from a brief): problem, outcome, category, budget, timeline, skills, attachments. Public or invite-only.
2. Experts submit proposals: solution, price, timeline, deliverables, relevant experience, questions, conditions, **payment model** (for example 30% deposit, balance on acceptance of milestone 1) and milestones.
3. Client compares proposals side by side (price, timeline, payment terms, provider evidence), can shortlist and ask questions in chat.
4. Accepts one → the system creates a `proposal` offer from it → checkout shows **deposit due now, balance and its trigger**, milestones, deadline and terms → client accepts and pays the deposit.
5. Provider delivers milestone 1 → client accepts → **balance becomes due** → order `awaiting_balance` → client pays from the order page → `in_progress` for milestone 2.
6. Final delivery → accept → `completed` → earnings per milestone clear and pay out.
- **Edge cases:** balance unpaid after the grace period → provider opens a `client_non_payment` case (cancel remaining scope, keep earnings for accepted milestone 1, or escalate); other proposals are declined automatically with a polite notice.

## J7. Expert sends a custom offer in chat

1. During a conversation, the expert clicks **Create offer**: scope, deliverables, price, delivery time, revisions, payment model and milestones.
2. The offer appears as a message card. The client can accept (→ checkout), decline or ask for changes (the expert withdraws and sends a new version; the old one is marked `superseded`).
3. Offers expire after a configurable period.

## J8. Role switch

- **Client → Expert:** "Become an expert" in the account menu → expert onboarding (J2) → the expert role is added → role switcher appears. The client history stays in the client workspace.
- **Expert → Client:** "Hire experts" → short client onboarding → client role added.
- **Switching:** a "Client / Expert" switcher in the header changes the workspace instantly. Unread badges show activity in the other role.
- **Edge case:** a suspended expert role leaves client access unaffected (unless the whole account is suspended).

## J9. Cancellations, refunds and disputes

| Situation | Flow |
|---|---|
| Client changes their mind before work starts | Client opens "Cancel before start" → provider has 72 h → accepts or doesn't respond → full refund of paid installments → order `cancelled`. Provider declines → client can escalate. EU consumer rules may apply (X-05). |
| Provider misses the deadline | `due_at` passes → the client sees "Order is late: cancel and request refund" → provider can deliver, agree or propose an extension within 72 h → no response → auto-cancel and refund for undelivered milestones. |
| Delivery doesn't match scope | Client requests a revision first → still unresolved → opens "Doesn't match agreed scope" case with the requested outcome (for example a 200.00 partial refund) → provider accepts, counters or declines → escalate if needed. |
| Mutual partial refund | Either side proposes an amount → the other accepts → refund executed → order completes with adjusted earnings. |
| Escalation | Staff review the timeline, terms, deliveries, order conversation and evidence → decision with a statement of reasons → refunds or releases executed and logged. |
| Exceptional post-completion review | Fraud or misconduct reported → staff case → possible refund with recovery from provider earnings (X-11). |

## J10. Chargeback (finance)

1. PSP webhook: dispute opened → related earnings `on_hold`, finance notified, provider informed.
2. Finance assembles the evidence pack from Greco records and adds the provider's input → submits before the deadline.
3. Won → earnings released from hold. Lost → reversal, possible provider receivable, recorded in the ledger.

## J11. Admin operations

- **Categories:** create, edit, reorder (drag in the tree), move, deactivate, translate, relate. Reassign listings from a deactivated category. All audited.
- **Moderation:** queues for new providers, listings, portfolio items flagged for injection or abuse, reports → approve, reject, hide or suspend with a statement of reasons.
- **Verification:** review manual verification requests (for example portfolio verification with evidence) → approve or reject → badge appears or doesn't.
- **Commission change:** finance creates a new policy with a future effective date → review → active. Existing offers and orders are unaffected.
- **Discovery monitoring:** usage, cost, flagged sessions, anomaly alerts, kill-switch.

## J12. Expert earnings and payouts

1. Earnings page: totals by status (pending, clearing, available, paid out, on hold), with a row per milestone showing order, client, gross, commission, fees, net and status with dates.
2. Payout history mirrored from the PSP (amount, date, status, failure reason).
3. Payout account panel: KYC status and "update details" link (PSP-hosted).
4. Negative balance (after a refund or chargeback post-payout): shown clearly with the reason and how it will be recovered.

## J13. Account deletion and data export

1. Settings → Privacy → **Download my data** → job builds an archive → notification with a link that expires in 7 days.
2. Settings → **Delete account** → blocked while orders, cases or balances are open (with an explanation) → otherwise confirmation and fresh sign-in → `pending_deletion` with a grace period → anonymisation. Financial records are kept pseudonymised for their statutory period.
