import type { Finding, PivotCandidate, QueryType } from '../types';

const EMAIL_RE = /[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/g;
const DOMAIN_RE = /\b(?:[a-zA-Z0-9-]+\.)+[a-zA-Z]{2,}\b/g;
const HANDLE_RE = /(?:^|[\s(])@([a-zA-Z0-9_]{2,32})\b/g;
const IPV4_RE = /\b(?:\d{1,3}\.){3}\d{1,3}\b/g;

// Domains that are too generic/common to be useful pivots on their own.
const DOMAIN_STOPLIST = new Set([
  'github.com', 'gitlab.com', 'npmjs.com', 'docker.com', 'reddit.com',
  'news.ycombinator.com', 'keybase.io', 'gravatar.com', 'duckduckgo.com',
  'wikipedia.org', 'shodan.io', 'chess.com', 'lichess.org', 'codeforces.com',
  'google.com', 'schema.org', 'w3.org', 'example.com',
]);

function collectText(finding: Finding): string {
  const parts = [finding.title, finding.detail ?? ''];
  if (finding.data) {
    for (const v of Object.values(finding.data)) {
      if (typeof v === 'string') parts.push(v);
    }
  }
  return parts.join(' \n ');
}

/**
 * Scans a finding's text/data for new candidate identifiers (emails,
 * domains, @handles, IPs) that the analyst can pivot the search to.
 * Never includes the value that was just searched for.
 */
export function extractPivots(finding: Finding): PivotCandidate[] {
  const text = collectText(finding);
  const seen = new Set<string>();
  const out: PivotCandidate[] = [];
  const originalValue = finding.query.value.toLowerCase();

  const add = (value: string, type: QueryType) => {
    const key = `${type}:${value.toLowerCase()}`;
    if (value.toLowerCase() === originalValue) return;
    if (seen.has(key)) return;
    seen.add(key);
    out.push({ value, type, origin: finding.connectorName });
  };

  for (const m of text.matchAll(EMAIL_RE)) add(m[0], 'email');
  for (const m of text.matchAll(HANDLE_RE)) add(m[1], 'username');
  for (const m of text.matchAll(IPV4_RE)) add(m[0], 'general');
  for (const m of text.matchAll(DOMAIN_RE)) {
    const domain = m[0].toLowerCase();
    if (DOMAIN_STOPLIST.has(domain)) continue;
    if (domain.split('.').length < 2) continue;
    add(domain, 'general');
  }

  return out;
}

export function extractAllPivots(findings: Finding[]): PivotCandidate[] {
  const merged = new Map<string, PivotCandidate>();
  for (const f of findings) {
    for (const p of extractPivots(f)) {
      const key = `${p.type}:${p.value.toLowerCase()}`;
      if (!merged.has(key)) merged.set(key, p);
    }
  }
  return [...merged.values()];
}
