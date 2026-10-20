<script lang="ts" module>
  /**
   * Figma › Backgrounds › Blur V1, rebuilt layer for layer from each screen.
   * Every Blur V1 instance becomes a layer with Figma's own size, transform
   * matrix (some are mirrored) and opacity, inside a frame placed where the
   * screen's "background" frame sits. Desktop Small and Large share numbers:
   * Figma anchors these blurs to the left of their card, or to the middle of
   * the screen on full-page backgrounds. The blob images are the component's
   * three blobs, unrotated (static/blob-*.webp).
   */
  type Layer = { w: number; h: number; m: string; op: number };
  /** fill: the background frame's own fill, which sits under the blobs at the frame's opacity. */
  type Frame = { anchor: 'left' | 'center'; x?: number; y?: number; op?: number; clipTop?: number; fill?: string; layers: Layer[] };
  type Preset = { desk: Frame; mob: Frame; bleed?: boolean; bp?: 640 | 960 };

  const BANNER = '0.9961, 0.0885, 0.0885, -0.9961'; // mirrored
  const BANNER2 = '0.0412, -0.9991, -0.9991, -0.0412'; // mirrored, turned
  const PAGE = '-0.0544, 0.9985, -0.9985, -0.0544';
  const page = (e: number, f: number): Layer[] => [{ w: 1269.6, h: 1611.9, m: `${PAGE}, ${e}, ${f}`, op: 0.6 }];

  export const BLURS = {
    /** Banner / Subscribe (and · mobile) */
    subscribe: {
      desk: { anchor: 'left', layers: [
        { w: 1388.4, h: 1762.7, m: `${BANNER}, -884.5547, 890.7804`, op: 0.35 },
        { w: 1388.4, h: 1762.7, m: `${BANNER2}, 1494.625, 1013.8971`, op: 0.35 }] },
      mob: { anchor: 'left', op: 0.7, layers: [
        { w: 1388.4, h: 1762.7, m: `${BANNER}, -944.5547, 890.7804`, op: 0.35 },
        { w: 1388.4, h: 1762.7, m: `${BANNER2}, 1003.625, 1013.8971`, op: 0.35 }] }
    },
    /** Organisation page cover */
    cover: {
      desk: { anchor: 'left', y: -225, op: 0.55, fill: 'var(--color-bg-subtle)', layers: [
        { w: 2122.6, h: 2694.8, m: `${BANNER}, -1352.3035, 1361.8212`, op: 0.35 },
        { w: 2122.6, h: 2694.8, m: `${BANNER2}, 2284.9763, 1550.0415`, op: 0.35 }] },
      mob: { anchor: 'left', x: -209, y: -557, op: 0.55, fill: 'var(--color-bg-subtle)', layers: [
        { w: 4703.1, h: 5971, m: `${BANNER}, -2996.3577, 3017.4465`, op: 0.35 },
        { w: 4703.1, h: 5971, m: `${BANNER2}, 5062.9219, 3434.4949`, op: 0.35 }] }
    },
    /** Today › signed-out prompt card */
    today: {
      desk: { anchor: 'left', layers: [{ w: 1691.4, h: 2147.3, m: '0.4436, 0.8962, -0.8962, 0.4436, 786.5156, -821.5362', op: 0.4 }] },
      mob: { anchor: 'left', layers: [{ w: 747.6, h: 949.1, m: '-0.4436, 0.8962, 0.8962, 0.4436, -76.1484, -320.9231', op: 0.4 }] }
    },
    /** Sign in (full page under the header) */
    signin: { bleed: true, bp: 960, desk: { anchor: 'center', layers: page(763.5547, -0.2922) }, mob: { anchor: 'center', layers: page(603.0547, 392.7078) } },
    /** Sign in › Check your email; on phones it also shows behind the (transparent) header */
    checkEmail: { bleed: true, bp: 960, desk: { anchor: 'center', layers: page(603.5552, -91.2922) }, mob: { anchor: 'center', y: -72, clipTop: -72, layers: page(603.5552, 20.7078) } },
    /** Page not found (main area between header and footer) */
    notFound: { bleed: true, desk: { anchor: 'center', layers: page(603.5552, -204.2922) }, mob: { anchor: 'center', y: -39, layers: page(603.0557, 19.7078) } }
  } satisfies Record<string, Preset>;
</script>

<script lang="ts">
  /** Place inside an element with .blur-bg. Plays the Blur entrance once per visit (see app.html). */
  let { preset }: { preset: keyof typeof BLURS } = $props();
  const p: Preset = $derived(BLURS[preset]);
</script>

<span class="blur" class:bleed={p.bleed} class:bp960={p.bp === 960} aria-hidden="true">
  {#each [['desk', p.desk], ['mob', p.mob]] as const as [k, fr] (k)}
    <span class="clip {k}" style:top={fr.clipTop != null ? `${fr.clipTop}px` : null}>
      {#if fr.fill}<span class="fill" style:background={fr.fill} style:opacity={fr.op ?? 1}></span>{/if}
      <span class="frame" style:left={fr.anchor === 'center' ? '50%' : `${fr.x ?? 0}px`} style:top="{(fr.y ?? 0) - (fr.clipTop ?? 0)}px" style:opacity={fr.op ?? 1}>
        {#each fr.layers as l, i (i)}
          <span class="layer" style:width="{l.w}px" style:height="{l.h}px" style:transform="matrix({l.m})" style:opacity={l.op}>
            <span class="blob blob-light-green"></span><span class="blob blob-amber"></span><span class="blob blob-green"></span>
          </span>
        {/each}
      </span>
    </span>
  {/each}
</span>
