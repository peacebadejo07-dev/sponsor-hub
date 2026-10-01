<script lang="ts">
  let { data } = $props();
  const fmt = (n: number) => n.toLocaleString('en-GB');
  const time = (iso: string) => new Date(iso).toLocaleString('en-GB', { timeZone: 'Europe/London', day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' });
  const mins = (s: number | null) => (s == null ? '—' : s < 90 ? `${s}s` : `${Math.round(s / 60)} min`);
  const LABEL: Record<string, string> = { research: 'Research new organisations', probe: 'Find job boards', discover: 'Find careers-page data', scan: 'Scan job boards', register: 'Check the register', maintenance: 'Tidy up', digest: 'Weekly emails' };
</script>

<svelte:head><title>Status · Sponsor Hub</title></svelte:head>

<h1>How the scan is doing</h1>
<p class="lead">A scan runs every morning at 8:00 UK time. This page shows what it did, and how much of the market it can currently see.</p>

{#if data.staleHours !== null && data.staleHours > 30}
  <p class="warn" role="status">The last successful scan finished {data.staleHours} hours ago, so some roles below may be out of date. A scan normally runs every morning.</p>
{:else if data.staleHours === null}
  <p class="warn" role="status">No scan has finished yet.</p>
{/if}

<section>
  <h2>Coverage</h2>
  <div class="stats">
    <div><b>{fmt(data.cov.researched)}</b><span>organisations researched</span></div>
    <div><b>{fmt(data.cov.websites)}</b><span>websites found</span></div>
    <div><b>{fmt(data.cov.boards)}</b><span>job boards known</span></div>
    <div><b>{fmt(data.cov.live)}</b><span>live roles from {fmt(data.cov.employers_with_roles)} employers</span></div>
    <div><b>{fmt(data.cov.failing)}</b><span>boards that failed their last scan</span></div>
  </div>
  <p class="note">We can only see employers whose job board we have found. Most organisations on the register do not publish jobs in a way we can read, so this is a fraction of all sponsored jobs, not the whole market.</p>
  <ul class="platforms">{#each data.cov.byPlatform as p (p.ats_type)}<li><b>{p.boards}</b> {p.ats_type}</li>{/each}</ul>
</section>

<section>
  <h2>Recent scans</h2>
  {#if data.runs.length === 0}<p class="empty">No scan has run yet.</p>{:else}
    <div class="table" role="table" aria-label="Recent scans">
      <div class="row head" role="row"><span>Date</span><span>Result</span><span>Took</span><span>Boards</span><span>New</span><span>Changed</span><span>Closed</span></div>
      {#each data.runs as r (r.id)}
        <div class="row" role="row">
          <span>{time(r.started_at)}{#if r.trigger === 'manual'} <small>(manual)</small>{/if}</span>
          <span class="st {r.status}">{r.status === 'ok' ? 'OK' : r.status === 'partial' ? 'Partly' : r.status === 'failed' ? 'Failed' : 'Running'}</span>
          <span>{mins(r.seconds)}</span>
          <span>{r.summary.boardsScanned ?? 0}{#if r.summary.boardsFailed} <small>({r.summary.boardsFailed} failed)</small>{/if}</span>
          <span>{r.summary.rolesAdded ?? 0}</span>
          <span>{r.summary.rolesChanged ?? 0}</span>
          <span>{r.summary.rolesExpired ?? 0}</span>
          <details class="steps"><summary>Steps</summary>
            <ul>{#each r.steps as s (s.name)}<li><span class="dot {s.status}"></span>{LABEL[s.name] ?? s.name}: {s.status}{#if s.seconds} · {mins(s.seconds)}{/if}</li>{/each}</ul>
          </details>
        </div>
      {/each}
    </div>
  {/if}
</section>

<style>
  h1 { font-size: 24px; margin: 0 0 4px; letter-spacing: -0.015em; }
  .lead { color: var(--muted); margin: 0 0 24px; max-width: 640px; }
  h2 { font-size: 18px; margin: 0 0 10px; }
  section { margin-bottom: 28px; }
  .stats { display: grid; grid-template-columns: repeat(auto-fit, minmax(170px, 1fr)); gap: 10px; }
  .stats div { background: var(--surface); border: 1px solid var(--line); border-radius: var(--radius); padding: 12px 14px; display: grid; }
  .stats b { font-size: 22px; font-variant-numeric: tabular-nums; }
  .stats span { color: var(--muted); font-size: 13px; }
  .warn { background: var(--inferred-soft); color: var(--ink); border-radius: var(--radius); padding: 12px 14px; margin: 0 0 24px; max-width: 680px; }
  .note { color: var(--muted); font-size: 14px; max-width: 680px; }
  .platforms { list-style: none; margin: 8px 0 0; padding: 0; display: flex; flex-wrap: wrap; gap: 6px 14px; font-size: 13px; color: var(--muted); }
  .platforms b { color: var(--ink); }
  .empty { color: var(--muted); }
  .table { background: var(--surface); border: 1px solid var(--line); border-radius: var(--radius); overflow-x: auto; }
  .row { display: grid; grid-template-columns: 1.4fr 0.8fr 0.7fr 1.1fr 0.6fr 0.7fr 0.6fr; gap: 8px; padding: 10px 14px; border-top: 1px solid var(--line); font-size: 14px; align-items: center; min-width: 640px; }
  .row.head { border-top: 0; color: var(--muted); font-size: 12px; font-weight: 600; }
  .st { font-weight: 600; } .st.ok { color: var(--verified); } .st.partial { color: var(--inferred); } .st.failed { color: var(--inferred); }
  small { color: var(--muted); }
  .steps { grid-column: 1 / -1; font-size: 13px; color: var(--muted); }
  .steps summary { cursor: pointer; }
  .steps ul { list-style: none; margin: 6px 0 0; padding: 0; display: grid; gap: 2px; }
  .dot { display: inline-block; width: 8px; height: 8px; border-radius: 99px; background: var(--muted); margin-right: 8px; }
  .dot.ok { background: var(--verified); } .dot.failed { background: var(--inferred); }
</style>
