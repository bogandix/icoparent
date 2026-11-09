# iCoParent

A calm, private co-parenting app: shared calendar on a custody schedule, handovers with check-ins,
agreements (requests & decisions), expenses with photo proof, and a family journal with voice notes.
Available in English and Romanian.

**Stack:** React + Vite + TypeScript PWA on Cloudflare Pages · Supabase (Postgres, Auth with Google, Storage) · one Cloudflare Worker.

- 📋 Development plan & roadmap: [`docs/DEVELOPMENT_PLAN.md`](docs/DEVELOPMENT_PLAN.md)
- 🤖 Rules for AI agents: [`CLAUDE.md`](CLAUDE.md)
- 🐙 Seed GitHub issues/milestones: `python3 scripts/seed-github-issues.py --repo bogandix/icoparent --dry-run`
- ⚙️ Setup, self-hosting and Docker local development guide: `docs/SETUP.md` (written during V0)
- 🤝 Contributing: [`CONTRIBUTING.md`](CONTRIBUTING.md)
- 🔒 Reporting a vulnerability: [`SECURITY.md`](SECURITY.md)

Status: **V1 — MVP** (family, calendar, agreements, expenses, feed, inbox, and the Worker). Cloudflare Pages builds the web app from `main`. Database tests need Docker.

## License

[GNU Affero General Public License v3.0](LICENSE).
