# iCoParent — Development Plan

> **Single source of truth** for building iCoParent with AI-assisted ("vibe") coding.
> Every agent session starts by reading `CLAUDE.md` → this file → the GitHub issue it is working on.
> If code and this plan disagree, stop and ask; then update whichever one is wrong in the same PR.

---

## Table of contents

1. [Product in one page](#1-product-in-one-page)
2. [Locked decisions](#2-locked-decisions)
3. [Architecture & free-tier budget](#3-architecture--free-tier-budget)
4. [Repository layout](#4-repository-layout)
5. [Domain model (database)](#5-domain-model-database)
6. [Core rules every feature must follow](#6-core-rules-every-feature-must-follow)
7. [Engineering conventions & Definition of Done](#7-engineering-conventions--definition-of-done)
8. [Agentic development workflow](#8-agentic-development-workflow)
9. [Roadmap overview & timeline](#9-roadmap-overview--timeline)
10. [Feature catalogue by version](#10-feature-catalogue-by-version)
11. [GitHub project setup](#11-github-project-setup)
12. [Risks & open questions](#12-risks--open-questions)

---

## 1. Product in one page

**What:** A private family space for two co-parents and their children: a shared calendar built on a custody schedule, handovers with check-ins, an approval system for requests and decisions, an expense log with photo proof, and a private family feed (journal) with photos and voice notes.

**Who (MVP):** Two co-parents with a cooperative relationship, plus their children (optional logins). One family to start (in-house), but built multi-family from day one so it can go public.

**Product principles**

| # | Principle | What it means in practice |
|---|-----------|---------------------------|
| P1 | **No one edits the other parent's input** | You can only *acknowledge*, *approve*, *decline* or *counter*. Never overwrite. |
| P2 | **Nothing disappears silently** | No hard deletes. Items are *voided* with a reason; edits after acknowledgment create a new version. |
| P3 | **Silence is never consent** | Proposals expire; they are never auto-accepted. |
| P4 | **Calm by default, evidence when needed** | MVP UX is friendly; the data model already stores who/when/what so the high-conflict mode (V4) is a UI layer, not a rewrite. |
| P5 | **Kids see kid things** | Children never see money, proposals between parents, or "parents only" posts. |
| P6 | **Logic lives in the database** | Permissions = Postgres RLS. Workflows = SQL functions + triggers. The frontend is a thin client; Workers only do what Postgres can't (push, cron, signing). |
| P7 | **Free tier first** | Every feature states its storage/request cost. Compress everything. |

---

## 2. Locked decisions

These were agreed during planning. Changing one requires updating this section in the PR that changes it.

| ID | Decision |
|----|----------|
| D1 | **Stack:** React + Vite + TypeScript PWA → Cloudflare Pages. Supabase (Postgres, Auth, Storage). One Cloudflare Worker for push + cron. |
| D2 | **Auth:** Google sign-in via Supabase Auth (PWA redirect flow). Auth code isolated in one module so V3 (Capacitor) can swap in native Google Sign-In. Local Docker environments additionally allow email/password sign-in with seeded fictional users (D18); this never ships to production. |
| D3 | **Multi-tenant from day one:** every domain row has `family_id`; every RLS policy checks family membership. |
| D4 | **MVP users:** parents (full) + children (optional login, restricted). Kid *profiles* exist without logins. Grandparents/partners/nannies → V5. |
| D5 | **Files:** Supabase Storage (1 GB free) behind a `storage` adapter interface. Images → WebP, max 1600 px long edge, target ≤ 250 KB. Voice → max 2 min. Migrate adapter to Cloudflare R2 in V9 (or earlier if > 700 MB used). |
| D6 | **Editing:** author may edit freely until the other parent acknowledges. After acknowledgment: edit = new version (`supersedes_id`), old version stays visible. Delete = void with reason. |
| D7 | **One proposal engine** for all requests: blocker requests, custody swaps, decisions ("buy this toy?"), event changes. States: `pending → accepted | declined | countered | expired | withdrawn`. One level of counter-proposal. Expiry default 7 days, reminder after 48 h. |
| D8 | **Expenses are records** (no split, no balances) in MVP. A per-parent monthly total is shown. Splits/settle-up → V6. |
| D9 | **Currency:** RON default per family; optional original currency + amount for trips (no FX conversion in MVP). |
| D10 | **Custody:** repeating pattern template generates "who has the kids" days; handovers are generated at switch points; exceptions go through proposals. |
| D11 | **Check-ins:** one tap with timestamp; receiving parent can confirm. GPS optional, off by default. Lateness is computed, never typed. |
| D12 | **Feed audience:** `family` (everyone incl. kids) or `parents`. Reactions only (no comments) in MVP. |
| D13 | **Notifications:** in-app inbox for everything; Web Push for proposals, handover check-ins, new expenses. iOS push requires "Add to Home Screen" (documented in onboarding). |
| D14 | **Language:** English and Romanian are both first-class from V0. Every UI string ships in `en` and `ro` in the same PR. The language comes from `profiles.locale`; before sign-in it comes from the browser, falling back to `en`. Timezone stored per family; all timestamps `timestamptz`. |
| D15 | **Backups:** nightly `pg_dump` via GitHub Actions (Supabase free tier has no backups), encrypted and uploaded to a private Cloudflare R2 bucket. Never stored as an Actions artifact, because artifacts on a public repo can be downloaded by any signed-in GitHub user. Part of V0, not optional. |
| D16 | **Open source:** the repo is public and anyone can self-host it with their own Supabase and Cloudflare accounts (`docs/SETUP.md`). The repo never contains real family data, secrets, or production-only values: config comes from environment variables, and `seed.sql` is fictional. |
| D17 | **Licence:** AGPL-3.0 (`LICENSE`). Contributions are accepted under the same licence. Revisit the licensing model before V9 billing (F-904). |
| D18 | **Local environment:** the whole app runs in Docker with one command and needs no cloud accounts: Supabase through its CLI, plus web, Worker and Playwright through Compose. Full E2E flows run against it using seeded local users for parent A, parent B, child and outsider. |

---

## 3. Architecture & free-tier budget

```
┌────────────────────────────┐        ┌──────────────────────────────┐
│  React PWA (Cloudflare     │  HTTPS │  Supabase                    │
│  Pages)                    │───────▶│  • Auth (Google)             │
│  • supabase-js             │        │  • Postgres + RLS            │
│  • TanStack Query          │◀───────│  • RPC functions / triggers  │
│  • Service worker (push,   │Realtime│  • Storage (images, audio)   │
│    offline shell)          │        │  • Realtime (live updates)   │
└────────────┬───────────────┘        └──────────────┬───────────────┘
             │ push subscription                     │ DB webhook on
             ▼                                       ▼ notifications INSERT
┌──────────────────────────────────────────────────────────────────────┐
│  Cloudflare Worker  `icoparent-worker`                               │
│  • POST /push      → sends Web Push (VAPID)                          │
│  • Cron (hourly)   → rpc('run_scheduled_jobs'): expire proposals,    │
│                      reminders, generate upcoming handovers,          │
│                      keeps Supabase project awake                    │
└──────────────────────────────────────────────────────────────────────┘
┌──────────────────────────────────────────────────────────────────────┐
│  GitHub Actions: CI (lint, typecheck, tests) + nightly DB backup     │
└──────────────────────────────────────────────────────────────────────┘
```

### Free-tier budget (verify current limits before relying on them)

| Resource | Free limit | Expected MVP use (1–3 families) | Guard |
|----------|-----------|-------------------------------|-------|
| Supabase DB | 500 MB | < 50 MB | No blobs in DB. Monitor in dashboard. |
| Supabase Storage | 1 GB | ~200–400 MB/yr/family | Client-side compression (D5); usage meter in Settings (F-162). |
| Supabase egress | 5 GB/mo | < 1 GB | Thumbnails (400 px) in lists; full image only on open; long cache headers. |
| Supabase pause | after 7 days idle | — | Worker cron hits the DB hourly. |
| Supabase MAU | 50,000 | < 10 | — |
| CF Workers/Pages Functions | 100k req/day, 10 ms CPU | < 1k/day | Worker does tiny jobs only. |
| CF Pages builds | 500/month | ~100 | Preview builds only on PRs. |
| GitHub Actions | Free on standard runners (public repo) | ~300 min/mo | Cache pnpm store. |
| Cloudflare R2 (backups) | 10 GB | < 1 GB | Encrypted dumps, 90-day lifecycle rule (D15). |

### Tech choices (frontend)

| Concern | Choice | Why |
|---------|--------|-----|
| Build | Vite + React 18/19 + TypeScript (strict) | Fast, standard |
| Routing | React Router | Standard |
| Server state | TanStack Query + supabase-js | Caching, optimistic updates |
| UI | Tailwind CSS + shadcn/ui (Radix) | Accessible, copy-in components, easy for agents |
| Forms | react-hook-form + zod | Shared validation schemas |
| Dates | date-fns + date-fns-tz | Tree-shakable, TZ-safe |
| Calendar UI | Custom month/week/agenda views built on date-fns (no heavy lib) | Small bundle, full control over custody colouring |
| PWA | vite-plugin-pwa (Workbox) | Manifest, SW, push handler |
| i18n | i18next + react-i18next | D14 |
| Images | `browser-image-compression` (or canvas → WebP) | D5 |
| Audio | MediaRecorder (`audio/webm;codecs=opus`; Safari falls back to `audio/mp4`) | Native, no deps |
| Tests | Vitest + Testing Library; Playwright (E2E); pgTAP via `supabase test db` (RLS) | |
| Types | `supabase gen types typescript` → `src/lib/database.types.ts` | DB is source of truth |

### Local development (Docker, D18)

| Piece | Runs through | Local behaviour |
|-------|--------------|-----------------|
| Postgres, Auth, Storage, Realtime, Studio, Mailpit | `supabase start` (CLI pinned as a dev dependency; Docker containers) | Same migrations and pgTAP tests as CI; seeded with a fictional family |
| Web app | Compose service `web` | Vite with hot reload; `VITE_AUTH_MODE=local` shows the local sign-in screen |
| Worker | Compose service `worker` | `wrangler dev`; `PUSH_MODE=log` records push messages instead of sending them; cron can be triggered on demand |
| Playwright | Compose service `e2e` (profile, runs on demand) | Pinned Playwright image; one signed-in session per seeded actor |

Compose services join the Supabase CLI's Docker network (`supabase_network_icoparent`), so the database webhook can reach the Worker. Supabase is deliberately not duplicated in Compose: one definition keeps local, CI and migrations identical.

Host requirements: Docker, Node and pnpm. Google OAuth stays optional locally and is only needed when working on F-003 itself.

---

## 4. Repository layout

```
icoparent/
├── CLAUDE.md                     # Agent rules (read first)
├── README.md
├── CONTRIBUTING.md
├── SECURITY.md
├── LICENSE
├── docker-compose.yml            # web, worker, e2e (Supabase runs through its CLI)
├── .env.example                  # Local defaults only; never real keys
├── docker/                       # Dockerfiles for local services
├── docs/
│   ├── DEVELOPMENT_PLAN.md       # This file
│   ├── SETUP.md                  # Accounts, keys, OAuth, deploy (written in F-001..F-006)
│   └── adr/                      # Architecture decision records (one per changed decision)
├── apps/
│   └── web/                      # React PWA
│       ├── src/
│       │   ├── app/              # routes, layout, providers
│       │   ├── features/         # one folder per domain: calendar/, custody/, handovers/,
│       │   │                     #   proposals/, expenses/, feed/, voice/, family/, notifications/
│       │   │   └── <feature>/    #   api.ts (queries/mutations), components/, hooks/, types.ts
│       │   ├── components/ui/    # shadcn components
│       │   ├── lib/              # supabase client, auth, storage adapter, dates, i18n
│       │   └── locales/{en,ro}/*.json
│       ├── public/
│       └── tests/e2e/
├── workers/
│   └── icoparent-worker/         # Cloudflare Worker: push + cron
├── supabase/
│   ├── config.toml
│   ├── migrations/               # timestamped SQL, never edited after merge
│   ├── tests/                    # pgTAP: RLS + function tests
│   └── seed.sql                  # demo family for local dev
├── scripts/
│   └── seed-github-issues.py     # Creates labels, milestones, issues from this plan
└── .github/
    ├── ISSUE_TEMPLATE/feature_request.yml
    ├── pull_request_template.md
    └── workflows/ (ci.yml, backup.yml)
```

Package manager: **pnpm** workspaces.

---

## 5. Domain model (database)

All tables live in `public`, have `id uuid primary key default gen_random_uuid()`, `created_at timestamptz default now()`, and `family_id uuid not null references families`. The exceptions are the user-owned tables `profiles`, `push_subscriptions` and `notification_prefs`, which are scoped by user. Child rows (for example `checkins`) must have the same `family_id` as their parent row, enforced by a composite foreign key or trigger. Money is `amount_minor bigint` (bani/cents) + `currency char(3)`.

### 5.1 Tables

| Table | Key columns | Notes |
|-------|-------------|-------|
| `profiles` | `id` (= `auth.users.id`), `display_name`, `avatar_url`, `locale` (`en`/`ro`), `timezone` | Created by trigger on sign-up |
| `families` | `name`, `timezone`, `default_currency`, `created_by` | |
| `family_members` | `family_id`, `user_id` (nullable), `role` (`parent`/`child`), `display_name`, `color`, `birthdate` (children), `status` (`invited`/`active`/`left`) | A child without login has `user_id = null`. Max 2 active parents in MVP. |
| `invites` | `family_id`, `email`, `role`, `token_hash`, `expires_at`, `accepted_at`, `created_by` | Accept via RPC `accept_invite(token)` |
| `custody_patterns` | `family_id`, `name`, `starts_on`, `cycle_length_days`, `segments jsonb` (`[{from_day, to_day, parent_member_id}]`), `handover_time`, `handover_location`, `is_active` | One active pattern per family |
| `custody_exceptions` | `family_id`, `starts_at`, `ends_at`, `parent_member_id`, `proposal_id`, `reason` | Created only by an accepted proposal |
| `events` | `family_id`, `kind` (`child_event`/`parent_blocker`/`family_event`), `title`, `notes`, `starts_at`, `ends_at`, `all_day`, `rrule` (nullable), `location`, `visibility` (`family`/`parents`), `status` (`confirmed`/`pending`/`voided`), `created_by` | `pending` while a linked proposal is open |
| `event_children` | `family_id`, `event_id`, `child_member_id` | |
| `handovers` | `family_id`, `scheduled_at`, `from_parent_id`, `to_parent_id`, `location`, `source` (`pattern`/`exception`/`manual`), `status` (`scheduled`/`in_progress`/`completed`/`missed`/`voided`) | Generated from custody (F-115) |
| `checkins` | `family_id`, `handover_id`, `actor_member_id`, `kind` (`dropoff`/`pickup`/`confirm`), `at`, `lat`, `lng`, `accuracy_m`, `note` | Immutable (insert-only) |
| `proposals` | `family_id`, `kind` (`blocker_request`/`custody_swap`/`decision`/`event_change`), `title`, `body`, `payload jsonb`, `amount_minor`, `currency`, `subject_type`, `subject_id`, `created_by`, `status`, `expires_at`, `parent_proposal_id`, `resolved_at` | `payload` holds kind-specific data (validated in SQL) |
| `proposal_responses` | `family_id`, `proposal_id`, `member_id`, `response` (`accept`/`decline`/`counter`), `comment`, `counter_proposal_id` | Insert-only |
| `expenses` | `family_id`, `created_by`, `category`, `title`, `amount_minor`, `currency`, `original_amount_minor`, `original_currency`, `spent_on`, `merchant`, `note`, `paid_by_member_id`, `status` (`recorded`/`voided`), `version`, `supersedes_id`, `decision_proposal_id` | |
| `expense_children` | `family_id`, `expense_id`, `child_member_id` | |
| `acknowledgments` | `family_id`, `subject_type`, `subject_id`, `member_id`, `at` | Generic "seen & noted" |
| `posts` | `family_id`, `author_member_id`, `body`, `audience` (`family`/`parents`), `happened_on`, `event_id` (nullable), `status` | Journal / feed |
| `reactions` | `family_id`, `post_id`, `member_id`, `emoji` | Unique (post, member, emoji) |
| `attachments` | `family_id`, `owner_type` (`expense`/`post`/`event`/`proposal`/`checkin`), `owner_id`, `kind` (`image`/`audio`), `storage_path`, `thumb_path`, `mime`, `bytes`, `width`, `height`, `duration_ms`, `created_by` | Files at `family/{family_id}/{owner_type}/{owner_id}/{uuid}.webp` |
| `notifications` | `family_id`, `recipient_user_id`, `type`, `link`, `payload jsonb`, `read_at`, `pushed_at` | Inserted by triggers only. Stores a type and parameters, never finished text; the text is rendered in the recipient's language |
| `push_subscriptions` | `user_id`, `endpoint`, `p256dh`, `auth`, `user_agent`, `last_used_at` | |
| `notification_prefs` | `user_id`, `type`, `push` bool, `inbox` bool | |
| `audit_log` | `family_id`, `table_name`, `row_id`, `action`, `actor_user_id`, `at`, `old jsonb`, `new jsonb` | Written by generic trigger on all domain tables. Insert-only, never exposed for update/delete. |

### 5.2 Helper SQL functions (security definer, `search_path` pinned)

- `is_family_member(fid uuid) returns bool`
- `is_family_parent(fid uuid) returns bool`
- `current_member_id(fid uuid) returns uuid`
- `custody_parent_on(fid uuid, at timestamptz) returns uuid` — pattern + exceptions
- `accept_invite(token text)`, `create_family(name, timezone, currency)`
- `create_proposal(...)`, `respond_to_proposal(proposal_id, response, comment, counter jsonb)`, `withdraw_proposal(id)`
- `acknowledge(subject_type, subject_id)`
- `edit_expense(id, patch jsonb)` — applies D6 (in-place vs new version)
- `void_item(subject_type, subject_id, reason)`
- `checkin(handover_id, kind, lat, lng, note)`
- `generate_handovers(fid, from_date, to_date)`
- `run_scheduled_jobs()` — expire proposals, send reminders, generate next 60 days of handovers, mark missed handovers

### 5.3 RLS baseline (applies to every domain table)

```sql
-- read: any family member, except children are filtered further
using ( is_family_member(family_id) and (
        is_family_parent(family_id)
        or <child-visible condition for this table> ) )
-- insert: parents (children only into posts/reactions with audience='family')
-- update: only via SQL functions (no direct UPDATE policy) unless table says otherwise
-- delete: never (no DELETE policy)
```

Children can **never** select from: `expenses`, `expense_children`, `proposals`, `proposal_responses`, `acknowledgments`, `audit_log`, `invites`, and `posts`/`events` with `visibility/audience = 'parents'`.

### 5.4 Proposal engine state machine

```
             create
               │
               ▼
          ┌─────────┐  withdraw (author)   ┌───────────┐
          │ pending │─────────────────────▶│ withdrawn │
          └────┬────┘                      └───────────┘
   accept ┌────┼──────────┬───────────────┐ expires_at passed (cron)
          ▼    ▼ decline   ▼ counter        ▼
   ┌──────────┐ ┌────────┐ ┌───────────┐ ┌─────────┐
   │ accepted │ │declined│ │ countered │ │ expired │
   └────┬─────┘ └────────┘ └─────┬─────┘ └─────────┘
        │ apply effect           └─▶ new proposal (parent_proposal_id = old,
        ▼                              author = responder). Counter of a counter
   kind-specific trigger               is NOT allowed (accept/decline only).
```

Effects on `accepted` (in SQL, same transaction):

| kind | Effect |
|------|--------|
| `blocker_request` | linked `events` row → `status = 'confirmed'` |
| `custody_swap` | insert `custody_exceptions`; regenerate affected handovers |
| `event_change` | apply `payload.patch` to the linked event (new values recorded in audit_log) |
| `decision` | mark decided; UI offers "Log expense for this" pre-filled (`decision_proposal_id`) |

Only the **other** parent can respond. The author can only withdraw. Every transition inserts a `notifications` row.

---

## 6. Core rules every feature must follow

1. **Family scope:** every query is scoped by the active `family_id`. Never trust `family_id` from the client without RLS backing it.
2. **No direct UPDATE/DELETE from the client** on domain tables. Mutations that change state go through RPC functions listed in §5.2 (simple inserts may go direct when RLS covers them).
3. **Author vs. other parent:** UI shows *Edit / Void* only to the author, *Acknowledge / Approve / Decline / Counter* only to the other parent.
4. **Child view:** every screen must be checked in "child mode" (role = child). Hide money, proposals, parent-only items. RLS is the real guard; UI hiding is cosmetic.
5. **Time:** store `timestamptz`; display in the family timezone; all-day events stored as dates in family TZ.
6. **Files:** always go through `lib/storage.ts` (`upload(file, owner) → attachment`). It compresses, creates a 400 px thumbnail, uploads both, inserts `attachments`. Max 10 images per item.
7. **Notifications:** created by DB triggers, never by the frontend.
8. **Strings:** no hard-coded UI text; use `t('feature.key')`, with every key present in both `en` and `ro`. Store codes, not labels (categories, statuses). SQL functions raise stable error codes that the UI translates. Anything generated outside the UI (push, digests, iCal, exports, reports) uses the recipient's `profiles.locale`.
9. **Accessibility:** keyboard reachable, labelled controls, colour is never the only signal (custody colours also have initials/patterns).
10. **Mobile first:** design at 375 px width first; the app must be usable with one thumb.

---

## 7. Engineering conventions & Definition of Done

### Conventions

- **Branches:** `feat/F-123-short-name`, `fix/...`, `chore/...`.
- **Commits:** Conventional Commits, referencing the feature: `feat(expenses): receipt upload (F-151)`.
- **Migrations:** `supabase migration new <name>`; never edit a merged migration; one feature may add several.
- **Types:** after every migration run `pnpm db:types` and commit the result.
- **No new dependency** without a line in the PR description explaining why (bundle-size conscious).
- **Feature folders** own their queries: components never call `supabase` directly — they use hooks from `features/<x>/api.ts`.

### Definition of Done (copy into every PR)

- [ ] Acceptance criteria of the issue all met
- [ ] Migration + RLS policies + pgTAP tests (if DB touched) — tests cover parent A, parent B, child, outsider
- [ ] Generated types updated
- [ ] Unit tests for non-trivial logic; Playwright happy path for user-facing flows
- [ ] Works at 375 px and on desktop; checked in child mode
- [ ] Strings in i18n files, in both `en` and `ro`
- [ ] No console errors; `pnpm lint && pnpm typecheck && pnpm test` green
- [ ] Docs updated (this plan, SETUP.md, or an ADR if a decision changed)
- [ ] Storage/egress impact noted if files involved

---

## 8. Agentic development workflow

### 8.1 Loop per feature

1. **Pick** the lowest-numbered open issue in the current milestone whose dependencies are closed.
2. **Plan:** ask the agent to read `CLAUDE.md`, this plan's sections relevant to the feature, and the issue; it replies with a short plan (files, migration, tests) **before coding**.
3. **DB first:** migration → RLS → pgTAP tests → `supabase db reset` → tests green → generate types.
4. **API layer:** hooks in `features/<x>/api.ts`.
5. **UI:** components + route; check 375 px and child mode.
6. **Tests & DoD checklist**, open PR, review the diff yourself (you are the reviewer — read the SQL especially).
7. Merge → Cloudflare Pages deploys → apply migration to the Supabase project (`supabase db push`).

### 8.2 Prompt template (copy/paste)

```
Read CLAUDE.md and docs/DEVELOPMENT_PLAN.md sections 2, 5, 6, 7.
Implement issue #<n> — F-<id> <title>.

Acceptance criteria:
<paste from issue>

Constraints:
- Follow the DB-first order in §8.1. Show me the plan first and wait for "go".
- Do not change locked decisions (§2). If one blocks you, stop and explain.
- Keep the change limited to this feature. List anything you noticed but did not do.
```

### 8.3 Sizing guide (for issues)

| Size | Meaning | Rough effort with an agent |
|------|---------|---------------------------|
| S | One table or one screen, no new concepts | ≤ ½ day |
| M | Table + RPC + screen, or a reusable component | 1–2 days |
| L | Cross-cutting (engine, scheduling, push) | 3–5 days |
| XL | Must be split before starting | — |

Agents do best on **S/M**. Any **L** should be done in 2–3 PRs (DB → API → UI).

---

## 9. Roadmap overview & timeline

Estimates assume one developer, part-time (~15 h/week), with AI assistance. Treat as relative, not promises.

| Version | Theme | Goal / exit criterion | Est. duration |
|---------|-------|----------------------|---------------|
| **V0** | Foundation | Empty app deployed in EN + RO; Google login works; full stack and E2E run locally in Docker; CI + backups running | 2–3 weeks |
| **V1** | **MVP** | Two parents use it daily for a month instead of WhatsApp | 8–10 weeks |
| V2 | Polish & everyday comfort | Offline read, iCal feed, search, exports | 4–5 weeks |
| V3 | Native apps | iOS + Android builds (Capacitor) with native push and login | 3–4 weeks |
| V4 | High-conflict mode | Court-ready records, structured messaging, stricter workflows | 4–5 weeks |
| V5 | Extended circle | Grandparents, new partners, nannies, teens with richer roles | 3–4 weeks |
| V6 | Money+ | Splits, balances, settle-up, recurring costs, budgets | 4–5 weeks |
| V7 | AI assist | Receipt extraction, weekly digest, tone check, Q&A | 4–6 weeks |
| V8 | Agentic | MCP server / Claude skill; agent drafts proposals | 4–6 weeks |
| V9 | Public launch | Onboarding, GDPR tooling, R2 storage, paid plan, landing page | 5–6 weeks |
| V10 | Ecosystem | Google Calendar 2-way sync, documents vault, health & school | ongoing |

**V1 internal milestones** (each is shippable to yourselves):

| Milestone | Contents | Week |
|-----------|----------|------|
| M1 Family | Family, invites, kids, settings, acknowledge/void | 1–2 |
| M2 Time | Calendar, custody pattern, events, blockers, handover generation | 3–4 |
| M3 Agreements | Proposal engine, blocker requests, swaps, decisions | 5–6 |
| M4 Handover & money | Check-ins, expenses + receipts | 7–8 |
| M5 Memories & alerts | Feed, voice notes, inbox, push, PWA install | 9–10 |

---

## 10. Feature catalogue by version

Format (used by `scripts/seed-github-issues.py` — keep it exact):
`### F-<id> · <title>` then a `**Size:** … · **Area:** … · **Depends on:** …` line, a description, and `Acceptance criteria` bullets. IDs: V0 = F-0xx, V1 = F-1xx, V2 = F-2xx, … V10 = F-10xx.

---

## V0 — Foundation

### F-001 · Monorepo scaffold
**Size:** S · **Area:** infra · **Depends on:** —

pnpm workspace with `apps/web` (Vite React TS, Tailwind, shadcn/ui, React Router, TanStack Query, i18next), `workers/icoparent-worker`, `supabase/`. ESLint + Prettier + strict TS.

**Acceptance criteria**
- [ ] `pnpm i && pnpm dev` starts the web app showing a placeholder home
- [ ] `pnpm lint`, `pnpm typecheck`, `pnpm test` exist and pass
- [ ] Folder layout matches §4

### F-002 · Supabase project & local dev
**Size:** S · **Area:** db · **Depends on:** F-001

Supabase CLI configured; local stack via `supabase start`; first migration creates `profiles` + sign-up trigger; `pnpm db:reset`, `pnpm db:types`, `pnpm db:test` scripts.

**Acceptance criteria**
- [ ] `supabase db reset` runs clean locally
- [ ] Types generated into `apps/web/src/lib/database.types.ts`
- [ ] pgTAP runs with at least one passing test
- [ ] `docs/SETUP.md` lists steps to create the hosted project and link it

### F-003 · Google sign-in
**Size:** M · **Area:** auth · **Depends on:** F-002

Google Cloud OAuth client (Web), Supabase Google provider, `lib/auth.ts` (signIn, signOut, session hook), protected routes, profile auto-created.

**Acceptance criteria**
- [ ] Sign in with Google works locally and on the deployed URL
- [ ] Unauthenticated users are redirected to `/login`
- [ ] `profiles` row created with name + avatar from Google
- [ ] All auth calls live in `lib/auth.ts` only (D2)
- [ ] SETUP.md documents redirect URLs for localhost, preview and production

### F-004 · Cloudflare Pages deployment
**Size:** S · **Area:** infra · **Depends on:** F-001

Connect GitHub repo to Pages; build `apps/web`; env vars `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY`; SPA fallback; preview deploys on PRs.

**Acceptance criteria**
- [ ] Push to `main` deploys production
- [ ] PRs get preview URLs
- [ ] Deep links (e.g. `/calendar`) load correctly

### F-005 · CI pipeline
**Size:** S · **Area:** infra · **Depends on:** F-002

GitHub Actions: install (cached), lint, typecheck, unit tests, `supabase db reset` + pgTAP in a local Supabase.

**Acceptance criteria**
- [ ] CI required on PRs to `main`
- [ ] A failing RLS test fails the build
- [ ] CI needs no repository secrets, so pull requests from forks run in full (D16)

### F-006 · Nightly backups & keep-alive
**Size:** S · **Area:** infra · **Depends on:** F-002

GitHub Action nightly `pg_dump` of the hosted DB (connection string in secrets), gzipped + encrypted (age/gpg), uploaded to a private R2 bucket with a 90-day lifecycle rule (D15). The workflow runs only on `schedule` and `workflow_dispatch`, never on pull requests, and must not print data to its public logs. Worker cron skeleton that calls a trivial RPC hourly (keeps project awake).

**Acceptance criteria**
- [ ] Backup workflow runs on schedule and on manual trigger
- [ ] No Actions artifact is produced, and the R2 bucket is not publicly readable
- [ ] Restore procedure documented and tested once into a local DB
- [ ] Worker deployed with hourly cron; Supabase does not pause after 7 idle days

### F-007 · App shell & design system
**Size:** M · **Area:** ui · **Depends on:** F-003

Mobile-first layout: bottom tab bar (Calendar, Agreements, Money, Feed, More), top bar with family switcher placeholder, light/dark theme, toast system, empty/loading/error states, i18n wiring.

**Acceptance criteria**
- [ ] Navigation works at 375 px and desktop (side nav ≥ 1024 px)
- [ ] Theme tokens defined once (colours for parent A, parent B, child)
- [ ] Every text comes from the locale files

### F-008 · English + Romanian localization
**Size:** M · **Area:** i18n · **Depends on:** F-007

Full `en` and `ro` catalogues, language picker saved to `profiles.locale`, browser detection before sign-in with `en` as fallback. Dates via date-fns locales; numbers and money via `Intl` (for example `1.234,50 lei` in `ro`). Romanian plurals use i18next's `one`/`few`/`other` forms. Text uses correct comma-below `ș` and `ț`. Agents may draft Romanian, but a native speaker reviews it before release.

**Acceptance criteria**
- [ ] Switching language updates the UI without a reload and persists across devices
- [ ] CI fails if a key exists in one language but not the other
- [ ] Unit tests cover Romanian plurals for 1, 2 and 20 items, plus date and money formatting
- [ ] Layout holds at 375 px in Romanian

### F-009 · Dockerised local stack
**Size:** M · **Area:** infra · **Depends on:** F-001, F-002, F-006

`docker-compose.yml` with `web` and `worker` services on the Supabase Docker network, as described in §3. `pnpm docker:up` starts Supabase, applies migrations and seed data, then starts the services; `pnpm docker:down` stops them. Local defaults live in `.env.example`. The Worker runs with `PUSH_MODE=log`.

**Acceptance criteria**
- [ ] On a clean machine with only Docker, Node and pnpm, `pnpm docker:up` gives a working app at `localhost:5173` with no cloud accounts
- [ ] Editing a source file hot-reloads the app, including on macOS
- [ ] A local database webhook reaches the Worker, and the scheduled job can be triggered on demand
- [ ] Image versions are pinned; SETUP.md documents the local workflow

### F-010 · Local sign-in & seeded actors
**Size:** M · **Area:** auth · **Depends on:** F-003, F-009

`lib/auth.ts` gains an email/password path used only when `VITE_AUTH_MODE=local`. `seed.sql` creates fictional users for parent A, parent B, child and outsider, with the first three in a demo family. The local sign-in screen offers one-tap login for each. Hosted Supabase keeps the email provider disabled, and SETUP.md says so.

**Acceptance criteria**
- [ ] All four actors can sign in locally without Google, and each gets the same RLS treatment as a Google user
- [ ] Sign-out and switching between actors work
- [ ] The production build fails if `VITE_AUTH_MODE=local`
- [ ] CI confirms the production bundle contains no local sign-in code or seeded credentials
- [ ] Seed data is never applied to the hosted database (`supabase db push` runs without `--include-seed`)

### F-011 · Docker E2E harness
**Size:** M · **Area:** quality · **Depends on:** F-005, F-010

`pnpm e2e` runs Playwright in the pinned Compose `e2e` service against a freshly reset local stack. Fixtures provide one signed-in browser context per actor, so two-parent flows run in one test. Time-based flows backdate rows with the service role, then trigger the scheduled job, rather than faking the database clock. Push is asserted against the Worker's `PUSH_MODE=log` output. The browser container uses its own app and Supabase URLs, with those origins treated as secure so service workers and microphone APIs work.

**Acceptance criteria**
- [ ] A sample test signs in as parent A and parent B in separate contexts and sees shared data live
- [ ] A sample test confirms that a child is blocked from a parents-only screen
- [ ] The E2E suite runs in CI with no repository secrets and uploads traces only from fictional data
- [ ] The same command works locally and in CI

---

## V1 — MVP

### M1 · Family

### F-101 · Create family & onboarding
**Size:** M · **Area:** family · **Depends on:** F-007, F-008, F-011

First-run flow: create family (name, timezone, default currency RON), become parent #1. Tables: `families`, `family_members`; helpers `is_family_member`, `is_family_parent`, `current_member_id`; RPC `create_family`. Generic `audit_log` trigger introduced here and attached to every domain table from now on.

**Acceptance criteria**
- [ ] New user without a family lands on onboarding
- [ ] RLS: outsider cannot read the family (pgTAP)
- [ ] `audit_log` row written on insert/update of `families` and `family_members`

### F-102 · Invite co-parent
**Size:** M · **Area:** family · **Depends on:** F-101

Parent creates an invite link (token, 7-day expiry, single use); shares via native share sheet/copy. Invitee signs in with Google → `accept_invite(token)` → becomes parent #2. Max 2 active parents.

**Acceptance criteria**
- [ ] Invite link works on another device/account
- [ ] Expired/used tokens show a clear error
- [ ] Token stored hashed
- [ ] Third parent invite is rejected

### F-103 · Children profiles (with optional login)
**Size:** M · **Area:** family · **Depends on:** F-101

Add child: name, birthdate, colour, avatar. Optionally invite the child via link (role `child`). Child mode: restricted navigation (Calendar, Feed only).

**Acceptance criteria**
- [ ] Children without login appear everywhere as selectable kids
- [ ] Child login sees only Calendar + Feed
- [ ] pgTAP: child cannot select expenses/proposals/parents-only rows (create the test helper now; extend per feature)

### F-104 · Family & profile settings
**Size:** S · **Area:** family · **Depends on:** F-102, F-103

Edit own profile (name, avatar, colour), family name/timezone/currency (either parent), list members, leave family.

**Acceptance criteria**
- [ ] A parent cannot edit the other parent's profile (P1)
- [ ] Changes appear in `audit_log`

### F-105 · Acknowledge & void
**Size:** M · **Area:** family · **Depends on:** F-101

Shared P1/P2 building blocks used by events, expenses and later items: `acknowledgments` table, RPCs `acknowledge(subject_type, subject_id)` and `void_item(subject_type, subject_id, reason)`, and a small allow-list that each feature adds its subject type to. Includes a reusable *Acknowledge* / *Void* UI component.

**Acceptance criteria**
- [ ] Only the other parent can acknowledge; the author cannot acknowledge their own item (pgTAP)
- [ ] Acknowledgments are insert-only and children cannot select them (pgTAP)
- [ ] `void_item` requires a reason, is author-only, and rejects unknown subject types

### M2 · Time

### F-111 · Calendar views
**Size:** L · **Area:** calendar · **Depends on:** F-101

Month, week and agenda views; family-timezone aware; custody colouring placeholder; filter by child; tap a day → day sheet. Data hook `useCalendarRange(from, to)` merging events, handovers, custody days.

**Acceptance criteria**
- [ ] Smooth on mobile; swiping between months/weeks
- [ ] Agenda view is the default on mobile
- [ ] Correct across DST change (unit test)

### F-112 · Custody pattern
**Size:** L · **Area:** custody · **Depends on:** F-111

Pattern editor with presets (week-on/week-off, 2-2-3, 2-2-5-5, alternate weekends + midweek) and custom cycle; preview of next 8 weeks; `custody_patterns` and `custody_exceptions` tables (exceptions are written only by SQL functions); SQL `custody_parent_on()`, where an exception overrides the pattern. Calendar days coloured by parent. Changing the active pattern requires a proposal once both parents have joined (uses F-121; until then, direct).

**Acceptance criteria**
- [ ] Presets generate the expected schedule (SQL tests for each preset)
- [ ] An exception overrides the pattern for its window only (SQL test)
- [ ] Calendar shows who has the kids each day with colour + initial
- [ ] "Today: kids with <parent> until <date/time>" banner on home

### F-113 · Child events
**Size:** M · **Area:** calendar · **Depends on:** F-111, F-105

Create/view events for one or more children (school, doctor, football, birthday), all-day or timed, location, notes, optional simple recurrence (none/daily/weekly/monthly, end date) stored as RRULE, attachments (F-153 later). Visibility `family` by default.

**Acceptance criteria**
- [ ] Author can edit until acknowledged; other parent sees *Acknowledge* (D6)
- [ ] Other parent wanting a change uses "Propose change" (F-124)
- [ ] Recurring events expand correctly in views (unit tests)

### F-114 · Parent blockers
**Size:** S · **Area:** calendar · **Depends on:** F-111

A parent marks time as unavailable ("busy" or with a reason). Visibility: other parent sees "Busy" by default; author can choose to show details. Blockers on **your own** custody time that need the other parent to cover are created via *Blocker request* (F-122).

**Acceptance criteria**
- [ ] Blockers render distinctly (hatched) and never visible to children
- [ ] Overlap warning when a blocker hits a handover

### F-115 · Handover generation
**Size:** M · **Area:** handovers · **Depends on:** F-112, F-006

`handovers` generated for the next 60 days from pattern + exceptions (`generate_handovers`), refreshed on pattern/exception change and by cron; manual one-off handovers allowed. Introduces `run_scheduled_jobs()`, which the Worker cron calls from now on; later features add their jobs to it.

**Acceptance criteria**
- [ ] Handovers appear on calendar at correct switch times
- [ ] Changing pattern or adding an exception regenerates future (not past) handovers
- [ ] Regeneration is idempotent: running it twice creates no duplicates (SQL test)

### M3 · Agreements

### F-121 · Proposal engine (core)
**Size:** L · **Area:** proposals · **Depends on:** F-101

Tables `proposals`, `proposal_responses`; RPCs `create_proposal`, `respond_to_proposal`, `withdraw_proposal`; state machine §5.4; one-level counter; expiry; effects dispatched by `kind` via trigger. Creates the `notifications` table (recipient-only RLS, trigger-inserted only) and the proposal notification rows; the inbox UI follows in F-181. **Agreements** tab: *Waiting for me*, *Waiting for them*, *History*.

**Acceptance criteria**
- [ ] Author cannot respond to own proposal; child cannot see proposals (pgTAP)
- [ ] Notifications are readable only by their recipient and cannot be inserted by clients (pgTAP)
- [ ] Counter creates linked proposal; counter-of-counter rejected
- [ ] `run_scheduled_jobs()` expires overdue proposals and creates 48 h reminders
- [ ] Every transition notifies the other parent

### F-122 · Blocker requests ("can you cover?")
**Size:** M · **Area:** proposals · **Depends on:** F-121, F-114, F-112, F-115

"I can't have the kids Thu 16:00–20:00 — can you take them?" → creates pending event + `blocker_request` proposal. Accept → confirmed + custody exception for that window.

**Acceptance criteria**
- [ ] Pending requests show on calendar as dashed
- [ ] Accept updates calendar and handovers; decline leaves custody unchanged

### F-123 · Custody swap requests
**Size:** M · **Area:** proposals · **Depends on:** F-121, F-112, F-115

Swap or give/take days ("swap my weekend 14–16 for your 21–23"). Accept → `custody_exceptions` + regenerated handovers.

**Acceptance criteria**
- [ ] Preview shows before/after schedule
- [ ] Accepted swaps visible on calendar with an "exception" marker

### F-124 · Event change requests
**Size:** S · **Area:** proposals · **Depends on:** F-121, F-113

Other parent proposes a change to an event they didn't create (time, location, cancel). Accept applies the patch.

**Acceptance criteria**
- [ ] Diff of proposed vs current shown
- [ ] Author of event is the one who approves

### F-125 · Decisions ("let's buy this toy — agree?")
**Size:** M · **Area:** proposals · **Depends on:** F-121

Free-form decision with optional amount, link, photo, child, deadline. Accepted decision offers "Log the expense" pre-filled.

**Acceptance criteria**
- [ ] Decision with photo works (uses storage adapter from F-151; if not merged yet, ship without photo and add after)
- [ ] Accepted decision → expense link visible both ways

### M4 · Handover & money

### F-132 · Pickup / drop-off check-ins
**Size:** M · **Area:** handovers · **Depends on:** F-115, F-121

Big buttons on the home screen near handover time: "Dropped off" / "Picked up"; receiving parent "Confirm". Optional GPS (permission prompt only when toggled). Optional note + photo. Lateness computed vs `scheduled_at`. Missed handovers flagged by cron after +3 h.

**Acceptance criteria**
- [ ] Check-ins are insert-only (no update/delete policy)
- [ ] Notification to other parent on each check-in
- [ ] Handover history list with on-time / late (+min) / missed

### F-141 · Expense log
**Size:** M · **Area:** expenses · **Depends on:** F-101, F-105

Add expense: title, amount, category (school, clothes, health, activities, toys, trips, food, other), date, children, paid by, note, optional original currency/amount. List with filters (month, category, child, payer) and per-parent monthly totals. Other parent: *Acknowledge*. Edits follow D6 via `edit_expense`; void with reason.

**Acceptance criteria**
- [ ] Money stored in minor units; formatting per locale
- [ ] Version history visible on an edited-after-ack expense
- [ ] Children have zero access (pgTAP)

### F-151 · Storage adapter & image pipeline
**Size:** M · **Area:** storage · **Depends on:** F-101

`lib/storage.ts`: compress to WebP (≤ 1600 px, quality ~0.75), 400 px thumbnail, upload to private bucket `family-media` at path convention §5.1, insert `attachments`. Storage RLS policies keyed on path `family/{family_id}/…`. Signed URLs with caching.

**Acceptance criteria**
- [ ] A 4 MB phone photo uploads as ≤ 300 KB
- [ ] Outsider and child (for expense files) cannot fetch the object (test)
- [ ] Adapter interface allows R2 swap without touching features

### F-152 · Receipt photos on expenses
**Size:** S · **Area:** expenses · **Depends on:** F-141, F-151

Attach up to 10 receipt/proof images (camera or gallery); gallery viewer; thumbnails in list.

**Acceptance criteria**
- [ ] Camera capture works on Android Chrome and iOS Safari PWA
- [ ] Attachments are frozen once the expense is acknowledged (new version to change)

### M5 · Memories & alerts

### F-161 · Family feed / journal
**Size:** L · **Area:** feed · **Depends on:** F-151

Private social feed: text + up to 10 photos, `happened_on` date, linked children, optional link to a calendar event, audience `family`/`parents`. Reactions. Timeline grouped by month; "On this day" card. Children can post with audience `family` if allowed by parents (family setting).

**Acceptance criteria**
- [ ] Parents-only posts invisible to children (pgTAP)
- [ ] Feed pagination (infinite scroll, 20 per page) uses thumbnails only
- [ ] Event detail shows linked memories

### F-162 · Storage usage meter
**Size:** S · **Area:** storage · **Depends on:** F-151

Settings shows MB used by the family (sum of `attachments.bytes`) vs budget; warning at 70 %.

**Acceptance criteria**
- [ ] Number matches bucket within 5 %

### F-171 · Voice notes
**Size:** M · **Area:** voice · **Depends on:** F-151, F-161

Record (hold-to-record + tap-to-lock), max 2 min, preview, attach to: feed post, event, expense, proposal. Opus/webm where supported, AAC/mp4 on Safari. Inline player with waveform-lite (progress bar).

**Acceptance criteria**
- [ ] Recording works on Android Chrome, iOS Safari (installed PWA) and desktop Chrome
- [ ] 1 minute ≈ ≤ 250 KB
- [ ] Children can play voice notes on family-audience posts

### F-181 · In-app inbox
**Size:** M · **Area:** notifications · **Depends on:** F-121, F-132, F-141, F-161, F-105

Inbox UI over the `notifications` table from F-121, which proposals and check-ins already populate. Adds the remaining triggers (expenses, new posts, acknowledgments). Bell with unread count (Realtime), list, mark read, deep links.

**Acceptance criteria**
- [ ] Unread count updates live without refresh
- [ ] Notifications only visible to their recipient
- [ ] Each notification renders in the viewer's language from its `type` and `payload`

### F-182 · Web Push
**Size:** L · **Area:** notifications · **Depends on:** F-181, F-006

PWA service worker push handler; subscribe flow + per-type prefs (`notification_prefs`); Supabase Database Webhook on `notifications` INSERT → Worker `POST /push` (shared secret) → Web Push with VAPID using a Workers-compatible (WebCrypto) library; remove dead subscriptions (404/410).

**Acceptance criteria**
- [ ] Push received on Android Chrome and iOS (installed PWA, iOS ≥ 16.4)
- [ ] Clicking a push opens the right screen
- [ ] Only default types (D13) push by default
- [ ] Push text uses the recipient's `profiles.locale`, from catalogues shared with the web app

### F-183 · PWA install & offline shell
**Size:** S · **Area:** ui · **Depends on:** F-007

Manifest, icons, splash; install prompt helper (Android) and "Add to Home Screen" guide (iOS); offline fallback page; app-update toast.

**Acceptance criteria**
- [ ] Lighthouse PWA installable checks pass
- [ ] New deploy prompts "Update available"

### F-191 · Home / Today screen
**Size:** M · **Area:** ui · **Depends on:** F-112, F-132, F-121

Who has the kids now; next handover with check-in buttons; items waiting for me; today's events; latest memory.

**Acceptance criteria**
- [ ] Everything actionable today is reachable in ≤ 1 tap from Home

### F-199 · MVP hardening & dogfooding
**Size:** M · **Area:** quality · **Depends on:** F-191, F-182, F-171

Two-week real use. Fix list, performance pass (bundle < 300 KB gz initial), Playwright suite covering: invite, custody swap, check-in, expense with receipt, decision → expense, feed post with voice note.

**Acceptance criteria**
- [ ] Zero P1 bugs open
- [ ] Full Playwright suite passes in Docker with local sign-in, with a smoke run in both `en` and `ro`
- [ ] Native-speaker review of the Romanian UI is complete
- [ ] Backups verified; restore drill done
- [ ] Both parents prefer the app over chat for logistics

---

## V2 — Polish & everyday comfort

### F-202 · iCal subscription feed
**Size:** M · **Area:** calendar · **Depends on:** F-199

Per-user secret URL (Worker endpoint) exposing custody days, handovers and events as `.ics` for Google/Apple Calendar (read-only). Revocable token.

**Acceptance criteria**
- [ ] Subscribed calendar updates within the client's refresh window
- [ ] Children's feed excludes parent-only items

### F-203 · Offline read & queued actions
**Size:** L · **Area:** ui · **Depends on:** F-199

Cache last 60 days of calendar, handovers and feed thumbnails; queue check-ins offline and sync later (with original timestamp, flagged as "synced late").

**Acceptance criteria**
- [ ] Airplane mode: calendar readable, check-in queued and synced on reconnect

### F-204 · Search
**Size:** M · **Area:** ui · **Depends on:** F-199

Postgres full-text search across events, expenses, posts, proposals (RLS-respecting RPC).

**Acceptance criteria**
- [ ] Results respect role (children see only allowed items)

### F-205 · Exports (CSV / simple PDF)
**Size:** M · **Area:** expenses · **Depends on:** F-199

Export expenses (CSV) and a monthly summary PDF (client-side generation) with receipt thumbnails.

**Acceptance criteria**
- [ ] Export of a full year completes on mobile

### F-206 · Comments on items
**Size:** M · **Area:** proposals · **Depends on:** F-199

Threaded comments on events, expenses, proposals, posts (parents; children only on family posts).

**Acceptance criteria**
- [ ] Comments are insert-only; edit within 5 min, then versioned

### F-207 · Holiday & school-break schedules
**Size:** M · **Area:** custody · **Depends on:** F-199

Overlay rules for holidays (Christmas, Easter, summer split) on top of the base pattern; Romanian school holiday presets.

**Acceptance criteria**
- [ ] Holiday overlay wins over base pattern; shown in preview

### F-208 · Templates & quick add
**Size:** S · **Area:** ui · **Depends on:** F-199

Saved templates (e.g. "Football Tue 17:00"), quick-add expense from home, duplicate item.

**Acceptance criteria**
- [ ] Creating a frequent item takes ≤ 3 taps

---

## V3 — Native apps (Capacitor)

### F-301 · Capacitor wrapper
**Size:** M · **Area:** mobile · **Depends on:** F-199

Add Capacitor to `apps/web`; iOS + Android projects; deep links / universal links; status bar, safe areas.

**Acceptance criteria**
- [ ] App runs on simulator and a real device for both platforms

### F-302 · Native Google Sign-In
**Size:** M · **Area:** auth · **Depends on:** F-301

Native Google Sign-In plugin → ID token → `supabase.auth.signInWithIdToken`. Only `lib/auth.ts` changes.

**Acceptance criteria**
- [ ] Same account works across web and native

### F-303 · Native push (FCM / APNs)
**Size:** L · **Area:** notifications · **Depends on:** F-301, F-182

Device tokens stored next to web push subscriptions; Worker sends via FCM HTTP v1 (Android + iOS through APNs).

**Acceptance criteria**
- [ ] Push parity with web push types and deep links

### F-304 · Native camera, mic & share
**Size:** S · **Area:** mobile · **Depends on:** F-301

Capacitor Camera / native recorder; "Share to iCoParent" target for receipts and photos.

**Acceptance criteria**
- [ ] Sharing a photo from the gallery opens "new expense" or "new post"

### F-305 · Store release
**Size:** M · **Area:** mobile · **Depends on:** F-302, F-303

Store listings, privacy labels, TestFlight / internal testing tracks, release checklist.

**Acceptance criteria**
- [ ] Both apps approved in test tracks

---

## V4 — High-conflict mode

### F-401 · Conflict mode toggle
**Size:** M · **Area:** family · **Depends on:** F-199

Family-level setting (requires one parent; turning **off** requires both). Enables: no edits after creation (versions only), mandatory reasons on declines, read receipts, stricter check-ins.

**Acceptance criteria**
- [ ] Mode change recorded in audit log and visible to both

### F-402 · Read receipts
**Size:** S · **Area:** notifications · **Depends on:** F-401

"Seen by X at time" on proposals, expenses, messages.

**Acceptance criteria**
- [ ] Receipts are immutable

### F-403 · Structured messaging
**Size:** L · **Area:** messaging · **Depends on:** F-206

Parent-to-parent messages tied to topics (child, event, expense); no deletion; timestamps; exportable.

**Acceptance criteria**
- [ ] Messages cannot be deleted or edited after 5 minutes

### F-404 · Court-ready report
**Size:** L · **Area:** exports · **Depends on:** F-205, F-403

PDF for a date range: custody adherence, handover punctuality, expenses with receipts, proposals and outcomes, messages; integrity hash per page + audit appendix.

**Acceptance criteria**
- [ ] Report reproducible: same range → same hash

### F-405 · Verified check-ins
**Size:** M · **Area:** handovers · **Depends on:** F-132, F-401

GPS required in conflict mode with accuracy; optional geofence for usual handover location; photo optional.

**Acceptance criteria**
- [ ] Check-in outside geofence shows distance, not blocked

### F-406 · Tamper-evident audit log
**Size:** M · **Area:** db · **Depends on:** F-401

Hash-chain on `audit_log` rows; verification function; periodic anchor export.

**Acceptance criteria**
- [ ] Verification fails if any row is altered (test)

---

## V5 — Extended circle

### F-501 · Roles & permissions model
**Size:** L · **Area:** family · **Depends on:** F-199

New roles: `guardian` (grandparent), `partner`, `caregiver` (nanny), `teen` (child 13+ with more rights). Permission matrix per role, editable per member by both parents (proposal required).

**Acceptance criteria**
- [ ] Matrix enforced by RLS; pgTAP matrix test per role

### F-502 · Caregiver handovers
**Size:** M · **Area:** handovers · **Depends on:** F-501, F-132

A caregiver/grandparent can do pickups/drop-offs on behalf of a parent and check in.

**Acceptance criteria**
- [ ] Check-in shows "by Grandma on behalf of Parent A"

### F-503 · Multiple families per user
**Size:** M · **Area:** family · **Depends on:** F-501

Family switcher (blended families, or a grandparent in two families).

**Acceptance criteria**
- [ ] No data leakage between families (pgTAP)

### F-504 · Teen mode
**Size:** M · **Area:** family · **Depends on:** F-501

Teens can request events/rides (proposal to both parents), see their own pocket-money items.

**Acceptance criteria**
- [ ] Teen proposals need one parent's approval

---

## V6 — Money+

### F-601 · Expense split rules
**Size:** M · **Area:** expenses · **Depends on:** F-199

Family default split (50/50, 60/40) and per-category overrides; agreed via proposal.

**Acceptance criteria**
- [ ] Changing rules applies only to future expenses

### F-602 · Balances & settle-up
**Size:** L · **Area:** expenses · **Depends on:** F-601

Running balance, "Request reimbursement", "Mark as paid" with proof; monthly statement.

**Acceptance criteria**
- [ ] Balance recomputable from records (SQL view), never stored as a single number

### F-603 · Recurring expenses
**Size:** M · **Area:** expenses · **Depends on:** F-601

School fees, clubs, subscriptions; auto-created each period; pre-agreed via proposal.

**Acceptance criteria**
- [ ] Generated by cron; editable per occurrence

### F-604 · Budgets & insights
**Size:** M · **Area:** expenses · **Depends on:** F-602

Per-child/category yearly totals, simple charts, budget warnings.

**Acceptance criteria**
- [ ] Charts load from an aggregated RPC (not raw rows)

### F-605 · Child support tracking
**Size:** M · **Area:** expenses · **Depends on:** F-602

Record agreed/ordered support amounts and payments; reminders.

**Acceptance criteria**
- [ ] Missed payment flagged after due date + grace

---

## V7 — AI assist (first agentic layer)

> Introduces paid LLM API calls. Runs in the Worker; API key never in the client. Every AI output is a **draft** a human confirms.

### F-701 · Receipt extraction
**Size:** M · **Area:** ai · **Depends on:** F-152

Photo → amount, date, merchant, category suggestion → pre-filled expense form.

**Acceptance criteria**
- [ ] User confirms before save; cost per extraction logged

### F-702 · Weekly digest
**Size:** M · **Area:** ai · **Depends on:** F-199

Sunday summary: next week's schedule, pending agreements, spend, memories.

**Acceptance criteria**
- [ ] Opt-in per parent; never sent to children

### F-703 · Tone check (BIFF-style)
**Size:** M · **Area:** ai · **Depends on:** F-403

Before sending a message/decline reason, optional suggestion to make it Brief, Informative, Friendly, Firm.

**Acceptance criteria**
- [ ] Original text is never changed without user action

### F-704 · Ask the family log
**Size:** L · **Area:** ai · **Depends on:** F-204

Natural-language Q&A ("how much did we spend on school this year?", "when was the last dentist visit?") via tool-calling over RLS-scoped RPCs.

**Acceptance criteria**
- [ ] Answers cite the records used; respects role permissions

### F-705 · Conflict-aware scheduling suggestions
**Size:** M · **Area:** ai · **Depends on:** F-123

When a blocker clashes with custody, suggest swap options and draft the proposal.

**Acceptance criteria**
- [ ] Suggestion becomes a normal proposal only after user taps "Send"

---

## V8 — Agentic platform

### F-801 · Public API & personal access tokens
**Size:** L · **Area:** api · **Depends on:** F-501

Scoped tokens (read calendar, create proposals, …) per user; rate limits in Worker.

**Acceptance criteria**
- [ ] Token scopes enforced server-side; revocable

### F-802 · MCP server
**Size:** L · **Area:** ai · **Depends on:** F-801

Remote MCP server (Worker) exposing tools: `get_schedule`, `who_has_kids`, `list_pending_agreements`, `draft_proposal`, `log_expense`, `add_memory`.

**Acceptance criteria**
- [ ] Usable from Claude with OAuth; destructive actions require in-app confirmation

### F-803 · Claude skill / agent recipes
**Size:** M · **Area:** ai · **Depends on:** F-802

Packaged skill: "plan next month's handovers", "prepare school-year expense report", "summarize this week for the kids".

**Acceptance criteria**
- [ ] Skill documented with examples; works end-to-end on a demo family

### F-804 · Automations
**Size:** L · **Area:** ai · **Depends on:** F-802

User-defined rules ("when a school email arrives, draft an event"; "remind me 1 h before handover"). Email-in address per family.

**Acceptance criteria**
- [ ] Every automation action is logged and reversible

---

## V9 — Public launch

### F-901 · R2 storage migration
**Size:** M · **Area:** storage · **Depends on:** F-151

Swap adapter to Cloudflare R2 via Worker-signed URLs; migrate existing files; keep Supabase Storage read fallback during migration.

**Acceptance criteria**
- [ ] Zero broken media after migration

### F-902 · GDPR & account lifecycle
**Size:** L · **Area:** legal · **Depends on:** F-199

Privacy policy, terms, consent for children's data, data export (ZIP), account deletion with family-data rules, retention policy, DPA list.

**Acceptance criteria**
- [ ] Full export and deletion verified end-to-end

### F-903 · Public onboarding & landing page
**Size:** M · **Area:** growth · **Depends on:** F-902

Marketing site, self-serve sign-up, guided setup (custody wizard), sample family.

**Acceptance criteria**
- [ ] New family fully set up in < 5 minutes in user tests

### F-904 · Billing (freemium)
**Size:** L · **Area:** growth · **Depends on:** F-903

Free plan with storage cap; paid plan (more storage, AI features, court reports). Stripe via Worker webhooks.

**Acceptance criteria**
- [ ] Plan limits enforced in DB (storage quota trigger)

### F-905 · Ops: monitoring & paid infra
**Size:** M · **Area:** infra · **Depends on:** F-903

Supabase Pro (daily backups, no pause), error tracking, uptime monitor, status page, admin dashboard (support tools without reading private content).

**Acceptance criteria**
- [ ] Alert within 5 min of an outage

### F-906 · Security review
**Size:** M · **Area:** security · **Depends on:** F-902

RLS audit, pen-test checklist, dependency audit, rate limits, abuse reporting.

**Acceptance criteria**
- [ ] All critical/high findings closed before launch

---

## V10 — Ecosystem

### F-1001 · Google Calendar two-way sync
**Size:** XL · **Area:** calendar · **Depends on:** F-202

Split into: OAuth scopes, push sync from app, pull with conflict handling. (Must be split into sub-issues before starting.)

**Acceptance criteria**
- [ ] Sub-issues created; no duplicate events after round-trip

### F-1002 · Documents vault
**Size:** L · **Area:** documents · **Depends on:** F-901

IDs, passports, medical records, school documents per child, with expiry reminders (passport renewals).

**Acceptance criteria**
- [ ] Encrypted at rest; access logged

### F-1003 · Health & growth tracker
**Size:** M · **Area:** health · **Depends on:** F-1002

Vaccines, allergies, medication schedule shared at handover, height/weight milestones.

**Acceptance criteria**
- [ ] Medication handover note shown on check-in screen

### F-1004 · School integration
**Size:** L · **Area:** integrations · **Depends on:** F-804

Import school calendars (iCal), parse school emails into events.

**Acceptance criteria**
- [ ] Imported items arrive as drafts, not confirmed events

### F-1005 · Kid app mode
**Size:** M · **Area:** mobile · **Depends on:** F-305

Simplified kid UI: "where am I sleeping tonight", countdown to next handover, send a voice note to a parent.

**Acceptance criteria**
- [ ] Usable by a 7-year-old in a moderated test

---

## 11. GitHub project setup

Run once after pushing this file (requires GitHub CLI `gh` logged in and Python 3):

```bash
python3 scripts/seed-github-issues.py --repo bogandix/icoparent --dry-run   # preview
python3 scripts/seed-github-issues.py --repo bogandix/icoparent            # create
```

It creates:
- **Milestones:** `V0 Foundation`, `V1 MVP`, … `V10 Ecosystem`
- **Labels:** `type:feature`, `version:vN`, `size:S|M|L|XL`, `area:<area>`
- **Issues:** one per `F-xxx` above, body = description + acceptance criteria + dependencies + DoD link. Re-running skips issues whose title already exists.

Recommended GitHub Project (board) columns: **Backlog → Ready (deps closed) → In progress → In review → Done**. Only one issue in *In progress* at a time when working with agents.

Before the repo goes public, turn on **Private vulnerability reporting** (Settings → Security) so `SECURITY.md` works, and add branch protection on `main`.

New ideas use the **Feature request** issue template; triage assigns a version and an `F-` id, then this plan is updated in the same PR that implements it (or a docs PR).

---

## 12. Risks & open questions

| Risk | Impact | Mitigation |
|------|--------|-----------|
| Supabase free project paused / data loss | High | Worker keep-alive (F-006), nightly backups, restore drill |
| Storage fills 1 GB | Medium | Compression, usage meter (F-162), R2 swap ready (D5) |
| iOS PWA push/recording quirks | Medium | Test on real iPhone in F-171/F-182; native app in V3 |
| Kids under 13 can't use Google login | Medium | Kid profiles without login; parent device "kid view" (V10 kid mode) |
| Recurrence + timezone bugs | Medium | Unit tests incl. DST; RRULE kept simple in MVP |
| Agent-generated RLS mistakes | **High** | pgTAP matrix tests required for every table; human reviews all SQL |
| Scope creep into V1 | High | Anything not listed in V1 goes to an issue with a later milestone |
| Secrets or real family data reach the public repo or logs | **High** | D16, `.gitignore`, env-only config, GitHub secret scanning, fictional seed data; backups never in Actions artifacts (D15) |
| Local sign-in or seeded users reach production | **High** | Build fails on `VITE_AUTH_MODE=local`, CI scans the bundle, hosted email provider disabled, seed never pushed (F-010) |
| Romanian falls behind or reads poorly | Medium | CI key-parity check (F-008), both languages required in every PR, native-speaker review before release |
| Public schema makes RLS mistakes easier to find | High | pgTAP matrix tests, private vulnerability reporting, F-906 security review before launch |

**Open questions (answer before the related feature starts):**
1. Children's ages and whether any has a Google account → affects F-103.
2. Your actual custody pattern and handover time/place → informs F-112. Keep the real details out of the repo and use a fictional equivalent as test data (D16).
3. Domain name for production (Cloudflare) → F-004, OAuth redirect URIs.
4. Should a child be allowed to post to the feed by default? → F-161.
