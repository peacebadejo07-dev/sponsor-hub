import { safeHttpUrl } from '@sponsored/core';

/** Use for every href built from data we scraped. Anything that is not http(s) becomes an inert '#'. */
export const safeHref = (u: string | null | undefined): string => safeHttpUrl(u) ?? '#';
