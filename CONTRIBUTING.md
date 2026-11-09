# Contributing to iCoParent

Thanks for your interest. iCoParent handles sensitive information about families and children, so
privacy and correct access rules matter more than speed.

## Before you start

1. Read [`docs/DEVELOPMENT_PLAN.md`](docs/DEVELOPMENT_PLAN.md), especially the product principles (§1),
   locked decisions (§2) and Definition of Done (§7).
2. Pick an open issue whose dependencies are closed, or open a **Feature request** first.
3. Comment on the issue so that two people don't build the same thing.

Changing a locked decision needs an architecture decision record in `docs/adr/`.

## Making a change

- Work on one feature (`F-xxx`) per branch and pull request, named like `feat/F-123-short-name`.
- Use [Conventional Commits](https://www.conventionalcommits.org/), for example
  `feat(expenses): receipt upload (F-151)`.
- For database changes, follow this order: migration, RLS policies, pgTAP tests, generated types.
- Row-level security tests must cover parent A, parent B, child and outsider.
- Never edit a merged migration. Add a new one.
- Add every new UI string in both English and Romanian. If you don't speak Romanian, a draft is fine;
  say so in the pull request so a native speaker can review it.
- Run the app and end-to-end tests locally in Docker. You don't need a Google or cloud account.
- Complete the checklist in the pull request template honestly.

AI-assisted contributions are welcome. [`CLAUDE.md`](CLAUDE.md) holds the rules for coding agents.
You are responsible for what you submit, so read every line, particularly the SQL.

## Keep private data out

This repository is public. Never commit or paste into an issue:

- API keys, tokens, connection strings or `.env` files
- Real names, photos, schedules, addresses or expenses of any family
- Database dumps or production logs

Seed data, tests and screenshots must use fictional families.

## License

By submitting a contribution, you agree that it is licensed under the
[AGPL-3.0](LICENSE), the same license as the project.

## Security issues

Please don't open a public issue. See [`SECURITY.md`](SECURITY.md).
