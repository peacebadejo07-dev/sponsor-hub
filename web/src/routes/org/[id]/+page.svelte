<script lang="ts">
  import { RATING_LABELS, RATING_HELP } from '$lib/labels';
  let { data } = $props();
  const o = $derived(data.org);
  const prov = $derived(data.org.provenance);
  const researched = $derived(o.resolve_status && o.resolve_status !== 'pending');
  const fmtDate = (d: string | null) => (d ? new Date(d).toLocaleDateString('en-GB', { year: 'numeric', month: 'short', day: 'numeric' }) : null);
  const label = (s?: string) => (s === 'verified' ? 'Verified' : s === 'inferred' ? 'Inferred' : 'Unconfirmed');
  const cls = (s?: string) => (s === 'verified' ? 'verified' : s === 'inferred' ? 'inferred' : 'unconfirmed');
  const tags = $derived(o.all_sector_tags.filter((t) => t !== 'tech' || o.all_sector_tags.length === 1));
  const atsName = (a: string | null) => (a ? a.charAt(0).toUpperCase() + a.slice(1) : null);
</script>

<svelte:head><title>{o.name.trim()} · Sponsor Hub</title></svelte:head>

<p class="back"><a href="/">← All organisations</a></p>

<header class="head">
  <h1>{o.name.trim()}</h1>
  <p class="sub">{[o.town, o.county].filter(Boolean).join(', ') || 'Location not listed'}</p>
</header>

<div class="grid">
  <section class="card">
    <h2>Sponsorship <span class="badge verified">Verified</span></h2>
    <p class="source">From the Home Office register of licensed sponsors.</p>
    <dl>
      <dt>Rating</dt>
      <dd>{RATING_LABELS[o.rating] ?? o.rating}<small>{RATING_HELP[o.rating] ?? ''}</small></dd>
      <dt>Routes</dt>
      <dd>
        <ul class="plain">{#each o.routes as r (r)}<li>{r}</li>{/each}</ul>
      </dd>
    </dl>
    <p class="note">Being on the register does not mean any particular role is sponsored. Check each job's own wording.</p>
  </section>

  <section class="card">
    <h2>Website and careers</h2>
    {#if !researched}
      <p class="muted">Not researched yet. Websites are found automatically, starting with tech organisations.</p>
    {:else}
      <dl>
        <dt>Website <span class="badge {cls(prov.website?.status)}">{label(prov.website?.status)}</span></dt>
        <dd>
          {#if o.website}
            <a href={o.website} rel="noopener nofollow" target="_blank">{o.website.replace(/^https?:\/\//, '')} ↗</a>
            {#if prov.website?.detail}<small>{prov.website.detail}{prov.website.confidence ? ` (confidence ${Math.round(prov.website.confidence * 100)}%)` : ''}</small>{/if}
          {:else if o.website_candidate}
            <span class="muted">Possible match, not verified: {o.website_candidate.replace(/^https?:\/\//, '')}</span>
            {#if prov.website?.detail}<small>{prov.website.detail}</small>{/if}
          {:else}
            <span class="muted">No website found</span>
          {/if}
        </dd>
        <dt>Careers page <span class="badge {cls(prov.careers_url?.status)}">{label(prov.careers_url?.status)}</span></dt>
        <dd>
          {#if o.careers_url}
            <a href={o.careers_url} rel="noopener nofollow" target="_blank">{o.careers_url.replace(/^https?:\/\//, '')} ↗</a>
            {#if prov.careers_url?.detail}<small>{prov.careers_url.detail}</small>{/if}
          {:else}<span class="muted">{o.website ? 'No careers page found' : 'Needs a website first'}</span>{/if}
        </dd>
        {#if o.ats_type}
          <dt>Job board system <span class="badge verified">Verified</span></dt>
          <dd>{atsName(o.ats_type)}{#if o.ats_slug} <small>{o.ats_slug}</small>{/if}</dd>
        {/if}
      </dl>
    {/if}
  </section>

  <section class="card">
    <h2>Sector <span class="badge inferred">Inferred</span></h2>
    {#if tags.length}
      <p class="tags">{#each tags as t (t)}<span class="tag">{data.sectorLabels[t as keyof typeof data.sectorLabels]}</span>{/each}</p>
      <p class="source">
        Guessed from {o.name_sector_tags.length ? 'the organisation name' : ''}{o.name_sector_tags.length && o.profile_sector_tags.length ? ' and ' : ''}{o.profile_sector_tags.length
          ? prov.sector_tags?.source?.includes('companies_house') ? 'Companies House codes and website text' : 'its website text'
          : ''}. Can be wrong.
      </p>
    {:else}
      <p class="muted">No sector identified yet.</p>
    {/if}
    {#if o.site_description}<p class="desc">“{o.site_description}”<small>From the organisation's own website</small></p>{/if}
  </section>

  <section class="card">
    <h2>Company details</h2>
    {#if o.companies_house_no || o.size_band || o.industry.length || o.wikidata_id}
      <dl>
        {#if o.companies_house_no}
          <dt>Companies House <span class="badge verified">Verified</span></dt>
          <dd>
            <a href={`https://find-and-update.company-information.service.gov.uk/company/${o.companies_house_no}`} rel="noopener nofollow" target="_blank">{o.companies_house_no} ↗</a>
            {#if o.incorporated_on}<small>Incorporated {fmtDate(o.incorporated_on)}</small>{/if}
          </dd>
        {/if}
        {#if o.size_band}<dt>Employees <span class="badge inferred">Inferred</span></dt><dd>{o.size_band}<small>Approximate, from Wikidata</small></dd>{/if}
        {#if o.industry.length}<dt>Industry <span class="badge inferred">Inferred</span></dt><dd>{o.industry.join(', ')}<small>From Wikidata</small></dd>{/if}
      </dl>
    {:else}
      <p class="muted"><span class="badge unconfirmed">Unconfirmed</span> No company details found yet.</p>
    {/if}
  </section>

  {#if data.branches.length > 1}
    <section class="card wide">
      <h2>Registered locations <span class="badge verified">Verified</span></h2>
      <ul class="branches">
        {#each data.branches as b (b.id)}
          <li><a href={`/org/${b.id}`} aria-current={b.id === o.id ? 'page' : undefined}>{[b.town, b.county].filter(Boolean).join(', ') || 'Location not listed'}</a> <small>{RATING_LABELS[b.rating] ?? b.rating}</small></li>
        {/each}
      </ul>
    </section>
  {/if}
</div>

<style>
  .back { margin: 0 0 12px; font-size: 14px; }
  .back a { color: var(--muted); }
  h1 { font-size: 26px; margin: 0; letter-spacing: -0.015em; overflow-wrap: anywhere; }
  .sub { margin: 2px 0 20px; color: var(--muted); }
  .grid { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 14px; align-items: start; }
  .card { background: var(--surface); border: 1px solid var(--line); border-radius: var(--radius); padding: 16px 18px; }
  .wide { grid-column: 1 / -1; }
  h2 { font-size: 15px; margin: 0 0 10px; display: flex; gap: 8px; align-items: center; flex-wrap: wrap; }
  dl { margin: 0; display: grid; gap: 4px; }
  dt { font-size: 12px; color: var(--muted); margin-top: 8px; display: flex; gap: 6px; align-items: center; }
  dd { margin: 0; overflow-wrap: anywhere; }
  dd small, .desc small { display: block; color: var(--muted); font-size: 12px; }
  dd a, .back a { color: var(--accent); }
  .plain, .branches { list-style: none; margin: 0; padding: 0; display: grid; gap: 2px; }
  .branches { grid-template-columns: repeat(auto-fill, minmax(220px, 1fr)); gap: 6px 16px; }
  .branches a[aria-current] { font-weight: 700; color: var(--ink); text-decoration: none; }
  .muted, .source { color: var(--muted); font-size: 13px; margin: 0; }
  .note { font-size: 12px; color: var(--muted); margin: 12px 0 0; padding-top: 10px; border-top: 1px solid var(--line); }
  .desc { margin: 10px 0 0; font-size: 14px; }
  .tags { margin: 0 0 6px; display: flex; flex-wrap: wrap; gap: 6px; }
  .tag { font-size: 12px; background: var(--bg); border: 1px solid var(--line); padding: 1px 8px; border-radius: 99px; }
  .badge { font-size: 11px; font-weight: 600; padding: 1px 7px; border-radius: 99px; }
  .badge.verified { background: var(--accent-soft); color: var(--verified); }
  .badge.inferred { background: var(--inferred-soft); color: var(--inferred); }
  .badge.unconfirmed { background: var(--bg); color: var(--muted); border: 1px solid var(--line); }
  @media (max-width: 760px) { .grid { grid-template-columns: 1fr; } }
</style>
