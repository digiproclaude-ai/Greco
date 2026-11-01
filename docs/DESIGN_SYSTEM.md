# Greco — UI/UX Direction and Design System

**Status:** Phase 1 proposal for approval (A-26). Final values are confirmed in Phase 2 with real component prototypes.
**Last updated:** 2026-11-01

---

## 1. Positioning and tone

Greco should feel like a **serious, calm, precise technology marketplace**: closer to a well-edited publication or a professional tool than a gig site or an "AI startup" landing page. Confidence comes from clarity, not decoration.

- **Voice:** plain English, short sentences, sentence case, no hype ("revolutionary", "supercharge"), no unexplained jargon.
- **Honesty in the UI:** labels say exactly what is verified and where information comes from.
- **The product is the hero:** real services, real experts and the Discovery experience, not illustrations.

**Avoid:** purple and blue AI gradients, glassmorphism, glowing orbs, sparkle icons as a stand-in for "AI", robot illustrations, 3D blobs, pill-shaped everything, heavy drop shadows, autoplaying motion, generic template hero sections with three icon cards.

## 2. Visual concept: "paper and ink"

Warm off-white surfaces, near-black ink typography, one deep accent colour, fine hairline rules and a disciplined grid. Borders do most of the separation work. Shadows are rare. Density can be higher than typical marketplaces in dashboards (professional users), with generous whitespace on marketing pages.

### 2.1 Colour tokens (proposal)

Contrast ratios are measured against the page background `paper-50` (#FAF8F4).

| Token | Value | Use | Contrast |
|---|---|---|---|
| `ink-900` | #14161A | Primary text, headings | 17.1:1 |
| `stone-600` | #625E56 | Secondary text | 6.1:1 |
| `stone-500` | #79756C | Placeholder, disabled, large captions only | 4.3:1 (not for body text) |
| `stone-400` | #8C8679 | Form control borders, focus-adjacent UI | 3.4:1 (meets 3:1 for UI components) |
| `line-200` | #E3DED3 | Decorative dividers, card borders | decorative only |
| `paper-50` | #FAF8F4 | Page background | — |
| `surface` | #FFFFFF | Cards, inputs, panels | — |
| `ultramarine-700` | #2A3A8F | Primary actions, links, focus ring | 9.4:1; white text on it 10.0:1 |
| `ultramarine-800` | #222F75 | Hover/pressed | white text 12.1:1 |
| `ultramarine-50` | #EEF0FA | Selected states, subtle highlights | accent text on it 8.8:1 |
| `ochre-600` | #A8741A | Editorial highlights, illustrations, large numerals | 3.8:1 (large text and graphics only) |
| `ochre-700` | #8A5E12 | Ochre text when needed | 5.4:1 |
| `success-700` | #1F7A4D | Success text and icons | 5.0:1 |
| `warning-700` | #A55407 | Warnings | 5.1:1 |
| `danger-700` | #B42318 | Errors, destructive actions | 6.2:1 |

The name is a nod to the deep ultramarine and ochre of El Greco's palette, used with restraint. Colour is never the only signal: badges and states always pair colour with an icon and a text label. A dark theme is planned through semantic tokens but not shipped at launch (light first).

### 2.2 Typography (proposal)

| Role | Typeface | Why |
|---|---|---|
| Display (marketing headlines, section titles) | **Source Serif 4** (variable, optical sizes) | Editorial, serious, distinctive without being trendy. Used sparingly. |
| UI and body | **IBM Plex Sans** | Technical and precise. The Plex family covers many scripts (Arabic, Devanagari, Thai, Japanese, Korean and more), which helps future localization. |
| Data, code, IDs | **IBM Plex Mono** | Technology tags, order numbers, code snippets. |

Self-hosted through `next/font`. Scale (px): 12 · 14 · 16 (body) · 18 · 20 · 24 · 30 · 36 · 48 · 60. Line height 1.5 for body and 1.15–1.25 for display. **Tabular numerals** for prices, money tables and stats.

### 2.3 Layout, spacing, shape

- 4 px spacing base (Tailwind scale). 12-column grid. Content max width 1280 px. Reading width about 70 characters.
- Radius: 6 px for controls, 10 px for cards, never fully rounded except avatars and small status dots.
- Elevation: borders by default. One soft shadow level for popovers and dialogs only.
- Icons: Lucide, 1.5 px stroke, always paired with labels in navigation.
- Motion: 150–200 ms ease-out for state changes. No decorative loops. Respects `prefers-reduced-motion`.

## 3. Information architecture

**Top navigation (signed out):** Discover · Find experts · Categories · How it works · Become an expert · Log in · Sign up
**Top navigation (signed in):** Discover · Find experts · Categories · Messages · Notifications · **Client/Expert switcher** · Account menu (Dashboard, Settings, Become an expert / Hire experts, Log out)

- **Categories:** mega-menu showing top-level categories and their main subcategories, plus "All categories".
- **Footer:** company, trust and safety, how it works, how recommendations work, legal pages, language selector (English only at launch, hidden until a second language exists).
- **Dashboards:** left sidebar on desktop, collapsible. On mobile, a top bar with a sheet menu. The client and expert workspaces have different sidebars, and the switcher sits in the header.

## 4. Key screens

**Homepage**
1. Headline: "Find the right AI expert for your business problem". One line underneath explaining Greco.
2. **One input, two paths:** "Describe what you want to achieve…" with **Help me figure it out** (Discovery) and **Search services**. Under it, example prompts as chips.
3. Browse categories (a clean grid of top categories with counts).
4. Featured experts and agencies (real data; hidden until enough approved supply exists).
5. Popular services.
6. How Greco works: three steps (Describe → Compare → Work and pay safely), with the payment protection explained honestly.
7. Trust: what verification means, how reviews work, how disputes work.
8. Calls to action for clients and experts.

**Search results:** filter sidebar (sheet on mobile), result count, sort (relevance, rating, price, delivery time), service cards with price "from", delivery time, rating with count, badges and provider identity. Empty state offers Discovery and broader filters.

**Expert profile:** header (name, headline, country, languages, availability, badges with "What's verified" popover), stats from Greco activity, services, portfolio with provenance labels, reviews, about, skills and technologies. Contact button opens messaging. No email or phone shown.

**Service listing:** title, provider strip, media, description, package table, add-ons, **payment terms panel** (full or deposit, what's due when), revisions, delivery time, requirements preview, FAQs, reviews, related services.

**Discovery workspace:** see [AI_DISCOVERY.md §3.1](AI_DISCOVERY.md#31-workspace-layout).

**Checkout:** two columns. Left: what you are buying (scope, deliverables, milestones, deadline, revisions, cancellation terms). Right: the **payment summary** (total, due now, balance and trigger), acceptance checkbox and Pay button. No distractions.

**Order workspace (shared by both parties):** status header showing all three statuses (work, payment, payout), next required action, timeline (events, deliveries, revisions, amendments), order conversation, files, terms summary, resolution actions.

**Expert dashboard overview:** what needs attention (new orders, deliveries due, proposals, messages), earnings summary by status, profile completeness, listing performance.

## 5. Component inventory

**From shadcn/ui (restyled):** Button, Input, Textarea, Select, Combobox, Checkbox, Radio, Switch, Dialog, Sheet, Popover, Tooltip, Dropdown Menu, Command, Tabs, Accordion, Table, Badge, Card, Avatar, Breadcrumb, Pagination, Skeleton, Toast (Sonner), Form, Calendar.

**Greco domain components:**
- `ServiceCard`, `ExpertCard`, `AgencyCard`
- `PriceTag` (locale-aware money, "from" prefix, tabular numerals)
- `VerificationBadge` (exact meaning in a tooltip) and `VerificationPanel` (each check listed with its status)
- `ProvenanceLabel` ("Verified by Greco" / "Based on Greco activity" / "According to the expert's profile")
- `RatingSummary` (stars, count, distribution)
- `PaymentTermsSummary` and `PaymentSchedule` (shared by listing, offer, checkout and order)
- `StatusTriplet` (work, payment, payout)
- `OrderTimeline`, `DeliveryComposer`, `DeliveryItem` (file, link, repository, note)
- `ResolutionCaseCard`, `AmendmentCard`, `OfferCard` (in chat)
- `BriefPanel`, `MatchCard` with `WhyThisMatch`, `QuickReplies`
- `CategoryTree` (admin drag and drop), `TaxonomyPicker`
- `FilterPanel`, `SortMenu`, `ActiveFilters`
- `MessageThread`, `Composer` (with contact-policy hint and secret-sharing warning)
- `FileUpload` (progress, resumable, scan status)
- `EmptyState`, `ErrorState`, `LoadingState`, `Stepper` (onboarding and checkout)
- `RoleSwitcher`

## 6. Trust UI rules

1. A badge only renders from an active verification record.
2. Every badge explains in one sentence what was checked, by whom and when, and what it does **not** mean (for example "Identity verified does not confirm technical skills").
3. Profiles show a **Verification** panel listing each check (email, identity, business, portfolio) as completed or not completed, without shaming language.
4. Portfolio items always show their provenance.
5. Stats like "14 orders completed" come only from Greco data and say so.
6. AI-written text (match explanations) is labelled "AI summary" next to the evidence labels.

## 7. States

- **Loading:** skeletons matching the final layout. No spinners for whole pages.
- **Empty:** explain what goes here and offer the next action ("No services yet. Create your first service").
- **Errors:** plain explanation plus a recovery action. Form errors inline next to fields, with a summary at the top for long forms.
- **Optimistic UI** only for low-risk actions (saving an expert, sending a message). Never for money or order state changes, which always wait for server confirmation.

## 8. Accessibility (target: WCAG 2.2 AA)

- Contrast as in §2.1. Visible 2 px focus ring in `ultramarine-700` with offset.
- Full keyboard support, logical focus order, focus trapped in dialogs and returned on close, skip link.
- Semantic HTML and landmarks. Every input has a label. Errors linked with `aria-describedby`.
- Discovery streaming replies use a polite live region. Quick replies are real buttons.
- Target size at least 24×24 px (44 px on touch for primary actions).
- Automated axe checks in Playwright plus manual screen-reader passes on key flows.

## 9. Responsive behaviour

Mobile first. Breakpoints: `sm` 640, `md` 768, `lg` 1024, `xl` 1280.
- Filters become a bottom sheet. Tables become stacked cards. Checkout becomes a single column with the payment summary pinned at the bottom.
- Discovery uses Chat / Brief / Matches tabs.
- Dashboards: sidebar becomes a sheet. Order workspace actions stay reachable in a sticky bar.

## 10. Content and localization guidelines

- All UI text comes from message files, never hardcoded.
- Allow about 30% text expansion. No text inside images.
- Logical CSS properties (start/end instead of left/right) so right-to-left languages work later.
- Dates, numbers and money always formatted with the user's locale. Times shown in the user's time zone with the zone label where it matters (deadlines).
