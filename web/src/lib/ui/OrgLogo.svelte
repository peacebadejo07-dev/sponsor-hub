<script lang="ts">
  import Icon from './Icon.svelte';
  /**
   * Figma › Org logo. Type=Logo shows the organisation's own logo; Type=Fallback
   * (no logo, or it fails to load) shows the grey building. Decorative: the
   * organisation name is always shown next to it.
   */
  let { src = null, size = 'md' }: { name?: string; src?: string | null; size?: 'sm' | 'md' | 'lg' } = $props();
  let failed = $state(false);
  const icon = $derived(size === 'sm' ? 16 : size === 'lg' ? 24 : 20);
</script>

<span class="org-logo" class:org-logo-sm={size === 'sm'} class:org-logo-lg={size === 'lg'} aria-hidden="true">
  {#if src && !failed}
    <img {src} alt="" loading="lazy" decoding="async" onerror={() => (failed = true)} />
  {:else}
    <span class="org-logo-fallback"><Icon name="building" size={icon} /></span>
  {/if}
</span>
