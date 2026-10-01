<svelte:head><title>About our crawler · Sponsor Hub</title><meta name="description" content="What SponsorHubBot is, what it reads, and how to opt out." /></svelte:head>

<article>
  <h1>About our crawler</h1>
  <p class="lead">Sponsor Hub helps people find tech jobs at UK employers licensed to sponsor visas. <b>SponsorHubBot</b> is the program that reads employers' public job listings for it.</p>

  <h2>What it does</h2>
  <ul>
    <li>Reads job lists that employers publish publicly: their careers pages, and the public job feeds of platforms such as Greenhouse, Lever, Ashby, Workable, SmartRecruiters and Workday.</li>
    <li>Looks at an employer's home page and careers page to work out where its jobs are listed.</li>
    <li>Runs once a day, with no more than one request per second to any single website, and slows down or stops when a site asks it to.</li>
    <li>Links back to the employer's own application page for every job. It does not copy applications or contact anyone.</li>
  </ul>

  <h2>What it will not do</h2>
  <ul>
    <li>It obeys <code>robots.txt</code>, including <code>Disallow</code> rules that name <code>SponsorHubBot</code>.</li>
    <li>It does not try to get past login pages, CAPTCHAs or bot-protection pages. If a site blocks it, it moves on.</li>
    <li>It does not collect personal data about candidates or employees.</li>
  </ul>

  <h2>Opting out or asking us a question</h2>
  <p>To stop the crawler visiting your site, add this to your <code>robots.txt</code>:</p>
  <pre>User-agent: SponsorHubBot
Disallow: /</pre>
  <p>Or tell us and we will remove your organisation's listings. [Contact email to be added before launch]</p>
</article>

<style>
  article { max-width: 680px; }
  h1 { font-size: 26px; letter-spacing: -0.015em; margin: 0 0 8px; }
  h2 { font-size: 17px; margin: 24px 0 6px; }
  .lead { color: var(--muted); font-size: 17px; }
  li { margin: 4px 0; }
  pre, code { background: var(--surface); border: 1px solid var(--line); border-radius: 6px; padding: 1px 6px; font-size: 13px; }
  pre { padding: 10px 14px; }
</style>
