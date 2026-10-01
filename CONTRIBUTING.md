# Contributing

Thanks for helping. This is a free, open-source (MIT) project that helps people find UK organisations licensed to
sponsor workers and the tech roles they advertise.

## Ground rules

1. **Honest labels.** Every field is Verified (read from a primary source), Inferred (worked out by us, with its
   evidence) or Not stated. Never present a guess as a fact. Being on the Home Office register does **not** mean a
   role is sponsored; only the job's own text can say that, and we quote it.
2. **Be a polite crawler.** Use `@sponsored/http` for every request. Respect `robots.txt` and rate limits. Do not try to
   get around bot protection, logins or CAPTCHAs. If a site says no, record it and move on.
3. **Minimal personal data.** We store the least we can, and everything is exportable and deletable. Do not add
   tracking, third-party scripts or analytics without a discussion first.
4. **Test with real data where you can.** Adapter and parser tests use saved real responses, not invented ones.

## Setup

Node 20+ (CI uses 24). No Docker needed.

```bash
npm install
npm run db:start      # terminal 1: local Postgres on :54329
npm run db:migrate    # terminal 2
npm run import        # load the register
npm run dev           # http://localhost:5173
```

## Before you open a pull request

```bash
npm run typecheck
npm test
cd web && npx svelte-check --threshold error
```

CI runs the same checks plus a production build. Database tests need the local Postgres running; they skip
themselves otherwise.

## Where things live

| You want to... | Look at |
|---|---|
| Add a job-board vendor | [docs/ADAPTERS.md](docs/ADAPTERS.md) |
| Change how roles are classified or screened | `packages/core/src/jobs.ts`, `scanner/src/normalise.ts` |
| Change how sectors are decided | `packages/core/src/sectors.ts` |
| Change matching and its explanations | `packages/core/src/matching.ts` |
| Change the website | `web/src` |
| Change the daily run | `jobs/src` |
| Add a database change | a new numbered file in `db/migrations` (never edit an applied one) |

## Style

TypeScript, ESM, no extra dependencies unless they earn their place. Match the surrounding code. Comments say
**why**, not what. Keep functions pure where you can (see `scoreMatch`, `deriveSectors`) so they are easy to test.

## Reporting a security problem

Please do not open a public issue. See [SECURITY.md](SECURITY.md).
