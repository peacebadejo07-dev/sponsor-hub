<script lang="ts">
  import Icon, { type IconName } from './Icon.svelte';
  /**
   * Figma › Dropdown menu + Dropdown option: a text field that suggests towns
   * as you type (ARIA 1.2 combobox with a listbox popup). Without JavaScript it
   * is a plain text field. With `multiple`, values are comma-separated and only
   * the part after the last comma is completed.
   */
  type Option = { value: string; count?: number };
  let {
    id, name, value = '', options, form, placeholder, icon = 'map-pin', multiple = false, describedby, noun = 'towns'
  }: {
    id: string; name: string; value?: string; options: Option[]; form?: string; placeholder?: string;
    icon?: IconName | null; multiple?: boolean; describedby?: string; noun?: string;
  } = $props();

  let text = $state('');
  // Follow the page's value when it changes (a new search, Clear all).
  $effect.pre(() => { text = value; });
  let open = $state(false);
  let active = $state(-1);
  let input: HTMLInputElement;
  const listId = $derived(`${id}-list`);
  const fmt = (n: number) => n.toLocaleString('en-GB');

  const token = $derived((multiple ? text.split(',').at(-1) ?? '' : text).trim());
  const chosen = $derived(new Set((multiple ? text.split(',') : [text]).map((s) => s.trim().toLowerCase()).filter(Boolean)));
  const matches = $derived.by(() => {
    const t = token.toLowerCase();
    if (!t) return [...options].sort((a, b) => (b.count ?? 0) - (a.count ?? 0)).slice(0, 8);
    const starts = options.filter((o) => o.value.toLowerCase().startsWith(t));
    const words = options.filter((o) => !starts.includes(o) && o.value.toLowerCase().split(/[\s-]+/).some((w) => w.startsWith(t)));
    return [...starts, ...words].slice(0, 8);
  });

  /** Splits a label around the typed letters so they can be emphasised. */
  function parts(label: string): [string, string, string] {
    const i = token ? label.toLowerCase().indexOf(token.toLowerCase()) : -1;
    return i < 0 ? [label, '', ''] : [label.slice(0, i), label.slice(i, i + token.length), label.slice(i + token.length)];
  }

  function show() { open = true; active = -1; }
  function pick(o: Option) {
    if (multiple) {
      const done = text.split(',').slice(0, -1).map((s) => s.trim()).filter(Boolean);
      text = [...done, o.value].join(', ') + ', ';
    } else text = o.value;
    open = false; active = -1;
    input.focus();
  }
  function onkeydown(e: KeyboardEvent) {
    if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
      e.preventDefault();
      if (!open) { show(); if (e.key === 'ArrowUp') active = matches.length - 1; else active = 0; return; }
      const n = matches.length;
      if (n) active = e.key === 'ArrowDown' ? (active + 1) % n : (active - 1 + n) % n;
    } else if (e.key === 'Enter' && open && active >= 0 && matches[active]) {
      e.preventDefault(); pick(matches[active]);
    } else if (e.key === 'Escape') {
      if (open) { e.preventDefault(); open = false; active = -1; } else if (text) { e.preventDefault(); text = ''; }
    } else if (e.key === 'Tab') open = false;
  }
</script>

<div class="combo">
  <div class="control">
    {#if icon}<Icon name={icon} />{/if}
    <input
      bind:this={input} bind:value={text} {id} {name} {form} {placeholder} type="text" autocomplete="off" spellcheck="false"
      role="combobox" aria-autocomplete="list" aria-expanded={open} aria-controls={listId} aria-describedby={describedby}
      aria-activedescendant={open && active >= 0 ? `${id}-opt-${active}` : undefined}
      oninput={show} onfocus={show} onclick={() => { if (!open) show(); }} onblur={() => (open = false)} {onkeydown}
    />
  </div>
  <div class="menu" hidden={!open}>
    <ul id={listId} role="listbox" aria-label={`Suggested ${noun}`}>
      {#each matches as o, i (o.value)}
        {@const [a, m, b] = parts(o.value)}
        {@const sel = chosen.has(o.value.toLowerCase())}
        <!-- Keys are handled on the input (aria-activedescendant), so options only need the mouse. -->
        <!-- svelte-ignore a11y_click_events_have_key_events -->
        <li id={`${id}-opt-${i}`} role="option" aria-selected={sel} class:active={i === active} class:sel
          onmousedown={(e) => e.preventDefault()} onclick={() => pick(o)} onmousemove={() => (active = i)}>
          <Icon name="map-pin" size={16} />
          <span class="label">{a}<mark>{m}</mark>{b}</span>
          {#if o.count != null}<span class="meta">{fmt(o.count)}</span>{/if}
          {#if sel}<Icon name="check" size={16} class="tick" />{/if}
        </li>
      {/each}
    </ul>
    {#if !matches.length}<p class="empty">No {noun} start with “{token}”. You can still search for it.</p>{/if}
  </div>
  <p class="visually-hidden" role="status">{open && token ? (matches.length ? `${matches.length} suggestion${matches.length === 1 ? '' : 's'}` : 'No suggestions') : ''}</p>
</div>

<style>
  .combo { position: relative; }
  .menu {
    position: absolute; z-index: 30; top: calc(100% + 6px); left: 0; right: 0; min-width: 240px;
    padding: 6px; background: var(--color-bg-surface); border: 1px solid var(--color-border-soft); border-radius: var(--radius-lg);
    box-shadow: var(--shadow-lg); max-height: min(320px, 50vh); overflow: auto; overscroll-behavior: contain;
    animation: menu-in var(--duration-fast) var(--ease-out);
  }
  .menu[hidden] { display: none; }
  ul { list-style: none; margin: 0; padding: 0; display: grid; gap: 2px; }
  li {
    display: flex; align-items: center; gap: var(--space-sm); min-height: var(--size-touch-target); padding: 0 var(--space-sm);
    border-radius: var(--radius-md); cursor: pointer; color: var(--color-text-primary); font-size: var(--font-size-body); line-height: var(--line-height-body);
  }
  li :global(.icon) { flex: none; color: var(--color-icon-secondary); }
  li.active, li.sel { background: var(--color-bg-brand-subtle); color: var(--color-text-link); font-weight: var(--font-weight-medium); }
  li.active :global(.icon), li.sel :global(.icon) { color: var(--color-icon-brand); }
  .label { flex: 1; min-width: 0; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
  mark { background: none; color: inherit; font-weight: var(--font-weight-semibold); }
  .meta { flex: none; color: var(--color-text-muted); font-size: var(--font-size-body-sm); font-weight: var(--font-weight-regular); font-variant-numeric: tabular-nums; }
  .empty { margin: 0; padding: var(--space-sm); color: var(--color-text-secondary); font-size: var(--font-size-body-sm); line-height: var(--line-height-body-sm); }
  @keyframes menu-in { from { opacity: 0; translate: 0 -4px; } }
</style>
