# ADR 0002: Local sign-in for Docker development and E2E

**Status:** Accepted · **Changes:** D2 · **Adds:** D18

## Context

Google sign-in needs cloud credentials and a real account, which blocks automated end-to-end tests,
CI on forks, and contributors who want to run the app quickly.

## Decision

The whole stack runs locally in Docker. Supabase runs through its CLI, and Compose runs the web app,
the Worker and Playwright. When `VITE_AUTH_MODE=local`, `lib/auth.ts` also allows email/password
sign-in with seeded fictional users for parent A, parent B, child and outsider. Google stays the only
production sign-in method.

Supabase is not re-declared in Compose, so local, CI and migrations share one definition.

## Consequences

- E2E tests cover full multi-user flows with no secrets.
- The Google redirect itself is not covered by automated tests and needs a manual check when F-003 changes.
- A second sign-in path must never reach production. The production build fails on local mode, CI scans
  the bundle, the hosted email provider stays disabled, and seed data is never pushed.
