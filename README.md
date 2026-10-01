# Sponsor Hub

One dashboard for finding UK organisations licensed to sponsor workers, and (in later milestones) the live
tech roles they advertise. Open source (MIT), built to run on free tiers. See [PLAN.md](PLAN.md).

**Status: M1, register foundation.** Importer + filterable organisation browser. Opportunities, matching,
accounts and the daily scan come in M2-M5.

## Data labels

Every field is labelled by how we know it:

- **Verified**: read directly from the Home Office register (name, town, route, rating).
- **Inferred**: worked out by us (e.g. sector guessed from the organisation name). Can be wrong.
- **Unconfirmed**: could not be found.

Being on the register does **not** mean any particular role is sponsored.

## Quick start

Requires Node 20+. No Docker needed; development uses an embedded Postgres.

```bash
npm install
npm run db:start      # terminal 1: local Postgres on :54329 (leave running)
npm run db:migrate    # terminal 2
npm run import        # downloads the latest register from GOV.UK and imports it
npm run dev           # http://localhost:5173
npm test
```

`npm run import -- --file path/to/register.csv` imports a local copy (the date is read from the file name, or
pass `--published YYYY-MM-DD`). Re-importing a newer register records what was added, removed or changed.

## Layout

| Path | Purpose |
|---|---|
| `packages/core` | Normalisation, rating parsing, sector classifier (shared) |
| `importer` | Download, parse, dedupe, upsert, diff the register |
| `db/migrations` | SQL, runs on local Postgres and Supabase |
| `web` | SvelteKit app |

## Licence and attribution

Code: MIT. Organisation data: [Home Office register of licensed sponsors](https://www.gov.uk/government/publications/register-of-licensed-sponsors-workers),
Crown copyright, published under the [Open Government Licence v3.0](https://www.nationalarchives.gov.uk/doc/open-government-licence/version/3/).
The raw register is downloaded at import time and is not committed to this repository.
