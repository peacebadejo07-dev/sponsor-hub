<script lang="ts">
  import BlurBg from '$lib/ui/BlurBg.svelte';
  import { page } from '$app/state';
  import { RATING_LABELS, RATING_HELP, ATS_NAMES, ago } from '$lib/labels';
  import { safeHref } from '$lib/safeHref';
  import OppCard from '$lib/OppCard.svelte';
  import Icon from '$lib/ui/Icon.svelte';
  import OrgLogo from '$lib/ui/OrgLogo.svelte';
  import ProvenanceBadge from '$lib/ui/ProvenanceBadge.svelte';
  import EmptyState from '$lib/ui/EmptyState.svelte';
  import SubscribeBanner from '$lib/ui/SubscribeBanner.svelte';
  import ProfileBanner from '$lib/ui/ProfileBanner.svelte';

  let { data } = $props();
  const o = $derived(data.org);
  const prov = $derived(data.org.provenance);
  const name = $derived(o.name.trim());
  const researched = $derived(!!o.resolve_status && o.resolve_status !== 'pending');
  const here = $derived(`/org/${o.id}`);
  const place = $derived([o.town, o.county].filter(Boolean).join(', ') || 'Location not listed');
  const branchCount = $derived(Math.max(1, data.branches.length));
  const fmtDate = (d: string | null) => (d ? new Date(d).toLocaleDateString('en-GB', { year: 'numeric', month: 'short', day: 'numeric' }) : null);
  const host = (u: string) => u.replace(/^https?:\/\/(www\.)?/, '').replace(/\/$/, '');
  const tags = $derived(o.all_sector_tags.filter((t) => t !== 'tech' || o.all_sector_tags.length === 1));
  const evidence = $derived(o.sector_evidence.filter((e) => e.tag !== 'tech' || o.sector_evidence.length === 1));
  const label = (t: string) => data.sectorLabels[t as keyof typeof data.sectorLabels] ?? t;
  const SOURCE_TEXT = {
    sic: ['Registered with Companies House', 'verified'],
    website: ["From the organisation's own website", 'verified'],
    jobs: ['From what it is hiring for now', 'inferred'],
    name: ["Guessed from the organisation's name", 'inferred']
  } as const;
  const sectorStatus = $derived(o.sector_basis === 'sic' || o.sector_basis === 'website' ? 'verified' : o.sector_basis ? 'inferred' : 'unconfirmed');
  const tabHref = (t: string) => (t === 'roles' ? here : `${here}?tab=${t}`);
  const TABS = $derived([
    ['roles', `Open roles (${data.roles.length})`, `Roles (${data.roles.length})`],
    ['sponsorship', 'Sponsorship & evidence', 'Sponsorship'],
    ['locations', `Locations (${branchCount})`, `Locations (${branchCount})`]
  ]);
  const returnTo = $derived(page.url.pathname + page.url.search);
</script>

<svelte:head>
  <title>{name} · Sponsor Hub</title>
  <meta name="description" content={`${name}: licensed UK visa sponsor (${RATING_LABELS[o.rating] ?? o.rating}). Open tech roles, sponsorship evidence and registered locations.`} />
</svelte:head>

{#snippet licenceCard(detailed: boolean)}
  <section class="card side-card" aria-labelledby="licence-h">
    <div class="side-head">
      <h2 id="licence-h" class="t-heading-4">Sponsor licence</h2>
      <ProvenanceBadge status="verified" />
    </div>
    {#if detailed}<p class="t-body-sm t-secondary sub">From the Home Office register of licensed sponsors.</p>{/if}
    <dl class:rows={detailed}>
      <div><dt>Rating</dt><dd><span class="v">{RATING_LABELS[o.rating] ?? o.rating}</span>{#if RATING_HELP[o.rating]}<span class="help">{RATING_HELP[o.rating]}{detailed && o.rating?.startsWith('A') ? '. The Home Office downgrades a sponsor to B when it must improve its compliance.' : ''}</span>{/if}</dd></div>
      <div><dt>Routes</dt><dd>{#each o.routes as r, i (r)}<span class={i === 0 ? 'v' : 'help'}>{i === 0 ? r : `Also: ${r}`}</span>{/each}</dd></div>
      {#if detailed}<div><dt>Listed as</dt><dd><span class="v">{name}</span><span class="help">{place}{branchCount > 1 ? ` · ${branchCount} registered locations` : ''}</span></dd></div>{/if}
    </dl>
    {#if !detailed}<p class="t-caption t-muted">From the Home Office register of licensed sponsors.</p>{/if}
    <p class="note t-body-sm t-secondary"><Icon name="info" size={16} />Being on the register doesn't mean every role is sponsored. Check each job's own wording.</p>
  </section>
{/snippet}

{#snippet companyCard()}
  <section class="card side-card" aria-labelledby="company-h">
    <div class="side-head">
      <h2 id="company-h" class="t-heading-4">Company details</h2>
      {#if !o.companies_house_no && !o.size_band && !o.industry.length}<ProvenanceBadge status="unconfirmed" />{/if}
    </div>
    {#if o.companies_house_no || o.size_band || o.industry.length || tags.length}
      <dl>
        {#if o.companies_house_no}
          <div><dt>Companies House <ProvenanceBadge status="verified" /></dt><dd><a class="v link" href={`https://find-and-update.company-information.service.gov.uk/company/${o.companies_house_no}`} rel="noopener nofollow" target="_blank">{o.companies_house_no}<Icon name="arrow-up-right" size={14} /><span class="visually-hidden"> (opens Companies House)</span></a>{#if o.incorporated_on}<span class="help">Incorporated {fmtDate(o.incorporated_on)}</span>{/if}</dd></div>
        {/if}
        {#if tags.length}<div><dt>Sector <ProvenanceBadge status={sectorStatus} /></dt><dd><span class="v">{tags.map(label).join(', ')}</span>{#if evidence[0]}<span class="help">{SOURCE_TEXT[evidence[0].source][0]}{evidence[0].detail ? ` (${evidence[0].detail})` : ''}</span>{/if}</dd></div>{/if}
        {#if o.careers_url}<div><dt>Careers page <ProvenanceBadge status={prov.careers_url?.status} /></dt><dd><a class="v link" href={safeHref(o.careers_url)} rel="noopener nofollow" target="_blank">{host(o.careers_url)}<Icon name="arrow-up-right" size={14} /><span class="visually-hidden"> (opens their site)</span></a>{#if o.ats_type}<span class="help">Jobs read from {ATS_NAMES[o.ats_type] ?? o.ats_type}</span>{/if}</dd></div>{/if}
        {#if o.size_band}<div><dt>Employees <ProvenanceBadge status="inferred" /></dt><dd><span class="v">{o.size_band}</span><span class="help">Approximate, from Wikidata</span></dd></div>{/if}
      </dl>
    {:else}
      <p class="t-body-sm t-secondary sub">Not checked yet. Company number, website and careers page appear here once we've matched this organisation to official records.</p>
    {/if}
  </section>
{/snippet}

<a class="back t-label" href="/organisations"><Icon name="chevron-left" size={16} />All organisations</a>

<article class="hero card">
  <div class="cover blur-bg" aria-hidden="true"><BlurBg /></div>
  <div class="hero-body">
    <div class="logo-wrap"><OrgLogo {name} size="lg" /></div>
    <div class="title-row">
      <div class="name">
        <h1 class="t-heading-2">{name}</h1>
        <p class="t-body-sm t-secondary loc"><Icon name="map-pin" size={16} />{place}{branchCount > 1 ? ` · ${branchCount} registered locations` : ''}</p>
      </div>
      <div class="actions">
        {#if o.website}<a class="btn btn-secondary" href={safeHref(o.website)} rel="noopener nofollow" target="_blank"><Icon name="arrow-up-right" />Visit website<span class="visually-hidden"> (opens their site)</span></a>{/if}
        {#if data.loggedIn}
          <form method="POST" action="/api/save-org">
            <input type="hidden" name="org_id" value={o.id} /><input type="hidden" name="saved" value={data.following ? '0' : '1'} /><input type="hidden" name="return" value={returnTo} />
            <button type="submit" class="btn {data.following ? 'btn-secondary' : 'btn-primary'}" aria-pressed={data.following}><Icon name={data.following ? 'check' : 'plus'} />{data.following ? 'Following' : 'Follow'}</button>
          </form>
        {:else}
          <a class="btn btn-primary" href={`/login?next=${encodeURIComponent(here)}`}><Icon name="plus" />Follow</a>
        {/if}
      </div>
    </div>
    {#if o.site_description}
      <div class="about">
        <p class="t-body t-secondary">“{o.site_description}”</p>
        <p class="t-caption t-muted">From the organisation's own website</p>
      </div>
    {/if}
    <ul class="tags meta" aria-label="At a glance">
      <li><ProvenanceBadge status="verified" /></li>
      <li class="tag">Licensed sponsor · {RATING_LABELS[o.rating] ?? o.rating}</li>
      {#if o.routes[0]}<li class="tag">{o.routes[0].replace(/^Worker:\s*/i, '')}</li>{/if}
      {#each tags.slice(0, 2) as t (t)}<li class="tag">{label(t)}</li>{/each}
      {#if o.size_band}<li class="tag">{o.size_band} employees</li>{/if}
    </ul>
    <nav class="tabs" aria-label="Organisation sections">
      {#each TABS as [t, long, short] (t)}
        <a href={tabHref(t)} aria-current={data.tab === t ? 'page' : undefined} data-sveltekit-noscroll><span class="long">{long}</span><span class="short">{short}</span></a>
      {/each}
    </nav>
  </div>
</article>

<div class="columns">
  <div class="main-col">
    {#if data.tab === 'roles'}
      {#if data.roles.length}
        <div class="list-head">
          <h2 class="t-heading-4">{data.roles.length} open tech role{data.roles.length === 1 ? '' : 's'}</h2>
          {#if data.lastScan}<p class="t-body-sm t-muted">Checked {ago(data.lastScan)}</p>{/if}
        </div>
        <ul class="list">
          {#each data.roles as r (r.id)}<OppCard o={r} loggedIn={data.loggedIn} mark={data.marks[r.id] ?? null} {returnTo} showOrg={false} headingLevel={3} />{/each}
        </ul>
      {:else if !researched}
        <EmptyState icon="building" title="We haven't checked this organisation's jobs yet" body="We find websites and job boards automatically, starting with tech organisations. This one is in the queue, so its roles will appear here once it's checked.">
          <a class="btn btn-secondary" href="/">Browse roles at other sponsors</a>
        </EmptyState>
      {:else if !o.ats_type}
        <EmptyState icon="building" title="We can't read this organisation's job board yet" body={o.careers_url ? 'We found their careers page, but not a job board we can read automatically. Check it directly for current roles.' : "We couldn't find a careers page for this organisation."}>
          {#if o.careers_url}<a class="btn btn-primary" href={safeHref(o.careers_url)} rel="noopener nofollow" target="_blank">Open their careers page<Icon name="arrow-up-right" size={16} /></a>{/if}
          <a class="btn btn-secondary" href="/">Browse roles at other sponsors</a>
        </EmptyState>
      {:else}
        <EmptyState icon="search" title="No open tech roles right now" body={`We check ${name}'s job board every day${data.lastScan ? ` (last checked ${ago(data.lastScan)})` : ''}. Follow them to see new roles on Today.`}>
          <a class="btn btn-secondary" href="/">Browse roles at other sponsors</a>
        </EmptyState>
      {/if}
    {:else if data.tab === 'sponsorship'}
      {@render licenceCard(true)}

      <section class="card side-card" aria-labelledby="sector-h">
        <div class="side-head"><h2 id="sector-h" class="t-heading-4">Sector</h2><ProvenanceBadge status={sectorStatus} /></div>
        {#if tags.length}
          <p class="t-body-sm t-secondary sub">How we decided what this organisation does, strongest evidence first.</p>
          <ul class="tags">{#each tags as t (t)}<li class="tag">{label(t)}</li>{/each}</ul>
          <ul class="evidence">
            {#each evidence as e (e.tag + e.source)}
              <li>
                <span class="tag">{label(e.tag)}</span>
                <span class="src"><span class="t-body-strong">{SOURCE_TEXT[e.source][0]}</span>{#if e.detail}<span class="t-body-sm t-secondary">{e.detail}</span>{/if}</span>
                <ProvenanceBadge status={SOURCE_TEXT[e.source][1]} />
              </li>
            {/each}
          </ul>
          <p class="t-caption t-muted">{o.sector_basis === 'name' ? "Last-resort guess from the organisation's name only. No Companies House code, website text or live roles back it up, so it may be wrong." : 'Sector labels are our reading of these sources and can be wrong.'}</p>
        {:else}
          <p class="t-body-sm t-secondary sub">Not stated. Nothing reliable tells us what this organisation does yet.</p>
        {/if}
        {#if o.site_description}<p class="t-body-sm t-secondary">“{o.site_description}” <span class="t-caption t-muted">From the organisation's own website</span></p>{/if}
      </section>

      <section class="card side-card" aria-labelledby="web-h">
        <div class="side-head"><h2 id="web-h" class="t-heading-4">Website and careers</h2></div>
        {#if !researched}
          <p class="t-body-sm t-secondary sub">Not researched yet. Websites are found automatically, starting with tech organisations.</p>
        {:else}
          <p class="t-body-sm t-secondary sub">Found automatically, then checked against official records.</p>
          <dl class="rows">
            <div><dt>Website <ProvenanceBadge status={prov.website?.status} /></dt><dd>
              {#if o.website}<a class="v link" href={safeHref(o.website)} rel="noopener nofollow" target="_blank">{host(o.website)}<Icon name="arrow-up-right" size={14} /></a>{#if prov.website?.detail}<span class="help">{prov.website.detail}{prov.website.confidence ? ` (confidence ${Math.round(prov.website.confidence * 100)}%)` : ''}</span>{/if}
              {:else if o.website_candidate}<span class="v">Possible match, not verified: {host(o.website_candidate)}</span>{#if prov.website?.detail}<span class="help">{prov.website.detail}</span>{/if}
              {:else}<span class="help">No website found</span>{/if}
            </dd></div>
            <div><dt>Careers page <ProvenanceBadge status={prov.careers_url?.status} /></dt><dd>
              {#if o.careers_url}<a class="v link" href={safeHref(o.careers_url)} rel="noopener nofollow" target="_blank">{host(o.careers_url)}<Icon name="arrow-up-right" size={14} /></a>{#if prov.careers_url?.detail}<span class="help">{prov.careers_url.detail}</span>{/if}
              {:else}<span class="help">{o.website ? 'No careers page found' : 'Needs a website first'}</span>{/if}
            </dd></div>
            {#if o.ats_type}<div><dt>Job board system <ProvenanceBadge status={prov.ats?.status} /></dt><dd><span class="v">{ATS_NAMES[o.ats_type] ?? o.ats_type}</span><span class="help">{o.ats_slug && o.ats_type !== 'jsonld' ? `Board: ${o.ats_slug}. ` : ''}We read live roles from here every day.</span></dd></div>{/if}
          </dl>
        {/if}
      </section>
    {:else}
      <section class="card side-card" aria-labelledby="loc-h">
        <div class="side-head"><h2 id="loc-h" class="t-heading-4">{branchCount} registered location{branchCount === 1 ? '' : 's'}</h2><ProvenanceBadge status="verified" /></div>
        <p class="t-body-sm t-secondary sub">Each location is a separate entry on the Home Office register, and each can have its own rating.</p>
        <ul class="locations">
          {#each data.branches.length ? data.branches : [{ id: o.id, town: o.town, county: o.county, rating: o.rating }] as b (b.id)}
            <li class:current={b.id === o.id}>
              <span class="pin" aria-hidden="true"><Icon name="map-pin" size={18} /></span>
              <span class="place">
                {#if b.id === o.id}<span class="t-body-strong">{b.town || 'Location not listed'}</span>
                {:else}<a class="t-body-strong t-link" href={`/org/${b.id}?tab=locations`}>{b.town || 'Location not listed'}</a>{/if}
                {#if b.county}<span class="t-body-sm t-secondary">{b.county}</span>{/if}
              </span>
              <span class="tag">{RATING_LABELS[b.rating] ?? b.rating}</span>
              {#if b.id === o.id}<span class="tag tag-brand">You're viewing this</span>{:else}<Icon name="chevron-right" size={16} />{/if}
            </li>
          {/each}
        </ul>
        <p class="t-caption t-muted">Roles and company details on this page cover the whole organisation, not one location.</p>
      </section>
    {/if}
  </div>

  <aside class="side-col" aria-label="About this organisation">
    {#if data.tab === 'sponsorship'}
      <section class="card side-card" aria-labelledby="legend-h">
        <h2 id="legend-h" class="t-heading-4">What the badges mean</h2>
        <div class="legend"><ProvenanceBadge status="verified" /><p class="t-body-sm t-secondary">Taken from an official record or the organisation's own website.</p></div>
        <div class="legend"><ProvenanceBadge status="inferred" /><p class="t-body-sm t-secondary">Our best reading of the evidence. Usually right, but it can be wrong.</p></div>
        <div class="legend"><ProvenanceBadge status="unconfirmed" /><p class="t-body-sm t-secondary">Nothing reliable tells us yet.</p></div>
      </section>
      <section class="card side-card" aria-labelledby="wrong-h">
        <h2 id="wrong-h" class="t-heading-4">Something wrong?</h2>
        <p class="t-body-sm t-secondary sub">If a detail here is out of date or wrong, tell us and we'll fix it.</p>
        <a class="btn btn-secondary btn-block" href={`https://github.com/peacebadejo07-dev/sponsor-hub/issues/new?title=${encodeURIComponent(`Data problem: ${name} (org ${o.id})`)}`} rel="noopener">Report a problem</a>
      </section>
    {:else}
      {@render licenceCard(false)}
      {@render companyCard()}
    {/if}
  </aside>
</div>

<div class="banners">
  <SubscribeBanner loggedIn={data.loggedIn} />
  <ProfileBanner loggedIn={data.loggedIn} />
</div>

<style>
  .back { display: inline-flex; align-items: center; gap: 6px; min-height: var(--size-touch-target); color: var(--color-text-secondary); text-decoration: none; margin: calc(-1 * var(--space-md)) 0 var(--space-xs); }
  .back:hover { color: var(--color-text-primary); }

  .hero { overflow: hidden; }
  .cover { height: 128px; background: var(--color-bg-page); --blur-w: 1200px; --blur-x: 50%; --blur-y: 40%; --blur-opacity: 0.55; }
  .hero-body { display: grid; gap: var(--space-md); padding: 0 var(--space-xl); margin-top: -36px; position: relative; }
  .logo-wrap { width: fit-content; padding: 4px; background: var(--color-bg-surface); border-radius: var(--radius-xl); box-shadow: var(--shadow-sm); }
  .title-row { display: flex; align-items: center; justify-content: space-between; gap: var(--space-lg); flex-wrap: wrap; }
  .name { display: grid; gap: 6px; min-width: 0; }
  .name h1 { overflow-wrap: anywhere; }
  .loc { display: flex; align-items: center; gap: 6px; margin: 0; }
  .actions { display: flex; gap: var(--space-sm); flex-wrap: wrap; }
  .actions form { margin: 0; }
  .about { display: grid; gap: 2px; }
  .about p { margin: 0; }
  .meta { list-style: none; margin: 0; padding: 0; align-items: center; }
  .tabs { display: flex; gap: var(--space-xl); border-bottom: 1px solid var(--color-border-subtle); margin-top: var(--space-xs); overflow-x: auto; overflow-y: hidden; scrollbar-width: none; }
  .tabs a { display: inline-flex; align-items: center; min-height: 48px; padding: 0; text-decoration: none; white-space: nowrap; color: var(--color-text-secondary); font-size: var(--font-size-body); border-bottom: 2px solid transparent; margin-bottom: -1px; }
  .tabs a:hover { color: var(--color-text-primary); }
  .tabs a[aria-current='page'] { color: var(--color-text-primary); font-weight: var(--font-weight-semibold); border-bottom-color: var(--color-icon-brand); }
  .tabs .short { display: none; }

  .columns { display: grid; grid-template-columns: minmax(0, 1fr) 360px; gap: var(--space-xl); align-items: start; margin-top: var(--space-xl); }
  .main-col, .side-col { display: grid; gap: var(--space-lg); min-width: 0; }
  .list-head { display: flex; justify-content: space-between; align-items: baseline; gap: var(--space-sm); flex-wrap: wrap; }
  .list-head p { margin: 0; }
  .list { list-style: none; margin: 0; padding: 0; display: grid; gap: var(--space-md); }

  .side-card { display: grid; gap: var(--space-md); padding: var(--space-lg); align-content: start; }
  .side-head { display: flex; align-items: center; justify-content: space-between; gap: var(--space-xs); flex-wrap: wrap; }
  .sub { margin: calc(-1 * var(--space-xs)) 0 0; }
  .side-card > p { margin: 0; }
  dl { margin: 0; display: grid; gap: var(--space-md); }
  dl > div { display: grid; gap: var(--space-2xs); }
  dt { display: flex; align-items: center; gap: var(--space-xs); flex-wrap: wrap; font-size: var(--font-size-label-sm); line-height: var(--line-height-label-sm); font-weight: var(--font-weight-medium); color: var(--color-text-muted); }
  dd { margin: 0; display: grid; gap: 2px; overflow-wrap: anywhere; }
  .v { font-size: var(--font-size-body); line-height: var(--line-height-body); color: var(--color-text-primary); }
  .help { font-size: var(--font-size-body-sm); line-height: var(--line-height-body-sm); color: var(--color-text-secondary); }
  .link { display: inline-flex; align-items: center; gap: 4px; width: fit-content; color: var(--color-text-link); font-weight: var(--font-weight-semibold); text-decoration: none; }
  .link:hover { text-decoration: underline; }
  dl.rows > div { grid-template-columns: 180px minmax(0, 1fr); gap: var(--space-md); padding-top: var(--space-md); border-top: 1px solid var(--color-border-subtle); }
  dl.rows > div:first-child { padding-top: 0; border-top: 0; }
  dl.rows dt { flex-direction: column; align-items: flex-start; font-size: var(--font-size-label); color: var(--color-text-secondary); }
  .note { display: flex; gap: var(--space-xs); align-items: flex-start; padding: var(--space-sm); background: var(--color-bg-page); border-radius: var(--radius-md); }
  .note :global(.icon) { margin-top: 3px; flex: none; color: var(--color-status-info-fg); }

  .evidence { list-style: none; margin: 0; padding: 0; border: 1px solid var(--color-border-subtle); border-radius: var(--radius-md); overflow: hidden; }
  .evidence li { display: grid; grid-template-columns: 110px minmax(0, 1fr) auto; gap: var(--space-sm); align-items: center; padding: 14px var(--space-md); }
  .evidence li + li { border-top: 1px solid var(--color-border-subtle); }
  .evidence .tag { justify-self: start; }
  .src { display: grid; gap: 2px; min-width: 0; }

  .locations { list-style: none; margin: 0; padding: 0; border: 1px solid var(--color-border-subtle); border-radius: var(--radius-md); overflow: hidden; }
  .locations li { display: flex; align-items: center; gap: var(--space-sm); padding: var(--space-md); flex-wrap: wrap; }
  .locations li + li { border-top: 1px solid var(--color-border-subtle); }
  .locations li.current { background: var(--color-bg-page); }
  .pin { display: grid; place-items: center; padding: 10px; border: 1px solid var(--color-border-subtle); border-radius: var(--radius-md); background: var(--color-bg-surface); }
  .place { display: grid; gap: 2px; flex: 1; min-width: 120px; }

  .legend { display: grid; gap: 6px; justify-items: start; }
  .legend p { margin: 0; }
  .banners { display: grid; grid-template-columns: minmax(0, 1fr) 360px; gap: var(--space-xl); margin-top: var(--space-4xl); }

  /* Desktop Large: open roles two per row; banners keep a 352px right margin (Figma). */
  @media (min-width: 1536px) {
    .list { grid-template-columns: repeat(2, minmax(0, 1fr)); }
    .banners { margin-right: 352px; }
  }
  @media (max-width: 1023px) {
    .columns { grid-template-columns: minmax(0, 1fr); }
    .banners { grid-template-columns: minmax(0, 1fr); margin-top: var(--space-2xl); }
  }
  @media (max-width: 640px) {
    .cover { height: 96px; }
    .hero-body { padding: 0 var(--space-lg); margin-top: -32px; }
    .actions { width: 100%; }
    .actions > :global(*) { flex: 1; }
    .actions :global(.btn) { width: 100%; }
    .tabs { gap: var(--space-md); }
    .tabs .long { display: none; }
    .tabs .short { display: inline; }
    dl.rows > div { grid-template-columns: minmax(0, 1fr); gap: 6px; }
    dl.rows dt { flex-direction: row; align-items: center; }
    .evidence li { grid-template-columns: minmax(0, 1fr); gap: var(--space-xs); justify-items: start; }
  }
</style>
