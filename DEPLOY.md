# Deploying Sponsor Hub

Everything runs on free tiers: **Supabase** (Postgres), **Cloudflare Workers** (the website), **GitHub Actions** (the daily scan),
**Resend** (sign-in and digest emails). Nothing here has been run against the real services yet; see "What has and has not been verified".

## 1. Accounts

| Service | Used for | Notes |
|---|---|---|
| GitHub (public repo) | Daily scan, CI | Free minutes are unlimited for public repositories |
| Supabase | Database | Free: 500 MB, pauses after 7 days of inactivity (the daily scan keeps it active) |
| Cloudflare | Hosting, DNS, Turnstile | Free Workers plan: 100,000 requests a day |
| Resend | Email | Free tier; verify your sending domain |
| Companies House | Company numbers, SIC codes | Free API key (REST) |

## 2. Database (Supabase)

1. Create a project. In **Project Settings, Database, Connection string**, copy the **Transaction pooler** URI (port 6543). Use it for everything below.
2. Create the tables and load the register:
   ```bash
   export DATABASE_URL='postgres://...'   # the pooler URI
   npm ci
   npm run db:migrate
   npm run import                         # downloads and imports the Home Office register (about 10 seconds)
   ```
3. **Start with what is already found.** On the machine where you ran the research, copy the profiles, live roles and scan log across
   (it replaces those tables and refuses to run if the target already has user accounts):
   ```bash
   TO_URL='postgres://...pooler...' npm run copy-data
   ```
4. Or fill it gradually (the first daily run also downloads Companies House's monthly bulk file, about 470 MB, and gives most organisations a company number and SIC codes): the daily scan researches new organisations, finds job boards and scans them. To start faster, run it by hand
   a few times: `npm run daily -- --force`.

Size: the register takes about 85 MB. Job descriptions are not stored (only a short excerpt), and closed roles are deleted after 60 days.

## 3. The daily scan (GitHub Actions)

In the repository, **Settings, Secrets and variables, Actions**:

- **Secrets:** `DATABASE_URL`, `COMPANIES_HOUSE_API_KEY`, `RESEND_API_KEY`, `AUTH_FROM` (for example `Sponsor Hub <hello@your-domain>`), `AUTH_SECRET` (`openssl rand -base64 48`), and optionally `DATABASE_CA` (see below)
- **Variables:** `PUBLIC_BASE_URL` (for example `https://sponsorhub.uk`), `BOT_CONTACT` (`https://sponsorhub.uk/bot`)

`.github/workflows/daily-scan.yml` fires at 07:07 and 08:07 UTC; the job runs only in the UK morning window (08:00-13:59 UK time) and only
once per UK day, so it is 08:00 UK time all year when GitHub is on time, and later the same morning when it is not. The Status page
warns when no scan has finished for 30 hours. Secrets are only given to the steps that need them. Run it by hand from the **Actions** tab (tick "force" to ignore the time window).

GitHub starts scheduled jobs late at busy times and **pauses scheduled workflows after 60 days without repository activity**
(any commit, or a manual run, wakes it).

## 4. The website (Cloudflare)

```bash
npm run build -w web
cd web
npx wrangler login                                   # once; approve in the browser
```

`wrangler secret put` only works once the Worker exists, so the first deploy sets the secrets itself. Create `web/prod.secrets.env`
(it is git-ignored) containing the values, one per line, `NAME=value`:

```
DATABASE_URL=...        # the Supabase pooler URI
AUTH_SECRET=...         # openssl rand -base64 48 (the same value goes into GitHub)
RESEND_API_KEY=...
AUTH_FROM=Sponsor Hub <hello@sponsorhub.uk>
CONTACT_EMAIL=...
```

```bash
npx wrangler deploy --secrets-file prod.secrets.env
```

Later changes to one secret: `npx wrangler secret put NAME`. Non-secret settings (`PUBLIC_BASE_URL`, the `sponsorhub.uk` route) live in
`web/wrangler.jsonc`. Deploy only once the database is loaded, or every page will error.

The domain is attached by the route in `wrangler.jsonc` (the zone must already be on your Cloudflare account).

`npm run build` (in `web`) also wraps the adapter's worker with `edge/entry.js` (`scripts/wrap-worker.mjs`). That wrapper stops the adapter's
edge cache from serving a logged-out copy of a page to a signed-in visitor, and the build **fails** if it is not in place. Do not point
wrangler's `main` at your own file: the adapter deletes and rewrites whatever `main` names.

## 5. Before you tell anyone about it

- [ ] **Verify the database's identity.** `ssl: require` encrypts the connection but does not check who is on the other end. Put the
      provider's CA certificate (Supabase publishes one) in `DATABASE_CA` (GitHub secret and Worker secret) to enforce it.
- [ ] **Rate-limit the sign-in form.** Add a Cloudflare rate-limiting rule for `POST /login` (and consider Turnstile on the form).
- [ ] **Set `CONTACT_EMAIL`** on the Worker. `/privacy` and `/bot` show it; until it is set they say "Contact details are not configured".
- [ ] **Replace the repository placeholder** in `BOT_CONTACT` (GitHub variable) and `.env.example` (`YOUR-ACCOUNT/YOUR-REPO`, formerly `OWNER`), and turn on private vulnerability reporting (Settings, Code security) so [SECURITY.md](SECURITY.md) works.
- [ ] **Verify the Resend domain** and send yourself a sign-in link end to end.
- [ ] **No "cache everything" rule** in Cloudflare for this site: signed-in pages must never be cached.
- [ ] Confirm `/status` shows a successful scan after the first scheduled run.
- [ ] Check the licence line and the repository's name, and read the privacy page once as a stranger would.

## What has and has not been verified

Verified locally: the whole app runs in Cloudflare's own `workerd` runtime against a local Postgres (pages, filters, 40 overlapping
requests, sign-in with the `Secure` cookie, private signed-in pages, the cache bypass, cross-site request refusal); the daily run
(`npm run daily`) end to end with its time budget; the UK 08:00 window logic for every day of 2026 and 2027, including both clock changes.

**Not verified:** the app against Supabase's pooler and on Cloudflare itself; email delivery (no key yet); a scheduled run on GitHub
Actions; Turnstile and the rate-limit rule.
