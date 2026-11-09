# CLAUDE.md — rules for AI agents working on iCoParent

Read this file first, then `docs/DEVELOPMENT_PLAN.md`, then the GitHub issue you were given.

## What this project is
A co-parenting PWA: shared calendar on a custody schedule, handovers with check-ins, an approval
("proposal") engine, an expense log with photo proof, and a private family feed with voice notes.
Stack: React + Vite + TypeScript (apps/web) → Cloudflare Pages; Supabase (Postgres + RLS, Auth with
Google, Storage); one Cloudflare Worker (workers/icoparent-worker) for push + cron.

## Non-negotiables
1. **Work on one issue (one `F-xxx`) per branch/PR.** Branch name: `feat/F-123-short-name`.
2. **Plan first.** Reply with the files you will touch, the migration, and the tests. Wait for "go".
3. **DB first:** migration → RLS policies → pgTAP tests → `pnpm db:reset` → `pnpm db:test` → `pnpm db:types`.
4. **Every domain table has `family_id`** and RLS (only `profiles`, `push_subscriptions` and `notification_prefs` are scoped by user instead). No DELETE policies. State changes go through SQL
   functions (RPC), not direct UPDATEs from the client.
5. **RLS tests cover four actors:** parent A, parent B, child, outsider.
6. **Parents never edit each other's data.** Other parent can only acknowledge / accept / decline / counter.
   No hard deletes — void with a reason. Edits after acknowledgment create a new version.
7. **Children never see** expenses, proposals, acknowledgments, audit log, or `parents`-audience items.
8. **Notifications are created by DB triggers**, never by the frontend.
9. **Files only through `apps/web/src/lib/storage.ts`** (compression + thumbnails + attachments row).
10. **Auth only through `apps/web/src/lib/auth.ts`.**
11. **No hard-coded UI strings** — use i18next keys in `apps/web/src/locales/en/*.json`.
12. **Never edit a merged migration.** Create a new one.
13. **Do not change locked decisions** (plan §2). If one blocks you, stop and explain; propose an ADR.
14. **No new dependency** without justifying it in the PR description.
15. **Stay in scope.** List anything you noticed but did not do at the end of your reply.
16. **This repo is public.** Never commit secrets, real family data, or production-only values. Seed and test
    data must be fictional. Workflows must not print private data to logs or publish it as artifacts.

## Commands
```
pnpm dev            # web app
pnpm lint && pnpm typecheck && pnpm test
pnpm db:reset       # supabase db reset (local)
pnpm db:test        # pgTAP
pnpm db:types       # regenerate apps/web/src/lib/database.types.ts
pnpm e2e            # Playwright
```

## Code layout
- `apps/web/src/features/<domain>/` — `api.ts` (TanStack Query hooks), `components/`, `hooks/`, `types.ts`
- Components never import the Supabase client directly; they use hooks from `api.ts`.
- `supabase/migrations/` — SQL; `supabase/tests/` — pgTAP; `supabase/seed.sql` — demo family.

## Definition of Done
See `docs/DEVELOPMENT_PLAN.md` §7. Copy the checklist into the PR description and tick it honestly.
Check every screen at 375 px width and in child mode.
