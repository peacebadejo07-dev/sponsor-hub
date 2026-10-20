<script lang="ts">
  const REPO = 'https://github.com/peacebadejo07-dev/sponsor-hub';
</script>

<footer class="auth-footer">
  <span>Sponsor Hub · Free and open source</span>
  <nav aria-label="Footer"><a href="/privacy">Privacy</a><a href={REPO} rel="noopener">Source code</a><a href={`${REPO}/issues/new`} rel="noopener">Report a problem</a></nav>
</footer>

<style>
  .auth-footer { display: flex; justify-content: space-between; align-items: center; gap: var(--space-sm) var(--space-lg); flex-wrap: wrap; padding: var(--space-lg) max(var(--layout-gutter), calc((100% - var(--layout-content-max)) / 2)); border-top: 1px solid var(--color-border-subtle); background: var(--color-bg-surface); font-size: var(--font-size-body-sm); color: var(--color-text-secondary); position: relative; z-index: 2; }
  nav { display: flex; gap: var(--space-lg); flex-wrap: wrap; }
  a { color: inherit; text-decoration: none; }
  a:hover { color: var(--color-text-primary); text-decoration: underline; }
</style>
