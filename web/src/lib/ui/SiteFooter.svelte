<script lang="ts">
  import Logo from './Logo.svelte';
  /** Figma › Site footer. Neutral links (not green), per the template's convention. */
  const REPO = 'https://github.com/peacebadejo07-dev/sponsor-hub';
  const COLS = [
    { title: 'Explore', links: [['/', 'Opportunities'], ['/organisations', 'Organisations'], ['/today', 'Today']] },
    { title: 'About', links: [['/status', 'Scan status'], ['/bot', 'About our crawler'], ['/privacy', 'Privacy']] },
    { title: 'Project', links: [[REPO, 'Source code on GitHub'], [`${REPO}/issues/new`, 'Report a problem']] }
  ];
</script>

<footer class="site-footer">
  <div class="inner">
    <div class="top">
      <div class="brand">
        <Logo height={28} />
        <p class="t-body-sm t-secondary">Free and open source. UK employers licensed to sponsor visas, and the tech roles they advertise.</p>
      </div>
      <div class="cols">
        {#each COLS as c (c.title)}
          <nav aria-label={c.title}>
            <h2 class="t-label">{c.title}</h2>
            <ul>{#each c.links as [href, label] (href)}<li><a {href} rel={href.startsWith('http') ? 'noopener' : undefined}>{label}</a></li>{/each}</ul>
          </nav>
        {/each}
      </div>
    </div>
    <hr class="divider" />
    <p class="t-caption t-muted legal">
      Organisation data: Home Office register of licensed sponsors,
      <a href="https://www.nationalarchives.gov.uk/doc/open-government-licence/version/3/">Open Government Licence v3.0</a>. Company data:
      Companies House. Being on the register does not mean any particular role is sponsored; check each job advert.
    </p>
  </div>
</footer>

<style>
  .site-footer { background: var(--color-bg-surface); border-top: 1px solid var(--color-border-subtle); padding: var(--space-3xl) 0; }
  .inner { max-width: var(--layout-page-max); margin: 0 auto; padding: 0 var(--layout-gutter); display: grid; gap: var(--space-lg); }
  .top { display: flex; justify-content: space-between; gap: var(--space-xl); flex-wrap: wrap; }
  .brand { display: grid; gap: var(--space-xs); max-width: 360px; align-content: start; }
  .brand p { margin: 0; }
  .cols { display: flex; gap: var(--space-3xl); flex-wrap: wrap; }
  h2 { margin: 0 0 var(--space-xs); font-size: var(--font-size-label); }
  ul { list-style: none; margin: 0; padding: 0; display: grid; gap: var(--space-xs); }
  a { color: var(--color-text-secondary); text-decoration: none; font-size: var(--font-size-body-sm); line-height: var(--line-height-body-sm); }
  a:hover { color: var(--color-text-primary); text-decoration: underline; }
  .legal { margin: 0; }
  .legal a { font-size: inherit; text-decoration: underline; color: inherit; }
  @media (max-width: 640px) {
    .site-footer { padding: var(--space-xl) 0; }
    .cols { display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); gap: var(--space-md); width: 100%; }
    /* 44px rows for thumbs */
    ul { gap: 0; }
    li a { display: inline-block; padding-block: 11px; }
  }
</style>
