<script lang="ts" module>
  /** Line icons from Figma › Components › Icons (20×20 grid, 1.75 stroke). Colour follows `currentColor`. */
  const CIRCLE = 'M10 1.667a8.333 8.333 0 1 0 0 16.666 8.333 8.333 0 0 0 0-16.666Z';
  export const ICONS = {
    check: ['M16.667 5 7.5 14.167 3.333 10'],
    x: ['M15 5 5 15', 'M5 5l10 10'],
    'check-circle': [CIRCLE, 'M7.083 10l2.084 2.083 3.75-4.166'],
    'x-circle': [CIRCLE, 'M12.5 7.5l-5 5', 'M7.5 7.5l5 5'],
    'minus-circle': [CIRCLE, 'M6.667 10h6.666'],
    help: [CIRCLE, 'M7.583 7.5a2.5 2.5 0 0 1 4.834.833c0 1.667-2.417 2.084-2.417 3.334', 'M10 14.583h.008'],
    info: [CIRCLE, 'M10 13.333V9.583', 'M10 6.667h.008'],
    alert: ['M8.583 3.25 1.5 15a1.667 1.667 0 0 0 1.417 2.5h14.166A1.667 1.667 0 0 0 18.5 15L11.417 3.25a1.667 1.667 0 0 0-2.834 0Z', 'M10 7.5v3.333', 'M10 14.167h.008'],
    sparkle: ['M10 2.5l1.5 4.333 4.333 1.5-4.333 1.5L10 14.167l-1.5-4.334-4.333-1.5 4.333-1.5L10 2.5Z', 'M15.833 14.167V17.5', 'M14.167 15.833H17.5'],
    search: ['M9.167 3.333a5.833 5.833 0 1 0 0 11.667 5.833 5.833 0 0 0 0-11.667Z', 'M17.083 17.083l-3.5-3.5'],
    'arrow-up-right': ['M5.833 14.167l8.334-8.334', 'M6.667 5.833h7.5v7.5'],
    'arrow-right': ['M4.167 10h11.666', 'M10 4.167 15.833 10 10 15.833'],
    'arrow-left': ['M15.833 10H4.167', 'M10 15.833 4.167 10 10 4.167'],
    bookmark: ['M15.833 17.5 10 13.333 4.167 17.5V4.167c0-.92.746-1.667 1.666-1.667h8.334c.92 0 1.666.746 1.666 1.667V17.5Z'],
    'map-pin': ['M16.667 8.333c0 5-6.667 10-6.667 10s-6.667-5-6.667-10a6.667 6.667 0 0 1 13.334 0Z', 'M10 5.833a2.5 2.5 0 1 0 0 5 2.5 2.5 0 0 0 0-5Z'],
    'chevron-down': ['M5 7.5l5 5 5-5'],
    'chevron-right': ['M7.5 5l5 5-5 5'],
    'chevron-left': ['M12.5 15l-5-5 5-5'],
    plus: ['M10 4.167v11.666', 'M4.167 10h11.666'],
    building: ['M3.333 17.5V4.167c0-.92.747-1.667 1.667-1.667h6.667c.92 0 1.666.746 1.666 1.667V17.5', 'M13.333 7.5H15c.92 0 1.667.746 1.667 1.667V17.5', 'M6.667 5.833H10', 'M6.667 9.167H10', 'M6.667 12.5H10', 'M1.667 17.5h16.666'],
    menu: ['M3.333 5.833h13.334', 'M3.333 10h13.334', 'M3.333 14.167h13.334'],
    filter: ['M3.333 5h13.334', 'M5.833 10h8.334', 'M8.333 15h3.334']
  } as const;
  export type IconName = keyof typeof ICONS;
</script>

<script lang="ts">
  let { name, size = 20, label, class: cls = '' }: { name: IconName; size?: number; label?: string; class?: string } = $props();
</script>

<svg
  class="icon {cls}"
  width={size}
  height={size}
  viewBox="0 0 20 20"
  fill="none"
  stroke="currentColor"
  stroke-width="1.75"
  stroke-linecap="round"
  stroke-linejoin="round"
  role={label ? 'img' : undefined}
  aria-label={label}
  aria-hidden={label ? undefined : 'true'}
  focusable="false"
>
  {#each ICONS[name] as d (d)}<path {d} />{/each}
</svg>

<style>
  .icon { display: inline-block; flex: none; vertical-align: middle; }
</style>
