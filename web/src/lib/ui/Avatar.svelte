<script lang="ts" module>
  /** Two initials from a person's name or email local part ("ada.lovelace" → "AL"). */
  export function initials(name: string): string {
    const w = name.replace(/[._-]+/g, ' ').replace(/[^\p{L}\p{N} ]/gu, ' ').split(/\s+/).filter(Boolean);
    return ((w[0]?.[0] ?? '') + (w[1]?.[0] ?? w[0]?.[1] ?? '')).toUpperCase();
  }
</script>

<script lang="ts">
  /** Figma › Avatar: a person, shown by initials. Decorative; the name or "Profile" sits beside it. */
  let { name }: { name: string } = $props();
</script>

<span class="avatar" aria-hidden="true">{initials(name)}</span>

<style>
  .avatar {
    display: inline-grid; place-items: center; flex: none; width: 32px; height: 32px; border-radius: 50%;
    background: var(--color-bg-brand-subtle); border: 1px solid var(--color-border-subtle);
    color: var(--color-text-link); font-size: 12px; line-height: 1; font-weight: var(--font-weight-semibold); letter-spacing: 0.02em;
  }
</style>
