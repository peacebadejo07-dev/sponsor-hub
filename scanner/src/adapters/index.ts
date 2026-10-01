import { greenhouse } from './greenhouse.ts';
import { lever } from './lever.ts';
import { ashby } from './ashby.ts';
import { workable } from './workable.ts';
import { smartrecruiters } from './smartrecruiters.ts';
import { workday } from './workday.ts';
import { jsonld } from './jsonld.ts';
import type { Adapter, Source } from '../types.ts';

export const ADAPTERS: Record<Source, Adapter> = { greenhouse, lever, ashby, workable, smartrecruiters, workday, jsonld };
export const isSupported = (ats: string | null): ats is Source => !!ats && ats in ADAPTERS;
