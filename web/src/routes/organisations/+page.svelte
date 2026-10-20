<script lang="ts">
  import { RATING_LABELS, RATING_HELP, GBM_PREFIX, routeShort } from '$lib/labels';
  import Icon from '$lib/ui/Icon.svelte';
  import Combobox from '$lib/ui/Combobox.svelte';
  import FilterPanel from '$lib/ui/FilterPanel.svelte';
  import EmptyState from '$lib/ui/EmptyState.svelte';
  import OrgCard from '$lib/ui/OrgCard.svelte';
  import SubscribeBanner from '$lib/ui/SubscribeBanner.svelte';
  import ProfileBanner from '$lib/ui/ProfileBanner.svelte';
  import { SECTOR_TAGS } from '@sponsored/core';
  import { page, navigating } from '$app/state';
  let { data } = $props();

  const f = $derived(data.filters);
  const activeCount = $derived(f.sectors.length + f.routes.length + f.ratings.length + (f.hasCareers ? 1 : 0) + (f.town ? 1 : 0) + (f.q ? 1 : 0));

  function pageHref(p: number) {
    const u = new URLSearchParams();
    if (f.q) u.set('q', f.q);
    if (f.town) u.set('town', f.town);
    f.sectors.forEach((s) => u.append('sector', s));
    f.routes.forEach((s) => u.append('route', s));
    f.ratings.forEach((s) => u.append('rating', s));
    if (f.hasCareers) u.set('careers', '1');
    if (p > 1) u.set('page', String(p));
    const qs = u.toString();
    return qs ? `/organisations?${qs}` : '/organisations';
  }

  const sectorFacets = $derived(new Map(data.sectorFacets.map((x) => [x.value, x.count])));
  const sectorOptions = $derived(
    SECTOR_TAGS.filter((t) => (sectorFacets.get(t) ?? 0) > 0 || f.sectors.includes(t))
  );
  const fmt = (n: number) => n.toLocaleString('en-GB');
  const loading = $derived(navigating.to?.url.pathname === '/organisations');

  // Sponsorship routes: Skilled Worker, the Global Business Mobility group, then
  // the rest by size. The smaller ones wait behind "Show all" unless chosen.
  let allRoutes = $state(false);
  const routeGroups = $derived.by(() => {
    const gbm = data.routeFacets.filter((r) => r.value.startsWith(GBM_PREFIX));
    const other = data.routeFacets.filter((r) => !r.value.startsWith(GBM_PREFIX));
    const more = (i: number, keep: number, v: string) => i >= keep && !f.routes.includes(v);
    return {
      first: other.slice(0, 1).map((r) => ({ ...r, more: false })),
      gbm: gbm.map((r, i) => ({ ...r, more: more(i, 3, r.value) })),
      rest: other.slice(1).map((r, i) => ({ ...r, more: more(i, 2, r.value) }))
    };
  });
  const hiddenRoutes = $derived([...routeGroups.gbm, ...routeGroups.rest].filter((r) => r.more).length);
  const following = $derived(new Set(data.following));
  const returnTo = $derived(page.url.pathname + page.url.search);
  const first = $derived((f.page - 1) * data.pageSize + 1);
  const last = $derived(Math.min(f.page * data.pageSize, data.total));
</script>

<svelte:head>
  <noscript><style>.opt.more { display: flex !important; } .show-all { display: none !important; }</style></noscript>
  <title>Organisations licensed to sponsor workers · Sponsor Hub</title>
  <meta name="description" content="Every UK organisation on the Home Office register of licensed sponsors, with sector, rating, routes and live tech roles." />
</svelte:head>

{#if page.url.searchParams.get('deleted') === '1'}
  <p class="notice" role="status"><Icon name="check-circle" />Your account and everything saved with it have been deleted.</p>
{/if}

<header class="page-head">
  <h1 class="t-heading-1">UK organisations licensed to sponsor workers</h1>
  <p class="t-body-lg t-secondary">{`${fmt(data.total)} match${data.total === 1 ? '' : 'es'}${data.register ? ` · register published ${data.register.published_on}` : ''}`}</p>
</header>

<form id="org-filters" method="GET" action="/organisations"></form>

<search class="search card" aria-label="Search organisations">
  <div class="field">
    <label class="field-label" for="q">Organisation name</label>
    <div class="control"><Icon name="search" /><input id="q" form="org-filters" type="search" name="q" value={f.q} placeholder="e.g. cyber, analytics" /></div>
  </div>
  <div class="field">
    <label class="field-label" for="town">Town or city</label>
    <Combobox id="town" name="town" form="org-filters" value={f.town} options={data.towns} placeholder="Anywhere in the UK" />
  </div>
  <button type="submit" form="org-filters" class="btn btn-primary"><Icon name="search" />Search</button>
</search>

<div class="layout">
  <FilterPanel formId="org-filters" {activeCount} clearHref="/organisations">
    <fieldset>
      <legend class="t-overline">Website <span class="prov prov-inferred"><Icon name="sparkle" size={14} />Inferred</span></legend>
      <p class="t-caption t-secondary hint">Websites are found automatically for a growing shortlist, starting with tech organisations.</p>
      <div class="chips"><label class="chip"><input form="org-filters" type="checkbox" name="careers" value="1" checked={f.hasCareers} /><Icon name="check" size={16} />Has a careers page</label></div>
    </fieldset>

    <fieldset>
      <legend class="t-overline">Sector <span class="prov prov-inferred"><Icon name="sparkle" size={14} />Inferred</span></legend>
      <p class="t-caption t-secondary hint">From Companies House codes, the organisation's website or its roles. Many organisations are untagged.</p>
      <div class="chips">
        {#each sectorOptions as t (t)}
          <label class="chip"><input form="org-filters" type="checkbox" name="sector" value={t} checked={f.sectors.includes(t)} /><Icon name="check" size={16} />{data.sectorLabels[t]} <span class="count">· {fmt(sectorFacets.get(t) ?? 0)}</span></label>
        {/each}
      </div>
    </fieldset>

    <fieldset>
      <legend class="t-overline">Sponsorship route <span class="prov prov-verified"><Icon name="check-circle" size={14} />Verified</span></legend>
      {#snippet routeOpt(r: { value: string; count: number; more: boolean }, nested: boolean)}
        <label class="opt" class:opt-nested={nested} class:more={r.more} hidden={r.more && !allRoutes} title={r.value}>
          <input form="org-filters" type="checkbox" name="route" value={r.value} checked={f.routes.includes(r.value)} aria-label={`${r.value}, ${fmt(r.count)}`} />
          <span class="opt-label">{routeShort(r.value)}</span><span class="opt-count">{fmt(r.count)}</span>
        </label>
      {/snippet}
      <div class="opts">
        {#each routeGroups.first as r (r.value)}{@render routeOpt(r, false)}{/each}
        {#if routeGroups.gbm.length}
          <p class="opt-group" aria-hidden="true">Global Business Mobility</p>
          {#each routeGroups.gbm as r (r.value)}{@render routeOpt(r, true)}{/each}
        {/if}
        {#each routeGroups.rest as r (r.value)}{@render routeOpt(r, false)}{/each}
      </div>
      {#if hiddenRoutes}
        <button type="button" class="btn btn-ghost btn-sm show-all" aria-expanded={allRoutes} onclick={() => (allRoutes = !allRoutes)}>
          {allRoutes ? 'Show fewer routes' : `Show all ${data.routeFacets.length} routes`}<Icon name="chevron-down" size={16} class={allRoutes ? 'flip' : ''} />
        </button>
      {/if}
    </fieldset>

    <fieldset>
      <legend class="t-overline">Rating <span class="prov prov-verified"><Icon name="check-circle" size={14} />Verified</span></legend>
      <div class="chips">
        {#each data.ratingFacets as r (r.value)}
          <label class="chip" title={RATING_HELP[r.value] ?? ''}><input form="org-filters" type="checkbox" name="rating" value={r.value} checked={f.ratings.includes(r.value)} /><Icon name="check" size={16} />{RATING_LABELS[r.value] ?? r.value} <span class="count">· {fmt(r.count)}</span></label>
        {/each}
      </div>
    </fieldset>
  </FilterPanel>

  <section class="results" aria-labelledby="org-count" aria-busy={loading}>
    <p id="org-count" class="t-label" role="status">{#if loading}Loading organisations…{:else if data.orgs.length}Showing {fmt(first)}–{fmt(last)} of {fmt(data.total)} organisations{:else}No organisations match{/if}</p>
    {#if data.orgs.length === 0}
      <EmptyState icon="building" title="No organisations match these filters" body="Try removing a filter or searching a shorter name.">
        <a class="btn btn-primary" href="/organisations">Clear all filters</a>
      </EmptyState>
    {:else}
      <ul class="grid">
        {#each data.orgs as o (o.id)}<OrgCard {o} sectorLabels={data.sectorLabels} loggedIn={data.loggedIn} following={following.has(o.id)} {returnTo} />{/each}
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
  .notice { display: flex; gap: var(--space-sm); align-items: center; margin: 0 0 var(--space-lg); padding: var(--space-sm) var(--space-md); border-radius: var(--radius-md); background: var(--color-status-verified-bg); color: var(--color-status-verified-fg); }
  .page-head { display: grid; gap: var(--space-xs); margin-bottom: var(--space-xl); }
  .page-head p { margin: 0; }
  .search { display: grid; grid-template-columns: 1fr 1fr auto; gap: var(--space-md); align-items: end; padding: var(--space-lg); margin-bottom: var(--space-xl); }
  .layout { display: grid; grid-template-columns: 300px minmax(0, 1fr); gap: var(--space-xl); align-items: start; }
  fieldset { border: 0; margin: 0; padding: 0; display: grid; gap: var(--space-sm); min-width: 0; }
  legend { display: flex; align-items: center; gap: var(--space-xs); padding: 0; margin-bottom: var(--space-sm); color: var(--color-text-secondary); }
  legend .prov { text-transform: none; letter-spacing: 0; }
  .hint { margin: calc(-1 * var(--space-xs)) 0 0; }
  .opts { margin-top: calc(-1 * var(--space-xs)); }
  .show-all { justify-self: start; margin-left: calc(-1 * var(--space-md)); }
  .show-all :global(.flip) { rotate: 180deg; }
  .results { display: grid; gap: var(--space-md); min-width: 0; }
  .results > p { margin: 0; }
  .results > :global(:not(p)) { transition: opacity var(--duration-base) var(--ease-out); }
  .results[aria-busy='true'] > :global(:not(p)) { opacity: 0.55; }
  .grid { list-style: none; margin: 0; padding: 0; display: grid; grid-template-columns: repeat(auto-fill, minmax(min(100%, 360px), 1fr)); gap: var(--space-md); }
  .pager { display: flex; justify-content: space-between; align-items: center; gap: var(--space-sm); }
  .banners { display: grid; grid-template-columns: minmax(0, 2fr) minmax(0, 1fr); gap: var(--space-lg); margin-top: var(--space-4xl); }
  @media (max-width: 1023px) {
    .layout { grid-template-columns: minmax(0, 1fr); gap: var(--space-md); }
        .banners { grid-template-columns: minmax(0, 1fr); margin-top: var(--space-2xl); }
  }
  @media (max-width: 640px) {
    .page-head { margin-bottom: var(--space-lg); }
    .search { grid-template-columns: minmax(0, 1fr); padding: var(--space-md); margin-bottom: var(--space-lg); }
    .search .btn { width: 100%; }
  }
</style>
