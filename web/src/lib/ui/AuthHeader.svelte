<script lang="ts">
  import Logo from './Logo.svelte';
  import Icon from './Icon.svelte';
  /** Figma › Sign in pages: logo left, "Browse without signing in" right. */
</script>

<header class="auth-header">
  <a class="home" href="/" aria-label="Sponsor Hub home"><Logo height={28} /></a>
  <a class="btn btn-secondary browse" href="/opportunities"><span class="long">Browse without signing in</span><span class="short">Browse roles</span><Icon name="arrow-right" size={16} /></a>
</header>

<style>
  .auth-header { display: flex; align-items: center; justify-content: space-between; gap: var(--space-md); padding: var(--space-md) max(var(--space-md), calc((100% - 1168px) / 2)); border-bottom: 1px solid var(--color-border-subtle); background: var(--color-bg-surface); position: relative; z-index: 2; }
  .home { border-radius: var(--radius-sm); }
  .short { display: none; }
  @media (max-width: 640px) {
    .long { display: none; }
    .short { display: inline; }
    .browse { min-height: var(--size-control-sm); padding: 0 var(--space-md); font-size: var(--font-size-label-sm); }
    .browse :global(.icon) { display: none; }
    .home :global(.logo) { height: 24px; width: auto; }
  }
</style>
