<script lang="ts">
  import { ROLE_LABELS, type RoleFamily } from '@sponsored/core';
  import { safeHref } from '$lib/safeHref';
  import { WORK_LABELS, LEVEL_LABELS, ATS_NAMES, moneyShort, place, ago } from '$lib/labels';
  import Icon from '$lib/ui/Icon.svelte';
  import OrgLogo from '$lib/ui/OrgLogo.svelte';
  import ProvenanceBadge from '$lib/ui/ProvenanceBadge.svelte';
  import SponsorChip from '$lib/ui/SponsorChip.svelte';

  type Opp = {
    id: number; org_id: number; org_name: string; title: string; role_family: string; seniority: string | null; location_raw: string;
    work_mode: string | null; employment_type: string | null; salary_min: number | null; salary_max: number | null;
    salary_currency: string | null; salary_period: string | null; skills: string[]; apply_url: string; sponsorship_signal: string;
    sponsorship_snippet: string | null; first_seen_at: string; last_seen_at: string; changed_at: string | null; stale_reason: string | null;
    posted_at?: string | null; ats_type?: string | null; status?: string | null;
    provenance: Record<string, { status: string }>;
  };
  type Match = { score: number; reasons: { kind: string; text: string; points: number }[] };
  type Flag = { kind: 'closed' | 'updated' | 'applied'; title: string; text?: string };

  /**
   * Figma › Job card. `showOrg` hides the organisation line on its own page;
   * `flag` adds the status strip used on Saved and Today; `match` adds the
   * "Why it matches" panel used on For you.
   */
  let {
    o, loggedIn, mark = null, match = null, returnTo, showOrg = true, flag = null, headingLevel = 2
  }: { o: Opp; loggedIn: boolean; mark?: string | null; match?: Match | null; returnTo: string; showOrg?: boolean; flag?: Flag | null; headingLevel?: 2 | 3 } = $props();

  const st = (f: string) => o.provenance?.[f]?.status ?? 'unconfirmed';
  const where = $derived(place(o.location_raw));
  const pay = $derived(moneyShort(o));
  const posted = $derived(o.posted_at ? `Posted ${ago(o.posted_at)}` : `Found ${ago(o.first_seen_at)}`);
  const source = $derived(o.ats_type ? ATS_NAMES[o.ats_type] ?? null : null);
  const updated = $derived(o.changed_at && Date.now() - new Date(o.changed_at).getTime() < 14 * 86_400_000 ? ago(o.changed_at) : null);
  const reasonsFor = $derived(match ? match.reasons.filter((r) => r.kind === '+').length : 0);
  const reasonsAgainst = $derived(match ? match.reasons.filter((r) => r.kind === '-').length : 0);
  const titleId = $derived(`role-${o.id}`);
</script>

{#snippet markForm(m: string, off: string, on: string, cls: string)}
  <form method="POST" action="/api/mark">
    <input type="hidden" name="opportunity_id" value={o.id} />
    <input type="hidden" name="mark" value={mark === m ? '' : m} />
    <input type="hidden" name="return" value={returnTo} />
    <button type="submit" class="btn btn-ghost btn-sm {cls}" aria-pressed={mark === m} aria-describedby={titleId}>
      {#if m === 'saved'}<Icon name="bookmark" size={16} />{/if}{mark === m ? on : off}
    </button>
  </form>
{/snippet}

<li class="job card" class:dismissed={mark === 'dismissed'} class:attached={!!flag || !!match}>
  {#if flag}
    <div class="flag flag-{flag.kind}">
      <Icon name={flag.kind === 'closed' ? 'alert' : flag.kind === 'updated' ? 'info' : 'check-circle'} size={16} />
      <p><strong>{flag.title}</strong>{#if flag.text} {flag.text}{/if}</p>
    </div>
  {/if}

  <div class="body">
    <div class="head">
      {#if showOrg}<OrgLogo name={o.org_name} />{/if}
      <div class="titles">
        {#if showOrg}<a class="org t-overline" href={`/org/${o.org_id}`}>{o.org_name.trim()}</a>{/if}
        <svelte:element this={`h${headingLevel}`} class="t-heading-4 title" id={titleId}>{o.title}</svelte:element>
      </div>
      {#if loggedIn}
        {@render markForm('saved', 'Save', 'Saved', 'save')}
      {:else}
        <a class="btn btn-ghost btn-sm save" href={`/login?next=${encodeURIComponent(returnTo)}`} aria-describedby={titleId}><Icon name="bookmark" size={16} />Save</a>
      {/if}
    </div>

    <ul class="tags" aria-label="Role details">
      <li class="tag" title={where.all}><Icon name="map-pin" size={16} />{where.first}{#if where.more} +{where.more}{/if}</li>
      {#if o.work_mode}<li class="tag">{WORK_LABELS[o.work_mode]}{#if st('work_mode') === 'inferred'}<Icon name="sparkle" size={14} label="inferred" />{/if}</li>{/if}
      {#if o.seniority}<li class="tag">{LEVEL_LABELS[o.seniority]}{#if st('seniority') === 'inferred'}<Icon name="sparkle" size={14} label="inferred" />{/if}</li>{/if}
      {#if pay}<li class="tag">{pay}</li>{/if}
      {#if !o.seniority}<li class="tag">{ROLE_LABELS[o.role_family as RoleFamily]}</li>{/if}
      {#if match}<li class="tag tag-brand">{match.score}% match</li>{/if}
    </ul>

    <div class="sponsorship">
      <SponsorChip signal={o.sponsorship_signal} />
      {#if o.sponsorship_snippet}<p class="quote t-body-sm t-secondary">“…{o.sponsorship_snippet}…”</p>{/if}
    </div>

    <hr class="divider" />

    <div class="foot">
      <ProvenanceBadge status={st('sponsorship')} />
      <p class="meta t-caption t-muted">
        {posted}{#if source} · via {source}{/if}{#if updated} · updated {updated}{/if}
        {#if o.stale_reason}<span class="stale"><Icon name="alert" size={14} />{o.stale_reason}</span>{/if}
      </p>
      <div class="actions">
        {#if loggedIn}
          {@render markForm('applied', 'Mark applied', 'Applied', 'quiet')}
          {@render markForm('dismissed', 'Not for me', 'Hidden', 'quiet')}
        {/if}
        <a class="btn btn-secondary btn-sm" href={safeHref(o.apply_url)} rel="noopener nofollow" target="_blank" aria-describedby={titleId}>
          <Icon name="arrow-up-right" size={16} />View role<span class="visually-hidden"> (opens the employer's site)</span>
        </a>
      </div>
    </div>
  </div>

  {#if match}
    <details class="why">
      <summary>
        <span class="t-label">Why it matches</span>
        <span class="count t-body-sm t-secondary">{reasonsFor} for, {reasonsAgainst} against</span>
        <Icon name="chevron-down" size={16} class="chev" />
      </summary>
      <ul>
        {#each match.reasons as r (r.text)}
          <li>
            <span class="ri ri-{r.kind === '+' ? 'for' : r.kind === '-' ? 'against' : 'note'}"><Icon name={r.kind === '+' ? 'check-circle' : r.kind === '-' ? 'x-circle' : 'minus-circle'} size={16} label={r.kind === '+' ? 'In its favour:' : r.kind === '-' ? 'Against it:' : 'Noted:'} /></span>
            <span class="t-body-sm t-secondary">{r.text}</span>
          </li>
        {/each}
        {#if !match.reasons.length}<li><span class="t-body-sm t-secondary">You haven't set preferences yet, so every role scores the same. <a class="t-link" href="/profile">Add some</a>.</span></li>{/if}
      </ul>
    </details>
  {/if}
</li>

<style>
  .job { list-style: none; border-color: var(--color-border-subtle); box-shadow: var(--shadow-xs); transition: box-shadow 120ms ease, border-color 120ms ease; }
  .job:hover { border-color: var(--color-border-default); box-shadow: var(--shadow-sm); }
  .job.attached { overflow: hidden; }
  .job.dismissed .body { opacity: 0.6; }
  .body { display: grid; gap: var(--space-md); padding: var(--space-lg); }

  .flag { display: flex; gap: var(--space-sm); align-items: center; padding: var(--space-sm) var(--space-lg); border-bottom: 1px solid var(--color-border-subtle); background: var(--color-bg-brand-subtle); color: var(--color-status-verified-fg); }
  .flag-closed { background: var(--color-bg-page); color: var(--color-status-unconfirmed-fg); }
  .flag-updated { background: var(--color-status-info-bg); color: var(--color-status-info-fg); }
  .flag p { margin: 0; font-size: var(--font-size-body-sm); line-height: var(--line-height-body-sm); color: var(--color-text-secondary); }
  .flag strong { color: var(--color-text-primary); font-weight: var(--font-weight-medium); }

  .head { display: flex; gap: var(--space-md); align-items: flex-start; }
  .titles { display: grid; gap: var(--space-3xs); flex: 1; min-width: 0; }
  .org { color: var(--color-text-secondary); text-decoration: none; width: fit-content; }
  .org:hover { color: var(--color-text-primary); text-decoration: underline; }
  .title { overflow-wrap: anywhere; }
  .head form, .head .save { flex: none; }
  .tags { list-style: none; margin: 0; padding: 0; }
  .sponsorship { display: grid; gap: var(--space-xs); justify-items: start; }
  .quote { margin: 0; overflow-wrap: anywhere; }

  .foot { display: flex; align-items: center; gap: var(--space-sm); flex-wrap: wrap; }
  .meta { margin: 0; flex: 1; min-width: 180px; }
  .stale { display: inline-flex; align-items: center; gap: var(--space-2xs); margin-left: var(--space-xs); color: var(--color-status-inferred-fg); font-weight: var(--font-weight-medium); }
  .actions { display: flex; gap: var(--space-2xs); align-items: center; flex-wrap: wrap; margin-left: auto; }
  .actions form { margin: 0; }
  .quiet { color: var(--color-text-secondary); }
  :global(.job button[aria-pressed='true'].quiet), :global(.job button[aria-pressed='true'].save) { color: var(--color-text-link); font-weight: var(--font-weight-semibold); }

  .why { border-top: 1px solid var(--color-border-subtle); background: var(--color-bg-page); }
  .why summary { list-style: none; display: flex; align-items: center; gap: var(--space-xs); min-height: var(--size-touch-target); padding: var(--space-sm) var(--space-lg); cursor: pointer; }
  .why summary::-webkit-details-marker { display: none; }
  .why .count { margin-left: auto; }
  .why[open] :global(.chev) { rotate: 180deg; }
  .why ul { list-style: none; margin: 0; padding: 0 var(--space-lg) var(--space-lg); display: grid; gap: var(--space-xs); }
  .why li { display: flex; gap: 10px; align-items: flex-start; }
  .ri { display: inline-flex; margin-top: 3px; }
  .ri-for { color: var(--color-icon-brand); }
  .ri-against { color: var(--color-text-danger); }
  .ri-note { color: var(--color-icon-secondary); }

  @media (max-width: 640px) {
    .body { padding: var(--space-md) var(--space-lg) var(--space-lg); }
    .actions { margin-left: 0; width: 100%; }
    .actions > a { flex: 1; }
  }
</style>
