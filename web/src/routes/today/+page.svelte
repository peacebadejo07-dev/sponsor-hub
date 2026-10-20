<script lang="ts">
  import BlurBg from '$lib/ui/BlurBg.svelte';
  import OppCard from '$lib/OppCard.svelte';
  import Icon from '$lib/ui/Icon.svelte';
  import EmptyState from '$lib/ui/EmptyState.svelte';
  import { ago } from '$lib/labels';
  let { data } = $props();
  const s = $derived(data.summary);
  const fmt = (n: number) => n.toLocaleString('en-GB');
  const finished = $derived(s.lastOk ? new Date(s.lastOk.finished_at) : null);
  const time = (d: Date) => d.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' });
  const finishedLabel = $derived(finished ? `${Date.now() - finished.getTime() < 86_400_000 ? 'Today' : ago(finished.toISOString())} at ${time(finished)}` : 'Not yet');
  const day = (d: string | null) => (d ? new Date(d).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' }) : null);
  type Watch = NonNullable<typeof data.mine>['watch'][number];
  const watchFlag = (o: Watch) =>
    o.status === 'expired'
      ? { kind: 'closed' as const, title: 'No longer listed', text: `The employer took this advert down${o.expired_at ? ` around ${day(o.expired_at)}` : ''}.` }
      : { kind: 'updated' as const, title: 'Updated by the employer', text: o.changed_at ? `The advert changed on ${day(o.changed_at)}.` : undefined };
</script>

<svelte:head><title>Today · Sponsor Hub</title><meta name="description" content="What changed in UK tech roles at visa-sponsoring employers since yesterday's scan." /></svelte:head>

<header class="page-head">
  <h1 class="t-heading-1">Today</h1>
  <p class="t-body-lg t-secondary">What changed since yesterday's scan. {#if s.lastOk}Last scan finished {ago(s.lastOk.finished_at)}{:else}No scan has finished yet{/if} · <a class="t-link" href="/status">How the scan is doing</a></p>
</header>

<dl class="stats">
  <div class="card"><dt>new roles</dt><dd class="t-stat">{fmt(s.fresh)}</dd></div>
  <div class="card"><dt>updated</dt><dd class="t-stat">{fmt(s.updated)}</dd></div>
  <div class="card"><dt>closed in the last 3 days</dt><dd class="t-stat">{fmt(s.closed)}</dd></div>
  <div class="card"><dt>live from {fmt(s.employers)} employers</dt><dd class="t-stat">{fmt(s.live)}</dd></div>
</dl>

<div class="columns">
  <div class="feed">
    {#if data.mine}
      <section class="group" aria-labelledby="fy-h">
        <div class="section-head">
          <h2 id="fy-h" class="t-heading-3">For you</h2>
          <p class="t-body-sm t-secondary">Based on your saved roles, the organisations you follow and your profile.</p>
        </div>
        {#if data.mine.watch.length}
          <h3 class="t-label t-secondary">Roles you saved that changed or closed</h3>
          <ul class="list">{#each data.mine.watch as o (o.id)}<OppCard {o} loggedIn={true} mark={data.marks[o.id] ?? o.mark} returnTo="/today" flag={watchFlag(o)} headingLevel={4} />{/each}</ul>
        {/if}
        {#if data.mine.followed.length}
          <h3 class="t-label t-secondary">New at organisations you follow</h3>
          <ul class="list">{#each data.mine.followed as o (o.id)}<OppCard {o} loggedIn={true} mark={data.marks[o.id] ?? null} returnTo="/today" headingLevel={4} />{/each}</ul>
        {/if}
        <h3 class="t-label t-secondary">Best new matches</h3>
        {#if !data.mine.hasPrefs}
          <p class="quiet t-body-sm t-secondary"><a class="t-link" href="/profile">Tell us what you're looking for</a> and the best new matches will appear here each morning.</p>
        {:else if data.mine.top.length}
          <ul class="list">{#each data.mine.top as it (it.row.id)}<OppCard o={it.row} loggedIn={true} mark={data.marks[it.row.id] ?? null} match={it.match} returnTo="/today" headingLevel={4} />{/each}</ul>
        {:else}
          <p class="quiet t-body-sm t-secondary">Nothing new fits your preferences in the last three days. <a class="t-link" href="/for-you">See everything ranked for you</a>.</p>
        {/if}
      </section>
    {:else}
      <section class="prompt card blur-bg" aria-labelledby="prompt-h"><BlurBg />
        <h2 id="prompt-h" class="t-heading-4">See what changed for you</h2>
        <p class="t-body-sm t-secondary">Sign in to see new roles ranked for you, new roles at organisations you follow, and changes to roles you've saved.</p>
        <a class="btn btn-primary" href="/login?next=%2Ftoday">Sign in</a>
      </section>
    {/if}

    <section class="group" aria-labelledby="new-h">
      <h2 id="new-h" class="t-heading-3">New since yesterday <span class="n">{fmt(s.fresh)}</span></h2>
      {#if data.fresh.length}
        <ul class="list">{#each data.fresh as o (o.id)}<OppCard {o} loggedIn={data.loggedIn} mark={data.marks[o.id] ?? null} returnTo="/today" headingLevel={3} />{/each}</ul>
        {#if s.fresh > data.fresh.length}<a class="btn btn-secondary btn-block" href="/?since=7">See all {fmt(s.fresh)} new roles<Icon name="arrow-right" size={16} /></a>{/if}
      {:else}
        <EmptyState icon="search" headingLevel={3} title="No new roles in the latest scan" body="We check every job board daily. New roles show up here the morning after they're posted." />
      {/if}
    </section>

    {#if data.updated.length}
      <section class="group" aria-labelledby="upd-h">
        <h2 id="upd-h" class="t-heading-3">Updated <span class="n">{fmt(s.updated)}</span></h2>
        <ul class="list">{#each data.updated as o (o.id)}<OppCard {o} loggedIn={data.loggedIn} mark={data.marks[o.id] ?? null} returnTo="/today" headingLevel={3} />{/each}</ul>
      </section>
    {/if}
  </div>

  <aside class="aside" aria-labelledby="scan-h">
    <section class="card side">
      <h2 id="scan-h" class="t-heading-4">About today's scan</h2>
      <dl class="facts">
        <div><dt>Finished</dt><dd>{finishedLabel}</dd></div>
        <div><dt>Live roles</dt><dd>{fmt(s.live)}</dd></div>
        <div><dt>Next scan</dt><dd>Tomorrow, early morning</dd></div>
      </dl>
      <p class="t-caption t-muted">“Closed” means the advert is no longer on the employer's job board. It may have been filled or withdrawn.</p>
      <a class="btn btn-secondary btn-block" href="/status">How the scan is doing</a>
    </section>
  </aside>
</div>

<style>
  .page-head { display: grid; gap: var(--space-xs); margin-bottom: var(--space-xl); }
  .page-head p { margin: 0; }
  .stats { display: grid; grid-template-columns: repeat(4, minmax(0, 1fr)); gap: var(--space-md); margin: 0 0 var(--space-xl); }
  .stats div { display: flex; flex-direction: column-reverse; justify-content: flex-end; gap: var(--space-2xs); padding: 20px; }
  .stats dt { font-size: var(--font-size-body-sm); line-height: var(--line-height-body-sm); color: var(--color-text-secondary); }
  .stats dd { margin: 0; }
  .columns { display: grid; grid-template-columns: minmax(0, 1fr) 360px; gap: var(--space-xl); align-items: start; }
  .feed { display: grid; gap: var(--space-2xl); min-width: 0; }
  .group { display: grid; gap: var(--space-md); }
  .section-head { display: grid; gap: 4px; }
  .section-head p, .group h3 { margin: 0; }
  .group h3 { margin-top: var(--space-xs); }
  .n { color: var(--color-text-muted); font-weight: var(--font-weight-regular); font-size: var(--font-size-body); }
  .list { list-style: none; margin: 0; padding: 0; display: grid; gap: var(--space-md); }
  .quiet { margin: 0; padding: var(--space-md); background: var(--color-bg-page); border-radius: var(--radius-md); }
  .prompt { display: grid; gap: var(--space-md); justify-items: start; padding: 28px; background: var(--color-bg-page); --blur-w: 1000px; --blur-x: 75%; --blur-y: 40%; --blur-opacity: 0.45; }
  .prompt p { margin: 0; max-width: 520px; }
  .aside { position: sticky; top: 96px; }
  .side { display: grid; gap: 14px; padding: var(--space-lg); }
  .side p { margin: 0; }
  .facts { margin: 0; display: grid; gap: 14px; }
  .facts div { display: flex; justify-content: space-between; gap: var(--space-sm); }
  .facts dt { font-size: var(--font-size-body-sm); color: var(--color-text-secondary); }
  .facts dd { margin: 0; font-weight: var(--font-weight-semibold); text-align: right; }
  @media (max-width: 1023px) {
    .columns { grid-template-columns: minmax(0, 1fr); }
    .aside { position: static; }
  }
  @media (max-width: 640px) {
    .stats { grid-template-columns: repeat(2, minmax(0, 1fr)); gap: var(--space-sm); }
    .stats div { padding: var(--space-md); }
    .prompt { padding: var(--space-lg) 20px; }
    .prompt .btn { width: 100%; }
  }
</style>
