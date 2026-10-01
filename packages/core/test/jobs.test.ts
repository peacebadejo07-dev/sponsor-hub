import { describe, it, expect } from 'vitest';
import {
  classifyRole, classifySeniority, isUkLocation, ukCity, inferWorkMode, mapEmploymentType, inferEmploymentType,
  parseSalary, sponsorshipSignal, extractSkills, extractYears, mentionsDegree, htmlToText, decodeEntities
} from '../src/index.ts';

describe('classifyRole', () => {
  it.each([
    ['Senior Software Engineer', 'software'],
    ['Backend Engineer (Payments)', 'software'],
    ['Full Stack Developer', 'software'],
    ['iOS Engineer', 'software'],
    ['QA Engineer', 'software'],
    ['Staff Software Engineer, Data Platform', 'software'],
    ['Engineering Manager', 'software'],
    ['Senior Engineering Manager', 'software'],
    ['Engineering Director, EU', 'software'],
    ['Head of Engineering', 'software'],
    ['Data Science Manager', 'data'],
    ['Director of Data, Payments', 'data'],
    ['Forward Deployed Enablement Engineer - Customer Success', 'adjacent'],
    ['Machine Learning Engineer', 'ai_ml'],
    ['Research Scientist, LLMs', 'ai_ml'],
    ['Applied Scientist', 'ai_ml'],
    ['Data Engineer', 'data'],
    ['Senior Data Analyst', 'data'],
    ['Analytics Engineer', 'data'],
    ['Security Engineer, Cloud', 'cybersecurity'],
    ['Head of Security', 'cybersecurity'],
    ['Penetration Tester', 'cybersecurity'],
    ['DevOps Engineer', 'cloud_devops'],
    ['Site Reliability Engineer', 'cloud_devops'],
    ['Platform Engineer', 'cloud_devops'],
    ['Senior Product Designer', 'design'],
    ['UX Researcher', 'design'],
    ['Content Designer', 'design'],
    ['Product Manager, Growth', 'product'],
    ['Head of Product', 'product'],
    ['Technical Product Manager', 'product'],
    ['Solutions Engineer', 'adjacent'],
    ['Sales Engineer', 'adjacent'],
    ['Technical Writer', 'adjacent'],
    ['Business Analyst', 'adjacent'],
    ['Delivery Manager', 'adjacent'],
    ['IT Support Analyst', 'it_support'],
    ['Network Engineer', 'it_support']
  ])('%s -> %s', (title, family) => {
    expect(classifyRole(title)).toBe(family);
  });

  it('skips non-tech roles', () => {
    for (const t of ['Account Executive', 'Marketing Manager', 'Recruiter', 'Mechanical Engineer', 'Civil Engineer', 'Customer Support Specialist', 'Financial Controller', 'Product Marketing Manager', 'Security Guard', 'Credit Risk Manager', 'Senior Legal Counsel', 'Talent Strategist', 'Revenue Accounting Manager', 'Fraud Investigator']) {
      expect(classifyRole(t)).toBeNull();
    }
  });
  it('only places a bare "Engineer" in software when the department is technical', () => {
    expect(classifyRole('Engineer', 'Software Development')).toBe('software');
    expect(classifyRole('Engineer', 'Digital Platform')).toBe('software');
    expect(classifyRole('Senior Engineer', 'Platform')).toBe('software');
    expect(classifyRole('Staff Engineer', 'Product Engineering')).toBe('software');
    expect(classifyRole('Engineer', 'Engineering')).toBeNull();
    expect(classifyRole('Engineer', 'Facilities')).toBeNull();
    expect(classifyRole('Engineer')).toBeNull();
  });
  it('does not treat physical-engineering roles as software, even in an Engineering department', () => {
    for (const t of ['Electrical Maintenance Engineer', 'Systems and Controls Engineer', 'Lead Engineer', 'Electronics Application Engineer', 'Senior Mechanical Engineer', 'Commissioning Engineer', 'Quality Engineer', 'Test Engineer']) {
      expect(classifyRole(t, 'Engineering'), t).toBeNull();
    }
  });
  it('still places explicit software titles regardless of department', () => {
    expect(classifyRole('Backend Engineer', 'Engineering')).toBe('software');
    expect(classifyRole('Senior Software Engineer', 'Engineering')).toBe('software');
    expect(classifyRole('Developer', 'Engineering')).toBe('software');
  });
});

describe('classifySeniority', () => {
  it.each([
    ['Graduate Software Engineer', 'entry'], ['Software Engineering Intern', 'entry'], ['Junior Designer', 'entry'],
    ['Senior Product Manager', 'senior'], ['Staff Engineer', 'principal'], ['Principal Designer', 'principal'],
    ['Engineering Manager', 'lead'], ['Head of Data', 'lead'], ['VP of Engineering', 'executive'], ['CTO', 'executive']
  ])('%s -> %s', (t, s) => expect(classifySeniority(t)).toBe(s));
  it('returns null when the title does not say', () => {
    expect(classifySeniority('Software Engineer')).toBeNull();
  });
});

describe('UK locations', () => {
  it('recognises UK places', () => {
    expect(isUkLocation(['London, UK'])).toBe(true);
    expect(isUkLocation(['Cardiff, London or Remote (UK)'])).toBe(true);
    expect(isUkLocation(['Edinburgh'])).toBe(true);
    expect(isUkLocation(['Remote - United Kingdom'])).toBe(true);
    expect(isUkLocation(['Somewhere'], ['GB'])).toBe(true);
  });
  it('rejects other countries and look-alikes', () => {
    expect(isUkLocation(['New York, NY'])).toBe(false);
    expect(isUkLocation(['London, Ontario'])).toBe(false);
    expect(isUkLocation(['Remote'])).toBe(false);
    expect(isUkLocation(['Berlin, Germany'])).toBe(false);
    expect(isUkLocation(['Remote (EMEA)'])).toBe(false);
    expect(isUkLocation(['New York, NY (HQ)', 'USA'])).toBe(false);
    for (const l of ['Birmingham, AL', 'Cambridge, MA', 'Reading, PA', 'Manchester, NH', 'Portsmouth, VA', 'Bristol, CT', 'Oxford, MS', 'Durham, NC', 'Dublin, Ireland', 'Toronto, ON']) {
      expect(isUkLocation([l]), l).toBe(false);
    }
    expect(isUkLocation(['Cambridge, UK'])).toBe(true);
    expect(isUkLocation(['Birmingham'])).toBe(true);
    expect(isUkLocation(['York'])).toBe(true);
  });
  it('picks out a city', () => {
    expect(ukCity(['Cardiff, London or Remote (UK)'])).toBe('Cardiff');
    expect(ukCity(['Remote - UK'])).toBeNull();
  });
});

describe('work mode and employment type', () => {
  it('reads the location string', () => {
    expect(inferWorkMode('Remote (UK)')).toEqual({ mode: 'remote', from: 'location' });
    expect(inferWorkMode('London (Hybrid)')).toEqual({ mode: 'hybrid', from: 'location' });
    expect(inferWorkMode('Cardiff, London or Remote (UK)')).toEqual({ mode: 'flexible', from: 'location' });
  });
  it('does not read "on-site parking" as an on-site role', () => {
    expect(inferWorkMode('London', 'Great benefits, on-site parking, free lunch.')).toBeNull();
    expect(inferWorkMode('London', 'This role is office-based in our Cambridge site.')).toEqual({ mode: 'onsite', from: 'text' });
    expect(inferWorkMode('London', 'This is an on-site role with shift work.')).toEqual({ mode: 'onsite', from: 'text' });
  });
  it('falls back to the description and otherwise says nothing', () => {
    expect(inferWorkMode('London', 'This is a hybrid role, 2 days in the office')).toEqual({ mode: 'hybrid', from: 'text' });
    expect(inferWorkMode('London', 'Join our team')).toBeNull();
  });
  it('maps structured employment types', () => {
    expect(mapEmploymentType('FullTime')).toBe('full_time');
    expect(mapEmploymentType('Full-time')).toBe('full_time');
    expect(mapEmploymentType('Part time')).toBe('part_time');
    expect(mapEmploymentType('Intern')).toBe('internship');
    expect(mapEmploymentType('Contractor')).toBe('contract');
    expect(mapEmploymentType('Other')).toBeNull();
    expect(inferEmploymentType('Data Analyst (6 month contract)')).toBe('contract');
  });
});

describe('parseSalary', () => {
  it('parses GBP ranges in several styles', () => {
    expect(parseSalary('Salary: £42,500 - £55,000 plus equity')).toEqual({ min: 42500, max: 55000, currency: 'GBP', period: 'year' });
    expect(parseSalary('£60k-£80k')).toEqual({ min: 60000, max: 80000, currency: 'GBP', period: 'year' });
    expect(parseSalary('£60-80k per year')).toEqual({ min: 60000, max: 80000, currency: 'GBP', period: 'year' });
    expect(parseSalary('between £50,000 and £60,000 per annum')).toMatchObject({ min: 50000, max: 60000 });
  });
  it('recognises day and hour rates', () => {
    expect(parseSalary('£400 - £500 per day')).toMatchObject({ period: 'day', min: 400, max: 500 });
    expect(parseSalary('£25 - £30 per hour')).toMatchObject({ period: 'hour' });
  });
  it('prefers GBP and ignores single figures and non-salaries', () => {
    expect(parseSalary('$120,000 - $150,000 or £90,000 - £110,000')).toMatchObject({ currency: 'GBP', min: 90000 });
    expect(parseSalary('Pays £42,500 pro rata')).toBeNull();
    expect(parseSalary('Join 10 - 20 people in our team')).toBeNull();
    expect(parseSalary('Raised £5 - £8 million')).toBeNull();
    expect(parseSalary('No salary here')).toBeNull();
  });
});

describe('sponsorshipSignal', () => {
  const sig = (t: string) => sponsorshipSignal(t).signal;
  it('detects offered sponsorship', () => {
    expect(sig('We offer visa sponsorship for this role.')).toBe('offered');
    expect(sig('Visa sponsorship is available for the right candidate.')).toBe('offered');
    expect(sig('We can sponsor your Skilled Worker visa.')).toBe('offered');
    expect(sig('We are a licensed sponsor and provide visa support.')).toBe('offered');
  });
  it('detects refusals', () => {
    expect(sig('Unfortunately we are unable to offer visa sponsorship.')).toBe('not_offered');
    expect(sig('No visa sponsorship is available.')).toBe('not_offered');
    expect(sig('We do not sponsor visas for this position.')).toBe('not_offered');
    expect(sig('Candidates must be able to work in the UK without sponsorship.')).toBe('not_offered');
    expect(sig('We cannot sponsor applicants for this role')).toBe('not_offered');
  });
  it('does not read a refusal as an offer (negation contains positive words)', () => {
    expect(sig('We are not able to provide visa sponsorship at this time.')).toBe('not_offered');
  });
  it('flags a conflict instead of guessing', () => {
    expect(sig('We offer visa sponsorship for senior roles. We are unable to offer visa sponsorship for this role.')).toBe('unclear');
  });
  it('treats a bare right-to-work requirement as weaker than a refusal', () => {
    expect(sig('You must have the right to work in the UK.')).toBe('right_to_work');
  });
  it('says nothing when nothing is said, and quotes what it found', () => {
    expect(sig('Join our friendly team in London. Great benefits.')).toBe('unmentioned');
    expect(sponsorshipSignal('Great team. We offer visa sponsorship. Apply now.').snippet).toContain('visa sponsorship');
    expect(sponsorshipSignal('Nothing relevant').snippet).toBeNull();
  });
});

describe('skills, years, degree, text', () => {
  it('extracts skills without false positives', () => {
    const s = extractSkills('Experience with Python, TypeScript, React and AWS. Java and JavaScript. Kubernetes a plus.');
    expect(s).toEqual(expect.arrayContaining(['Python', 'TypeScript', 'React', 'AWS', 'Java', 'JavaScript', 'Kubernetes']));
    expect(extractSkills('We go the extra mile. Swift response times.')).not.toContain('Go');
  });
  it('reads years of experience', () => {
    expect(extractYears('You have 5+ years of professional experience')).toBe(5);
    expect(extractYears('3-5 years experience in data')).toBe(3);
    expect(extractYears('We have 40 years of history')).toBeNull();
  });
  it('spots degree mentions', () => {
    expect(mentionsDegree("Bachelor's degree in CS")).toBe(true);
    expect(mentionsDegree('No formal qualifications needed')).toBe(false);
  });
  it('converts Greenhouse-style double-escaped HTML to text', () => {
    const t = htmlToText('&lt;div&gt;&lt;p&gt;We&amp;rsquo;re hiring&lt;/p&gt;&lt;ul&gt;&lt;li&gt;£50,000&amp;nbsp;- £60,000&lt;/li&gt;&lt;/ul&gt;&lt;/div&gt;');
    expect(t).toContain('We’re hiring');
    expect(t).toContain('£50,000 - £60,000');
    expect(t).not.toContain('<');
  });
  it('decodes numeric entities safely', () => {
    expect(decodeEntities('&#163;10 &#x41; &#99999999999;')).toContain('£10 A');
  });
});
