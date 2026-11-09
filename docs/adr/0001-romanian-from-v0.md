# ADR 0001: English and Romanian from V0

**Status:** Accepted · **Changes:** D14

## Context

D14 shipped English first and added Romanian in V2. Romanian is needed from the start, and adding a
language after the MVP would mean revisiting every screen.

## Decision

Both languages are first-class from V0 (F-008, replacing F-201). Every UI string ships in both in the
same pull request. The database stores codes and parameters instead of display text, and notifications
drop their `title` and `body` columns. Text generated outside the UI uses the recipient's language.

## Consequences

- Every feature carries a small translation cost, and CI enforces matching keys.
- Agents can draft Romanian, but a native speaker reviews it before release.
- The Worker needs access to the shared notification catalogues to send push messages.
