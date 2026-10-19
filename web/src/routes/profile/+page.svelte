<script lang="ts">
  import { ROLE_LABELS, ROLE_FAMILIES } from '@sponsored/core';
  import { WORK_LABELS, EMP_LABELS, LEVEL_LABELS } from '$lib/labels';
  import Icon from '$lib/ui/Icon.svelte';
  let { data, form } = $props();
  const p = $derived(data.profile);
  const isNew = $derived(!data.exists);
  const digestOn = $derived(form?.subscribed ? true : data.digest);
  const SPONSOR_OPTIONS = [['yes', 'Yes, I need sponsorship'], ['unsure', "I'm not sure"], ['no', "No, I don't"], ['', "I'd rather not say"]] as const;
</script>

<svelte:head><title>{isNew ? 'Create your profile' : 'Your profile'} · Sponsor Hub</title><meta name="robots" content="noindex" /></svelte:head>

{#snippet howWeUse(where: string)}
  <section class="card side {where}" aria-label="How we use this">
    <h2 class="t-heading-4">How we use this</h2>
    <ul class="points">
      <li><Icon name="check-circle" size={18} /><span>Only to rank roles for you and explain why</span></li>
      <li><Icon name="check-circle" size={18} /><span>Never shared, sold or shown to employers</span></li>
      <li><Icon name="check-circle" size={18} /><span>Download or delete it any time</span></li>
    </ul>
  </section>
{/snippet}

<header class="page-head">
  <h1 class="t-heading-1">{isNew ? 'Create your profile' : 'Your profile'}</h1>
  <p class="t-body-lg t-secondary">Tell us what you're looking for and we'll rank every role for you, with the reasons shown. Everything is optional, and you can change it any time.</p>
</header>

{#if form?.saved}
  <p class="notice ok" role="status"><Icon name="check-circle" />Saved. <a class="t-link" href="/for-you">See roles ranked for you</a></p>
{:else if form?.subscribed}
  <p class="notice ok" role="status"><Icon name="check-circle" />Your weekly email is on. You can stop it here or from any email.</p>
{:else if data.subscribe}
  <form method="POST" action="?/subscribe" class="notice info">
    <Icon name="info" />
    <span>You're signed in. Turn on the weekly email you asked for?</span>
    <button type="submit" class="btn btn-primary btn-sm">Turn it on</button>
  </form>
{:else if data.welcome}
  <p class="notice info" role="status"><Icon name="sparkle" />Welcome. Everything here is optional, so fill in as much or as little as you like.</p>
{/if}

<div class="columns">
  <form method="POST" action="?/save" class="form">
    {#if isNew}<input type="hidden" name="then" value="for-you" />{/if}
    {@render howWeUse("mobile-only")}
    <fieldset class="card section">
      <legend class="t-heading-4">What kind of work?</legend>
      <p class="t-body-sm t-secondary hint">Pick as many as you like.</p>
      <div class="chips">
        {#each ROLE_FAMILIES as r (r)}
          <label class="chip"><input type="checkbox" name="roles" value={r} checked={p.roles.includes(r)} /><Icon name="check" size={16} />{ROLE_LABELS[r]}</label>
        {/each}
      </div>
    </fieldset>

    <fieldset class="card section">
      <legend class="t-heading-4">Where?</legend>
      <p class="t-body-sm t-secondary hint">Leave these blank and we won't use location or working pattern to rank roles.</p>
      <div class="field">
        <label class="field-label" for="locations">Towns or cities</label>
        <div class="control"><input id="locations" name="locations" value={p.locations.join(', ')} list="cities" placeholder="e.g. London, Manchester" autocomplete="off" aria-describedby="locations-help" /></div>
        <p id="locations-help" class="field-help">Separate with commas</p>
        <datalist id="cities">{#each data.cities as c (c.value)}<option value={c.value}></option>{/each}</datalist>
      </div>
      <div class="chips" role="group" aria-label="Working pattern">
        {#each ['remote', 'hybrid', 'onsite'] as m (m)}
          <label class="chip"><input type="checkbox" name="workModes" value={m} checked={p.workModes.includes(m as never)} /><Icon name="check" size={16} />{WORK_LABELS[m]}</label>
        {/each}
      </div>
    </fieldset>

    <fieldset class="card section">
      <legend class="t-heading-4">About you</legend>
      <div class="row3">
        <div class="field">
          <label class="field-label" for="level">Your level</label>
          <div class="control">
            <select id="level" name="level"><option value="">Not set</option>{#each Object.entries(LEVEL_LABELS) as [v, l] (v)}<option value={v} selected={p.level === v}>{l}</option>{/each}</select>
            <Icon name="chevron-down" class="chev" />
          </div>
        </div>
        <div class="field">
          <label class="field-label" for="years">Years of experience</label>
          <div class="control"><input id="years" name="yearsExperience" type="number" min="0" max="50" inputmode="numeric" value={p.yearsExperience ?? ''} /></div>
        </div>
        <div class="field">
          <label class="field-label" for="salary">Minimum salary (£ a year)</label>
          <div class="control"><input id="salary" name="minSalary" type="number" min="0" step="1000" inputmode="numeric" value={p.minSalary ?? ''} /></div>
        </div>
      </div>
      <div class="field">
        <label class="field-label" for="skills">Skills</label>
        <div class="control"><input id="skills" name="skills" value={p.skills.join(', ')} placeholder="e.g. Python, SQL, Figma, AWS" aria-describedby="skills-help" /></div>
        <p id="skills-help" class="field-help">Separate with commas</p>
      </div>
      <div class="field">
        <span class="field-label" id="contract-label">Type of contract</span>
        <div class="chips" role="group" aria-labelledby="contract-label">
          {#each Object.entries(EMP_LABELS) as [v, l] (v)}
            <label class="chip"><input type="checkbox" name="employmentTypes" value={v} checked={p.employmentTypes.includes(v as never)} /><Icon name="check" size={16} />{l}</label>
          {/each}
        </div>
      </div>
    </fieldset>

    <fieldset class="card section">
      <legend class="t-heading-4">Visa sponsorship <span class="t-label-sm t-muted">Optional</span></legend>
      <p class="t-body-sm t-secondary hint">Do you need an employer to sponsor your visa? We use this only to rank roles for you. Every employer here is a licensed sponsor, but individual roles can still say they don't sponsor.</p>
      <div class="options">
        {#each SPONSOR_OPTIONS as [v, l] (v)}
          <label class="check"><input type="radio" name="needsSponsorship" value={v} checked={(p.needsSponsorship ?? '') === v} />{l}</label>
        {/each}
      </div>
      <hr class="divider" />
      <label class="check"><input type="checkbox" name="hideRefusals" checked={p.hideRefusals} />Hide roles whose posting says they don't sponsor visas</label>
    </fieldset>

    <fieldset class="card section" id="weekly-email">
      <legend class="t-heading-4">Weekly email <span class="t-label-sm t-muted">Optional</span></legend>
      <label class="check"><input type="checkbox" name="digest" checked={digestOn} />Email me a weekly list of new roles that fit my profile</label>
      <p class="t-body-sm t-muted hint">Off unless you tick it. One click to stop.</p>
    </fieldset>

    <div class="save">
      <button type="submit" class="btn btn-primary">{isNew ? 'Save and see my roles' : 'Save profile'}</button>
      <p class="t-body-sm t-muted">You can change this any time.</p>
    </div>
  </form>

  <aside class="aside" aria-label="Your data and account">
    {@render howWeUse("desktop-only")}

    <section class="card side" aria-labelledby="acct-h">
      <h2 id="acct-h" class="t-heading-4">Your account</h2>
      <p class="t-body-sm t-secondary">Signed in as <strong class="who">{data.email}</strong></p>
      <a class="btn btn-secondary btn-block" href="/profile/export" download>Download my data</a>
      <form method="POST" action="/logout"><button type="submit" class="btn btn-secondary btn-block">Sign out</button></form>
      <form method="POST" action="?/signOutEverywhere"><button type="submit" class="btn btn-ghost btn-block">Sign out on all devices</button></form>
    </section>

    <section class="card side" aria-labelledby="del-h">
      <h2 id="del-h" class="t-heading-4">Delete my account</h2>
      <p class="t-body-sm t-secondary">Permanently deletes your account, profile and saved roles. This can't be undone.</p>
      <form method="POST" action="?/deleteAccount" class="del">
        <div class="field">
          <label class="field-label" for="confirm">Type <b>delete</b> to confirm</label>
          <div class="control" class:invalid={!!form?.deleteError}><input id="confirm" name="confirm" autocomplete="off" aria-invalid={form?.deleteError ? 'true' : undefined} aria-describedby={form?.deleteError ? 'del-error' : undefined} /></div>
          {#if form?.deleteError}<p id="del-error" class="field-error" role="alert"><Icon name="alert" size={16} />{form.deleteError}</p>{/if}
        </div>
        <button class="btn btn-secondary danger btn-block" type="submit">Delete my account</button>
      </form>
    </section>
  </aside>
</div>

<style>
  .page-head { display: grid; gap: var(--space-xs); margin-bottom: var(--space-lg); }
  .page-head p { margin: 0; max-width: 760px; }
  .notice { display: flex; align-items: center; gap: var(--space-sm); flex-wrap: wrap; margin: 0 0 var(--space-lg); padding: var(--space-sm) var(--space-md); border-radius: var(--radius-md); font-size: var(--font-size-body-sm); }
  .notice.ok { background: var(--color-status-verified-bg); color: var(--color-status-verified-fg); }
  .notice.info { background: var(--color-status-info-bg); color: var(--color-status-info-fg); }
  .notice span { flex: 1; color: var(--color-text-primary); }
  .columns { display: grid; grid-template-columns: minmax(0, 1fr) 360px; gap: var(--space-xl); align-items: start; }
  .form { display: grid; gap: var(--space-lg); margin: 0; }
  .section { display: grid; gap: var(--space-md); padding: 28px; margin: 0; min-width: 0; }
  legend { float: left; width: 100%; display: flex; align-items: baseline; gap: var(--space-xs); padding: 0; }
  legend + * { clear: both; }
  .hint { margin: calc(-1 * var(--space-xs)) 0 0; }
  .row3 { display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); gap: var(--space-md); }
  .options { display: grid; }
  .save { display: flex; align-items: center; gap: var(--space-md); flex-wrap: wrap; }
  .save p { margin: 0; }
  .aside { display: grid; gap: var(--space-lg); position: sticky; top: 96px; }
  .side { display: grid; gap: var(--space-sm); padding: var(--space-lg); }
  .side p { margin: 0; }
  .side form { margin: 0; }
  .who { color: var(--color-text-primary); overflow-wrap: anywhere; }
  .points { list-style: none; margin: 0; padding: 0; display: grid; gap: var(--space-sm); }
  .points li { display: flex; gap: 10px; align-items: flex-start; font-size: var(--font-size-body-sm); line-height: var(--line-height-body-sm); color: var(--color-text-secondary); }
  .points :global(.icon) { color: var(--color-icon-brand); margin-top: 2px; }
  .del { display: grid; gap: var(--space-sm); }
  .danger { color: var(--color-text-danger); border-color: var(--color-border-danger); }
  .danger:hover { background: var(--color-status-danger-bg); }
  .mobile-only { display: none; }
  @media (max-width: 1023px) {
    .columns { grid-template-columns: minmax(0, 1fr); }
    .aside { position: static; }
    .mobile-only { display: grid; }
    .desktop-only { display: none; }
  }
  @media (max-width: 640px) {
    .section { padding: var(--space-lg) 20px; }
    .row3 { grid-template-columns: minmax(0, 1fr); }
    .save { flex-direction: column; align-items: stretch; text-align: center; }
  }
</style>
