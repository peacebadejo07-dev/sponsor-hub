<script lang="ts">
  import OppCard from '$lib/OppCard.svelte';
  import { safeHref } from '$lib/safeHref';
  let { data } = $props();
</script>

<svelte:head><title>Saved · Sponsor Hub</title><meta name="robots" content="noindex" /></svelte:head>

<h1>Saved</h1>

<section>
  <h2>Roles you saved <span class="n">{data.saved.length}</span></h2>
  {#if data.saved.length}
    <ul class="list">{#each data.saved as o (o.id)}<OppCard o={o as never} loggedIn={true} mark={o.mark} returnTo="/saved" />{/each}</ul>
  {:else}<p class="empty">Nothing saved yet. Use <b>Save</b> on any role in <a href="/opportunities">Opportunities</a> or <a href="/for-you">For you</a>.</p>{/if}
</section>

{#if data.applied.length}
  <section><h2>Applied <span class="n">{data.applied.length}</span></h2>
    <ul class="list">{#each data.applied as o (o.id)}<OppCard o={o as never} loggedIn={true} mark={o.mark} returnTo="/saved" />{/each}</ul></section>
{/if}

<section>
  <h2>Organisations you follow <span class="n">{data.orgs.length}</span></h2>
  {#if data.orgs.length}
    <ul class="orgs">
      {#each data.orgs as o (o.id)}
        <li class="org">
          <div><a href={`/org/${o.id}`}><strong>{o.name.trim()}</strong></a><br /><span class="muted">{[o.town, o.county].filter(Boolean).join(', ')}</span></div>
          <div class="right">
            {#if o.live > 0}<a class="pill" href={`/opportunities?q=${encodeURIComponent(o.name.trim())}`}>{o.live} live role{o.live === 1 ? '' : 's'}</a>{:else}<span class="muted">No live roles found</span>{/if}
            {#if o.careers_url}<a href={safeHref(o.careers_url)} rel="noopener nofollow" target="_blank">Careers page ↗</a>{/if}
            <form method="POST" action="/api/save-org"><input type="hidden" name="org_id" value={o.id} /><input type="hidden" name="saved" value="0" /><input type="hidden" name="return" value="/saved" /><button type="submit">Unfollow</button></form>
          </div>
        </li>
      {/each}
    </ul>
  {:else}<p class="empty">You're not following any organisations. Open one from <a href="/">Organisations</a> and choose <b>Follow</b>.</p>{/if}
</section>

{#if data.dismissed.length}
  <details class="hidden"><summary>Roles you hid ({data.dismissed.length})</summary>
    <ul class="list">{#each data.dismissed as o (o.id)}<OppCard o={o as never} loggedIn={true} mark={o.mark} returnTo="/saved" />{/each}</ul></details>
{/if}

<style>
  h1 { font-size: 24px; margin: 0 0 16px; letter-spacing: -0.015em; }
  section { margin-bottom: 28px; }
  h2 { font-size: 17px; margin: 0 0 10px; }
  .n { color: var(--muted); font-weight: 400; font-size: 14px; }
  .list { padding: 0; margin: 0; display: grid; gap: 12px; }
  .empty { color: var(--muted); background: var(--surface); border: 1px dashed var(--line); border-radius: var(--radius); padding: 16px; margin: 0; }
  .empty a, .right a { color: var(--accent); }
  .orgs { list-style: none; margin: 0; padding: 0; display: grid; gap: 8px; }
  .org { background: var(--surface); border: 1px solid var(--line); border-radius: var(--radius); padding: 12px 16px; display: flex; justify-content: space-between; gap: 12px; flex-wrap: wrap; align-items: center; }
  .org a { text-decoration: none; } .org strong:hover { text-decoration: underline; }
  .muted { color: var(--muted); font-size: 13px; }
  .right { display: flex; gap: 12px; align-items: center; flex-wrap: wrap; font-size: 14px; }
  .right form { margin: 0; }
  .pill { background: var(--accent-soft); color: var(--accent); font-weight: 600; padding: 2px 10px; border-radius: 99px; }
  button { background: var(--bg); border: 1px solid var(--line); border-radius: 8px; padding: 5px 12px; font-size: 13px; cursor: pointer; }
  .hidden { margin-top: 8px; } .hidden summary { cursor: pointer; color: var(--muted); margin-bottom: 10px; }
</style>
