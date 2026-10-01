<script lang="ts">
  import './layout.css';
  let { children } = $props();
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
      <a href="/" aria-current="page">Organisations</a>
      <span class="soon" title="Coming in a later milestone">Opportunities</span>
      <span class="soon" title="Coming in a later milestone">Saved</span>
      <span class="soon" title="Coming in a later milestone">Today</span>
    </nav>
  </div>
</header>

<main class="wrap">{@render children()}</main>

<footer class="wrap foot">
  Organisation data: Home Office register of licensed sponsors, published on GOV.UK under the
  <a href="https://www.nationalarchives.gov.uk/doc/open-government-licence/version/3/">Open Government Licence v3.0</a>.
  Being on the register does not mean any particular role is sponsored.
</footer>

<style>
  .wrap { max-width: 1120px; margin: 0 auto; padding: 0 16px; }
  .top { background: var(--surface); border-bottom: 1px solid var(--line); position: sticky; top: 0; z-index: 5; }
  .bar { display: flex; align-items: center; justify-content: space-between; gap: 16px; height: 56px; }
  .brand { white-space: nowrap; font-weight: 700; font-size: 18px; text-decoration: none; letter-spacing: -0.01em; }
  .brand span { color: var(--accent); }
  nav { display: flex; gap: 4px; overflow-x: auto; }
  nav a, nav .soon { padding: 6px 12px; border-radius: 8px; text-decoration: none; white-space: nowrap; font-size: 14px; }
  nav a[aria-current='page'] { background: var(--accent-soft); color: var(--accent); font-weight: 600; }
  nav .soon { color: var(--muted); opacity: 0.6; cursor: not-allowed; }
  @media (max-width: 560px) {
    .bar { height: auto; padding-top: 8px; padding-bottom: 8px; flex-wrap: wrap; gap: 4px 16px; }
    nav { width: 100%; }
    nav .soon { display: none; }
  }
  main { padding-top: 24px; padding-bottom: 40px; min-height: 70vh; }
  .foot { color: var(--muted); font-size: 13px; padding-bottom: 32px; }
</style>
