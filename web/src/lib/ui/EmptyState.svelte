<script lang="ts">
  import type { Snippet } from 'svelte';
  import Icon, { type IconName } from './Icon.svelte';
  /** Figma › Empty state. Pass buttons/links as children. */
  let { icon = 'search', title, body, headingLevel = 2, children }: { icon?: IconName; title: string; body?: string; headingLevel?: 2 | 3; children?: Snippet } = $props();
</script>

<section class="empty card">
  <span class="tile"><Icon name={icon} size={28} /></span>
  <svelte:element this={`h${headingLevel}`} class="t-heading-3">{title}</svelte:element>
  {#if body}<p class="t-body t-secondary">{body}</p>{/if}
  {#if children}<div class="actions">{@render children()}</div>{/if}
</section>

<style>
  .empty { display: grid; justify-items: center; gap: var(--space-lg); text-align: center; padding: var(--space-3xl) var(--space-xl); }
  .tile { display: grid; place-items: center; width: 56px; height: 56px; border-radius: 16px; background: var(--color-bg-surface); border: 1px solid var(--color-border-subtle); box-shadow: var(--shadow-sm); color: var(--color-text-link); }
  p { margin: calc(-1 * var(--space-md)) 0 0; max-width: 480px; }
  .actions { display: flex; flex-wrap: wrap; justify-content: center; gap: var(--space-sm); }
  @media (max-width: 640px) { .empty { padding: var(--space-xl) var(--space-lg); } }
</style>
