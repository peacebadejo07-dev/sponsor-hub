<script lang="ts">
  import BlurBg from '$lib/ui/BlurBg.svelte';
  import Icon from '$lib/ui/Icon.svelte';
  let { data, form } = $props();
  const broken = $derived(form?.failed || !data.token);
</script>

<svelte:head><title>Sign in · Sponsor Hub</title><meta name="robots" content="noindex" /></svelte:head>

<div class="stage blur-bg"><BlurBg />
  <section class="box card" aria-labelledby="verify-h">
    <span class="tile" aria-hidden="true"><Icon name={broken ? 'alert' : 'check-circle'} size={28} /></span>
    {#if broken}
      <h1 id="verify-h" class="t-heading-2">This link can't be used</h1>
      <p class="t-body t-secondary">It may have expired (links last 15 minutes) or already been used. Sign-in links work once.</p>
      <a href="/login" class="btn btn-primary">Get a new link</a>
    {:else}
      <h1 id="verify-h" class="t-heading-2">Finish signing in</h1>
      <p class="t-body t-secondary">This link will sign you in as <strong class="who">{data.maskedEmail}</strong>.</p>
      <p class="tip t-body-sm t-secondary"><Icon name="info" size={16} />Not your address? Don't continue: someone else may have sent you this link. Close this page.</p>
      <form method="POST"><input type="hidden" name="token" value={data.token} /><input type="hidden" name="next" value={data.next} /><button type="submit" class="btn btn-primary">Sign in</button></form>
    {/if}
  </section>
</div>

<style>
  .stage { flex: 1; display: grid; place-items: center; padding: var(--space-6xl) var(--space-md); --blur-w: 1500px; --blur-rotate: 93deg; --blur-x: 38%; --blur-y: 54%; }
  .box { display: grid; justify-items: center; text-align: center; gap: var(--space-lg); width: min(100%, 560px); padding: var(--space-3xl); }
  .box p { margin: 0; }
  .who { color: var(--color-text-primary); }
  .tile { display: grid; place-items: center; width: 56px; height: 56px; border-radius: 16px; background: var(--color-bg-surface); border: 1px solid var(--color-border-subtle); box-shadow: var(--shadow-sm); color: var(--color-text-link); }
  .tip { display: flex; gap: var(--space-xs); align-items: flex-start; text-align: left; padding: var(--space-sm) var(--space-md); border: 1px solid var(--color-border-soft); border-radius: var(--radius-md); }
  .tip :global(.icon) { margin-top: 3px; flex: none; }
  form { margin: 0; }
  @media (max-width: 640px) { .stage { place-items: start center; padding-top: var(--space-4xl); } .box { padding: var(--space-xl) var(--space-lg); } }
</style>
