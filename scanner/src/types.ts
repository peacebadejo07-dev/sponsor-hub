import type { Salary } from '@sponsored/core';

export type Source = 'greenhouse' | 'lever' | 'ashby' | 'workable' | 'smartrecruiters' | 'workday';
export type RawWorkMode = 'remote' | 'hybrid' | 'onsite';

/** A job as a board reports it, before our normalisation. Salary here is only ever STRUCTURED data from the API. */
export interface RawJob {
  externalId: string;
  title: string;
  locations: string[];
  countryCodes: string[];
  applyUrl: string | null;
  postedAt: Date | null;
  department: string | null;
  employmentTypeRaw: string | null;
  workMode: RawWorkMode | null; // only when the API states it
  descriptionText: string | null; // null = not fetched yet (SmartRecruiters list)
  salary: Salary | null;
  ref?: string; // adapter-private data needed by enrich() (e.g. a Workday job path)
}

export interface BoardResult {
  ok: boolean;
  status: number; // 0 = unreachable, 404 = no such board
  jobs: RawJob[];
  /** A more precise slug discovered while fetching (Workday host number); the caller stores it. */
  slug?: string;
}

export interface Adapter {
  source: Source;
  fetchBoard(slug: string): Promise<BoardResult>;
  /** Fetch the description (and apply link) for one job when the list endpoint omits them. */
  enrich?(slug: string, job: RawJob): Promise<(Partial<RawJob> & { descriptionText: string }) | null>;
}
