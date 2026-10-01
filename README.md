# Sponsor Hub

One dashboard for finding UK organisations licensed to sponsor workers, and (in later milestones) the live
tech roles they advertise. Open source (MIT), built to run on free tiers. See [PLAN.md](PLAN.md).

**Status: M5, the daily scan.** Register importer, organisation browser, a resolver that finds each
organisation's website, careers page and job-board system, and a scanner that reads those job boards for UK tech
roles. Accounts (passwordless email sign-in), a profile, ranked "For you" roles with plain-English reasons, and saved roles and organisations are built. A daily orchestrator runs the whole pipeline at 08:00 UK time, a **Today** page shows what changed, **Status** shows how the scan is doing, and people can opt in to a weekly email digest. See [DEPLOY.md](DEPLOY.md) to put it online.

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
npm run probe -- --limit 500                  # guess job-board addresses for organisations with none, then verify
npm run discover -- --limit 200               # find careers pages that publish schema.org JobPosting data
npm run scan -- --limit 50                    # scan boards not checked in the last 20 hours
npm run scan -- --org monzo --force --dry-run
```

The scanner reads the public job-board APIs of **Greenhouse, Lever, Ashby, Workable, SmartRecruiters and Workday**. It keeps
only UK jobs in tech and adjacent roles, extracts role family, level, work mode, employment type, salary, skills and
the posting's own sponsorship wording (quoted, never inferred from the register), and tracks each job's life: a job
missing from two successful scans is marked expired, and a failed fetch never expires anything. Only a short excerpt
of each description is stored, to stay inside free database limits. Some employers do not allow public API access (some Ashby
boards, some Workday tenants return HTTP 422); those boards are recorded as failed and retried every 3 days. Workday
boards are listed with a UK location filter, so a global employer costs a handful of requests.

**Finding more boards.** Most organisations do not link a job board from their homepage, so two extra steps widen
coverage. `probe` guesses board addresses (e.g. `boards.greenhouse.io/<name>`) from the name and website and keeps a
guess only when the board's own company name, or its job text, names the organisation (a bare shared first word is
not enough). `discover` reads schema.org `JobPosting` data that careers pages publish for Google for Jobs, which
covers sites with no job-board API (including Teamtailor-hosted pages). Both label what they find as Inferred or
Verified accordingly.

`npm run import -- --file path/to/register.csv` imports a local copy (the date is read from the file name, or
pass `--published YYYY-MM-DD`). Re-importing a newer register records what was added, removed or changed.

## The daily run

```bash
npm run daily -- --gate               # what the scheduler runs: only does anything in the UK morning window, once per UK day
npm run daily -- --force              # run now
npm run daily -- --force --only scan  # just some steps (register, research, probe, discover, scan, maintenance, digest)
```

Steps run in order, each with a time budget, and one failing step never stops the rest. Every run is recorded (`scan_runs`) and
shown on **Status**. Closed roles are kept for 60 days (longer if someone saved them), then removed. Hosts that ask the scanner to
stay away (HTTP 429 with a long Retry-After) are left alone until then.

## Accounts and matching

Sign in with an emailed link (no passwords). In development the link is printed to the server console. Each person can
set optional preferences (role types, places, working pattern, level, skills, minimum salary, and whether they need visa
sponsorship), and **For you** ranks live roles by fit. Every score comes with the reasons behind it, only the questions
a person answered count, and a refusal to sponsor hides a role only for someone who said they need sponsorship. Saved
roles, hidden roles and followed organisations live under **Saved**. From **Profile** a person can download all their
data or delete their account (which removes everything). Security notes: tokens and sessions are stored hashed, sign-in
links are single-use and expire in 15 minutes, state-changing requests must come from this site, signed-in pages are
never cached, scraped links are only ever http(s), and there is a Content-Security-Policy.

## Layout

| Path | Purpose |
|---|---|
| `packages/core` | Normalisation, rating parsing, sector classifier (shared) |
| `importer` | Download, parse, dedupe, upsert, diff the register |
| `resolver` | Website, careers page and job-board detection per organisation |
| `scanner` | Job-board adapters, normalisation, job lifecycle |
| `packages/http` | Polite fetching shared by resolver and scanner |
| `db/migrations` | SQL, runs on local Postgres and Supabase |
| `packages/accounts` | Sign-in links, sessions, profile, saved items, data export and deletion |
| `web` | SvelteKit app |

## Licence and attribution

Code: MIT. Organisation data: [Home Office register of licensed sponsors](https://www.gov.uk/government/publications/register-of-licensed-sponsors-workers),
Crown copyright, published under the [Open Government Licence v3.0](https://www.nationalarchives.gov.uk/doc/open-government-licence/version/3/).
The raw register is downloaded at import time and is not committed to this repository.
