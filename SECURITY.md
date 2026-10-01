# Security

If you find a vulnerability, please report it privately rather than in a public issue. Use GitHub's
"Report a vulnerability" button on the Security tab of this repository (private vulnerability reporting).

Please include what you found, how to reproduce it, and what you think the impact is. We will acknowledge a report
within a few days, fix confirmed issues as quickly as we can, and credit you if you wish.

Areas that matter most here: the email sign-in flow, sessions and CSRF checks, the crawler's address filtering
(it must never fetch private or internal addresses), and anything that exposes another user's saved items or profile.
