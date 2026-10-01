/**
 * Name-based sector classifier. It only sees the organisation name, so every tag it
 * produces is INFERRED, not verified. Website-based classification (M2) upgrades these.
 */
export const SECTOR_TAGS = [
  'tech',
  'software',
  'ai',
  'data',
  'cloud',
  'cybersecurity',
  'it_services',
  'digital',
  'design',
  'fintech',
  'telecoms',
  'electronics',
  'games',
  'finance',
  'healthcare',
  'education',
  'consulting',
  'engineering'
] as const;
export type SectorTag = (typeof SECTOR_TAGS)[number];

export const SECTOR_LABELS: Record<SectorTag, string> = {
  tech: 'Technology (any)',
  software: 'Software',
  ai: 'AI / ML',
  data: 'Data & analytics',
  cloud: 'Cloud / DevOps',
  cybersecurity: 'Cybersecurity',
  it_services: 'IT services',
  digital: 'Digital',
  design: 'UX / design',
  fintech: 'Fintech',
  telecoms: 'Telecoms & networks',
  electronics: 'Electronics & hardware',
  games: 'Games',
  finance: 'Finance',
  healthcare: 'Healthcare',
  education: 'Education & research',
  consulting: 'Consulting',
  engineering: 'Engineering'
};

const RULES: Record<Exclude<SectorTag, 'tech'>, RegExp> = {
  software: /\bsoftware\b|\bsaas\b|\bapps?\b|\bdevops\b|\bdevelopers?\b/i,
  ai: /\bai\b|\bartificial intelligence\b|\bmachine learning\b|\bdeep ?learning\b|\brobotics?\b|\bautomation\b|\bllm\b/i,
  data: /\bdata\b|\banalytics\b|\bdatabases?\b|\binsights?\b/i,
  cloud: /\bcloud\b|\bhosting\b|\bdatacent(re|er)s?\b/i,
  cybersecurity: /\bcyber\w*|\binfosec\b|\bpenetration\b|\bsoc\b|\bencryption\b/i,
  it_services: /\bit (services|solutions|consulting|consultancy|support|systems|recruitment)\b|\bcomputing\b|\bcomputers?\b|\binformatics\b|\btechnology (services|solutions|consulting)\b/i,
  digital: /\bdigital\b|\bonline\b|\bweb\b|\bmobile\b|\binternet\b|\bvirtual\b/i,
  design: /\bux\b|\bui\b|\buser experience\b|\bproduct design\b|\bdigital design\b|\bdesign (studio|agency|consultancy)\b/i,
  fintech: /\bfintech\b|\bpayments?\b|\bblockchain\b|\bcrypto\w*|\bneobank\b/i,
  telecoms: /\btelecom\w*|\bnetworks?\b|\bbroadband\b|\bwireless\b|\bsatellite\b/i,
  electronics: /\belectronics?\b|\bsemiconductors?\b|\bphotonics?\b|\bmicro(chip|electronics)\b|\bsensors?\b|\bquantum\b/i,
  games: /\bgames?\b|\bgaming\b|\besports?\b/i,
  finance: /\bbank\b|\bbanking\b|\bcapital\b|\basset management\b|\binsurance\b|\binvestment\b|\bfinancial\b/i,
  healthcare: /\bnhs\b|\bhospital\b|\bhealth(care)?\b|\bpharma\w*|\bbiotech\w*|\bmedical\b|\btherapeutics\b|\bgenomics?\b/i,
  education: /\buniversity\b|\bcollege\b|\bschool\b|\bacademy\b|\binstitute\b|\bresearch\b|\bsciences?\b/i,
  consulting: /\bconsult(ing|ancy|ants)\b|\badvisory\b|\bpartners\b/i,
  engineering: /\bengineering\b|\bengineers\b|\baerospace\b|\bautomotive\b|\benergy\b|\brenewables?\b/i
};

/** Sectors that imply the umbrella `tech` tag. */
const TECH_IMPLIERS: SectorTag[] = [
  'software',
  'ai',
  'data',
  'cloud',
  'cybersecurity',
  'it_services',
  'digital',
  'design',
  'fintech',
  'telecoms',
  'electronics',
  'games'
];

const TECH_DIRECT = /\btech\b|\btechnolog(y|ies)\b|\btechnologies\b/i;

const NOT_TELECOM_NETWORK = /\b(care|health|nhs|tv|television|radio|broadcast\w*|media|primary|social|support|community|business|charity|family|church)\b/i;

export function classifyName(name: string): SectorTag[] {
  const tags = new Set<SectorTag>();
  for (const [tag, re] of Object.entries(RULES) as [Exclude<SectorTag, 'tech'>, RegExp][]) {
    if (re.test(name)) tags.add(tag);
  }
  // "Network" alone is ambiguous: a primary care network or a TV network is not telecoms.
  if (tags.has('telecoms') && !/\btelecom\w*|\bbroadband\b|\bwireless\b|\bsatellite\b/i.test(name) && NOT_TELECOM_NETWORK.test(name)) tags.delete('telecoms');
  if (TECH_DIRECT.test(name) || TECH_IMPLIERS.some((t) => tags.has(t))) tags.add('tech');
  return SECTOR_TAGS.filter((t) => tags.has(t));
}
