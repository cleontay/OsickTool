import type { Finding } from '../types';
import { isUsableName } from './textFilters';
import { looksLikePersonName } from './classify';

// Fields holding a single freeform value - must NOT be comma-split, since
// values like "Austin, TX" or "Doe & Associates, LLC" are one atomic value
// that happens to contain a comma, not a list.
const NAME_KEYS = ['name', 'fullName', 'registrantName'];
const EMAIL_KEYS = ['email', 'registrantEmail'];
const LOCATION_KEYS = ['location', 'city', 'currentLocation', 'country'];
const ORG_KEYS = ['company', 'organization', 'jobTitle', 'registrantOrg', 'isp'];
const PHONE_KEYS = ['internationalFormat'];
const BIRTHDATE_KEYS = ['birthDate'];

// Fields a connector explicitly joins as a comma-separated list of several
// distinct values (e.g. npm's `emails: "a@x.com, b@y.com"`) - safe to split.
const EMAIL_LIST_KEYS = ['emails'];

function collectAtomic(findings: Finding[], keys: string[]): Set<string> {
  const values = new Set<string>();
  for (const f of findings) {
    const data = f.data ?? {};
    for (const key of keys) {
      const raw = data[key];
      if (typeof raw !== 'string') continue;
      const trimmed = raw.trim();
      if (isUsableName(trimmed)) values.add(trimmed);
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
        if (isUsableName(trimmed)) values.add(trimmed);
      }
    }
  }
  return values;
}

/** Every distinct value actually searched for a given query type - the
 * canonical source of "every email/username/phone this investigation has
 * confirmed", regardless of whether a connector also happened to echo it
 * back in a data field. */
function collectSearchedValues(findings: Finding[], type: Finding['query']['type']): Set<string> {
  const values = new Set<string>();
  for (const f of findings) {
    if (f.query.type === type) values.add(f.query.value);
  }
  return values;
}

function estimateAge(birthDate: string): number | null {
  const parsed = new Date(birthDate);
  if (Number.isNaN(parsed.getTime())) return null;
  const now = new Date();
  let age = now.getFullYear() - parsed.getFullYear();
  const hasNotHadBirthdayYet =
    now.getMonth() < parsed.getMonth() || (now.getMonth() === parsed.getMonth() && now.getDate() < parsed.getDate());
  if (hasNotHadBirthdayYet) age -= 1;
  return age >= 0 && age < 130 ? age : null;
}

/**
 * Cross-references every finding collected so far (regardless of which tab
 * it lives in) into a single consolidated profile - names, emails, phone
 * numbers, usernames, locations, organizations, and date of birth that
 * showed up on two or more independent sources carry more weight than any
 * single source alone.
 */
export function buildIdentitySummary(allFindings: Finding[]): Finding | null {
  // A guessed handle (e.g. a generated username permutation) existing as a
  // real account only confirms the handle is taken - not that the account
  // belongs to the target. Folding its name/company/location fields into
  // the "confirmed" profile would misattribute a stranger's identity to the
  // target just because a common name produced a collision. Speculative
  // findings still surface normally in their own tab (and still drive
  // further enrichment) - they're only excluded from this aggregation.
  const findings = allFindings.filter((f) => !f.query.speculative);
  if (findings.length === 0) return null;

  // A general-type search is only ever run because someone typed that exact
  // name in expecting it to be about the target - unlike a data field
  // *found* on some other source, there's no ambiguity about whose name it
  // is. Include it directly rather than relying on some connector to have
  // echoed it back in a "name" field.
  const names = new Set([
    ...collectAtomic(findings, NAME_KEYS),
    ...[...collectSearchedValues(findings, 'general')].filter(looksLikePersonName),
  ]);
  const emails = new Set([
    ...collectAtomic(findings, EMAIL_KEYS),
    ...collectList(findings, EMAIL_LIST_KEYS),
    ...collectSearchedValues(findings, 'email'),
  ]);
  const phones = new Set([...collectAtomic(findings, PHONE_KEYS), ...collectSearchedValues(findings, 'phone')]);
  const usernames = new Set([
    ...collectSearchedValues(findings, 'username'),
    ...collectSearchedValues(findings, 'social'),
  ]);
  const locations = collectAtomic(findings, LOCATION_KEYS);
  const orgs = collectAtomic(findings, ORG_KEYS);
  const birthDates = collectAtomic(findings, BIRTHDATE_KEYS);

  if (
    names.size === 0 &&
    emails.size === 0 &&
    phones.size === 0 &&
    usernames.size === 0 &&
    locations.size === 0 &&
    orgs.size === 0 &&
    birthDates.size === 0
  ) {
    return null;
  }

  const primaryName = [...names][0];
  const sourceCount = new Set(findings.map((f) => f.connectorName)).size;
  const ages = [...birthDates].map(estimateAge).filter((a): a is number => a !== null);

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
      phones: [...phones].join(', ') || undefined,
      usernames: [...usernames].join(', ') || undefined,
      locations: [...locations].join(', ') || undefined,
      organizations: [...orgs].join(', ') || undefined,
      birthDate: [...birthDates].join(', ') || undefined,
      estimatedAge: ages.length > 0 ? [...new Set(ages)].join(' or ') : undefined,
    },
  };
}
