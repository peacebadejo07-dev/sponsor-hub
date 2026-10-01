# Sponsor Hub

One dashboard for finding UK organisations licensed to sponsor workers, and (in later milestones) the live
tech roles they advertise. Open source (MIT), built to run on free tiers. See [PLAN.md](PLAN.md).

**Status: M3, opportunity scanner.** Register importer, organisation browser, a resolver that finds each
organisation's website, careers page and job-board system, and a scanner that reads those job boards for UK tech
roles. Matching, accounts and the daily schedule come in M4-M5.

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

```bash
npm run resolve -- --limit 200 --tag tech     # research the next 200 unresearched tech organisations
npm run resolve -- --name monzo --limit 1 --verbose
```

The resolver looks up Wikidata, optionally Companies House (set `COMPANIES_HOUSE_API_KEY`), then guesses and
verifies the organisation's domain, finds its careers page, and detects the job-board system (Greenhouse,
Lever, Ashby, Workable, SmartRecruiters, Workday and others). It is polite by design: it obeys `robots.txt`,
makes at most one request per second per host, identifies itself (set `BOT_CONTACT`), refuses private
addresses, and does not try to get past bot-protection pages. Sites that block automated access are recorded as
unverified candidates.

```bash
npm run scan -- --limit 50                    # scan boards not checked in the last 20 hours
npm run scan -- --org monzo --force --dry-run
```

The scanner reads the public job-board APIs of **Greenhouse, Lever, Ashby, Workable and SmartRecruiters**. It keeps
only UK jobs in tech and adjacent roles, extracts role family, level, work mode, employment type, salary, skills and
the posting's own sponsorship wording (quoted, never inferred from the register), and tracks each job's life: a job
missing from two successful scans is marked expired, and a failed fetch never expires anything. Only a short excerpt
of each description is stored, to stay inside free database limits. Some Ashby customers do not enable the public
posting API; those boards are recorded as failed and retried every 3 days.

`npm run import -- --file path/to/register.csv` imports a local copy (the date is read from the file name, or
pass `--published YYYY-MM-DD`). Re-importing a newer register records what was added, removed or changed.

## Layout

| Path | Purpose |
|---|---|
| `packages/core` | Normalisation, rating parsing, sector classifier (shared) |
| `importer` | Download, parse, dedupe, upsert, diff the register |
| `resolver` | Website, careers page and job-board detection per organisation |
| `scanner` | Job-board adapters, normalisation, job lifecycle |
| `packages/http` | Polite fetching shared by resolver and scanner |
| `db/migrations` | SQL, runs on local Postgres and Supabase |
| `web` | SvelteKit app |

## Licence and attribution

Code: MIT. Organisation data: [Home Office register of licensed sponsors](https://www.gov.uk/government/publications/register-of-licensed-sponsors-workers),
Crown copyright, published under the [Open Government Licence v3.0](https://www.nationalarchives.gov.uk/doc/open-government-licence/version/3/).
The raw register is downloaded at import time and is not committed to this repository.
