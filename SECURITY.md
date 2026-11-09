# Security policy

iCoParent stores sensitive information about families and children, so we take reports seriously.

## Reporting a vulnerability

Please **don't open a public issue**. Report it privately from this repository's **Security** tab,
using **Report a vulnerability**.

Include what is affected, the steps to reproduce it, and the impact you expect. Use your own test
accounts, and don't access, change or keep other people's data.

Especially important:

- Access-rule (RLS) bypasses, such as an outsider reading a family's data
- A child account reaching parent-only data, including expenses and proposals
- A parent changing or removing the other parent's records
- Access to files in private storage
- Leaked secrets

## Supported versions

The project is pre-release, so only the latest commit on `main` is supported. If you self-host,
keep your deployment up to date.
