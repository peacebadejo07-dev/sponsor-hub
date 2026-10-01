import { clean, key, titleCase, parseTypeAndRating, betterRating, type Rating, type WorkerType } from './normalise.ts';
import { classifyName, type SectorTag } from './classify.ts';

export interface RegisterRow {
  'Organisation Name': string;
  'Town/City': string;
  County: string;
  'Type & Rating': string;
  Route: string;
}

export interface OrgRecord {
  nameKey: string;
  townKey: string;
  name: string;
  town: string;
  county: string;
  rating: Rating;
  ratings: Rating[];
  workerTypes: WorkerType[];
  routes: string[];
  sectorTags: SectorTag[];
}

/** Collapse register rows (one per route) into one record per organisation + town. */
export function aggregateRegister(rows: Iterable<RegisterRow>): OrgRecord[] {
  const map = new Map<string, OrgRecord & { nameCounts: Map<string, number> }>();
  for (const row of rows) {
    const rawName = clean(row['Organisation Name']);
    if (!rawName) continue;
    const nameKey = key(rawName);
    const townKey = key(row['Town/City']);
    const k = `${nameKey}\u0000${townKey}`;
    const { workerType, rating } = parseTypeAndRating(row['Type & Rating']);
    let rec = map.get(k);
    if (!rec) {
      rec = {
        nameKey,
        townKey,
        name: rawName,
        town: townKey ? titleCase(row['Town/City']) : '',
        county: clean(row.County) ? titleCase(row.County) : '',
        rating,
        ratings: [],
        workerTypes: [],
        routes: [],
        sectorTags: [],
        nameCounts: new Map()
      };
      map.set(k, rec);
    }
    rec.nameCounts.set(rawName, (rec.nameCounts.get(rawName) ?? 0) + 1);
    rec.rating = betterRating(rec.rating, rating);
    if (!rec.ratings.includes(rating)) rec.ratings.push(rating);
    if (!rec.workerTypes.includes(workerType)) rec.workerTypes.push(workerType);
    const route = clean(row.Route);
    if (route && !rec.routes.includes(route)) rec.routes.push(route);
    if (!rec.county && clean(row.County)) rec.county = titleCase(row.County);
  }
  const out: OrgRecord[] = [];
  for (const { nameCounts, ...rec } of map.values()) {
    // Prefer the most frequent spelling of the name as the display name.
    rec.name = [...nameCounts.entries()].sort((a, b) => b[1] - a[1])[0][0];
    rec.sectorTags = classifyName(rec.name);
    rec.routes.sort();
    out.push(rec);
  }
  return out;
}
