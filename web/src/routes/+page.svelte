<script lang="ts">
  import { ROLE_LABELS, type RoleFamily } from '@sponsored/core';
  import { page } from '$app/state';
  import OppCard from '$lib/OppCard.svelte';
  import Icon from '$lib/ui/Icon.svelte';
  import Combobox from '$lib/ui/Combobox.svelte';
  import FilterPanel from '$lib/ui/FilterPanel.svelte';
  import EmptyState from '$lib/ui/EmptyState.svelte';
  import SubscribeBanner from '$lib/ui/SubscribeBanner.svelte';
  import ProfileBanner from '$lib/ui/ProfileBanner.svelte';
  import { navigating } from '$app/state';
  import { ago } from '$lib/labels';
  let { data } = $props();

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
  const SPONSOR: Record<string, string> = { offered: 'Offered', unmentioned: 'Not mentioned', right_to_work: 'Right to work needed', not_offered: 'No sponsorship', unclear: 'Unclear' };
  const FAMILY_SHORT: Record<string, string> = { software: 'Software', product: 'Product', design: 'Design', ai_ml: 'AI & ML', data: 'Data', cloud_devops: 'Cloud & DevOps', cybersecurity: 'Security', it_support: 'IT support', adjacent: 'Adjacent' };
  const LEVEL_SHORT: Record<string, string> = { entry: 'Entry', mid: 'Mid', senior: 'Senior', lead: 'Lead', principal: 'Staff', executive: 'Executive' };
  const summaryLine = $derived(
    [`${fmt(data.total)} live role${data.total === 1 ? '' : 's'}${data.summary?.orgs ? ` from ${fmt(data.summary.orgs)} employers` : ''}`, data.summary?.last ? `checked ${ago(data.summary.last)}` : '']
      .filter(Boolean)
      .join(' · ')
  );
  const loading = $derived(navigating.to?.url.pathname === '/');
  const first = $derived((f.page - 1) * data.pageSize + 1);
  const last = $derived(Math.min(f.page * data.pageSize, data.total));
  const activeLabels = $derived([
    ...f.families.map((v) => FAMILY_SHORT[v]), ...f.modes.map((v) => WORK[v]), ...f.seniority.map((v) => LEVEL_SHORT[v]),
    ...f.sponsorship.map((v) => `Sponsorship: ${SPONSOR[v].toLowerCase()}`), ...f.employment.map((v) => EMP[v]),
    ...(f.since ? [`Last ${f.since} days`] : []), ...(f.hasSalary ? ['Shows a salary'] : []), ...(f.hideStale ? ['Hide possibly stale'] : [])
  ]);

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
    return qs ? `/?${qs}` : '/';
  }

  const facetMap = (rows: { value: string; count: number }[]) => new Map(rows.map((r) => [r.value, r.count]));
  const fam = $derived(facetMap(data.facets.family));
  const mode = $derived(facetMap(data.facets.mode));
  const emp = $derived(facetMap(data.facets.employment));
  const sp = $derived(facetMap(data.facets.sponsorship));
  const lvl = $derived(facetMap(data.facets.seniority));
  const empOptions = $derived(['full_time', 'part_time', 'contract', 'internship', 'temporary'].filter((v) => (emp.get(v) ?? 0) > 0 || f.employment.includes(v)));
  const familyOptions = ['software', 'product', 'design', 'ai_ml', 'data', 'cloud_devops', 'cybersecurity', 'it_support', 'adjacent'] as RoleFamily[];
</script>

<header class="page-head">
  <h1 class="t-heading-1">Tech opportunities at UK visa sponsors</h1>
  <p class="t-body-lg t-secondary">{summaryLine}</p>
</header>

<form id="opp-filters" method="GET" action="/"></form>

<search class="search card" aria-label="Search roles">
  <div class="field">
    <label class="field-label" for="q">Role or employer</label>
    <div class="control"><Icon name="search" /><input id="q" form="opp-filters" type="search" name="q" value={f.q} placeholder="e.g. designer, Monzo" /></div>
  </div>
  <div class="field">
    <label class="field-label" for="city">Town or city</label>
    <Combobox id="city" name="city" form="opp-filters" value={f.city} options={data.cities} placeholder="Anywhere in the UK" noun="places" />
  </div>
  <button type="submit" form="opp-filters" class="btn btn-primary"><Icon name="search" />Search</button>
</search>

<div class="layout">
  <FilterPanel formId="opp-filters" {activeCount} clearHref="/">
    <fieldset>
      <legend class="t-overline">Role type <span class="prov prov-inferred"><Icon name="sparkle" size={14} />Inferred</span></legend>
      <p class="t-caption t-secondary hint">Worked out from the job title.</p>
      <div class="chips">
        {#each familyOptions as v (v)}
          <label class="chip"><input form="opp-filters" type="checkbox" name="family" value={v} checked={f.families.includes(v)} /><Icon name="check" size={16} />{FAMILY_SHORT[v]} <span class="count">· {fmt(fam.get(v) ?? 0)}</span></label>
        {/each}
      </div>
    </fieldset>

    <fieldset>
      <legend class="t-overline">Where you work</legend>
      <p class="t-caption t-secondary hint">Roles that don't say are hidden when you pick one.</p>
      <div class="chips">
        {#each ['remote', 'hybrid', 'onsite'] as v (v)}
          <label class="chip"><input form="opp-filters" type="checkbox" name="mode" value={v} checked={f.modes.includes(v)} /><Icon name="check" size={16} />{WORK[v]} <span class="count">· {fmt((mode.get(v) ?? 0) + (mode.get('flexible') ?? 0))}</span></label>
        {/each}
      </div>
    </fieldset>

    <fieldset>
      <legend class="t-overline">Level <span class="prov prov-inferred"><Icon name="sparkle" size={14} />Inferred</span></legend>
      <div class="chips">
        {#each ['entry', 'mid', 'senior', 'lead', 'principal', 'executive'] as v (v)}
          {#if (lvl.get(v) ?? 0) > 0 || f.seniority.includes(v)}
            <label class="chip"><input form="opp-filters" type="checkbox" name="level" value={v} checked={f.seniority.includes(v)} /><Icon name="check" size={16} />{LEVEL_SHORT[v]} <span class="count">· {fmt(lvl.get(v) ?? 0)}</span></label>
          {/if}
        {/each}
      </div>
    </fieldset>

    <fieldset>
      <legend class="t-overline">Sponsorship in the advert</legend>
      <p class="t-caption t-secondary hint">Every employer here is on the register. This filters by the job advert's own wording.</p>
      <div class="chips">
        {#each ['offered', 'unmentioned', 'right_to_work', 'not_offered', 'unclear'] as v (v)}
          <label class="chip"><input form="opp-filters" type="checkbox" name="sponsor" value={v} checked={f.sponsorship.includes(v)} /><Icon name="check" size={16} />{SPONSOR[v]} <span class="count">· {fmt(sp.get(v) ?? 0)}</span></label>
        {/each}
      </div>
    </fieldset>

    {#if empOptions.length}
      <fieldset>
        <legend class="t-overline">Employment</legend>
        <div class="chips">
          {#each empOptions as v (v)}
            <label class="chip"><input form="opp-filters" type="checkbox" name="emp" value={v} checked={f.employment.includes(v)} /><Icon name="check" size={16} />{EMP[v]} <span class="count">· {fmt(emp.get(v) ?? 0)}</span></label>
          {/each}
        </div>
      </fieldset>
    {/if}

    <fieldset>
      <legend class="t-overline">Freshness and pay</legend>
      <div class="field">
        <label class="field-label" for="since">New or updated</label>
        <div class="control">
          <select id="since" form="opp-filters" name="since">
            <option value="0" selected={!f.since}>Any time</option>
            <option value="7" selected={f.since === 7}>Last 7 days</option>
            <option value="14" selected={f.since === 14}>Last 14 days</option>
            <option value="30" selected={f.since === 30}>Last 30 days</option>
          </select>
          <Icon name="chevron-down" class="chev" />
        </div>
      </div>
      <div class="chips">
        <label class="chip"><input form="opp-filters" type="checkbox" name="salary" value="1" checked={f.hasSalary} /><Icon name="check" size={16} />Shows a salary</label>
        <label class="chip"><input form="opp-filters" type="checkbox" name="fresh" value="1" checked={f.hideStale} /><Icon name="check" size={16} />Hide possibly stale</label>
      </div>
    </fieldset>
  </FilterPanel>

  <section class="results" aria-labelledby="results-count" aria-busy={loading}>
    <div class="results-bar">
      <p id="results-count" class="t-label" role="status">
        {#if loading}Loading roles…{:else if data.rows.length === 0}No roles match{activeCount ? ` all ${activeCount} filters` : ''}{:else}Showing {fmt(first)}–{fmt(last)} of {fmt(data.total)} roles{/if}
      </p>
      {#if activeLabels.length}<ul class="tags active" aria-label="Active filters">{#each activeLabels as l (l)}<li class="tag tag-brand"><Icon name="check" size={14} />{l}</li>{/each}</ul>{/if}
    </div>

    {#if data.rows.length === 0}
      <EmptyState title={data.summary?.live ? 'No roles match these filters' : 'No roles yet'} body={data.summary?.live ? "Try removing a filter, or search anywhere in the UK. Sponsorship wording changes often, so it's worth checking back." : 'Roles appear once employers with a supported job board have been scanned.'}>
        {#if activeCount}<a class="btn btn-primary" href="/">Clear all filters</a>{/if}
        <a class="btn btn-secondary" href="/organisations">Browse organisations</a>
      </EmptyState>
    {:else}
      <ul class="list">
        {#each data.rows as o (o.id)}
          <OppCard {o} loggedIn={data.loggedIn} mark={data.marks[o.id] ?? null} {returnTo} />
        {/each}
      </ul>

      {#if data.pages > 1}
        <nav class="pager" aria-label="Pagination">
          {#if f.page > 1}<a class="btn btn-secondary" href={pageHref(f.page - 1)} rel="prev"><Icon name="arrow-left" size={16} />Previous</a>{:else}<span class="btn btn-secondary" aria-disabled="true">Previous</span>{/if}
          <span class="t-body-sm t-secondary">Page {fmt(f.page)} of {fmt(data.pages)}</span>
          {#if f.page < data.pages}<a class="btn btn-secondary" href={pageHref(f.page + 1)} rel="next">Next<Icon name="arrow-right" size={16} /></a>{:else}<span class="btn btn-secondary" aria-disabled="true">Next</span>{/if}
        </nav>
      {/if}
    {/if}
  </section>
</div>

<div class="banners">
  <SubscribeBanner loggedIn={data.loggedIn} />
  <ProfileBanner loggedIn={data.loggedIn} />
</div>

<style>
  .page-head { display: grid; gap: var(--space-xs); margin-bottom: var(--space-xl); }
  .page-head p { margin: 0; }
  .search { display: grid; grid-template-columns: 1fr 1fr auto; gap: var(--space-md); align-items: end; padding: var(--space-lg); margin-bottom: var(--space-xl); }
  .layout { display: grid; grid-template-columns: 300px minmax(0, 1fr); gap: var(--space-xl); align-items: start; }

  fieldset { border: 0; margin: 0; padding: 0; display: grid; gap: var(--space-sm); min-width: 0; }
  legend { display: flex; align-items: center; gap: var(--space-xs); padding: 0; margin-bottom: var(--space-sm); color: var(--color-text-secondary); }
  legend .prov { text-transform: none; letter-spacing: 0; }
  .hint { margin: calc(-1 * var(--space-xs)) 0 0; }

  .results { display: grid; gap: var(--space-md); min-width: 0; }
  .results-bar { display: flex; flex-wrap: wrap; align-items: center; gap: var(--space-sm); min-height: 32px; }
  .results-bar p { margin: 0; }
  .results > :global(:not(.results-bar)) { transition: opacity var(--duration-base) var(--ease-out); }
  .results[aria-busy='true'] > :global(:not(.results-bar)) { opacity: 0.55; }
  .active { list-style: none; margin: 0; padding: 0; }
  .list { list-style: none; margin: 0; padding: 0; display: grid; gap: var(--space-md); }
  .pager { display: flex; justify-content: space-between; align-items: center; gap: var(--space-sm); margin-top: var(--space-xs); }
  .banners { display: grid; grid-template-columns: minmax(0, 2fr) minmax(0, 1fr); gap: var(--space-lg); margin-top: var(--space-4xl); }

  @media (max-width: 1023px) {
    .layout { grid-template-columns: 1fr; gap: var(--space-md); }
        .banners { grid-template-columns: minmax(0, 1fr); margin-top: var(--space-2xl); }
  }
  @media (max-width: 640px) {
    .page-head { margin-bottom: var(--space-lg); }
    .search { grid-template-columns: 1fr; padding: var(--space-md); margin-bottom: var(--space-lg); }
    .search .btn { width: 100%; }
  }
</style>
