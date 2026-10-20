<script lang="ts">
  import './layout.css';
  import { page } from '$app/state';
  import SiteHeader from '$lib/ui/SiteHeader.svelte';
  import SiteFooter from '$lib/ui/SiteFooter.svelte';
  import AuthHeader from '$lib/ui/AuthHeader.svelte';
  import AuthFooter from '$lib/ui/AuthFooter.svelte';
  let { children, data } = $props();
  // Sign-in screens use the stripped-back header and footer from Figma.
  const auth = $derived(page.url.pathname === '/login' || page.url.pathname.startsWith('/auth/'));
</script>

<svelte:head>
  <title>Sponsor Hub: tech jobs at UK visa sponsors</title>
  <meta name="description" content="Tech jobs at UK employers licensed to sponsor visas, checked daily, with what each advert says about sponsorship. Plus every organisation on the Home Office sponsor register." />
  <link rel="icon" href="/favicon.svg" type="image/svg+xml" />
</svelte:head>

<a class="skip" href="#main">Skip to content</a>
{#if auth}
  <div class="auth-shell">
    <AuthHeader />
    <main id="main" class="auth-main">{@render children()}</main>
    <AuthFooter />
  </div>
{:else}
  <SiteHeader user={data.user} />
  <main id="main" class="page">{@render children()}</main>
  <SiteFooter />
{/if}

<style>
  .skip { position: absolute; left: var(--space-md); top: -100px; z-index: 100; background: var(--color-bg-surface); padding: var(--space-xs) var(--space-md); border-radius: var(--radius-md); box-shadow: var(--shadow-md); }
  .skip:focus { top: var(--space-md); }
  .page { --page-pad-end: var(--space-4xl); max-width: var(--layout-page-max); margin: 0 auto; padding: var(--space-2xl) var(--layout-gutter) var(--page-pad-end); min-height: 70vh; }
  .auth-shell { min-height: 100vh; display: flex; flex-direction: column; }
  .auth-main { flex: 1; display: flex; flex-direction: column; }
  @media (max-width: 640px) { .page { --page-pad-end: var(--space-2xl); padding-top: var(--space-lg); } }
</style>
