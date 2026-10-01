import { describe, it, expect } from 'vitest';
import { publishedFromName } from '../src/source.ts';

describe('publishedFromName', () => {
  it('reads GOV.UK style names', () => {
    expect(publishedFromName('SP_-_Worker_and_Temporary_Worker_Web_Register_-_2026-09-30.csv')).toBe('2026-09-30');
  });
  it('reads "Sept 30 2026" style names', () => {
    expect(publishedFromName('Worker Temporary Worker Register Sept 30 2026.csv')).toBe('2026-09-30');
    expect(publishedFromName('Register Jan 5, 2027.csv')).toBe('2027-01-05');
  });
  it('returns null when there is no date', () => {
    expect(publishedFromName('register.csv')).toBeNull();
  });
});
