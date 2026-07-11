import { findPhoneNumbersInText, type CountryCode } from 'libphonenumber-js';
import type { Finding, PivotCandidate, QueryType } from '../types';
import { isUsableName } from './textFilters';
import { queryKey } from './queryKey';

const EMAIL_RE = /[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/g;
const DOMAIN_RE = /\b(?:[a-zA-Z0-9-]+\.)+[a-zA-Z]{2,}\b/g;
const HANDLE_RE = /(?:^|[\s(])@([a-zA-Z0-9_]{2,32})\b/g;
const IPV4_RE = /\b(?:\d{1,3}\.){3}\d{1,3}\b/g;

// Fields that hold a person's actual name - worth re-searching (as a
// general/keyword query against DuckDuckGo, Wikipedia, etc.) even though a
// name has no dedicated "search by name" connector of its own.
const NAME_FIELD_KEYS = ['name', 'fullName'];

// Fields holding a bare handle on another platform - e.g. Gravatar's linked
// accounts (`{ username: "jdoe", domain: "twitter.com" }`) or Keybase's
// proven proofs (`{ nametag: "jdoe" }`). These don't have an "@" prefix in
// the source text, so HANDLE_RE alone would miss them.
const USERNAME_FIELD_KEYS = ['username', 'nametag', 'twitter', 'handle'];
const USERNAME_VALUE_RE = /^[a-zA-Z0-9_.]{2,32}$/;

// Domains that are too generic/common to be useful pivots on their own -
// either OsickTool's own sources, or major platforms so ubiquitous (they
// show up constantly in "linked account" domain fields) that re-searching
// the bare domain itself carries no signal.
const DOMAIN_STOPLIST = new Set([
  'github.com', 'gitlab.com', 'npmjs.com', 'docker.com', 'reddit.com',
  'news.ycombinator.com', 'keybase.io', 'gravatar.com', 'duckduckgo.com',
  'wikipedia.org', 'shodan.io', 'chess.com', 'lichess.org', 'codeforces.com',
  'google.com', 'schema.org', 'w3.org', 'example.com',
  'twitter.com', 'x.com', 'linkedin.com', 'instagram.com', 'facebook.com',
  'tiktok.com', 'youtube.com', 'bsky.app', 'mastodon.social', 'telegram.org',
]);

// Structured fields that hold a dotted-looking string which is NOT a
// pivot-worthy domain/keyword: an email's own local part ("jane.doe" from
// "jane.doe@example.com" - domain-shaped purely by coincidence), and
// image/CDN URLs (a platform's avatar host, not anything about the target).
const PIVOT_SCAN_EXCLUDE_KEYS = new Set(['localPart', 'avatar', 'avatarUrl']);

function collectText(finding: Finding): string {
  const parts = [finding.title, finding.detail ?? ''];
  if (finding.data) {
    for (const [key, v] of Object.entries(finding.data)) {
      if (typeof v === 'string' && !PIVOT_SCAN_EXCLUDE_KEYS.has(key)) parts.push(v);
    }
  }
  return parts.join(' \n ');
}

/**
 * Scans a finding's text/data for new candidate identifiers (emails,
 * domains, @handles, IPs) that the analyst can pivot the search to.
 * Never includes the value that was just searched for.
 */
// Connectors whose findings are constructed queries/links rather than
// actually discovered data - scanning them for pivots would "discover" the
// query's own scaffolding (a platform name, a `site:` filter) as if it were
// new information about the target.
const NO_PIVOT_CONNECTORS = new Set(['site-directory', 'google-dork-links']);

export function extractPivots(finding: Finding): PivotCandidate[] {
  if (NO_PIVOT_CONNECTORS.has(finding.connectorId)) return [];

  const text = collectText(finding);
  const seen = new Set<string>();
  const out: PivotCandidate[] = [];
  // Canonicalized (not raw-string) so a phone number found in the results
  // doesn't loop back as a "new" pivot just because it's formatted
  // differently than what was typed (e.g. "4155552671" vs "+14155552671").
  const originalKey = queryKey(finding.query.type, finding.query.value, finding.query.country);

  const add = (value: string, type: QueryType, country?: string) => {
    const key = queryKey(type, value, country);
    if (key === originalKey) return;
    if (seen.has(key)) return;
    seen.add(key);
    out.push({ value, type, origin: finding.connectorName, country });
  };

  for (const m of text.matchAll(EMAIL_RE)) add(m[0], 'email');
  for (const m of text.matchAll(HANDLE_RE)) add(m[1], 'username');
  for (const m of text.matchAll(IPV4_RE)) add(m[0], 'general');
  for (const m of text.matchAll(DOMAIN_RE)) {
    // "jane.doe@example.com" matches DOMAIN_RE twice - once for the local
    // part "jane.doe" and once for the real domain "example.com", since '@'
    // isn't part of the pattern. A match immediately followed by '@' is the
    // local part of an email, not a domain - skip it.
    if (text[m.index + m[0].length] === '@') continue;
    const domain = m[0].toLowerCase().replace(/^www\./, '');
    if (DOMAIN_STOPLIST.has(domain)) continue;
    if (domain.split('.').length < 2) continue;
    add(domain, 'general');
  }

  // Phone numbers embedded in bios, WHOIS records, carrier lookups, etc.
  // The original query's country (if any) helps resolve local-format
  // numbers; libphonenumber-js resolves the region for each match itself,
  // which we carry forward so the eventual re-search doesn't have to guess.
  try {
    const phoneMatches = findPhoneNumbersInText(
      text,
      finding.query.country ? { defaultCountry: finding.query.country as CountryCode } : undefined,
    );
    for (const match of phoneMatches) {
      if (!match.number.isValid()) continue;
      add(match.number.number, 'phone', match.number.country);
    }
  } catch {
    // Malformed input text can make the phone parser throw - never let a
    // pivot-extraction bug break the rest of the search.
  }

  // A person's actual name has no dedicated connector, but it's still worth
  // re-searching as a keyword (DuckDuckGo, Wikipedia) - unlike the other
  // pivot types this one is inherently noisier (common names collide), so
  // it's included but not weighted any differently downstream.
  const data = finding.data ?? {};
  for (const key of NAME_FIELD_KEYS) {
    const raw = data[key];
    if (typeof raw === 'string' && isUsableName(raw)) add(raw.trim(), 'general');
  }

  // Bare handles on other platforms, surfaced via structured fields rather
  // than an "@mention" in free text.
  for (const key of USERNAME_FIELD_KEYS) {
    const raw = data[key];
    if (typeof raw === 'string' && USERNAME_VALUE_RE.test(raw.trim())) add(raw.trim(), 'username');
  }

  return out;
}

export function extractAllPivots(findings: Finding[]): PivotCandidate[] {
  const merged = new Map<string, PivotCandidate>();
  for (const f of findings) {
    for (const p of extractPivots(f)) {
      const key = queryKey(p.type, p.value, p.country);
      if (!merged.has(key)) merged.set(key, p);
    }
  }
  return [...merged.values()];
}
