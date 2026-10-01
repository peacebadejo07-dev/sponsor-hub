<script lang="ts">
  import { ROLE_LABELS, ROLE_FAMILIES } from '@sponsored/core';
  import { WORK_LABELS, EMP_LABELS, LEVEL_LABELS } from '$lib/labels';
  let { data, form } = $props();
  const p = $derived(data.profile);
</script>

<svelte:head><title>Your profile · Sponsor Hub</title><meta name="robots" content="noindex" /></svelte:head>

<h1>Your profile</h1>
{#if data.welcome}<p class="banner" role="status"><strong>Welcome.</strong> Tell us what you're looking for and we'll rank the roles for you. Everything here is optional, and you can change it any time.</p>{/if}
{#if form?.saved}<p class="banner ok" role="status">Saved. <a href="/for-you">See roles ranked for you →</a></p>{/if}

<form method="POST" action="?/save" class="form">
  <fieldset>
    <legend>What kind of work?</legend>
    <div class="checks">
      {#each ROLE_FAMILIES as r (r)}
        <label class="chip"><input type="checkbox" name="roles" value={r} checked={p.roles.includes(r)} /> {ROLE_LABELS[r]}</label>
      {/each}
    </div>
  </fieldset>

  <fieldset>
    <legend>Where?</legend>
    <label class="field"><span>Towns or cities, separated by commas</span>
      <input name="locations" value={p.locations.join(', ')} list="cities" placeholder="e.g. London, Manchester" autocomplete="off" />
      <datalist id="cities">{#each data.cities as c (c.value)}<option value={c.value}></option>{/each}</datalist>
    </label>
    <div class="checks">
      {#each ['remote', 'hybrid', 'onsite'] as m (m)}
        <label class="chip"><input type="checkbox" name="workModes" value={m} checked={p.workModes.includes(m as never)} /> {WORK_LABELS[m]}</label>
      {/each}
    </div>
    <p class="hint">Leave these blank and we won't use location or working pattern to rank roles.</p>
  </fieldset>

  <fieldset>
    <legend>About you</legend>
    <div class="grid">
      <label class="field"><span>Your level</span>
        <select name="level"><option value="">Not set</option>
          {#each Object.entries(LEVEL_LABELS) as [v, l] (v)}<option value={v} selected={p.level === v}>{l}</option>{/each}
        </select>
      </label>
      <label class="field"><span>Years of experience</span><input name="yearsExperience" type="number" min="0" max="50" value={p.yearsExperience ?? ''} /></label>
      <label class="field"><span>Minimum salary (£ a year)</span><input name="minSalary" type="number" min="0" step="1000" value={p.minSalary ?? ''} /></label>
    </div>
    <label class="field"><span>Skills, separated by commas</span><input name="skills" value={p.skills.join(', ')} placeholder="e.g. Python, SQL, Figma, AWS" /></label>
    <div class="checks">
      {#each Object.entries(EMP_LABELS) as [v, l] (v)}
        <label class="chip"><input type="checkbox" name="employmentTypes" value={v} checked={p.employmentTypes.includes(v as never)} /> {l}</label>
      {/each}
    </div>
  </fieldset>

  <fieldset>
    <legend>Visa sponsorship <span class="opt">(optional)</span></legend>
    <p class="hint">Do you need an employer to sponsor your visa? We use this only to rank roles for you, and you can skip it. Every employer on this site is a licensed sponsor, but individual roles can still say they don't sponsor.</p>
    <div class="checks">
      {#each [['yes', 'Yes, I need sponsorship'], ['unsure', "I'm not sure"], ['no', "No, I don't"], ['', "I'd rather not say"]] as [v, l] (v)}
        <label class="chip"><input type="radio" name="needsSponsorship" value={v} checked={(p.needsSponsorship ?? '') === v} /> {l}</label>
      {/each}
    </div>
    <label class="check"><input type="checkbox" name="hideRefusals" checked={p.hideRefusals} /> Hide roles whose posting says they don't sponsor visas (only if you need sponsorship)</label>
  </fieldset>

  <fieldset>
    <legend>Email <span class="opt">(optional)</span></legend>
    <label class="check"><input type="checkbox" name="digest" checked={data.digest} /> Email me a weekly list of new roles that fit my profile (off unless you tick this; one click to stop)</label>
  </fieldset>

  <button type="submit" class="primary">Save profile</button>
</form>

<section class="card">
  <h2>Your account</h2>
  <p>Signed in as <strong>{data.email}</strong>.</p>
  <div class="row">
    <a class="btn" href="/profile/export" download>Download my data</a>
    <form method="POST" action="?/signOutEverywhere"><button class="btn" type="submit">Sign out on all devices</button></form>
  </div>
</section>

<section class="card danger">
  <h2>Delete my account</h2>
  <p>This permanently deletes your account, profile and saved roles. It can't be undone.</p>
  <form method="POST" action="?/deleteAccount" class="row">
    <label class="field inline"><span>Type <b>delete</b> to confirm</span><input name="confirm" autocomplete="off" /></label>
    <button class="btn warn" type="submit">Delete everything</button>
  </form>
  {#if form?.deleteError}<p class="err" role="alert">{form.deleteError}</p>{/if}
</section>

<style>
  h1 { font-size: 24px; margin: 0 0 12px; letter-spacing: -0.015em; }
  .banner { background: var(--inferred-soft); border-radius: 8px; padding: 12px 14px; margin: 0 0 16px; }
  .banner.ok { background: var(--accent-soft); }
  .form { display: grid; gap: 16px; max-width: 760px; }
  fieldset { background: var(--surface); border: 1px solid var(--line); border-radius: var(--radius); padding: 14px 16px; margin: 0; display: grid; gap: 10px; }
  legend { font-weight: 600; padding: 0 6px; }
  .opt { font-weight: 400; color: var(--muted); font-size: 13px; }
  .checks { display: flex; flex-wrap: wrap; gap: 8px; }
  .chip { display: inline-flex; gap: 6px; align-items: center; border: 1px solid var(--line); border-radius: 99px; padding: 5px 12px; font-size: 14px; cursor: pointer; background: var(--bg); }
  .chip:has(input:checked) { border-color: var(--accent); background: var(--accent-soft); }
  .check { display: flex; gap: 8px; align-items: center; font-size: 14px; }
  .field { display: grid; gap: 4px; font-size: 13px; color: var(--muted); }
  .field input, .field select { padding: 9px 10px; border: 1px solid var(--line); border-radius: 8px; background: var(--bg); font-size: 15px; }
  .grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(170px, 1fr)); gap: 12px; }
  .hint { color: var(--muted); font-size: 13px; margin: 0; }
  .primary { justify-self: start; background: var(--accent); color: var(--accent-ink); border: 0; border-radius: 8px; padding: 11px 22px; font-weight: 600; cursor: pointer; }
  .card { background: var(--surface); border: 1px solid var(--line); border-radius: var(--radius); padding: 16px 18px; margin-top: 20px; max-width: 760px; }
  .card h2 { font-size: 16px; margin: 0 0 6px; }
  .card.danger { border-color: color-mix(in srgb, var(--inferred) 50%, var(--line)); }
  .row { display: flex; flex-wrap: wrap; gap: 10px; align-items: end; }
  .row form { margin: 0; }
  .btn { background: var(--bg); border: 1px solid var(--line); border-radius: 8px; padding: 8px 14px; font-size: 14px; cursor: pointer; text-decoration: none; color: inherit; display: inline-block; }
  .btn.warn { background: var(--inferred-soft); color: var(--inferred); border-color: var(--inferred); font-weight: 600; }
  .inline { min-width: 200px; }
  .err { color: var(--inferred); margin: 8px 0 0; }
</style>
