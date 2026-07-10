import type { Finding } from '../types';

// Fields holding a single freeform value - must NOT be comma-split, since
// values like "Austin, TX" or "Doe & Associates, LLC" are one atomic value
// that happens to contain a comma, not a list.
const NAME_KEYS = ['name', 'fullName', 'registrantName'];
const EMAIL_KEYS = ['email', 'registrantEmail'];
const LOCATION_KEYS = ['location', 'city', 'currentLocation', 'country'];
const ORG_KEYS = ['company', 'organization', 'jobTitle', 'registrantOrg', 'isp'];

// Fields a connector explicitly joins as a comma-separated list of several
// distinct values (e.g. npm's `emails: "a@x.com, b@y.com"`) - safe to split.
const EMAIL_LIST_KEYS = ['emails'];

const GENERIC_NAME_RE = /^(n\/a|none|unknown|redacted|privacy|proxy)$/i;

function collectAtomic(findings: Finding[], keys: string[]): Set<string> {
  const values = new Set<string>();
  for (const f of findings) {
    const data = f.data ?? {};
    for (const key of keys) {
      const raw = data[key];
      if (typeof raw !== 'string') continue;
      const trimmed = raw.trim();
      if (trimmed && !GENERIC_NAME_RE.test(trimmed)) values.add(trimmed);
    }
  }
  return values;
}

function collectList(findings: Finding[], keys: string[]): Set<string> {
  const values = new Set<string>();
  for (const f of findings) {
    const data = f.data ?? {};
    for (const key of keys) {
      const raw = data[key];
      if (typeof raw !== 'string' || !raw.trim()) continue;
      for (const part of raw.split(',')) {
        const trimmed = part.trim();
        if (trimmed && !GENERIC_NAME_RE.test(trimmed)) values.add(trimmed);
      }
    }
  }
  return values;
}

/**
 * Cross-references every finding collected so far (regardless of which tab
 * it lives in) into a single consolidated profile - names, emails,
 * locations, and organizations that showed up on two or more independent
 * sources carry more weight than any single source alone.
 */
export function buildIdentitySummary(findings: Finding[]): Finding | null {
  if (findings.length === 0) return null;

  const names = collectAtomic(findings, NAME_KEYS);
  const emails = new Set([...collectAtomic(findings, EMAIL_KEYS), ...collectList(findings, EMAIL_LIST_KEYS)]);
  const locations = collectAtomic(findings, LOCATION_KEYS);
  const orgs = collectAtomic(findings, ORG_KEYS);

  if (names.size === 0 && emails.size === 0 && locations.size === 0 && orgs.size === 0) return null;

  const primaryName = [...names][0];
  const sourceCount = new Set(findings.map((f) => f.connectorName)).size;

  return {
    id: 'identity-summary',
    connectorId: 'identity-summary',
    connectorName: 'Consolidated Profile',
    tab: 'identity',
    title: primaryName
      ? `Consolidated profile: ${primaryName}${names.size > 1 ? ` (+${names.size - 1} name variant${names.size > 2 ? 's' : ''})` : ''}`
      : 'Consolidated profile',
    detail: `Cross-referenced from ${sourceCount} source(s) collected so far. Auto-generated - verify before relying on it.`,
    confidence: 'info',
    query: findings[0].query,
    timestamp: Date.now(),
    data: {
      names: [...names].join(', ') || undefined,
      emails: [...emails].join(', ') || undefined,
      locations: [...locations].join(', ') || undefined,
      organizations: [...orgs].join(', ') || undefined,
    },
  };
}
