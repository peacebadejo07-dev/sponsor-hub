<script lang="ts">
  import { RATING_LABELS, ago } from '$lib/labels';
  import { safeHref } from '$lib/safeHref';
  import Icon from './Icon.svelte';
  import OrgLogo from './OrgLogo.svelte';
  import ProvenanceBadge from './ProvenanceBadge.svelte';

  type Org = {
    id: number; name: string; town: string; county: string; rating: string; routes: string[]; all_sector_tags: string[];
    sector_basis: string | null; website: string | null; resolve_status: string | null; live: number; offered: number; branches: number; last_scan: string | null;
  };
  /** Figma › Organisation card (Roles = Live / None). */
  let { o, sectorLabels, loggedIn, following, returnTo }: { o: Org; sectorLabels: Record<string, string>; loggedIn: boolean; following: boolean; returnTo: string } = $props();
  const name = $derived(o.name.trim());
  const tags = $derived(o.all_sector_tags.filter((t) => t !== 'tech' || o.all_sector_tags.length === 1));
  const sectorStatus = $derived(o.sector_basis === 'sic' || o.sector_basis === 'website' ? 'verified' : 'inferred');
  const SOURCE: Record<string, string> = { sic: 'Companies House', website: 'Their website', jobs: 'Roles they advertise', name: 'Guessed from the name' };
  const host = (u: string) => u.replace(/^https?:\/\/(www\.)?/, '').replace(/\/.*$/, '');
  const id = $derived(`org-${o.id}`);
</script>

<li class="org card">
  <div class="head">
    <OrgLogo {name} size="lg" />
    <div class="names">
      <h2 class="t-heading-4" id={id}><a href={`/org/${o.id}`}>{name}</a></h2>
      <p class="t-body-sm t-secondary">{o.town || 'Location not listed'}{o.branches > 1 ? ` · ${o.branches} registered locations` : ''}</p>
    </div>
    {#if loggedIn}
      <form method="POST" action="/api/save-org">
        <input type="hidden" name="org_id" value={o.id} /><input type="hidden" name="saved" value={following ? '0' : '1'} /><input type="hidden" name="return" value={returnTo} />
        <button type="submit" class="btn btn-secondary btn-sm" aria-pressed={following} aria-describedby={id}>{#if following}<Icon name="check" size={16} />Following{:else}Follow{/if}</button>
      </form>
    {/if}
  </div>

  <div class="block">
    <p class="label"><span class="t-overline">Licence</span><ProvenanceBadge status="verified" /><span class="t-caption t-muted">Home Office register</span></p>
    <ul class="tags">
      <li class="tag">{RATING_LABELS[o.rating] ?? o.rating}</li>
      {#each o.routes.slice(0, 2) as r (r)}<li class="tag">{r.replace(/^Worker:\s*/i, '')}</li>{/each}
      {#if o.routes.length > 2}<li class="tag">+{o.routes.length - 2} more</li>{/if}
    </ul>
  </div>

  {#if tags.length}
    <div class="block">
      <p class="label"><span class="t-overline">Sector</span><ProvenanceBadge status={sectorStatus} /><span class="t-caption t-muted">{SOURCE[o.sector_basis ?? 'name'] ?? ''}</span></p>
      <ul class="tags">{#each tags.slice(0, 4) as t (t)}<li class="tag">{sectorLabels[t] ?? t}</li>{/each}</ul>
    </div>
  {/if}

  {#if o.live > 0}
    <div class="roles">
      <div>
        <p class="t-body-strong">{o.live} live tech role{o.live === 1 ? '' : 's'}</p>
        <p class="t-caption t-secondary">{o.offered} advert{o.offered === 1 ? '' : 's'} mention visa sponsorship{o.last_scan ? ` · checked ${ago(o.last_scan)}` : ''}</p>
      </div>
      <a class="btn btn-ghost btn-sm" href={`/org/${o.id}`} aria-describedby={id}>See roles<Icon name="arrow-right" size={16} /></a>
    </div>
  {:else}
    <div class="roles none">
      <p class="t-body-sm t-secondary">{o.resolve_status && o.resolve_status !== 'pending' ? 'No live tech roles found on their job board.' : "We haven't checked this organisation's jobs yet."}</p>
    </div>
  {/if}

  {#if o.website}
    <p class="foot t-caption"><span class="t-secondary">Website</span><a class="t-link" href={safeHref(o.website)} rel="noopener nofollow" target="_blank">{host(o.website)}<Icon name="arrow-up-right" size={12} /><span class="visually-hidden"> (opens their site)</span></a></p>
  {/if}
</li>

<style>
  .org { min-width: 0; list-style: none; display: grid; gap: var(--space-md); align-content: start; padding: var(--space-lg); border-color: var(--color-border-subtle); box-shadow: var(--shadow-xs); transition: box-shadow 120ms ease, border-color 120ms ease; }
  .org:hover { border-color: var(--color-border-default); box-shadow: var(--shadow-sm); }
  .head { display: flex; gap: var(--space-md); align-items: center; }
  .names { display: grid; gap: 2px; flex: 1; min-width: 0; }
  .names p { margin: 0; }
  /* Inline padding widens the tap area to 44px without moving anything. */
  h2 a { text-decoration: none; overflow-wrap: anywhere; padding-block: 11px; }
  h2 a:hover { text-decoration: underline; }
  .head form { margin: 0; }
  .block { display: grid; gap: var(--space-xs); }
  .label { display: flex; align-items: center; gap: var(--space-xs); flex-wrap: wrap; margin: 0; color: var(--color-text-secondary); }
  .roles { display: flex; align-items: center; justify-content: space-between; gap: var(--space-md); padding: var(--space-sm) var(--space-md); background: var(--color-bg-brand-subtle); border-radius: var(--radius-md); }
  .roles p { margin: 0; }
  .roles.none { background: var(--color-bg-page); }
  .foot { display: flex; gap: var(--space-xs); align-items: center; margin: 0; }
  .foot a { text-decoration: none; display: inline-flex; align-items: center; gap: 2px; }
  .foot a:hover { text-decoration: underline; }
</style>
