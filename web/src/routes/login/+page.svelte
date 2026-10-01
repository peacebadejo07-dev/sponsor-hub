<script lang="ts">
  let { data, form } = $props();
</script>

<svelte:head><title>Sign in · Sponsor Hub</title><meta name="robots" content="noindex" /></svelte:head>

<div class="box">
  <h1>Sign in</h1>
  {#if form?.sent}
    <div class="ok" role="status">
      <strong>Check your email.</strong>
      <p>If <b>{form.email}</b> is a valid address, we've sent a sign-in link. It works once and expires in 15 minutes. Check your spam folder if it doesn't arrive.</p>
    </div>
  {:else}
    <p class="lead">Enter your email and we'll send you a link. There is no password to remember, and an account is created the first time you sign in.</p>
    <form method="POST">
      <input type="hidden" name="next" value={data.next} />
      <label for="email">Email address</label>
      <input id="email" name="email" type="email" required autocomplete="email" inputmode="email" value={form?.email ?? ''} aria-describedby={form?.error ? 'err' : undefined} />
      {#if form?.error}<p id="err" class="err" role="alert">{form.error}</p>{/if}
      <button type="submit" class="primary">Email me a sign-in link</button>
    </form>
    <p class="fine">We only use your email to sign you in. See <a href="/privacy">how we handle your data</a>.</p>
  {/if}
</div>

<style>
  .box { max-width: 440px; margin: 32px auto; background: var(--surface); border: 1px solid var(--line); border-radius: var(--radius); padding: 24px; }
  h1 { margin: 0 0 8px; font-size: 24px; letter-spacing: -0.015em; }
  .lead { color: var(--muted); margin: 0 0 16px; }
  label { display: block; font-size: 13px; color: var(--muted); margin-bottom: 4px; }
  input { width: 100%; padding: 10px 12px; border: 1px solid var(--line); border-radius: 8px; background: var(--bg); font-size: 16px; }
  .primary { margin-top: 14px; width: 100%; background: var(--accent); color: var(--accent-ink); border: 0; border-radius: 8px; padding: 11px 16px; font-weight: 600; cursor: pointer; }
  .err { color: var(--inferred); margin: 8px 0 0; font-size: 14px; }
  .ok { background: var(--accent-soft); border-radius: 8px; padding: 14px 16px; }
  .ok p { margin: 6px 0 0; }
  .fine { color: var(--muted); font-size: 12px; margin: 14px 0 0; }
</style>
