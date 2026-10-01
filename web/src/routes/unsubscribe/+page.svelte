<script lang="ts">
  let { data, form } = $props();
</script>

<svelte:head><title>Weekly email · Sponsor Hub</title><meta name="robots" content="noindex" /></svelte:head>

<div class="box">
  {#if form?.done}
    <h1>You're unsubscribed</h1>
    <p>We won't send you the weekly email any more. You can turn it back on any time in <a href="/profile">your profile</a>.</p>
  {:else if !data.valid || form?.done === false}
    <h1>This link can't be used</h1>
    <p>It may be incomplete. You can turn the weekly email off from <a href="/profile">your profile</a> after signing in.</p>
  {:else}
    <h1>Stop the weekly email?</h1>
    <p>You'll stop getting the weekly list of new roles that fit you.</p>
    <form method="POST"><input type="hidden" name="token" value={data.token} /><button type="submit" class="primary">Turn it off</button></form>
  {/if}
</div>

<style>
  .box { max-width: 440px; margin: 32px auto; background: var(--surface); border: 1px solid var(--line); border-radius: var(--radius); padding: 24px; }
  h1 { margin: 0 0 8px; font-size: 24px; }
  a { color: var(--accent); }
  .primary { background: var(--accent); color: var(--accent-ink); border: 0; border-radius: 8px; padding: 11px 20px; font-weight: 600; cursor: pointer; }
</style>
