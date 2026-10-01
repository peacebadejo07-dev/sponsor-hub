<script lang="ts">
  let { data, form } = $props();
</script>

<svelte:head><title>Sign in · Sponsor Hub</title><meta name="robots" content="noindex" /></svelte:head>

<div class="box">
  {#if form?.failed || !data.token}
    <h1>This link can't be used</h1>
    <p>It may have expired (they last 15 minutes) or already been used. Sign-in links work once.</p>
    <p><a href="/login" class="primary">Get a new link</a></p>
  {:else}
    <h1>Finish signing in</h1>
    <p>This link will sign you in as <strong class="who">{data.maskedEmail}</strong>.</p>
    <p class="fine">Not your address? Don't continue: someone else may have sent you this link. Close this page.</p>
    <form method="POST"><input type="hidden" name="token" value={data.token} /><input type="hidden" name="next" value={data.next} /><button type="submit" class="primary">Sign in</button></form>
  {/if}
</div>

<style>
  .box { max-width: 440px; margin: 32px auto; background: var(--surface); border: 1px solid var(--line); border-radius: var(--radius); padding: 24px; }
  h1 { margin: 0 0 8px; font-size: 24px; }
  .who { font-family: ui-monospace, monospace; }
  .fine { color: var(--muted); font-size: 13px; }
  .primary { display: inline-block; background: var(--accent); color: var(--accent-ink); border: 0; border-radius: 8px; padding: 11px 20px; font-weight: 600; cursor: pointer; text-decoration: none; }
</style>
