<script lang="ts">
  import { ROLE_LABELS, type RoleFamily } from '@sponsored/core';
  import { WORK_LABELS, LEVEL_LABELS } from '$lib/labels';
  import OppCard from '$lib/OppCard.svelte';
  import Icon from '$lib/ui/Icon.svelte';
  import EmptyState from '$lib/ui/EmptyState.svelte';
  let { data } = $props();
  const p = $derived(data.profile);
  const returnTo = $derived(`/for-you${data.page > 1 ? `?page=${data.page}` : ''}`);
  const fmt = (n: number) => n.toLocaleString('en-GB');
  const SPONSOR_NEED: Record<string, string> = { yes: 'Needs sponsorship', unsure: 'Not sure about sponsorship', no: "Doesn't need sponsorship" };
  const groups = $derived(
    [
      ['Work', p.roles.map((r: string) => ROLE_LABELS[r as RoleFamily])],
      ['Places', [...p.locations, ...p.workModes.map((m: string) => WORK_LABELS[m])]],
      ['You', [p.level ? LEVEL_LABELS[p.level] : null, p.yearsExperience != null ? `${p.yearsExperience} years` : null, p.minSalary ? `From £${p.minSalary.toLocaleString('en-GB')}` : null, ...p.skills.slice(0, 6)].filter(Boolean)],
      ['Visa', p.needsSponsorship ? [SPONSOR_NEED[p.needsSponsorship]] : []]
    ].filter(([, v]) => (v as string[]).length) as [string, string[]][]
  );
</script>

<svelte:head><title>For you · Sponsor Hub</title><meta name="robots" content="noindex" /></svelte:head>

{#snippet howItWorks()}
  <section class="card side" aria-labelledby="how-h">
    <h2 id="how-h" class="t-heading-4">How the ranking works</h2>
    <p class="t-body-sm t-secondary">Each role gets points for what fits you and loses points for what doesn't. We always show the reasons, so you can judge for yourself.</p>
    <ul class="legend">
      <li><span class="for"><Icon name="check-circle" size={16} /></span>Counts in its favour</li>
      <li><span class="against"><Icon name="x-circle" size={16} /></span>Counts against it</li>
      <li><span class="note"><Icon name="minus-circle" size={16} /></span>Noted, but doesn't change the score</li>
    </ul>
  </section>
{/snippet}

<header class="page-head">
  <h1 class="t-heading-1">Roles for you</h1>
  <p class="t-body-lg t-secondary">
    {#if data.hasPrefs}{fmt(data.total)} live role{data.total === 1 ? '' : 's'}, best fit first.{:else}Set your preferences and we'll rank every live role for you.{/if}
  </p>
</header>

{#if data.hasPrefs && data.hiddenCount > 0}
  <p class="note-bar t-body-sm t-secondary"><Icon name="info" size={16} /><span>{data.hiddenCount} role{data.hiddenCount === 1 ? ' is' : 's are'} hidden because the posting says it doesn't offer visa sponsorship. You can change this in <a class="t-link" href="/profile">your profile</a>.</span></p>
{/if}

<div class="columns">
  <section class="main" aria-label="Ranked roles">
    {#if !data.hasPrefs}
      <EmptyState icon="sparkle" title="Tell us what you're looking for" body="Until you do, every role scores the same. It takes a minute, and every answer is optional.">
        <a class="btn btn-primary" href="/profile">Set up your profile</a>
        <a class="btn btn-secondary" href="/">Browse all roles</a>
      </EmptyState>
    {:else if data.items.length === 0}
      <EmptyState icon="search" title="No roles to show yet" body="Nothing live matches what you've told us. Try widening your role types or places.">
        <a class="btn btn-primary" href="/profile">Edit your profile</a>
        <a class="btn btn-secondary" href="/">Browse all roles</a>
      </EmptyState>
    {:else}
      <ul class="list">{#each data.items as it (it.row.id)}<OppCard o={it.row as never} loggedIn={true} mark={it.mark} match={it.match} {returnTo} />{/each}</ul>
      {#if data.pages > 1}
        <nav class="pager" aria-label="Pagination">
          {#if data.page > 1}<a class="btn btn-secondary" href={`/for-you?page=${data.page - 1}`} rel="prev"><Icon name="arrow-left" size={16} />Previous</a>{:else}<span class="btn btn-secondary" aria-disabled="true">Previous</span>{/if}
          <span class="t-body-sm t-secondary">Page {data.page} of {data.pages}</span>
          {#if data.page < data.pages}<a class="btn btn-secondary" href={`/for-you?page=${data.page + 1}`} rel="next">Next<Icon name="arrow-right" size={16} /></a>{:else}<span class="btn btn-secondary" aria-disabled="true">Next</span>{/if}
        </nav>
      {/if}
      {#if data.capped}<p class="t-body-sm t-muted">Showing the best fits among the most recent roles.</p>{/if}
    {/if}
  </section>

  <aside class="aside" aria-label="Your profile">
    <section class="card side" aria-labelledby="prof-h">
      <h2 id="prof-h" class="t-heading-4">{data.hasPrefs ? 'Ranked using your profile' : 'Your profile'}</h2>
      {#if data.hasPrefs}
        {#each groups as [g, items] (g)}
          <div class="group"><h3 class="t-label-sm t-muted">{g}</h3><ul class="tags">{#each items as t (t)}<li class="tag">{t}</li>{/each}</ul></div>
        {/each}
        <a class="btn btn-secondary btn-block" href="/profile">Edit profile</a>
      {:else}
        <p class="t-body-sm t-secondary">Nothing set yet. Add role types, places and your level, and we'll rank roles and show why each one fits.</p>
      {/if}
    </section>
    {@render howItWorks()}
  </aside>
</div>

<style>
  .page-head { display: grid; gap: var(--space-xs); margin-bottom: var(--space-lg); }
  .page-head p { margin: 0; }
  .note-bar { display: flex; align-items: flex-start; gap: 10px; margin: 0 0 var(--space-lg); padding: var(--space-sm) var(--space-md); background: var(--color-bg-page); border-radius: var(--radius-md); }
  .note-bar :global(.icon) { color: var(--color-status-info-fg); margin-top: 3px; }
  .columns { display: grid; grid-template-columns: minmax(0, 1fr) 360px; gap: var(--space-xl); align-items: start; }
  .main { display: grid; gap: var(--space-md); min-width: 0; }
  .main > p { margin: 0; }
  .list { list-style: none; margin: 0; padding: 0; display: grid; gap: var(--space-md); }
  .pager { display: flex; justify-content: space-between; align-items: center; gap: var(--space-sm); }
  .aside { display: grid; gap: var(--space-lg); position: sticky; top: 96px; }
  .side { display: grid; gap: var(--space-md); padding: var(--space-lg); }
  .side p { margin: 0; }
  .group { display: grid; gap: 6px; }
  .group h3 { margin: 0; }
  .legend { list-style: none; margin: 0; padding: 0; display: grid; gap: var(--space-xs); font-size: var(--font-size-body-sm); color: var(--color-text-secondary); }
  .legend li { display: flex; align-items: center; gap: 10px; }
  .for { color: var(--color-icon-brand); display: inline-flex; }
  .against { color: var(--color-text-danger); display: inline-flex; }
  .note { color: var(--color-icon-secondary); display: inline-flex; }
  @media (max-width: 1023px) {
    .columns { grid-template-columns: minmax(0, 1fr); }
    .aside { position: static; order: -1; }
    .aside > :last-child { display: none; }
  }
</style>
