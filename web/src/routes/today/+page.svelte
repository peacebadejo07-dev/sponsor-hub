<script lang="ts">
  import OppCard from '$lib/OppCard.svelte';
  import { ago } from '$lib/labels';
  let { data } = $props();
  const s = $derived(data.summary);
  const fmt = (n: number) => n.toLocaleString('en-GB');
</script>

<svelte:head><title>Today · Sponsor Hub</title><meta name="description" content="What changed in UK tech roles at visa-sponsoring employers since yesterday's scan." /></svelte:head>

<div class="head">
  <h1>Today</h1>
  <p class="sub">
    {#if s.lastOk}Last scan finished {ago(s.lastOk.finished_at)}{:else}No scan has finished yet{/if}
    · <a href="/status">How the scan is doing</a>
  </p>
</div>

<div class="stats" role="list">
  <div role="listitem"><b>{fmt(s.fresh)}</b><span>new roles</span></div>
  <div role="listitem"><b>{fmt(s.updated)}</b><span>updated</span></div>
  <div role="listitem"><b>{fmt(s.closed)}</b><span>closed in the last 3 days</span></div>
  <div role="listitem"><b>{fmt(s.live)}</b><span>live from {fmt(s.employers)} employers</span></div>
</div>

{#if data.mine}
  <section>
    <h2>For you</h2>
    {#if data.mine.watch.length}
      <h3>Roles you saved that changed or closed</h3>
      <ul class="list">{#each data.mine.watch as o (o.id)}
        <div class="flag">{o.status === 'expired' ? 'No longer listed' : 'Updated by the employer'}</div>
        <OppCard {o} loggedIn={true} mark={data.marks[o.id] ?? o.mark} returnTo="/today" />
      {/each}</ul>
    {/if}
    {#if data.mine.followed.length}
      <h3>New at organisations you follow</h3>
      <ul class="list">{#each data.mine.followed as o (o.id)}<OppCard {o} loggedIn={true} mark={data.marks[o.id] ?? null} returnTo="/today" />{/each}</ul>
    {/if}
    {#if data.mine.hasPrefs}
      <h3>Best new matches</h3>
      {#if data.mine.top.length}
        <ul class="list">{#each data.mine.top as it (it.row.id)}<OppCard o={it.row} loggedIn={true} mark={data.marks[it.row.id] ?? null} match={it.match} returnTo="/today" />{/each}</ul>
      {:else}<p class="empty">Nothing new fits your preferences in the last three days. <a href="/for-you">See everything ranked for you</a>.</p>{/if}
    {:else}
      <p class="empty"><a href="/profile">Tell us what you're looking for</a> and the best new matches will appear here each morning.</p>
    {/if}
  </section>
{:else}
  <p class="cta"><a href="/login?next=/today">Sign in</a> to see new roles ranked for you, and changes to roles you've saved.</p>
{/if}

<section>
  <h2>New since yesterday <span class="n">{fmt(s.fresh)}</span></h2>
  {#if data.fresh.length}
    <ul class="list">{#each data.fresh as o (o.id)}<OppCard {o} loggedIn={data.loggedIn} mark={data.marks[o.id] ?? null} returnTo="/today" />{/each}</ul>
    {#if s.fresh > data.fresh.length}<p class="more"><a href="/opportunities?since=7">See all new roles</a></p>{/if}
  {:else}<p class="empty">No new roles were found in the latest scan.</p>{/if}
</section>

{#if data.updated.length}
  <section>
    <h2>Updated <span class="n">{fmt(s.updated)}</span></h2>
    <ul class="list">{#each data.updated as o (o.id)}<OppCard {o} loggedIn={data.loggedIn} mark={data.marks[o.id] ?? null} returnTo="/today" />{/each}</ul>
  </section>
{/if}

<style>
  .head { margin-bottom: 16px; }
  h1 { font-size: 24px; margin: 0 0 2px; letter-spacing: -0.015em; }
  .sub { margin: 0; color: var(--muted); }
  .sub a, .empty a, .more a, .cta a { color: var(--accent); }
  .stats { display: grid; grid-template-columns: repeat(auto-fit, minmax(150px, 1fr)); gap: 10px; margin-bottom: 24px; }
  .stats div { background: var(--surface); border: 1px solid var(--line); border-radius: var(--radius); padding: 12px 14px; display: grid; }
  .stats b { font-size: 22px; font-variant-numeric: tabular-nums; }
  .stats span { color: var(--muted); font-size: 13px; }
  section { margin-bottom: 28px; }
  h2 { font-size: 18px; margin: 0 0 10px; }
  h3 { font-size: 14px; margin: 16px 0 8px; color: var(--muted); font-weight: 600; }
  .n { color: var(--muted); font-weight: 400; font-size: 14px; }
  .list { padding: 0; margin: 0; display: grid; gap: 12px; }
  .flag { font-size: 12px; font-weight: 600; color: var(--inferred); margin-bottom: -6px; }
  .empty { color: var(--muted); background: var(--surface); border: 1px dashed var(--line); border-radius: var(--radius); padding: 16px; margin: 0; }
  .cta { background: var(--accent-soft); border-radius: var(--radius); padding: 12px 16px; margin: 0 0 24px; }
  .more { margin: 12px 0 0; }
</style>
