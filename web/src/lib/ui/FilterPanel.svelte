<script lang="ts">
  import type { Snippet } from 'svelte';
  import { onMount } from 'svelte';
  import { goto } from '$app/navigation';
  import Icon from './Icon.svelte';
  /**
   * The filter sidebar (Figma › Opportunities — Desktop Small · Filters scrolled).
   * Desktop with JavaScript: choices apply as you make them, the header stays
   * pinned and only the groups scroll (no scrollbar until you hover or scroll;
   * a divider once scrolled and a fade while more is below). Phones, and any
   * screen without JavaScript, keep the button that submits the form.
   */
  let { formId, activeCount, clearHref, children }: { formId: string; activeCount: number; clearHref: string; children: Snippet } = $props();

  let details: HTMLDetailsElement;
  let instant = $state(false);
  let scroller: HTMLDivElement;
  let scrolled = $state(false);
  let more = $state(false);
  let scrolling = $state(false);
  let timer: ReturnType<typeof setTimeout> | undefined;
  let idle: ReturnType<typeof setTimeout> | undefined;

  function edges() {
    if (!scroller) return;
    scrolled = scroller.scrollTop > 0;
    more = scroller.scrollTop + scroller.clientHeight < scroller.scrollHeight - 1;
  }
  function onscroll() {
    edges();
    scrolling = true;
    clearTimeout(idle);
    idle = setTimeout(() => (scrolling = false), 800);
  }

  onMount(() => {
    const desktop = window.matchMedia('(min-width: 1024px)');
    const sync = () => {
      instant = desktop.matches;
      // Phones start closed: active filters are listed above the results.
      details.open = desktop.matches;
      edges();
    };
    sync();
    desktop.addEventListener('change', sync);
    const ro = new ResizeObserver(edges);
    ro.observe(scroller);
    if (scroller.firstElementChild) ro.observe(scroller.firstElementChild);
    return () => { desktop.removeEventListener('change', sync); ro.disconnect(); clearTimeout(timer); clearTimeout(idle); };
  });

  /** Builds the form's query (skipping blanks) and navigates without moving focus or scroll. */
  function onchange() {
    if (!instant) return;
    const form = document.getElementById(formId) as HTMLFormElement | null;
    if (!form) return;
    const q = new URLSearchParams();
    for (const [k, v] of new FormData(form)) if (typeof v === 'string' && v !== '' && !(k === 'since' && v === '0')) q.append(k, v);
    const qs = q.toString();
    clearTimeout(timer);
    // A short wait lets quick clicks land in one request.
    timer = setTimeout(() => goto(`${form.getAttribute('action')}${qs ? `?${qs}` : ''}`, { keepFocus: true, noScroll: true }), 200);
  }
</script>

<details class="filters card" open bind:this={details} {onchange}>
  <summary class="btn btn-secondary btn-sm"><Icon name="filter" size={16} />Filters{#if activeCount}{' '}({activeCount}){/if}</summary>
  <div class="body">
    <div class="head" class:scrolled>
      <div class="title">
        <h2 class="t-heading-4">Filters{#if activeCount}{' '}({activeCount}){/if}</h2>
        {#if activeCount}<a href={clearHref} class="btn btn-ghost btn-sm">Clear all</a>{/if}
      </div>
      {#if instant}<p class="t-caption t-muted note">Results update as you choose.</p>{/if}
    </div>
    <div class="scroll" class:scrolling bind:this={scroller} {onscroll}>
      <div class="groups">
        {@render children()}
        {#if !instant}<button type="submit" form={formId} class="btn btn-primary btn-block apply">Show results</button>{/if}
      </div>
    </div>
    <div class="fade" class:on={more} aria-hidden="true"></div>
  </div>
</details>

<style>
  .filters { position: sticky; top: 96px; padding: 0; }
  .filters > summary { display: none; }
  .body { position: relative; display: flex; flex-direction: column; max-height: calc(100dvh - 112px); }
  .head { flex: none; display: grid; gap: var(--space-2xs); padding: var(--space-lg) var(--space-lg) var(--space-sm); border-bottom: 1px solid transparent; transition: border-color var(--duration-fast) var(--ease-out); }
  .head.scrolled { border-bottom-color: var(--color-border-subtle); }
  .title { display: flex; align-items: center; justify-content: space-between; gap: var(--space-xs); min-height: 32px; }
  .note { margin: 0; }
  .scroll {
    flex: 1; min-height: 0; overflow-y: auto; overscroll-behavior: contain;
    scrollbar-width: none; scrollbar-color: var(--color-border-default) transparent;
  }
  .scroll:hover, .scroll.scrolling, .scroll:focus-within { scrollbar-width: thin; }
  .groups { display: grid; gap: var(--space-lg); padding: var(--space-sm) var(--space-lg) var(--space-lg); }
  .fade {
    position: absolute; left: 1px; right: 1px; bottom: 1px; height: 56px; pointer-events: none;
    border-radius: 0 0 var(--radius-xl) var(--radius-xl);
    background: linear-gradient(to bottom, rgb(255 255 255 / 0), var(--color-bg-surface));
    opacity: 0; transition: opacity var(--duration-base) var(--ease-out);
  }
  .fade.on { opacity: 1; }
  @keyframes sheet-in { from { opacity: 0; translate: 0 -8px; } }

  @media (max-width: 1023px) {
    .filters { position: static; background: none; border: 0; box-shadow: none; }
    .filters > summary { display: inline-flex; list-style: none; }
    .filters > summary::-webkit-details-marker { display: none; }
    .filters[open] > summary { margin-bottom: var(--space-md); }
    .body { max-height: none; background: var(--color-bg-surface); border: 1px solid var(--color-border-soft); border-radius: var(--radius-xl); box-shadow: var(--shadow-soft); }
    .scroll { overflow: visible; }
    /* Figma P3: the panel slides down into place as it opens. */
    .filters[open] .body { animation: sheet-in var(--duration-slow) var(--ease-out); }
    .fade { display: none; }
    /* The button stays in reach at the bottom of the screen while the panel is open. */
    .apply { position: sticky; bottom: var(--space-sm); box-shadow: var(--shadow-md); }
  }
</style>
