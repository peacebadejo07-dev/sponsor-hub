<script lang="ts">
  import OppCard from '$lib/OppCard.svelte';
  import Icon from '$lib/ui/Icon.svelte';
  import EmptyState from '$lib/ui/EmptyState.svelte';
  import OrgLogo from '$lib/ui/OrgLogo.svelte';
  let { data } = $props();
  type Row = (typeof data.saved)[number];
  const day = (d: string | null) => (d ? new Date(d).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' }) : null);
  const recent = (d: string | null) => !!d && Date.now() - new Date(d).getTime() < 14 * 86_400_000;
  function flagFor(o: Row) {
    if (o.status === 'expired') return { kind: 'closed' as const, title: 'No longer listed', text: `The employer took this advert down${o.expired_at ? ` around ${day(o.expired_at)}` : ''}. We keep it here so you don't lose track.` };
    if (recent(o.changed_at)) return { kind: 'updated' as const, title: 'Updated by the employer', text: `The advert changed on ${day(o.changed_at)}. Check the sponsorship wording again.` };
    return null;
  }
  const nothing = $derived(!data.saved.length && !data.applied.length);
</script>

<svelte:head><title>Saved · Sponsor Hub</title><meta name="robots" content="noindex" /></svelte:head>

<header class="page-head">
  <h1 class="t-heading-1">Saved</h1>
  <p class="t-body-lg t-secondary">Roles you're keeping an eye on and organisations you follow. We flag anything that changes or closes.</p>
</header>

<div class="columns">
  <div class="roles">
    {#if nothing}
      <EmptyState icon="bookmark" title="Nothing saved yet" body="Use Save on any role in Opportunities or For you and it'll appear here. We'll flag it if the employer changes the advert or takes it down.">
        <a class="btn btn-primary" href="/opportunities">Browse opportunities</a>
        <a class="btn btn-secondary" href="/for-you">See roles for you</a>
      </EmptyState>
    {:else}
      {#if data.saved.length}
        <section aria-labelledby="saved-h" class="group">
          <h2 id="saved-h" class="t-heading-4">Roles you saved <span class="n">{data.saved.length}</span></h2>
          <ul class="list">{#each data.saved as o (o.id)}<OppCard o={o as never} loggedIn={true} mark={o.mark} returnTo="/saved" flag={flagFor(o)} headingLevel={3} />{/each}</ul>
        </section>
      {/if}
      {#if data.applied.length}
        <section aria-labelledby="applied-h" class="group">
          <h2 id="applied-h" class="t-heading-4">Applied <span class="n">{data.applied.length}</span></h2>
          <ul class="list">{#each data.applied as o (o.id)}<OppCard o={o as never} loggedIn={true} mark={o.mark} returnTo="/saved" flag={flagFor(o) ?? { kind: 'applied', title: 'You marked this as applied' }} headingLevel={3} />{/each}</ul>
        </section>
      {/if}
    {/if}
    {#if data.dismissed.length}
      <details class="hidden">
        <summary><span class="t-label">Roles you hid ({data.dismissed.length})</span><Icon name="chevron-down" size={16} class="chev" /></summary>
        <ul class="list">{#each data.dismissed as o (o.id)}<OppCard o={o as never} loggedIn={true} mark={o.mark} returnTo="/saved" headingLevel={3} />{/each}</ul>
      </details>
    {/if}
  </div>

  <aside class="aside" aria-labelledby="follow-h">
    <section class="card follow">
      <h2 id="follow-h" class="t-heading-4">Organisations you follow <span class="n">{data.orgs.length}</span></h2>
      {#if data.orgs.length}
        <ul class="orgs">
          {#each data.orgs as o (o.id)}
            <li>
              <OrgLogo name={o.name} size="sm" />
              <span class="org">
                <a class="t-body-strong t-link" href={`/org/${o.id}`}>{o.name.trim()}</a>
                <span class="meta">
                  <span class="t-body-sm t-secondary">{[o.town, o.county].filter(Boolean)[0] ?? ''}</span>
                  {#if o.live > 0}<a class="tag tag-brand" href={`/org/${o.id}`}>{o.live} live role{o.live === 1 ? '' : 's'}</a>{:else}<span class="tag">No live roles found</span>{/if}
                </span>
              </span>
              <form method="POST" action="/api/save-org">
                <input type="hidden" name="org_id" value={o.id} /><input type="hidden" name="saved" value="0" /><input type="hidden" name="return" value="/saved" />
                <button type="submit" class="btn btn-ghost btn-sm" aria-label={`Unfollow ${o.name.trim()}`}>Unfollow</button>
              </form>
            </li>
          {/each}
        </ul>
        <p class="t-caption t-muted">We'll show new roles from these organisations on Today, and in your weekly email if it's on.</p>
      {:else}
        <p class="t-body-sm t-secondary">You're not following any organisations yet. Open one from <a class="t-link" href="/">Organisations</a> and choose Follow to see its new roles here and on Today.</p>
      {/if}
    </section>
  </aside>
</div>

<style>
  .page-head { display: grid; gap: var(--space-xs); margin-bottom: var(--space-xl); }
  .page-head p { margin: 0; max-width: 760px; }
  .columns { display: grid; grid-template-columns: minmax(0, 1fr) 380px; gap: var(--space-xl); align-items: start; }
  .roles { display: grid; gap: var(--space-xl); min-width: 0; }
  .group { display: grid; gap: var(--space-md); }
  .n { color: var(--color-text-muted); font-weight: var(--font-weight-regular); }
  .list { list-style: none; margin: 0; padding: 0; display: grid; gap: var(--space-md); }
  .hidden summary { list-style: none; display: flex; align-items: center; justify-content: space-between; min-height: var(--size-touch-target); padding: 0 var(--space-lg); background: var(--color-bg-page); border-radius: var(--radius-md); cursor: pointer; color: var(--color-text-secondary); }
  .hidden summary::-webkit-details-marker { display: none; }
  .hidden[open] summary { margin-bottom: var(--space-md); }
  .hidden[open] :global(.chev) { rotate: 180deg; }
  .aside { position: sticky; top: 96px; }
  .follow { display: grid; gap: var(--space-sm); padding: var(--space-lg); }
  .follow p { margin: 0; }
  .orgs { list-style: none; margin: 0; padding: 0; }
  .orgs li { display: flex; align-items: center; gap: var(--space-sm); padding: 14px 0; }
  .orgs li + li { border-top: 1px solid var(--color-border-subtle); }
  .org { display: grid; gap: 4px; flex: 1; min-width: 0; }
  .org > a { overflow-wrap: anywhere; text-decoration: none; }
  .org > a:hover { text-decoration: underline; }
  .meta { display: flex; flex-wrap: wrap; align-items: center; gap: 6px; }
  .meta .tag { text-decoration: none; }
  .orgs form { margin: 0; }
  @media (max-width: 1023px) {
    .columns { grid-template-columns: minmax(0, 1fr); }
    .aside { position: static; }
  }
</style>
