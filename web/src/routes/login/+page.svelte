<script lang="ts">
  import Icon from '$lib/ui/Icon.svelte';
  let { data, form } = $props();
  const fmt = (n: number) => n.toLocaleString('en-GB');
</script>

<svelte:head><title>{form?.sent ? 'Check your email' : 'Sign in'} · Sponsor Hub</title><meta name="robots" content="noindex" /></svelte:head>

{#if form?.sent}
  <div class="stage blur-bg confirm-stage">
    <section class="confirm card" aria-labelledby="confirm-h">
      <span class="tile" aria-hidden="true"><svg width="28" height="28" viewBox="0 0 28 28"><rect x="3" y="6" width="22" height="16" rx="3" fill="#A8D5B5" /><path d="M3 9c0-1.7 1.3-3 3-3h16c1.7 0 3 1.3 3 3l-9.2 5.5a3.4 3.4 0 0 1-3.6 0L3 9Z" fill="#1B7D3E" /></svg></span>
      <h1 id="confirm-h" class="t-heading-2" tabindex="-1">Check your email</h1>
      <p class="t-body t-secondary" role="status">If <strong>{form.email}</strong> is a valid address, we've sent a sign-in link to it. It works once and expires in 15 minutes.</p>
      <p class="tip t-body-sm t-secondary"><Icon name="info" size={16} />Not there after a minute? Check your spam or promotions folder.</p>
      <div class="confirm-actions">
        <a class="btn btn-secondary" href={data.next ? `/login?next=${encodeURIComponent(data.next)}` : '/login'}>Use a different email</a>
        <form method="POST">
          <input type="hidden" name="email" value={form.email} />
          <input type="hidden" name="next" value={data.next} />
          <button type="submit" class="btn btn-ghost">Send a new link</button>
        </form>
      </div>
    </section>
  </div>
{:else}
  <div class="stage blur-bg">
    <div class="split">
      <section class="signin card" aria-labelledby="signin-h">
        <div class="head">
          <h1 id="signin-h" class="t-heading-2">Sign in or create an account</h1>
          <p class="t-body t-secondary">Enter your email and we'll send you a link. There's no password to remember, and we create your account the first time you sign in.</p>
        </div>
        <form method="POST" novalidate>
          <input type="hidden" name="next" value={data.next} />
          <div class="field">
            <label class="field-label" for="email">Email address</label>
            <div class="control" class:invalid={!!form?.error}>
              <input id="email" name="email" type="email" required autocomplete="email" inputmode="email" placeholder="you@example.com" value={form?.email ?? ''} aria-invalid={form?.error ? 'true' : undefined} aria-describedby={form?.error ? 'email-error' : undefined} />
            </div>
            {#if form?.error}<p id="email-error" class="field-error" role="alert"><Icon name="alert" size={16} />Enter a full email address, like name@example.com</p>{/if}
          </div>
          <button type="submit" class="btn btn-primary btn-block">Email me a sign-in link</button>
        </form>
        <p class="t-body-sm t-secondary fine">We only use your email to sign you in and, if you ask, to send your weekly list. <a class="t-link" href="/privacy">See how we handle your data.</a></p>
      </section>

      <section class="why" aria-labelledby="why-h">
        <div class="why-head">
          <h2 id="why-h" class="t-heading-3">Tech jobs at UK visa sponsors</h2>
          <p class="t-body t-secondary">Every employer here holds a Home Office sponsor licence. We check their job boards every day.</p>
        </div>
        <dl class="stats">
          <div class="card"><dt>live tech roles</dt><dd class="t-stat">{fmt(data.stats.live)}</dd></div>
          <div class="card"><dt>sponsors hiring now</dt><dd class="t-stat">{fmt(data.stats.hiring)}</dd></div>
          <div class="card"><dt>register entries checked</dt><dd class="t-stat">{fmt(data.stats.register)}</dd></div>
          <div class="card"><dt>job board checks</dt><dd class="t-stat">Daily</dd></div>
        </dl>
      </section>
    </div>
  </div>
{/if}

<style>
  .stage { flex: 1; display: grid; align-items: center; padding: var(--space-4xl) max(var(--space-md), calc((100% - 1168px) / 2)); --blur-w: 1500px; --blur-rotate: 93deg; --blur-x: 58%; --blur-y: 62%; --blur-opacity: 0.6; }
  .split { display: grid; grid-template-columns: minmax(0, 500px) minmax(0, 425px); justify-content: space-between; align-items: center; gap: var(--space-3xl); }
  .signin { display: grid; gap: var(--space-lg); padding: var(--space-2xl); }
  .head { display: grid; gap: var(--space-xs); }
  .head p, .fine { margin: 0; }
  form { display: grid; gap: var(--space-lg); margin: 0; }

  .why { display: grid; gap: var(--space-lg); }
  .why-head { display: grid; gap: var(--space-xs); }
  .why-head p { margin: 0; }
  .stats { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: var(--space-md); margin: 0; }
  .stats div { display: flex; flex-direction: column-reverse; justify-content: flex-end; gap: var(--space-2xs); padding: var(--space-lg); }
  .stats dt { font-size: var(--font-size-body-sm); line-height: var(--line-height-body-sm); color: var(--color-text-secondary); }
  .stats dd { margin: 0; color: var(--color-text-secondary); }

  .confirm-stage { --blur-w: 1500px; --blur-rotate: 93deg; --blur-x: 38%; --blur-y: 54%; justify-items: center; }
  .confirm { display: grid; justify-items: center; text-align: center; gap: var(--space-lg); width: min(100%, 560px); padding: var(--space-3xl); }
  .confirm h1:focus { outline: none; }
  .confirm p { margin: 0; }
  .tile { display: grid; place-items: center; width: 56px; height: 56px; border-radius: 16px; background: var(--color-bg-surface); border: 1px solid var(--color-border-subtle); box-shadow: var(--shadow-sm); }
  .tip { display: flex; gap: var(--space-xs); align-items: flex-start; text-align: left; width: 100%; padding: var(--space-sm) var(--space-md); border: 1px solid var(--color-border-soft); border-radius: var(--radius-md); }
  .tip :global(.icon) { margin-top: 3px; flex: none; }
  .confirm-actions { display: flex; gap: var(--space-sm); align-items: center; justify-content: center; flex-wrap: wrap; }
  .confirm-actions form { display: block; }

  @media (max-width: 960px) {
    .stage { align-items: start; padding-top: var(--space-lg); padding-bottom: 240px; --blur-w: 1000px; --blur-x: 62%; --blur-y: 86%; }
    .split { grid-template-columns: minmax(0, 1fr); gap: var(--space-3xl); }
    .signin { padding: var(--space-lg); }
    .why { padding: var(--space-xl) 4px 0; }
    .stats { gap: var(--space-sm); }
    .stats div { padding: var(--space-md); }
    .confirm-stage { align-items: start; padding-top: var(--space-6xl); padding-bottom: var(--space-6xl); --blur-y: 78%; --blur-x: 55%; }
    .confirm { padding: var(--space-xl) var(--space-lg); }
    .confirm-actions { flex-direction: column; width: 100%; }
    .confirm-actions > * { width: 100%; }
    .confirm-actions :global(.btn) { width: 100%; }
  }
</style>
