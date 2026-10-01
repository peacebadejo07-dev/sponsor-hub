<script lang="ts">
  import { ROLE_LABELS, type RoleFamily } from '@sponsored/core';
  import { page } from '$app/state';
  import OppCard from '$lib/OppCard.svelte';
  import { ago } from '$lib/labels';
  import { onMount } from 'svelte';
  let { data } = $props();
  // Open on desktop; on phones start collapsed unless filters are already active, so results are visible.
  let filtersOpen = $state(true);
  onMount(() => {
    if (window.innerWidth < 820 && activeCount === 0) filtersOpen = false;
  });

  const f = $derived(data.filters);
  const fmt = (n: number) => n.toLocaleString('en-GB');
  const returnTo = $derived(page.url.pathname + page.url.search);
  const activeCount = $derived(
    f.families.length + f.modes.length + f.employment.length + f.sponsorship.length + f.seniority.length +
      (f.city ? 1 : 0) + (f.q ? 1 : 0) + (f.since ? 1 : 0) + (f.hasSalary ? 1 : 0) + (f.hideStale ? 1 : 0)
  );

  const WORK: Record<string, string> = { remote: 'Remote', hybrid: 'Hybrid', onsite: 'On-site', flexible: 'Remote or office' };
  const EMP: Record<string, string> = { full_time: 'Full-time', part_time: 'Part-time', contract: 'Contract', internship: 'Internship', temporary: 'Temporary' };
  const LEVEL: Record<string, string> = { entry: 'Entry level', mid: 'Mid level', senior: 'Senior', lead: 'Lead / head', principal: 'Staff / principal', executive: 'Executive' };
  const SPONSOR: Record<string, string> = {
    offered: 'Says it offers sponsorship',
    not_offered: 'Says it does not sponsor',
    right_to_work: 'Asks for UK right to work',
    unclear: 'Wording is conflicting',
    unmentioned: 'Does not mention sponsorship'
  };




  function pageHref(p: number) {
    const u = new URLSearchParams();
    if (f.q) u.set('q', f.q);
    if (f.city) u.set('city', f.city);
    f.families.forEach((v) => u.append('family', v));
    f.modes.forEach((v) => u.append('mode', v));
    f.employment.forEach((v) => u.append('emp', v));
    f.sponsorship.forEach((v) => u.append('sponsor', v));
    f.seniority.forEach((v) => u.append('level', v));
    if (f.since) u.set('since', String(f.since));
    if (f.hasSalary) u.set('salary', '1');
    if (f.hideStale) u.set('fresh', '1');
    if (p > 1) u.set('page', String(p));
    const qs = u.toString();
    return qs ? `/opportunities?${qs}` : '/opportunities';
  }

  const facetMap = (rows: { value: string; count: number }[]) => new Map(rows.map((r) => [r.value, r.count]));
  const fam = $derived(facetMap(data.facets.family));
  const mode = $derived(facetMap(data.facets.mode));
  const emp = $derived(facetMap(data.facets.employment));
  const sp = $derived(facetMap(data.facets.sponsorship));
  const lvl = $derived(facetMap(data.facets.seniority));
  const familyOptions = ['software', 'product', 'design', 'ai_ml', 'data', 'cloud_devops', 'cybersecurity', 'it_support', 'adjacent'] as RoleFamily[];
</script>

<div class="head">
  <div>
    <h1>Tech opportunities at UK visa sponsors</h1>
    <p class="sub">
      {fmt(data.total)} live role{data.total === 1 ? '' : 's'}
      {#if data.summary?.live}· {fmt(data.summary.live)} in total from {fmt(data.summary.orgs)} employers{/if}
      {#if data.summary?.last}· last checked {ago(data.summary.last)}{/if}
    </p>
  </div>
  <p class="legend">
    <span><span class="badge verified">Verified</span> stated by the employer or the register</span>
    <span><span class="badge inferred">Inferred</span> worked out by us, can be wrong</span>
    <span><span class="badge unconfirmed">Not stated</span> could not be confirmed</span>
  </p>
</div>

<div class="layout">
  <details class="filters" bind:open={filtersOpen}>
    <summary>Filters{#if activeCount}{' '}({activeCount}){/if}</summary>
    <form method="GET" action="/opportunities">
      <label class="field"><span>Role or employer</span><input type="search" name="q" value={f.q} placeholder="e.g. designer, Monzo" /></label>
      <label class="field">
        <span>Town / city</span>
        <input type="text" name="city" value={f.city} list="cities" placeholder="Anywhere in the UK" autocomplete="off" />
        <datalist id="cities">{#each data.cities as c (c.value)}<option value={c.value}>{c.count}</option>{/each}</datalist>
      </label>

      <fieldset>
        <legend>Role type <span class="badge inferred">Inferred</span></legend>
        <p class="hint">Worked out from the job title.</p>
        {#each familyOptions as v (v)}
          <label class="check"><input type="checkbox" name="family" value={v} checked={f.families.includes(v)} /><span>{ROLE_LABELS[v]}</span><em>{fmt(fam.get(v) ?? 0)}</em></label>
        {/each}
      </fieldset>

      <fieldset>
        <legend>Where you work</legend>
        <p class="hint">Jobs that do not state it are hidden when you pick one.</p>
        {#each ['remote', 'hybrid', 'onsite'] as v (v)}
          <label class="check"><input type="checkbox" name="mode" value={v} checked={f.modes.includes(v)} /><span>{WORK[v]}</span><em>{fmt((mode.get(v) ?? 0) + (mode.get('flexible') ?? 0))}</em></label>
        {/each}
      </fieldset>

      <fieldset>
        <legend>Employment type</legend>
        {#each ['full_time', 'part_time', 'contract', 'internship', 'temporary'] as v (v)}
          {#if (emp.get(v) ?? 0) > 0 || f.employment.includes(v)}
            <label class="check"><input type="checkbox" name="emp" value={v} checked={f.employment.includes(v)} /><span>{EMP[v]}</span><em>{fmt(emp.get(v) ?? 0)}</em></label>
          {/if}
        {/each}
      </fieldset>

      <fieldset>
        <legend>Level <span class="badge inferred">Inferred</span></legend>
        {#each ['entry', 'mid', 'senior', 'lead', 'principal', 'executive'] as v (v)}
          {#if (lvl.get(v) ?? 0) > 0 || f.seniority.includes(v)}
            <label class="check"><input type="checkbox" name="level" value={v} checked={f.seniority.includes(v)} /><span>{LEVEL[v]}</span><em>{fmt(lvl.get(v) ?? 0)}</em></label>
          {/if}
        {/each}
      </fieldset>

      <fieldset>
        <legend>What the posting says about sponsorship</legend>
        <p class="hint">Every employer here is on the Home Office register. This is about the job ad's own wording.</p>
        {#each ['offered', 'unmentioned', 'right_to_work', 'not_offered', 'unclear'] as v (v)}
          <label class="check"><input type="checkbox" name="sponsor" value={v} checked={f.sponsorship.includes(v)} /><span>{SPONSOR[v]}</span><em>{fmt(sp.get(v) ?? 0)}</em></label>
        {/each}
      </fieldset>

      <fieldset>
        <legend>Freshness and pay</legend>
        <label class="field"><span>New or updated</span>
          <select name="since">
            <option value="0" selected={!f.since}>Any time</option>
            <option value="7" selected={f.since === 7}>Last 7 days</option>
            <option value="14" selected={f.since === 14}>Last 14 days</option>
            <option value="30" selected={f.since === 30}>Last 30 days</option>
          </select>
        </label>
        <label class="check"><input type="checkbox" name="salary" value="1" checked={f.hasSalary} /><span>Shows a salary</span></label>
        <label class="check"><input type="checkbox" name="fresh" value="1" checked={f.hideStale} /><span>Hide possibly stale</span></label>
      </fieldset>

      <div class="actions">
        <button type="submit" class="primary">Apply filters</button>
        {#if activeCount}<a href="/opportunities" class="reset">Clear all</a>{/if}
      </div>
    </form>
  </details>

  <section aria-live="polite">
    {#if data.rows.length === 0}
      <div class="empty">
        <strong>{data.summary?.live ? 'No roles match these filters.' : 'No opportunities yet.'}</strong>
        <p>{data.summary?.live ? 'Try removing a filter.' : 'Roles appear once employers with a supported job board have been scanned.'}</p>
        {#if activeCount}<a href="/opportunities">Clear all filters</a>{/if}
      </div>
    {:else}
      <ul class="list">
        {#each data.rows as o (o.id)}
          <OppCard {o} loggedIn={data.loggedIn} mark={data.marks[o.id] ?? null} returnTo={returnTo} />
        {/each}
      </ul>

      {#if data.pages > 1}
        <nav class="pager" aria-label="Pagination">
          {#if f.page > 1}<a href={pageHref(f.page - 1)} rel="prev">← Previous</a>{:else}<span></span>{/if}
          <span>Page {fmt(f.page)} of {fmt(data.pages)}</span>
          {#if f.page < data.pages}<a href={pageHref(f.page + 1)} rel="next">Next →</a>{:else}<span></span>{/if}
        </nav>
      {/if}
    {/if}
  </section>
</div>

<style>
  .head { display: flex; flex-wrap: wrap; justify-content: space-between; gap: 12px 24px; align-items: end; margin-bottom: 20px; }
  h1 { font-size: 24px; margin: 0 0 2px; letter-spacing: -0.015em; }
  .sub { margin: 0; color: var(--muted); }
  .legend { margin: 0; font-size: 12px; color: var(--muted); display: flex; flex-wrap: wrap; gap: 6px 14px; }
  .badge { font-size: 11px; font-weight: 600; padding: 1px 7px; border-radius: 99px; letter-spacing: 0.02em; vertical-align: 1px; white-space: nowrap; }
  .badge.verified { background: var(--accent-soft); color: var(--verified); }
  .badge.inferred { background: var(--inferred-soft); color: var(--inferred); }
  .badge.unconfirmed { background: var(--bg); color: var(--muted); border: 1px solid var(--line); }

  .layout { display: grid; grid-template-columns: 300px 1fr; gap: 24px; align-items: start; }
  .filters { background: var(--surface); border: 1px solid var(--line); border-radius: var(--radius); padding: 14px 16px; position: sticky; top: 72px; max-height: calc(100vh - 88px); overflow: auto; }
  .filters summary { font-weight: 600; cursor: pointer; list-style: none; }
  .filters summary::-webkit-details-marker { display: none; }
  .filters form { margin-top: 12px; display: grid; gap: 14px; }
  .field { display: grid; gap: 4px; font-size: 13px; color: var(--muted); }
  .field input, .field select { padding: 8px 10px; border: 1px solid var(--line); border-radius: 8px; background: var(--bg); font-size: 15px; }
  fieldset { border: 0; padding: 0; margin: 0; display: grid; gap: 2px; }
  legend { font-weight: 600; font-size: 13px; padding: 0; margin-bottom: 4px; }
  .hint { margin: 0 0 4px; font-size: 12px; color: var(--muted); }
  .check { display: flex; align-items: center; gap: 8px; padding: 3px 0; font-size: 14px; cursor: pointer; }
  .check span { flex: 1; }
  .check em { font-style: normal; color: var(--muted); font-size: 12px; font-variant-numeric: tabular-nums; }
  .check input { accent-color: var(--accent); width: 16px; height: 16px; }
  .actions { display: flex; align-items: center; gap: 12px; position: sticky; bottom: -14px; background: var(--surface); padding: 8px 0; }
  .primary { background: var(--accent); color: var(--accent-ink); border: 0; border-radius: 8px; padding: 9px 16px; font-weight: 600; cursor: pointer; }
  .reset { font-size: 14px; color: var(--muted); }

  .list { margin: 0; padding: 0; display: grid; gap: 12px; }
  .empty { background: var(--surface); border: 1px dashed var(--line); border-radius: var(--radius); padding: 28px; text-align: center; color: var(--muted); }
  .empty strong { color: var(--ink); }
  .pager { display: flex; justify-content: space-between; align-items: center; margin-top: 18px; color: var(--muted); font-size: 14px; }
  .pager a { color: var(--accent); font-weight: 600; text-decoration: none; padding: 6px 4px; }
  a { color: inherit; }

  @media (max-width: 820px) { .layout { grid-template-columns: 1fr; } .filters { position: static; max-height: none; } }
</style>
