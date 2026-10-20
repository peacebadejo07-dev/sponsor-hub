<script lang="ts">
  import BlurBg from '$lib/ui/BlurBg.svelte';
  import { page } from '$app/state';
  const notFound = $derived(page.status === 404);
</script>

<svelte:head><title>{notFound ? 'Page not found' : 'Something went wrong'} · Sponsor Hub</title><meta name="robots" content="noindex" /></svelte:head>

<div class="stage blur-bg"><BlurBg preset="notFound" />
  <p class="t-overline t-muted code">Error {page.status}</p>
  <section class="box card" aria-labelledby="err-h">
    <span class="tile" aria-hidden="true">
      <svg width="28" height="28" viewBox="0 0 20 20" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round"><path d="M10 1.667a8.333 8.333 0 1 0 0 16.666 8.333 8.333 0 0 0 0-16.666Z" /><path d="M7.583 7.5a2.5 2.5 0 0 1 4.834.833c0 1.667-2.417 2.084-2.417 3.334" /><path d="M10 14.583h.008" /></svg>
    </span>
    {#if notFound}
      <h1 id="err-h" class="t-heading-3">We can't find that page</h1>
      <p class="t-body t-secondary">The link may be out of date, or the organisation may have left the sponsor register. Try searching for roles or organisations instead.</p>
    {:else}
      <h1 id="err-h" class="t-heading-3">Something went wrong</h1>
      <p class="t-body t-secondary">That's on us, not you. Try again in a moment. If it keeps happening, please report it.</p>
    {/if}
    <div class="actions">
      <a class="btn btn-primary" href="/">Browse opportunities</a>
      <a class="btn btn-secondary" href="/organisations">Search organisations</a>
    </div>
  </section>
</div>

<style>
  .stage { --blur-clip-top: calc(-1 * var(--page-pad-start, 0px)); display: grid; justify-items: center; gap: var(--space-md); /* Figma: 137px from the top of main to the label, and from the card to the footer */ padding: calc(137px - var(--page-pad-start, 0px)) 0 calc(137px + var(--page-pad-end, 0px)); margin-bottom: calc(-1 * var(--page-pad-end, 0px)); }
  .code { margin: 0; }
  .box { display: grid; justify-items: center; text-align: center; gap: var(--space-lg); width: min(100%, 640px); padding: var(--space-3xl) var(--space-xl); }
  .box p { margin: 0; max-width: 480px; }
  .tile { display: grid; place-items: center; width: 56px; height: 56px; border-radius: 16px; background: var(--color-bg-surface); border: 1px solid var(--color-border-subtle); box-shadow: var(--shadow-sm); color: var(--color-text-link); }
  .actions { display: flex; flex-wrap: wrap; justify-content: center; gap: var(--space-sm); }
  @media (max-width: 640px) { .stage { padding-top: calc(64px - var(--page-pad-start, 0px)); padding-bottom: calc(312px + var(--page-pad-end, 0px)); } .box { padding: var(--space-xl) var(--space-lg); } }
</style>
