<script lang="ts">
  import Icon from './Icon.svelte';
  /** Figma › Provenance badge. `status` is the provenance status stored on the data. */
  let { status, label }: { status?: string | null; label?: string } = $props();
  const kind = $derived(status === 'verified' ? 'verified' : status === 'inferred' ? 'inferred' : 'unconfirmed');
  const text = $derived(label ?? (kind === 'verified' ? 'Verified' : kind === 'inferred' ? 'Inferred' : 'Not stated'));
</script>

<span class="prov prov-{kind}"><Icon name={kind === 'verified' ? 'check-circle' : kind === 'inferred' ? 'sparkle' : 'minus-circle'} size={14} />{text}</span>
