export interface Mail {
  to: string;
  subject: string;
  text: string;
  /** Extra headers, e.g. List-Unsubscribe. */
  headers?: Record<string, string>;
}

export interface Mailer {
  send(mail: Mail): Promise<void>;
}

/** Development: print the message (including the sign-in link) to the server console. Never use in production. */
export const consoleMailer: Mailer = {
  async send(m) {
    console.log(`\n--- email to ${m.to} ---\n${m.subject}\n\n${m.text}\n--- end email ---\n`);
  }
};

/** Production: Resend's HTTP API (https://resend.com), which has a free tier. */
export function resendMailer(apiKey: string, from: string, fetchImpl: typeof fetch = fetch): Mailer {
  return {
    async send(m) {
      const res = await fetchImpl('https://api.resend.com/emails', {
        method: 'POST',
        headers: { authorization: `Bearer ${apiKey}`, 'content-type': 'application/json' },
        body: JSON.stringify({ from, to: [m.to], subject: m.subject, text: m.text, ...(m.headers ? { headers: m.headers } : {}) }),
        signal: AbortSignal.timeout(10_000)
      });
      if (!res.ok) throw new Error(`Resend responded ${res.status}`);
    }
  };
}

export function loginEmail(link: string, minutes: number): { subject: string; text: string } {
  return {
    subject: 'Your Sponsor Hub sign-in link',
    text: [
      'Use this link to sign in to Sponsor Hub:',
      '',
      link,
      '',
      `It works once and expires in ${minutes} minutes.`,
      '',
      "If you didn't ask for this, you can ignore this email. Nobody can sign in without the link."
    ].join('\n')
  };
}
