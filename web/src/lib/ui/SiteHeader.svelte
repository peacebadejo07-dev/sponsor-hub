<script lang="ts">
  import { page } from '$app/state';
  import { afterNavigate } from '$app/navigation';
  import Logo from './Logo.svelte';
  import Icon from './Icon.svelte';
  import { initials } from './OrgLogo.svelte';

  /** Figma › Site header (desktop) and Site header · mobile. */
  let { user }: { user: { email: string } | null } = $props();
  const here = $derived(page.url.pathname);
  const LINKS = [
    { href: '/', label: 'Organisations', on: (p: string) => p === '/' || p.startsWith('/org/') },
    { href: '/opportunities', label: 'Opportunities', on: (p: string) => p.startsWith('/opportunities') },
    { href: '/for-you', label: 'For you', on: (p: string) => p.startsWith('/for-you') },
    { href: '/saved', label: 'Saved', on: (p: string) => p.startsWith('/saved') },
    { href: '/today', label: 'Today', on: (p: string) => p.startsWith('/today') }
  ];
  let open = $state(false);
  afterNavigate(() => (open = false));
  const signIn = $derived(`/login?next=${encodeURIComponent(here)}`);
</script>

<header class="site-header">
  <div class="bar">
    <div class="left">
      <a class="home" href="/" aria-label="Sponsor Hub home"><Logo height={28} /></a>
      <nav class="nav" aria-label="Sections">
        {#each LINKS as l (l.href)}<a href={l.href} aria-current={l.on(here) ? 'page' : undefined}>{l.label}</a>{/each}
      </nav>
    </div>
    <div class="right">
      {#if user}
        <a class="me" href="/profile" aria-current={here.startsWith('/profile') ? 'page' : undefined}>
          <span class="me-label">Profile</span><span class="org-logo org-logo-sm" aria-hidden="true">{initials(user.email.split('@')[0].replace(/[._-]+/g, ' '))}</span>
        </a>
      {:else}
        <a class="btn btn-primary signin" href={signIn}>Sign in</a>
      {/if}
      <button class="btn btn-secondary btn-sm menu" type="button" aria-expanded={open} aria-controls="mobile-nav" onclick={() => (open = !open)}>
        <Icon name={open ? 'x' : 'menu'} size={16} />Menu
      </button>
    </div>
  </div>
  {#if open}
    <nav id="mobile-nav" class="mobile-nav" aria-label="Sections">
      {#each LINKS as l (l.href)}<a href={l.href} aria-current={l.on(here) ? 'page' : undefined}>{l.label}</a>{/each}
      {#if user}
        <a href="/profile" aria-current={here.startsWith('/profile') ? 'page' : undefined}>Your profile</a>
        <form method="POST" action="/logout"><button type="submit" class="btn btn-secondary btn-block">Sign out</button></form>
      {/if}
    </nav>
  {/if}
</header>

<style>
  .site-header { background: var(--color-bg-surface); border-bottom: 1px solid var(--color-border-subtle); position: sticky; top: 0; z-index: 10; }
  .bar { max-width: var(--layout-content-max); margin: 0 auto; padding: var(--space-xs) var(--space-md); min-height: 72px; display: flex; align-items: center; justify-content: space-between; gap: var(--space-md); }
  .left { display: flex; align-items: center; gap: var(--space-xl); min-width: 0; }
  .home { display: block; border-radius: var(--radius-sm); }
  .nav { display: flex; gap: var(--space-2xs); }
  .nav a, .mobile-nav a { display: inline-flex; align-items: center; min-height: var(--size-control-sm); padding: 0 var(--space-sm); border-radius: var(--radius-full); text-decoration: none; white-space: nowrap; font-size: var(--font-size-label); line-height: var(--line-height-label); font-weight: var(--font-weight-medium); color: var(--color-text-secondary); }
  .nav a:hover, .mobile-nav a:hover { color: var(--color-text-primary); background: var(--color-bg-muted); }
  .nav a[aria-current='page'], .mobile-nav a[aria-current='page'] { background: var(--color-bg-brand-subtle); color: var(--color-text-link); font-weight: var(--font-weight-semibold); }
  .right { display: flex; align-items: center; gap: var(--space-sm); flex: none; }
  .me { display: inline-flex; align-items: center; gap: var(--space-xs); min-height: var(--size-touch-target); text-decoration: none; color: var(--color-text-secondary); font-size: var(--font-size-label); font-weight: var(--font-weight-medium); border-radius: var(--radius-full); }
  .me:hover .me-label, .me[aria-current='page'] .me-label { color: var(--color-text-primary); }
  .menu { display: none; }
  .mobile-nav { display: grid; gap: var(--space-2xs); padding: var(--space-xs) var(--space-md) var(--space-md); border-top: 1px solid var(--color-border-subtle); }
  .mobile-nav a { min-height: var(--size-touch-target); font-size: var(--font-size-body); }
  .mobile-nav form { margin: var(--space-xs) 0 0; }
  @media (max-width: 900px) {
    .nav { display: none; }
    .menu { display: inline-flex; }
    .bar { min-height: 64px; }
    .signin { min-height: var(--size-control-sm); padding: 0 var(--space-md); font-size: var(--font-size-label-sm); }
    .me-label { display: none; }
  }
  @media (max-width: 400px) {
    .home :global(.logo) { height: 24px; width: auto; }
    .right { gap: var(--space-xs); }
  }
  @media (min-width: 901px) { .mobile-nav { display: none; } }
</style>
