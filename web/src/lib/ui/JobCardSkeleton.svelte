<script lang="ts">
  /** Figma › Job card · loading. Purely visual; the list announces "Loading roles". */
</script>

<li class="sk card" aria-hidden="true">
  <div class="row"><span class="b logo"></span><span class="col"><span class="b" style="width:120px;height:10px"></span><span class="b" style="width:260px;height:16px"></span></span></div>
  <div class="row"><span class="b pill" style="width:80px"></span><span class="b pill" style="width:64px"></span><span class="b pill" style="width:64px"></span></div>
  <span class="b" style="width:150px;height:26px;border-radius:13px"></span>
  <span class="b" style="width:100%;max-width:480px;height:12px"></span>
  <div class="row"><span class="b" style="width:80px;height:26px;border-radius:13px"></span><span class="b grow" style="height:10px;max-width:220px"></span><span class="b" style="width:110px;height:36px;border-radius:18px;margin-left:auto"></span></div>
</li>

<style>
  .sk { list-style: none; display: grid; gap: var(--space-md); padding: var(--space-lg); }
  .row { display: flex; align-items: center; gap: var(--space-sm); min-width: 0; }
  .col { display: grid; gap: var(--space-xs); min-width: 0; }
  .b { display: block; background: var(--color-bg-page); border-radius: 6px; max-width: 100%; animation: pulse 1.6s ease-in-out infinite; }
  .logo { width: 40px; height: 40px; border-radius: 10px; flex: none; }
  .pill { height: 26px; border-radius: 8px; }
  .grow { flex: 1; }
  @keyframes pulse { 50% { opacity: 0.55; } }
  @media (prefers-reduced-motion: reduce) { .b { animation: none; } }
</style>
