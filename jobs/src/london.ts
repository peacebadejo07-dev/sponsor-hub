/** UK local time helpers. The scheduler fires in UTC, but "8:00 AM" means UK clock time, which shifts with BST/GMT. */

const FORMAT = new Intl.DateTimeFormat('en-GB', {
  timeZone: 'Europe/London', year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', hourCycle: 'h23'
});

export function londonParts(d: Date): { date: string; hour: number; minute: number } {
  const p = Object.fromEntries(FORMAT.formatToParts(d).map((x) => [x.type, x.value]));
  return { date: `${p.year}-${p.month}-${p.day}`, hour: Number(p.hour), minute: Number(p.minute) };
}

/**
 * Is it the morning window in which the daily scan should run? The scheduler is set to fire at both 07:00 and 08:00 UTC,

 * so that one of them is 08:00 in the UK all year. GitHub can start scheduled jobs hours late, so the window runs 08:00-13:59;
 * the once-a-day check stops a late firing from repeating a run that already happened.
 */
export function inRunWindow(d: Date, fromHour = 8, toHour = 14): boolean {
  const { hour } = londonParts(d);
  return hour >= fromHour && hour < toHour;
}
