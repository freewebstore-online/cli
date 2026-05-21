# @freewebstore/cli

Designer-side CLI for [FreeWebStore](https://freewebstore.online). Scaffold an HTML+Tailwind template, vibecode the design, ship it to a small business website near you.

```sh
npx @freewebstore/cli init sofia-bistro --category=restaurant.italian
cd sofia-bistro
# vibecode index.html with Claude Code / Cursor / your editor of choice
# add a 1280×720 preview.png
npx @freewebstore/cli doctor    # local validation
npx @freewebstore/cli login     # one-time GitHub App install
npx @freewebstore/cli publish   # upload + create repo + queue for review
npx @freewebstore/cli status sofia-bistro
```

## Commands

| Command | What it does |
|---------|--------------|
| `fws init <slug> --category=<c>` | Scaffold a new template directory |
| `fws doctor [--path=<dir>]` | Validate the template locally before publish |
| `fws login` | Install the FreeWebStore Templates GitHub App |
| `fws logout` | Clear local auth |
| `fws whoami` | Show current auth state |
| `fws publish [--path=<dir>]` | Upload the template for review |
| `fws status <slug>` | Check the status of a published template |

## What you get

- A small business uses your template → site footer credits you ("Template by @your-handle")
- Every adopting business shows up on your `/designers/<handle>` page on freewebstore.online
- MIT license, no payouts, no exposure-currency hand-waving — the credit *is* the credit

## How customization works

You write `index.html` with Tailwind utility classes. Mark customization points with `data-fws-slot="business.name"` etc. (see `slots.md` in your scaffolded directory).

When a small business picks your template, the FreeWebStore platform AI rewrites the slot contents per business. No templating language, no build step — pure HTML in, pure HTML out, AI bridges both sides.

## Environment variables

| Var | Purpose |
|-----|---------|
| `FREEWEBSTORE_CONFIG_DIR` | Override `~/.freewebstore/` (useful in CI) |
| `FREEWEBSTORE_ADMIN_BASE` | Override admin Worker URL (useful for local dev / staging) |

## Status

Scaffold + init + doctor + status + config are working. Login + publish wire through to the admin Worker but the admin side of GitHub App auth + provisioning ships in T2/T3.
