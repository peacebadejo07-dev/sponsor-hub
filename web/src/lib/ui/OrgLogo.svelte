<script lang="ts" module>
  const SKIP = new Set(['ltd', 'limited', 'plc', 'llp', 'the', 'uk', 'group', 'and', '&', 'of', 'inc', 'co']);
  /** Two initials from an organisation name, ignoring words like "Ltd" and "The". */
  export function initials(name: string): string {
    const words = name.replace(/[^\p{L}\p{N}& ]/gu, ' ').split(/\s+/).filter((w) => w && !SKIP.has(w.toLowerCase()));
    const w = words.length ? words : name.split(/\s+/).filter(Boolean);
    return ((w[0]?.[0] ?? '') + (w[1]?.[0] ?? w[0]?.[1] ?? '')).toUpperCase();
  }
</script>

<script lang="ts">
  /** Figma › Org logo (Initials). Decorative: the organisation name is always shown next to it. */
  let { name, size = 'md' }: { name: string; size?: 'sm' | 'md' | 'lg' } = $props();
</script>

<span class="org-logo" class:org-logo-sm={size === 'sm'} class:org-logo-lg={size === 'lg'} aria-hidden="true">{initials(name)}</span>
