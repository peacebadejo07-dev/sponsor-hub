<script lang="ts">
  import { RATING_LABELS, RATING_HELP } from '$lib/labels';
  import { SECTOR_TAGS } from '@sponsored/core';
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
    return qs ? `/?${qs}` : '/';
  }

  const sectorFacets = $derived(new Map(data.sectorFacets.map((x) => [x.value, x.count])));
  const sectorOptions = $derived(
    SECTOR_TAGS.filter((t) => (sectorFacets.get(t) ?? 0) > 0 || f.sectors.includes(t))
  );
  const fmt = (n: number) => n.toLocaleString('en-GB');
</script>

<div class="head">
  <div>
    <h1>UK organisations licensed to sponsor workers</h1>
    <p class="sub">
      {fmt(data.total)} match{data.total === 1 ? '' : 'es'}{#if data.register}{' '}· register published {data.register.published_on}{/if}
    </p>
  </div>
  <p class="legend" aria-label="How to read the labels">
    <span><span class="badge verified">Verified</span> from the Home Office register</span>
    <span><span class="badge inferred">Inferred</span> worked out by us, can be wrong</span>
  </p>
</div>

<div class="layout">
  <details class="filters" open={activeCount > 0 || undefined}>
    <summary>Filters{#if activeCount}{' '}({activeCount}){/if}</summary>
    <form method="GET" action="/">
      <label class="field">
        <span>Organisation name</span>
        <input type="search" name="q" value={f.q} placeholder="e.g. cyber, analytics" />
      </label>

      <label class="field">
        <span>Town / city</span>
        <input type="text" name="town" value={f.town} list="towns" placeholder="Anywhere in the UK" autocomplete="off" />
        <datalist id="towns">
          {#each data.towns as t (t.value)}<option value={t.value}>{fmt(t.count)}</option>{/each}
        </datalist>
      </label>

      <fieldset>
        <legend>Website <span class="badge inferred">Inferred</span></legend>
        <p class="hint">Websites are found automatically for a growing shortlist, starting with tech organisations.</p>
        <label class="check">
          <input type="checkbox" name="careers" value="1" checked={f.hasCareers} />
          <span>Has a careers page</span>
        </label>
      </fieldset>

      <fieldset>
        <legend>Sector <span class="badge inferred">Inferred</span></legend>
        <p class="hint">Guessed from the organisation's name only. Many organisations are untagged.</p>
        {#each sectorOptions as t (t)}
          <label class="check">
            <input type="checkbox" name="sector" value={t} checked={f.sectors.includes(t)} />
            <span>{data.sectorLabels[t]}</span>
            <em>{fmt(sectorFacets.get(t) ?? 0)}</em>
          </label>
        {/each}
      </fieldset>

      <fieldset>
        <legend>Sponsorship category <span class="badge verified">Verified</span></legend>
        {#each data.routeFacets as r (r.value)}
          <label class="check">
            <input type="checkbox" name="route" value={r.value} checked={f.routes.includes(r.value)} />
            <span>{r.value}</span>
            <em>{fmt(r.count)}</em>
          </label>
        {/each}
      </fieldset>

      <fieldset>
        <legend>Sponsorship rating <span class="badge verified">Verified</span></legend>
        {#each data.ratingFacets as r (r.value)}
          <label class="check" title={RATING_HELP[r.value] ?? ''}>
            <input type="checkbox" name="rating" value={r.value} checked={f.ratings.includes(r.value)} />
            <span>{RATING_LABELS[r.value] ?? r.value}</span>
            <em>{fmt(r.count)}</em>
          </label>
        {/each}
      </fieldset>

      <div class="actions">
        <button type="submit" class="primary">Apply filters</button>
        {#if activeCount}<a href="/" class="reset">Clear all</a>{/if}
      </div>
    </form>
  </details>

  <section aria-live="polite">
    {#if data.orgs.length === 0}
      <div class="empty">
        <strong>No organisations match these filters.</strong>
        <p>Try removing a filter or searching a shorter name.</p>
        <a href="/">Clear all filters</a>
      </div>
    {:else}
      <ul class="list">
        {#each data.orgs as o (o.id)}
          {@const tags = o.all_sector_tags.filter((t) => t !== 'tech' || o.all_sector_tags.length === 1)}
          <li class="card">
            <div class="row1">
              <h2><a href={`/org/${o.id}`}>{o.name.trim()}</a></h2>
              <span class="rating" title={RATING_HELP[o.rating] ?? ''}>{RATING_LABELS[o.rating] ?? o.rating}</span>
            </div>
            <p class="loc">{[o.town, o.county].filter(Boolean).join(', ') || 'Location not listed'}</p>
            <p class="routes">{o.routes.join(' · ')}</p>
            {#if o.website || o.careers_url}
              <p class="links">
                {#if o.website}<a href={o.website} rel="noopener nofollow" target="_blank">{o.website.replace(/^https?:\/\/(www\.)?/, '')}</a>{/if}
                {#if o.careers_url}<a class="careers" href={o.careers_url} rel="noopener nofollow" target="_blank">Careers page ↗</a>{/if}
                <span class="badge inferred" title="Found automatically; the match may be wrong">Inferred</span>
              </p>
            {:else if o.resolve_status === 'candidate'}
              <p class="links muted">Possible website found but not verified</p>
            {/if}
            {#if tags.length}
              <p class="tags">
                {#each tags as t (t)}
                  <span class="tag" title="Inferred from the organisation name">{data.sectorLabels[t as keyof typeof data.sectorLabels]}</span>
                {/each}
                <span class="badge inferred">Inferred</span>
              </p>
            {/if}
          </li>
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
  .legend { margin: 0; font-size: 13px; color: var(--muted); display: flex; flex-wrap: wrap; gap: 6px 10px; align-items: center; }
  .badge { font-size: 11px; font-weight: 600; padding: 1px 7px; border-radius: 99px; letter-spacing: 0.02em; vertical-align: 1px; }
  .badge.verified { background: var(--accent-soft); color: var(--verified); }
  .badge.inferred { background: var(--inferred-soft); color: var(--inferred); }

  .layout { display: grid; grid-template-columns: 300px 1fr; gap: 24px; align-items: start; }
  .filters { background: var(--surface); border: 1px solid var(--line); border-radius: var(--radius); padding: 14px 16px; position: sticky; top: 72px; max-height: calc(100vh - 88px); overflow: auto; }
  .filters summary { font-weight: 600; cursor: pointer; list-style: none; }
  .filters summary::-webkit-details-marker { display: none; }
  .filters form { margin-top: 12px; display: grid; gap: 14px; }
  .field { display: grid; gap: 4px; font-size: 13px; color: var(--muted); }
  .field input { padding: 8px 10px; border: 1px solid var(--line); border-radius: 8px; background: var(--bg); font-size: 15px; }
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

  .list { list-style: none; margin: 0; padding: 0; display: grid; gap: 10px; }
  .card { background: var(--surface); border: 1px solid var(--line); border-radius: var(--radius); padding: 14px 16px; }
  .row1 { display: flex; justify-content: space-between; gap: 12px; align-items: start; }
  h2 { font-size: 16px; margin: 0; font-weight: 600; overflow-wrap: anywhere; }
  .rating { font-size: 12px; font-weight: 600; color: var(--verified); background: var(--accent-soft); padding: 2px 8px; border-radius: 99px; white-space: nowrap; }
  .loc { margin: 2px 0 0; color: var(--muted); }
  .routes { margin: 6px 0 0; font-size: 13px; color: var(--muted); }
  h2 a { text-decoration: none; }
  h2 a:hover { text-decoration: underline; }
  .links { margin: 8px 0 0; display: flex; flex-wrap: wrap; gap: 6px 14px; align-items: center; font-size: 13px; }
  .links a { color: var(--accent); }
  .links .careers { font-weight: 600; }
  .links.muted { color: var(--muted); }
  .tags { margin: 8px 0 0; display: flex; flex-wrap: wrap; gap: 6px; align-items: center; }
  .tag { font-size: 12px; background: var(--bg); border: 1px solid var(--line); padding: 1px 8px; border-radius: 99px; }
  .empty { background: var(--surface); border: 1px dashed var(--line); border-radius: var(--radius); padding: 28px; text-align: center; color: var(--muted); }
  .empty strong { color: var(--ink); }
  .pager { display: flex; justify-content: space-between; align-items: center; margin-top: 18px; color: var(--muted); font-size: 14px; }
  .pager a { color: var(--accent); font-weight: 600; text-decoration: none; padding: 6px 4px; }

  @media (max-width: 820px) {
    .layout { grid-template-columns: 1fr; }
    .filters { position: static; max-height: none; }
  }
</style>
