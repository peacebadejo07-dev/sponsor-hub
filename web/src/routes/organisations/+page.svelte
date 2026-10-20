<script lang="ts">
  import { RATING_LABELS, RATING_HELP } from '$lib/labels';
  import Icon from '$lib/ui/Icon.svelte';
  import EmptyState from '$lib/ui/EmptyState.svelte';
  import OrgCard from '$lib/ui/OrgCard.svelte';
  import SubscribeBanner from '$lib/ui/SubscribeBanner.svelte';
  import ProfileBanner from '$lib/ui/ProfileBanner.svelte';
  import { SECTOR_TAGS } from '@sponsored/core';
  import { onMount } from 'svelte';
  import { page } from '$app/state';
  let { data } = $props();
  // Open on desktop; on smaller screens start collapsed so results are visible.
  let filtersOpen = $state(true);
  onMount(() => {
    if (window.innerWidth < 1024) filtersOpen = false;
  });

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
  const following = $derived(new Set(data.following));
  const returnTo = $derived(page.url.pathname + page.url.search);
  const first = $derived((f.page - 1) * data.pageSize + 1);
  const last = $derived(Math.min(f.page * data.pageSize, data.total));
</script>

<svelte:head>
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
    <div class="control"><Icon name="map-pin" /><input id="town" form="org-filters" type="text" name="town" value={f.town} list="towns" placeholder="Anywhere in the UK" autocomplete="off" /></div>
    <datalist id="towns">{#each data.towns as t (t.value)}<option value={t.value}>{fmt(t.count)}</option>{/each}</datalist>
  </div>
  <button type="submit" form="org-filters" class="btn btn-primary"><Icon name="search" />Search</button>
</search>

<div class="layout">
  <details class="filters card" bind:open={filtersOpen}>
    <summary class="btn btn-secondary btn-sm"><Icon name="filter" size={16} />Filters{#if activeCount}{' '}({activeCount}){/if}</summary>
    <div class="filters-body">
      <div class="filters-head">
        <h2 class="t-heading-4">Filters{#if activeCount}{' '}({activeCount}){/if}</h2>
        {#if activeCount}<a href="/organisations" class="btn btn-ghost btn-sm">Clear all</a>{/if}
      </div>

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
        <div class="chips">
          {#each data.routeFacets as r (r.value)}
            <label class="chip"><input form="org-filters" type="checkbox" name="route" value={r.value} checked={f.routes.includes(r.value)} /><Icon name="check" size={16} />{r.value} <span class="count">· {fmt(r.count)}</span></label>
          {/each}
        </div>
      </fieldset>

      <fieldset>
        <legend class="t-overline">Rating <span class="prov prov-verified"><Icon name="check-circle" size={14} />Verified</span></legend>
        <div class="chips">
          {#each data.ratingFacets as r (r.value)}
            <label class="chip" title={RATING_HELP[r.value] ?? ''}><input form="org-filters" type="checkbox" name="rating" value={r.value} checked={f.ratings.includes(r.value)} /><Icon name="check" size={16} />{RATING_LABELS[r.value] ?? r.value} <span class="count">· {fmt(r.count)}</span></label>
          {/each}
        </div>
      </fieldset>

      <button type="submit" form="org-filters" class="btn btn-primary btn-block">Apply filters</button>
    </div>
  </details>

  <section class="results" aria-labelledby="org-count">
    <p id="org-count" class="t-label" role="status">{#if data.orgs.length}Showing {fmt(first)}–{fmt(last)} of {fmt(data.total)} organisations{:else}No organisations match{/if}</p>
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
  .filters { padding: var(--space-lg); position: sticky; top: 96px; max-height: calc(100vh - 112px); overflow: auto; }
  .filters > summary { display: none; }
  .filters-body { display: grid; gap: var(--space-lg); }
  .filters-head { display: flex; align-items: center; justify-content: space-between; gap: var(--space-xs); }
  fieldset { border: 0; margin: 0; padding: 0; display: grid; gap: var(--space-sm); min-width: 0; }
  legend { display: flex; align-items: center; gap: var(--space-xs); padding: 0; margin-bottom: var(--space-sm); color: var(--color-text-secondary); }
  legend .prov { text-transform: none; letter-spacing: 0; }
  .hint { margin: calc(-1 * var(--space-xs)) 0 0; }
  .results { display: grid; gap: var(--space-md); min-width: 0; }
  .results > p { margin: 0; }
  .grid { list-style: none; margin: 0; padding: 0; display: grid; grid-template-columns: repeat(auto-fill, minmax(min(100%, 360px), 1fr)); gap: var(--space-md); }
  .pager { display: flex; justify-content: space-between; align-items: center; gap: var(--space-sm); }
  .banners { display: grid; grid-template-columns: minmax(0, 2fr) minmax(0, 1fr); gap: var(--space-lg); margin-top: var(--space-4xl); }
  @media (max-width: 1023px) {
    .layout { grid-template-columns: minmax(0, 1fr); gap: var(--space-md); }
    .filters { position: static; max-height: none; overflow: visible; padding: 0; background: none; border: 0; box-shadow: none; }
    .filters > summary { display: inline-flex; list-style: none; }
    .filters > summary::-webkit-details-marker { display: none; }
    .filters[open] > summary { margin-bottom: var(--space-md); }
    .filters-body { padding: var(--space-lg); background: var(--color-bg-surface); border: 1px solid var(--color-border-soft); border-radius: var(--radius-xl); box-shadow: var(--shadow-soft); }
    .banners { grid-template-columns: minmax(0, 1fr); margin-top: var(--space-2xl); }
  }
  @media (max-width: 640px) {
    .page-head { margin-bottom: var(--space-lg); }
    .search { grid-template-columns: minmax(0, 1fr); padding: var(--space-md); margin-bottom: var(--space-lg); }
    .search .btn { width: 100%; }
  }
</style>
