# Sponsored Jobs Discovery Hub: Build Plan (v1 draft)

Public, multi-user, free-to-run, open source. One dashboard: organisations, profiles, live opportunities, personalised matching, saved items, daily scan.

## 0. Open decisions (defaults assumed below)
| # | Decision | Default |
|---|---|---|
| 1 | Launch focus | All tech careers (software, product, UX/design, AI/ML, data, cloud/DevOps, cybersecurity, IT and adjacent); whole UK |
| 2 | Licence | MIT code; register data attributed under OGL v3 |
| 3 | Stack | SvelteKit on Cloudflare Pages (hosting + edge cache) + Supabase (Postgres + Auth). See §1a |
| 4 | Scan runner | GitHub Actions cron (public repo = free minutes) |
| 5 | Users | Built for an average user; no seeded profile. Location, work mode, role family, visa need etc. are user-chosen search and filter options |
| 6 | Matching | Rules + keywords (+ optional local embeddings); templated explanations, no per-user LLM |

Free-tier limits must be re-checked before each provider is committed to.

## 1. Architecture
```
GOV.UK register CSV ──► importer ──► orgs table
                                      │
                      classifier (sector, role-family tags)
                                      │
                   site resolver ──► org profiles (website, careers URL, ATS type)
                                      │
            scanner (ATS adapters → JSON-LD → LLM fallback) ──► opportunities
                                      │
                 matcher (per user, rules) ──► user_matches
                                      │
                         SvelteKit dashboard + email digest
```
Shared core (orgs, profiles, opportunities) is scanned once for everyone. Per-user layer (profile, matches, saves, digests) is cheap and isolated.

## 1a. Stack and capacity
- **Web:** SvelteKit on Cloudflare Pages. Public, shared data (org list, opportunities) is cached at the edge so most page views never hit the database.
- **Database + auth:** Supabase free tier (Postgres, 500 MB, 50k MAU auth, 5 GB egress). Chosen over D1 because D1's free tier hard-caps at 100k row writes/day, which the nightly scan would hit. Not Vercel Hobby (non-commercial only).
- **Scan runner:** GitHub Actions, writing to Supabase. The daily write should keep the project from pausing after 7 days of inactivity; verify at deploy and add a keep-alive ping if not.
- **Design rules that protect the free tier:**
  - Match at read time from the user's filters/profile; store only saved items and small top-N caches, not users x jobs rows.
  - Keep request-time compute light; heavy work happens in the scan job.
  - Store a slimmed register (normalised fields only) to stay well under 500 MB.
- **Estimated ceiling (not measured):** roughly 5-10k monthly active users before paying. First upgrade: Supabase Pro ($25/month).
- Re-check free-tier limits at deploy time; they change.

## 2. Data model (core tables)
- `orgs`: id, name, name_norm, town, county, rating, routes[], register_first_seen, register_last_seen, status (active / removed from register)
- `org_profiles`: org_id, website, careers_url, ats_type, sector_tags[], roles_teams[], companies_house_no, size_band, industry, funding (nullable), field_provenance (JSON: each field → verified / inferred / unconfirmed + source + timestamp)
- `opportunities`: id, org_id, title, location, work_mode, employment_type, salary_min/max/currency, seniority, years_experience, skills[], degree_required, apply_url, source_type (ats / jsonld / llm), role_family, date_discovered, last_verified, status (live / changed / expired), content_hash, repost_count, stale_flag + reason, sponsorship_signal (see §5), field_provenance
- `users`, `user_profiles` (roles, skills, background, locations, work_mode prefs, visa status)
- `saved_orgs`, `saved_opportunities`
- `user_matches`: user_id, opportunity_id, score, reasons[], created_at
- `scan_runs`: started, finished, orgs_scanned, new/changed/expired counts, errors

Every displayed field carries provenance: **Verified** (read directly from the source), **Inferred** (derived, with reasoning), **Unconfirmed** (not found).

## 3. Milestones

### M1: Register foundation (week 1)
- Importer: download latest register from GOV.UK, trim/normalise whitespace, dedupe by normalised name + town, aggregate routes per org.
- Diff each import: new, removed from register, rating changes (drives "sponsor health").
- Rule-based classifier: sector tags from name keywords and route (tech, design, AI, etc.), city normalisation.
- Org browser in the UI: filters for sector, location, route (sponsorship category), rating; search; pagination.
- Exit: browse and filter ~127k orgs on a deployed site.
- **Status: built and verified locally (not deployed).** 127,698 org+town records from 143,136 rows; diff tested (added/changed/removed/reactivated). Name-only classifier tags ~5.5k orgs as tech (4%), so most orgs are untagged until M2. DB footprint ~85 MB for `orgs` (of Supabase's 500 MB). Deploy to Cloudflare + Supabase still to do (needs adapter-cloudflare and a Supabase project).

### M2: Organisation profiles (week 2)
- Site resolver: Companies House API (free key) → Wikidata → domain guessing with name verification.
- Careers URL + ATS detection (Greenhouse, Lever, Ashby, Workable, SmartRecruiters, Teamtailor signatures).
- Shortlist engine: prioritise orgs by tag + city + profile demand; resolve in batches.
- Company enrichment from free sources only: Companies House (size hints, filing status, incorporation date), Wikidata (industry, size where present), register fields (first seen, sponsor health). Funding only where a free source has it; otherwise Unconfirmed.
- Profile page: sector, location, careers link, sponsorship routes/rating, enrichment, provenance badges.
- Exit: profiles for first shortlist (~1–2k orgs) with verified websites.
- **Status: built and tested live (not deployed).** Measured on 60 small tech organisations: 26 resolved, 8 low-confidence candidates, 26 not found; careers page found for 12 of the 26 resolved; ATS detected on well-known employers (Monzo: Greenhouse, Darktrace: Workday) but rarely on small ones. ~2.3 s per organisation, so the 5.4k tech-tagged names take ~3.5 h. Precision was tightened after a first run produced ~10% wrong websites (short or generic brand words). Companies House enrichment is implemented and unit-tested but untested live (needs a free API key). Candidates are never shown as facts. Known gaps: JavaScript-rendered careers links, bot-protected sites, and name-based sector tags that are wrong in places (e.g. "1st Cloud Accountants" tagged Cloud).

### M3: Opportunity scanner (weeks 3–4)
- Adapter interface: `detect(org) → bool`, `fetch(org) → [Opportunity]`.
- Adapters: Greenhouse, Lever, Ashby, Workable, SmartRecruiters; generic JSON-LD `JobPosting` parser.
- Polite crawling: robots.txt, per-host rate limit, identifying User-Agent, conditional requests, content hashing.
- Normalisation: location, remote/hybrid/onsite, employment type, salary parsing, role family (Software Engineering, Product, UX/UI/Design, AI/ML, Data, Cloud/DevOps, Cybersecurity, IT/Support, Adjacent).
- Structured fields extracted by rules first (regex/keyword dictionaries), each with provenance: seniority, years of experience required, skills, degree requirements, salary range. These feed both filters and matching.
- Lifecycle: new → changed → expired (missing 2 consecutive scans or past `validThrough`), kept visible as "Expired" for a retention period.
- Ghost-job signals: days live, repost count (same title/org reappearing), broken or redirected apply link, no change in N days. Shown as a "possibly stale" flag with the reason, plus a "posted within X days" filter.
- LLM fallback: only for changed pages with no structured data, capped per run, optional.
- Exit: live opportunities for shortlist with direct apply links.
- **Status: core built and tested live (not deployed).** Adapters for Greenhouse, Lever, Ashby, Workable and SmartRecruiters verified against real responses (Monzo, Palantir, Bosch, Ramp, Blueground). Normalisation, UK filter, sponsorship-wording extraction, lifecycle (new/changed/expired/repost), ghost-job flags and the Opportunities view are done; 147 tests. Bugs found by testing and fixed: "unable to offer visa sponsorship" read as unclear; New York/Birmingham AL read as UK; electrical/maintenance engineers read as software; "on-site parking" read as on-site. **Workday adapter added** (UK-filtered listing, per-job detail, host number probed and saved; verified live on Arctic Wolf and Alfa; one tenant, A10 Networks, refuses unauthenticated API calls). **Added after:** board-address probing (`npm run probe`, with name verification; tightened after a dry run produced look-alike matches such as Atlantis/Blueprint/AI Tech) and a JSON-LD `JobPosting` adapter (`npm run discover`; verified on two real careers sites). **Not built:** (JSON-LD, now done) `JobPosting` fallback for boards without an API, LLM fallback, and ATS-slug probing to find boards the resolver missed. Only a handful of employers have been scanned so far; real volume depends on how many boards the resolver's full run finds.

### M4: Users, matching, saves (week 5)
- Auth via Supabase Auth (magic link / Google), onboarding form for profile, editable later.
- CV upload to prefill the profile: parse PDF/DOCX into titles, skills, locations, seniority with rules; user reviews and edits before saving. Optional capped LLM parse if a key is configured. Store extracted fields only; delete the uploaded file after parsing (UK GDPR).
- Matcher: role-family match, skill/keyword overlap, location and work-mode fit, seniority, sponsorship relevance. Score 0–100 with itemised reasons ("Matches: UX Designer title, London, hybrid, org holds Skilled Worker licence").
- Bookmarks for orgs and opportunities; "new since last visit".
- Exit: signed-in user sees ranked opportunities with reasons and can save.
- **Status: built and tested (not deployed).** Auth is our own passwordless email links, not Supabase Auth (Supabase's login service cannot run locally here, and the links are small enough to test thoroughly); the database stays plain Postgres. Done: sign-in, sessions, profile, For you with explained scores, save/hide/applied, follow organisations, data export, account deletion, privacy page. Reviewed by an independent Opus pass; fixes: `javascript:` apply URLs (scheme guard at the scanner and at render, plus CSP), login-CSRF (confirmation page shows the masked address), victim lockout (limits per email+IP), IPv6 /64 rate limiting, DB errors no longer sign people out, sliding sessions capped at 90 days, TLS to the database. **Not built:** CV upload/parsing, Google sign-in (needs OAuth credentials). **Launch gates (not code):** Cloudflare Turnstile or a rate-limit rule on `POST /login`, a real email sender (Resend key and verified domain), a contact address on the privacy page, `AUTH_SECRET` and `PUBLIC_BASE_URL` set, and a check that no CDN rule caches HTML for signed-in requests (Cloudflare ignores `Vary: Cookie`).

### M5: Daily scan automation (week 6)
- GitHub Actions: cron at 07:00 and 08:00 UTC; script proceeds only when Europe/London local time is 08:00 (handles BST/GMT).
- Batch rotation so full shortlist is covered within run limits; resume on failure; scan_runs logged.
- Steps each run: refresh register (weekly or on change) → scan → diff → mark expired → update profiles → recompute matches → write "highlights".
- Dashboard "Today" view: new, changed, top matches, expiring soon. Optional email digest (weekly default, daily if quota allows).
- Exit: unattended daily run updating the same dashboard.

### M6: Public launch hardening (week 7)
- UK GDPR: privacy policy, consent, account deletion, data export. Visa status is sensitive; store minimally and explain why.
- Abuse controls: rate limits, signup protection, per-user caps.
- Clear disclaimers: register listing ≠ role-level sponsorship.
- README, CONTRIBUTING, adapter guide, `.env.example`, seed data, CI (lint, tests).
- Exit: public repo + live site.

## 4. Filters
- **Organisations:** sector tags (Tech, UX/Design/Product, AI, Data, Cloud, Cybersecurity, other realistic-entry industries), location, sponsorship category (route), sponsorship rating.
- **Opportunities:** role family, location, remote/hybrid/onsite, employment type, sponsorship relevance, new/recently updated, seniority, years of experience, salary range, posted within X days, hide possibly stale.

## 5. Sponsorship relevance (honest model)
Signals, each labelled:
- Org on register with Skilled Worker route: **Verified** (register).
- Job text mentions sponsorship / "right to work" requirements: **Verified** (quoted snippet) or **Inferred**.
- Role SOC eligibility / salary threshold compatibility: **Inferred**, shown as guidance only.
- Otherwise: **Unconfirmed**.
Never state "this role is sponsored" from the register alone.

## 6. Risks and mitigations
| Risk | Mitigation |
|---|---|
| Free-tier limits or terms change | Portable schema, no provider lock-in in core logic |
| Site resolver misses small orgs | Focus on shortlist; allow user-submitted careers URLs |
| Scraping complaints | robots.txt respected, rate limits, link to employer apply pages, contact page |
| Stale/wrong data | last_verified dates, expiry rules, report-a-problem link |
| Match quality too coarse | Transparent reasons, user feedback (hide/not relevant) feeds weights |
| Maintenance load | Adapter plugin pattern, scan health dashboard |

## 7. Repo layout
```
/importer        register download, diff, normalise
/classifier      sector and role-family rules
/resolver        website, careers, ATS detection
/scanner
  /adapters      greenhouse, lever, ashby, workable, smartrecruiters, jsonld
/matcher         scoring and explanations
/web             SvelteKit app
/jobs            GitHub Actions workflows
/docs            methodology, provenance model, contributing
```

## 8. Success criteria
- Open the dashboard at 08:30 UK time and see that day's new and changed opportunities.
- Every opportunity shows the required fields with verified / inferred / unconfirmed labels.
- Zero recurring cost at launch scale.
