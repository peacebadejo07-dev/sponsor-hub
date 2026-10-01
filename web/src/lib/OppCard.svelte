<script lang="ts">
  import { ROLE_LABELS, type RoleFamily } from '@sponsored/core';
  import { safeHref } from '$lib/safeHref';
  import { WORK_LABELS, EMP_LABELS, LEVEL_LABELS, SPONSOR_LABELS, money, ago } from '$lib/labels';

  type Opp = {
    id: number; org_id: number; org_name: string; title: string; role_family: string; seniority: string | null; location_raw: string;
    work_mode: string | null; employment_type: string | null; salary_min: number | null; salary_max: number | null;
    salary_currency: string | null; salary_period: string | null; skills: string[]; apply_url: string; sponsorship_signal: string;
    sponsorship_snippet: string | null; first_seen_at: string; last_seen_at: string; changed_at: string | null; stale_reason: string | null;
    provenance: Record<string, { status: string }>;
  };
  type Match = { score: number; reasons: { kind: string; text: string; points: number }[] };

  let { o, loggedIn, mark = null, match = null, returnTo }: { o: Opp; loggedIn: boolean; mark?: string | null; match?: Match | null; returnTo: string } = $props();

  const salary = $derived(money(o));
  const st = (f: string) => o.provenance?.[f]?.status ?? 'unconfirmed';
  const cls = (s: string) => (s === 'verified' ? 'verified' : s === 'inferred' ? 'inferred' : 'unconfirmed');
  const label = (s: string) => (s === 'verified' ? 'Verified' : s === 'inferred' ? 'Inferred' : 'Not stated');
  const loc = $derived(o.location_raw.replaceAll(' | ', ' · '));
</script>

<li class="card" class:dismissed={mark === 'dismissed'}>
  <div class="top">
    <div>
      <h2>{o.title}</h2>
      <p class="org"><a href={`/org/${o.org_id}`}>{o.org_name.trim()}</a> <span class="badge verified" title="Listed on the Home Office register of licensed sponsors">Licensed sponsor</span></p>
    </div>
    <div class="side">
      {#if match}<span class="score" title="How well this fits what you told us">{match.score}% match</span>{/if}
      <a class="apply" href={safeHref(o.apply_url)} rel="noopener nofollow" target="_blank">Apply ↗</a>
    </div>
  </div>

  <dl class="facts">
    <div><dt>Location</dt><dd title={loc}>{loc.slice(0, 70)}{loc.length > 70 ? '…' : ''}</dd></div>
    <div><dt>Working pattern <span class="badge {cls(st('work_mode'))}">{label(st('work_mode'))}</span></dt><dd>{o.work_mode ? WORK_LABELS[o.work_mode] : '—'}</dd></div>
    <div><dt>Employment <span class="badge {cls(st('employment_type'))}">{label(st('employment_type'))}</span></dt><dd>{o.employment_type ? EMP_LABELS[o.employment_type] : '—'}</dd></div>
    <div><dt>Salary <span class="badge {cls(st('salary'))}">{label(st('salary'))}</span></dt><dd>{salary ?? '—'}</dd></div>
  </dl>

  <div class="spons">
    <span class="badge {cls(st('sponsorship'))}">{label(st('sponsorship'))}</span>
    <span>This posting: <strong>{SPONSOR_LABELS[o.sponsorship_signal]}</strong></span>
    {#if o.sponsorship_snippet}<details><summary>See the wording</summary><blockquote>“…{o.sponsorship_snippet}…”</blockquote></details>{/if}
  </div>

  {#if match}
    <details class="why" open={false}>
      <summary>Why it matches</summary>
      <ul>
        {#each match.reasons.filter((r) => r.kind !== '=' || r.points !== 0 || true) as r (r.text)}
          <li class={r.kind === '+' ? 'good' : r.kind === '-' ? 'bad' : 'note'}><span aria-hidden="true">{r.kind === '+' ? '✓' : r.kind === '-' ? '✗' : '•'}</span> {r.text}</li>
        {/each}
        {#if !match.reasons.length}<li class="note"><span aria-hidden="true">•</span> You have not set preferences yet, so every role scores the same. <a href="/profile">Add some</a>.</li>{/if}
      </ul>
    </details>
  {/if}

  <p class="meta">
    <span class="tag">{ROLE_LABELS[o.role_family as RoleFamily]}</span>
    {#if o.seniority}<span class="tag">{LEVEL_LABELS[o.seniority]}</span>{/if}
    {#each o.skills.slice(0, 5) as s (s)}<span class="tag skill">{s}</span>{/each}
  </p>
  <p class="dates">
    Found {ago(o.first_seen_at)} · last verified {ago(o.last_seen_at)}{#if o.changed_at && Date.now() - new Date(o.changed_at).getTime() < 14 * 86400000} · updated {ago(o.changed_at)}{/if}
    {#if o.stale_reason}<span class="stale" title="Long-running or reposted ads are sometimes no longer open">⚠ {o.stale_reason}</span>{/if}
  </p>

  <div class="actions">
    {#if loggedIn}
      {#each [['saved', 'Save', 'Saved'], ['applied', 'Mark applied', 'Applied'], ['dismissed', 'Not for me', 'Hidden']] as [m, off, on] (m)}
        <form method="POST" action="/api/mark">
          <input type="hidden" name="opportunity_id" value={o.id} />
          <input type="hidden" name="mark" value={mark === m ? '' : m} />
          <input type="hidden" name="return" value={returnTo} />
          <button type="submit" class:on={mark === m} aria-pressed={mark === m}>{mark === m ? on : off}</button>
        </form>
      {/each}
    {:else}
      <a class="signin" href={`/login?next=${encodeURIComponent(returnTo)}`}>Sign in to save this role</a>
    {/if}
  </div>
</li>

<style>
  .card { background: var(--surface); border: 1px solid var(--line); border-radius: var(--radius); padding: 16px 18px; list-style: none; }
  .card.dismissed { opacity: 0.55; }
  .top { display: flex; justify-content: space-between; gap: 12px; align-items: start; }
  .side { display: flex; align-items: center; gap: 10px; flex-wrap: wrap; justify-content: flex-end; }
  h2 { font-size: 17px; margin: 0; font-weight: 600; overflow-wrap: anywhere; }
  .org { margin: 3px 0 0; font-size: 14px; display: flex; flex-wrap: wrap; gap: 6px 8px; align-items: center; }
  .org a { font-weight: 500; }
  .org a:hover { text-decoration: underline; }
  .score { font-weight: 700; font-size: 13px; color: var(--accent); background: var(--accent-soft); padding: 3px 10px; border-radius: 99px; white-space: nowrap; }
  .apply { background: var(--accent); color: var(--accent-ink); text-decoration: none; font-weight: 600; font-size: 14px; padding: 7px 14px; border-radius: 8px; white-space: nowrap; }
  .badge { font-size: 11px; font-weight: 600; padding: 1px 7px; border-radius: 99px; letter-spacing: 0.02em; vertical-align: 1px; white-space: nowrap; }
  .badge.verified { background: var(--accent-soft); color: var(--verified); }
  .badge.inferred { background: var(--inferred-soft); color: var(--inferred); }
  .badge.unconfirmed { background: var(--bg); color: var(--muted); border: 1px solid var(--line); }
  .facts { display: grid; grid-template-columns: repeat(4, minmax(0, 1fr)); gap: 10px 16px; margin: 14px 0 0; }
  dt { font-size: 12px; color: var(--muted); display: flex; gap: 6px; align-items: center; flex-wrap: wrap; }
  dd { margin: 2px 0 0; font-size: 14px; overflow-wrap: anywhere; }
  .spons { margin: 14px 0 0; padding: 10px 12px; background: var(--bg); border-radius: 8px; font-size: 14px; display: flex; flex-wrap: wrap; gap: 4px 10px; align-items: center; }
  .spons details { flex-basis: 100%; font-size: 13px; color: var(--muted); }
  summary { cursor: pointer; }
  blockquote { margin: 6px 0 0; padding-left: 10px; border-left: 3px solid var(--line); overflow-wrap: anywhere; }
  .why { margin: 10px 0 0; font-size: 14px; }
  .why summary { font-weight: 600; color: var(--accent); }
  .why ul { list-style: none; margin: 8px 0 0; padding: 0; display: grid; gap: 4px; }
  .good { color: var(--ink); } .good span { color: var(--verified); font-weight: 700; }
  .bad span { color: var(--inferred); font-weight: 700; } .note { color: var(--muted); }
  .meta { margin: 12px 0 0; display: flex; flex-wrap: wrap; gap: 6px; }
  .tag { font-size: 12px; background: var(--bg); border: 1px solid var(--line); padding: 1px 8px; border-radius: 99px; }
  .tag.skill { color: var(--muted); }
  .dates { margin: 10px 0 0; font-size: 12px; color: var(--muted); }
  .stale { margin-left: 8px; color: var(--inferred); font-weight: 600; }
  .actions { display: flex; flex-wrap: wrap; gap: 8px; margin-top: 12px; padding-top: 12px; border-top: 1px solid var(--line); align-items: center; }
  .actions form { margin: 0; }
  .actions button { background: var(--bg); border: 1px solid var(--line); border-radius: 8px; padding: 6px 12px; font-size: 13px; cursor: pointer; }
  .actions button.on { background: var(--accent-soft); border-color: var(--accent); color: var(--accent); font-weight: 600; }
  .signin { font-size: 13px; color: var(--accent); font-weight: 600; }
  @media (max-width: 900px) { .facts { grid-template-columns: repeat(2, minmax(0, 1fr)); } }
  @media (max-width: 480px) { .top { flex-direction: column; } .side { justify-content: flex-start; } }
</style>
