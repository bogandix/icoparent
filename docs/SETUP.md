# Setup

## Requirements

- Node.js 22 or newer
- pnpm 10. From the repository root, with [Corepack](https://nodejs.org/api/corepack.html):

```bash
corepack enable
corepack prepare pnpm@10.20.0 --activate
```

If `corepack enable` cannot write to your system bin directory, install pnpm 10.20.0 onto a directory that is already on your `PATH`.

- Docker, for the local Supabase stack, Playwright, and `pnpm docker:up`

## Web app

```bash
pnpm install
cp .env.example .env
pnpm dev
```

Open <http://localhost:5173>. Copy the values from `.env.example`. `VITE_AUTH_MODE=local` shows the four fictional sign-in buttons. A production build throws if that variable is `local`, and the local password and actor emails are not included in the bundle.

```bash
pnpm lint
pnpm typecheck
pnpm test
```

## Local Supabase

```bash
pnpm db:reset
pnpm db:test
pnpm db:types
```

`pnpm db:reset` applies the migrations and `supabase/seed.sql`. The seed family is fictional: Parent A, Parent B, Child, and a younger child with no login. The local password is `local-dev-password`.

Google sign-in stays off until `SUPABASE_AUTH_EXTERNAL_GOOGLE_CLIENT_ID` and `SUPABASE_AUTH_EXTERNAL_GOOGLE_SECRET` are set for the local stack. The redirect URL is `http://localhost:5173`. On a hosted project, turn the email provider off and add the production URL plus `http://localhost:5173` as redirect URLs.

## Docker

`pnpm docker:up` starts Supabase, resets the database, then runs the web app and the Worker. The Worker uses `PUSH_MODE=log`, so push requests are stored in memory and returned from `GET /push-log`. `pnpm docker:down` stops both.

Point the database at the Worker after the stack is up:

```sql
insert into private.runtime_config (key, value)
values ('push_webhook_url', 'http://worker:8787/push')
on conflict (key) do update set value = excluded.value;
```

`pnpm e2e` runs Playwright against the seeded family. Parent A and Parent B both see Football practice. The child account is sent away from `/money`.

## Cloudflare Pages

Connect the GitHub repository. Production branch is `main`. Preview deploys are created for pull requests.

| Setting | Value |
| --- | --- |
| Root directory | `/` |
| Build command | `pnpm install --frozen-lockfile && pnpm build` |
| Build output | `apps/web/dist` |
| Node | `22` (`.nvmrc`, or `NODE_VERSION=22`) |

Set these for both Production and Preview. Leave `VITE_AUTH_MODE` unset. A production build fails if it is `local`.

| Variable | Value |
| --- | --- |
| `VITE_SUPABASE_URL` | `https://<project-ref>.supabase.co` |
| `VITE_SUPABASE_ANON_KEY` | the project anon key |

`apps/web/public/_redirects` is copied into the build so a direct open of `/calendar` still loads the app.

In the hosted Supabase project, set the Site URL to the production Pages URL. Add that URL, `http://localhost:5173`, and the preview host to the redirect allow list. Google’s authorized redirect is `https://<project-ref>.supabase.co/auth/v1/callback`.

Apply the schema with `supabase link` and `supabase db push`. The Pages build does not migrate the database.

## Worker, backups, and restore

`pnpm --filter @icoparent/worker dev` serves the Worker. `POST /jobs` and the hourly cron call `run_scheduled_jobs` with the service role. That key never belongs in the web app.

The nightly backup workflow dumps the hosted database, encrypts it with gpg, and uploads it to R2. It does not publish the dump as an Actions artifact. Keep R2 objects for 90 days with a bucket lifecycle rule. Restore with `gpg --decrypt` and `psql` against a new database, then run `pnpm db:types` only against local.

Do not commit `.env` files, hosted keys, or real family data. Seed data stays fictional.
