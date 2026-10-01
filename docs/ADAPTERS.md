# Writing a job-board adapter

An adapter reads one applicant-tracking system's **public** job feed and returns jobs in a common shape. The scanner
does the rest: UK filtering, role family, level, work mode, salary, skills, the sponsorship wording, and the job
lifecycle (new, changed, reposted, expired).

Existing adapters to copy from, simplest first: `lever.ts`, `workable.ts`, `teamtailor.ts` (RSS), `bamboohr.ts`
(list plus detail), `smartrecruiters.ts` (paging plus detail), `workday.ts` (POST and a UK facet).

## The contract (`scanner/src/types.ts`)

```ts
interface Adapter {
  source: Source;                                   // 'greenhouse' | 'lever' | ... add yours here
  fetchBoard(slug: string): Promise<BoardResult>;   // list the board's jobs
  enrich?(slug: string, job: RawJob): Promise<...>; // optional: fetch a description the list omitted
}
```

`fetchBoard` returns `{ ok, status, jobs }`:

| Situation | Return |
|---|---|
| Board exists | `{ ok: true, status: 200, jobs }` (an empty board is still ok) |
| No such board | `{ ok: false, status: 404, jobs: [] }` |
| Could not reach it | `{ ok: false, status: 0, jobs: [] }` |
| Server error or rate limit | `{ ok: false, status: <code>, jobs: [] }` |

**Never return `ok: true` with a partial list.** A job missing from two successful scans is marked expired, so a
truncated "success" would wrongly close real jobs. If paging fails halfway, return `ok: false`.

## Mapping a job (`RawJob`)

| Field | Rule |
|---|---|
| `externalId` | Stable id from the board. Falls back to the URL path only if there is no id. |
| `locations`, `countryCodes` | As the board states them. Do not guess a country. Normalisation decides what counts as UK. |
| `workMode` | Only when the board states it (`remote`, `hybrid`, `onsite`). Otherwise `null`. A "not remote" flag is not "onsite". |
| `salary` | Only a **structured** complete range with a currency (GBP, USD, EUR) and a period. Never parse it out of prose here. |
| `descriptionText` | Plain text (use `htmlToText`). `null` if you will fill it in `enrich`. |
| `applyUrl` | The public posting URL. Links are re-checked later and only `http`/`https` are ever shown. |

## Fetching politely

Use `fetchJson` or `fetchPage` from `@sponsored/http`, never `fetch`. They enforce `robots.txt` (documented public
APIs are exempt via `skipRobots`), one request per second per host, retry on 429 and 503, a circuit breaker for long
bans, and a block on private addresses. If a vendor needs a slower rate, add its host to `HOST_INTERVALS` in
`packages/http/src/index.ts`.

Validate the slug before putting it in a URL (`/^[a-z0-9-]+$/i` for subdomain-based vendors) so a bad value cannot
change the host being called.

## Wiring it in

1. Add the source name to `Source` in `scanner/src/types.ts` and register the adapter in `scanner/src/adapters/index.ts`.
2. Add the vendor to `resolver/src/ats.ts` (`PATTERNS`) so boards can be detected from a careers page. Add the
   vendor's own hosts (such as `app` or `career`) to `RESERVED`.
3. Add a display name in `web/src/routes/org/[id]/+page.svelte` (`ATS_NAMES`).
4. No migration is needed: `source` is plain text.

## Testing

Save **real** responses from a live board under `scanner/test/fixtures/` (trim anything large that you do not
use) and test the pure mapping function against them. Cover: the normal case, a field the board omits, an empty
board, and malformed input. See `scanner/test/scanner.test.ts`. Run one board for real with:

```bash
npm run scan -- --org "<name>" --force --dry-run
```
