<script lang="ts">
  import './layout.css';
  import { page } from '$app/state';
  let { children, data } = $props();
  const here = $derived(page.url.pathname);
</script>

<svelte:head>
  <title>Sponsor Hub: UK visa-sponsoring employers and tech roles</title>
  <meta
    name="description"
    content="Explore UK organisations licensed to sponsor workers, filtered by sector, location, route and rating."
  />
</svelte:head>

<header class="top">
  <div class="wrap bar">
    <a class="brand" href="/">Sponsor Hub<span>.</span></a>
    <nav aria-label="Sections">
      <a href="/" aria-current={here === '/' || here.startsWith('/org/') ? 'page' : undefined}>Organisations</a>
      <a href="/opportunities" aria-current={here.startsWith('/opportunities') ? 'page' : undefined}>Opportunities</a>
      <a href="/for-you" aria-current={here.startsWith('/for-you') ? 'page' : undefined}>For you</a>
      <a href="/saved" aria-current={here.startsWith('/saved') ? 'page' : undefined}>Saved</a>
      <a href="/today" aria-current={here.startsWith('/today') ? 'page' : undefined}>Today</a>
    </nav>
    <div class="acct">
      {#if data.user}
        <a href="/profile" class="me" title="Your profile" aria-current={here.startsWith('/profile') ? 'page' : undefined}>{data.user.email}</a>
        <form method="POST" action="/logout"><button type="submit">Sign out</button></form>
      {:else}
        <a href={`/login?next=${encodeURIComponent(here)}`} class="signin">Sign in</a>
      {/if}
    </div>
  </div>
</header>

<main class="wrap">{@render children()}</main>

<footer class="wrap foot">
  Organisation data: Home Office register of licensed sponsors, published on GOV.UK under the
  <a href="https://www.nationalarchives.gov.uk/doc/open-government-licence/version/3/">Open Government Licence v3.0</a>.
  Being on the register does not mean any particular role is sponsored. <a href="/status">Scan status</a> · <a href="/privacy">Privacy</a>
</footer>

<style>
  .wrap { max-width: 1120px; margin: 0 auto; padding: 0 16px; }
  .top { background: var(--surface); border-bottom: 1px solid var(--line); position: sticky; top: 0; z-index: 5; }
  .bar { display: flex; align-items: center; justify-content: space-between; gap: 16px; height: 56px; }
  .acct { display: flex; align-items: center; gap: 10px; font-size: 14px; white-space: nowrap; }
  .acct form { margin: 0; }
  .acct button { background: none; border: 1px solid var(--line); border-radius: 8px; padding: 4px 10px; cursor: pointer; font-size: 13px; }
  .me { max-width: 180px; overflow: hidden; text-overflow: ellipsis; text-decoration: none; color: var(--muted); }
  .signin { background: var(--accent); color: var(--accent-ink); text-decoration: none; font-weight: 600; padding: 6px 14px; border-radius: 8px; }
  .brand { white-space: nowrap; font-weight: 700; font-size: 18px; text-decoration: none; letter-spacing: -0.01em; }
  .brand span { color: var(--accent); }
  nav { display: flex; gap: 4px; overflow-x: auto; }
  nav a { padding: 6px 12px; border-radius: 8px; text-decoration: none; white-space: nowrap; font-size: 14px; }
  nav a[aria-current='page'] { background: var(--accent-soft); color: var(--accent); font-weight: 600; }
  @media (max-width: 560px) {
    .bar { height: auto; padding-top: 8px; padding-bottom: 8px; flex-wrap: wrap; gap: 4px 16px; }
    nav { width: 100%; }
      .me { display: none; }
  }
  main { padding-top: 24px; padding-bottom: 40px; min-height: 70vh; }
  .foot { color: var(--muted); font-size: 13px; padding-bottom: 32px; }
</style>
