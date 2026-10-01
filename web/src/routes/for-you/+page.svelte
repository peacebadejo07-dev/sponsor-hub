<script lang="ts">
  import OppCard from '$lib/OppCard.svelte';
  let { data } = $props();
  const returnTo = $derived(`/for-you${data.page > 1 ? `?page=${data.page}` : ''}`);
</script>

<svelte:head><title>For you · Sponsor Hub</title><meta name="robots" content="noindex" /></svelte:head>

<div class="head">
  <div>
    <h1>Roles for you</h1>
    <p class="sub">
      {#if data.hasPrefs}{data.total.toLocaleString('en-GB')} live role{data.total === 1 ? '' : 's'}, best fit first{:else}Set your preferences to rank roles for you{/if}
      · <a href="/profile">Edit profile</a>
    </p>
  </div>
</div>

{#if !data.hasPrefs}
  <div class="banner">
    <strong>You haven't told us what you're looking for yet.</strong>
    <p>Until you do, every role scores the same. It takes a minute, and every answer is optional.</p>
    <a class="primary" href="/profile">Set up your profile</a>
  </div>
{/if}

{#if data.hiddenCount > 0}
  <p class="note">{data.hiddenCount} role{data.hiddenCount === 1 ? ' is' : 's are'} hidden because the posting says it does not offer visa sponsorship. You can change this in <a href="/profile">your profile</a>.</p>
{/if}

{#if data.items.length === 0}
  <div class="empty"><strong>No roles to show yet.</strong><p>Try widening your role types or locations in <a href="/profile">your profile</a>, or browse <a href="/opportunities">all opportunities</a>.</p></div>
{:else}
  <ul class="list">{#each data.items as it (it.row.id)}<OppCard o={it.row as never} loggedIn={true} mark={it.mark} match={it.match} {returnTo} />{/each}</ul>
  {#if data.pages > 1}
    <nav class="pager" aria-label="Pagination">
      {#if data.page > 1}<a href={`/for-you?page=${data.page - 1}`} rel="prev">← Previous</a>{:else}<span></span>{/if}
      <span>Page {data.page} of {data.pages}</span>
      {#if data.page < data.pages}<a href={`/for-you?page=${data.page + 1}`} rel="next">Next →</a>{:else}<span></span>{/if}
    </nav>
  {/if}
  {#if data.capped}<p class="note">Showing the best fits among the most recent roles.</p>{/if}
{/if}

<style>
  .head { margin-bottom: 16px; }
  h1 { font-size: 24px; margin: 0 0 2px; letter-spacing: -0.015em; }
  .sub { margin: 0; color: var(--muted); }
  .sub a, .note a, .empty a { color: var(--accent); }
  .banner { background: var(--inferred-soft); border-radius: var(--radius); padding: 16px 18px; margin-bottom: 16px; }
  .banner p { margin: 4px 0 10px; }
  .primary { display: inline-block; background: var(--accent); color: var(--accent-ink); text-decoration: none; font-weight: 600; padding: 9px 18px; border-radius: 8px; }
  .note { color: var(--muted); font-size: 14px; }
  .list { padding: 0; margin: 0; display: grid; gap: 12px; }
  .empty { background: var(--surface); border: 1px dashed var(--line); border-radius: var(--radius); padding: 28px; text-align: center; color: var(--muted); }
  .empty strong { color: var(--ink); }
  .pager { display: flex; justify-content: space-between; align-items: center; margin-top: 18px; color: var(--muted); font-size: 14px; }
  .pager a { color: var(--accent); font-weight: 600; text-decoration: none; padding: 6px 4px; }
</style>
