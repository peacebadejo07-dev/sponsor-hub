<script lang="ts">
  import { onMount } from 'svelte';
  /**
   * A number that counts up from 0 the first time it scrolls into view
   * (🎞 Motion: entrance duration, ease-out). The real figure is what the
   * server sends and what screen readers hear; with reduced motion or no
   * JavaScript it simply shows.
   */
  let { value, duration = 1100 }: { value: number; duration?: number } = $props();
  const fmt = (n: number) => n.toLocaleString('en-GB');
  let el: HTMLSpanElement;
  let shown = $state<number | null>(null);
  let ready = $state(false);

  onMount(() => {
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) { ready = true; return; }
    shown = 0;
    ready = true;
    let raf = 0;
    const io = new IntersectionObserver(([e]) => {
      if (!e.isIntersecting) return;
      io.disconnect();
      const t0 = performance.now();
      const tick = (t: number) => {
        const p = Math.min(1, (t - t0) / duration);
        shown = Math.round(value * (1 - Math.pow(1 - p, 4)));
        if (p < 1) raf = requestAnimationFrame(tick);
        else shown = null;
      };
      raf = requestAnimationFrame(tick);
    }, { threshold: 0.4 });
    io.observe(el);
    return () => { io.disconnect(); cancelAnimationFrame(raf); };
  });
</script>

<span class="countup" class:ready bind:this={el}><span aria-hidden="true">{fmt(shown ?? value)}</span><span class="visually-hidden">{fmt(value)}</span></span>
