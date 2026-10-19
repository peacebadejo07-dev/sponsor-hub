<script lang="ts">
  import Icon from './Icon.svelte';
  /**
   * Figma › Banner / Subscribe. Signed out, the email goes through the normal
   * sign-in link (that link is the confirmation), then lands on the profile
   * with the weekly email switched on.
   */
  let { loggedIn = false }: { loggedIn?: boolean } = $props();
</script>

<section class="banner card blur-bg" aria-labelledby="subscribe-title">
  <span class="mail" aria-hidden="true"><svg width="28" height="28" viewBox="0 0 28 28"><rect x="3" y="6" width="22" height="16" rx="3" fill="#A8D5B5" /><path d="M3 9c0-1.7 1.3-3 3-3h16c1.7 0 3 1.3 3 3l-9.2 5.5a3.4 3.4 0 0 1-3.6 0L3 9Z" fill="#1B7D3E" /></svg></span>
  <h2 id="subscribe-title" class="t-heading-3">Get roles that fit you, every week</h2>
  <p class="t-body t-secondary">New tech roles at UK visa sponsors that match your profile. Free, one click to stop.</p>
  {#if loggedIn}
    <a class="btn btn-primary" href="/profile#weekly-email">Turn on the weekly email<Icon name="arrow-right" size={16} /></a>
  {:else}
    <form method="POST" action="/login" class="pill">
      <input type="hidden" name="next" value="/profile?subscribe=1" />
      <label class="visually-hidden" for="subscribe-email">Email address</label>
      <input id="subscribe-email" name="email" type="email" required autocomplete="email" inputmode="email" placeholder="you@example.com" />
      <button type="submit" class="btn btn-primary">Subscribe</button>
    </form>
    <p class="t-caption t-muted fine">We'll email a link to confirm. We never share your address.</p>
  {/if}
</section>

<style>
  .banner { --blur-w: 1100px; --blur-x: 50%; --blur-y: 55%; --blur-opacity: 0.35; display: grid; justify-items: center; text-align: center; gap: var(--space-md); padding: var(--space-3xl) var(--space-xl); background: var(--color-bg-subtle); }
  .mail { display: grid; place-items: center; width: 56px; height: 56px; border-radius: 16px; background: var(--color-bg-surface); border: 1px solid var(--color-border-subtle); box-shadow: var(--shadow-sm); }
  h2 { max-width: 440px; }
  p { margin: 0; max-width: 380px; }
  .pill { display: flex; align-items: center; width: min(100%, 360px); padding: 4px 4px 4px var(--space-lg); background: var(--color-bg-surface); border: 1px solid var(--color-border-brand-soft); border-radius: var(--radius-full); box-shadow: var(--shadow-soft); margin-top: var(--space-xs); }
  .pill:focus-within { box-shadow: var(--focus-ring); }
  .pill input[type='email'] { flex: 1; min-width: 0; border: 0; outline: 0; background: transparent; font-size: var(--font-size-body); padding: 10px 0; }
  .pill input::placeholder { color: var(--color-text-muted); }
  .pill input:focus-visible { box-shadow: none; }
  .fine { max-width: 340px; }
  @media (max-width: 640px) { .banner { padding: var(--space-xl) var(--space-lg); } }
</style>
