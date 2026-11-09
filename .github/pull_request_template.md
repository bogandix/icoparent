## Feature
Closes #<issue> — F-<id> <title>

## What changed
-

## Definition of Done
- [ ] Acceptance criteria of the issue all met
- [ ] Migration + RLS policies + pgTAP tests (parent A, parent B, child, outsider) — if DB touched
- [ ] Generated types updated (`pnpm db:types`)
- [ ] Unit tests for non-trivial logic; Playwright happy path for user-facing flows
- [ ] Works at 375 px and desktop; checked in child mode
- [ ] Strings in i18n files
- [ ] `pnpm lint && pnpm typecheck && pnpm test` green
- [ ] Docs updated (plan / SETUP.md / ADR)
- [ ] Storage/egress impact noted (if files involved)

## New dependencies (and why)
- none

## Noticed but out of scope
-
