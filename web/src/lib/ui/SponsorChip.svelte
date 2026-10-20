<script lang="ts">
  import Icon, { type IconName } from './Icon.svelte';
  /** Figma › Sponsorship chip. What the job advert itself says about visa sponsorship. */
  let { signal }: { signal: string } = $props();
  const MAP: Record<string, [string, IconName]> = {
    offered: ['Sponsorship offered', 'check-circle'],
    not_offered: ['No sponsorship', 'x-circle'],
    right_to_work: ['Right to work needed', 'alert'],
    unclear: ['Sponsorship unclear', 'help'],
    unmentioned: ['Sponsorship not mentioned', 'minus-circle']
  };
  const [label, icon] = $derived(MAP[signal] ?? MAP.unmentioned);
  const key = $derived(signal in MAP ? signal : 'unmentioned');
</script>

<span class="spons spons-{key}"><svg class="spons-dash" aria-hidden="true"><rect /></svg><Icon name={icon} size={16} />{label}</span>
