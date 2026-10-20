<script lang="ts">
  /** Figma › Banner / Create profile, with the halftone dots in its top-left corner. */
  let { loggedIn = false }: { loggedIn?: boolean } = $props();
</script>

<section class="banner card halftone" aria-labelledby="profile-title">
  <span class="tile" aria-hidden="true"><svg width="28" height="28" viewBox="0 0 28 28"><circle cx="14" cy="10" r="5" fill="#A8D5B5" /><rect x="6" y="18" width="16" height="5" rx="2.5" fill="#1B7D3E" /></svg></span>
  <h2 id="profile-title" class="t-heading-4">Make every list about you</h2>
  <p class="t-body-sm t-secondary">Tell us the roles, places and level you want. We'll rank every role for you and show why.</p>
  <a class="btn btn-secondary" href={loggedIn ? '/profile' : '/login?next=%2Fprofile'}>Create your profile</a>
</section>

<style>
  .banner { display: grid; align-content: center; justify-items: start; gap: var(--space-md); padding: var(--space-xl); background: var(--color-bg-subtle); }
  .tile { display: grid; place-items: center; width: 56px; height: 56px; border-radius: 16px; background: var(--color-bg-surface); border: 1px solid var(--color-border-subtle); box-shadow: var(--shadow-sm); }
  p { margin: 0; }
  @media (max-width: 640px) { .banner { padding: var(--space-lg); } }
</style>
