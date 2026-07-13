import { getCountries } from 'libphonenumber-js';
import type { QueryType } from '../types';

const DOMAIN_RE = /^(?:[a-z0-9-]+\.)+[a-z]{2,}$/i;
const IPV4_RE = /^(\d{1,3}\.){3}\d{1,3}$/;

export interface DorkQuery {
  query: string;
  /** Short label explaining what this dork is hunting for. */
  purpose: string;
}

function quote(value: string): string {
  return `"${value}"`;
}

/** Resolves an ISO 3166-1 alpha-2 code (e.g. "SG") to its English display
 * name (e.g. "Singapore") via the built-in Intl API - no extra data file.
 * Intl.DisplayNames doesn't reject a syntactically-valid-looking but unused
 * code (e.g. "ZZ"), so the code is cross-checked against libphonenumber-js's
 * actual supported region list first. */
function countryName(code: string): string | null {
  if (!getCountries().includes(code as ReturnType<typeof getCountries>[number])) return null;
  try {
    return new Intl.DisplayNames(['en'], { type: 'region' }).of(code) ?? null;
  } catch {
    return null;
  }
}

/**
 * Builds a curated set of Google dork queries tailored to the query type -
 * standard, widely-documented OSINT recon patterns (exact-phrase search,
 * site/filetype scoping, common leak-hosting sites), not anything novel.
 * Each is meant to be opened by a human in their own browser - this never
 * fetches Google itself (see connectors/googleDorkLinks.ts for why: Google
 * Search has no CORS-enabled, keyless API, and scraping it isn't something
 * a client-only static app should attempt).
 */
export function buildDorkQueries(type: QueryType, value: string, country?: string): DorkQuery[] {
  const v = value.trim();
  if (!v) return [];

  switch (type) {
    case 'dork':
      // Power-user escape hatch: use exactly what was typed, untouched.
      return [{ query: v, purpose: 'Custom query, as typed' }];

    case 'email':
      return [
        { query: quote(v), purpose: 'Exact mentions anywhere' },
        { query: `${quote(v)} filetype:pdf OR filetype:doc OR filetype:xlsx`, purpose: 'Exposed in a document' },
        { query: `${quote(v)} site:pastebin.com OR site:trello.com OR site:docs.google.com`, purpose: 'Leak/paste sites & shared docs' },
        { query: `intext:${quote(v)}`, purpose: 'Mentioned in page body text' },
      ];

    case 'phone': {
      const dorks: DorkQuery[] = [
        { query: quote(v), purpose: 'Exact mentions anywhere' },
        { query: `${quote(v)} (contact OR profile OR resume OR "about us")`, purpose: 'Contact/profile pages' },
      ];
      // A phone number alone is ambiguous across the many local-format
      // variants a site might display it in - narrowing by the number's own
      // resolved country cuts down on unrelated results from elsewhere in
      // the world that just happen to share the same digits out of context.
      const cName = country ? countryName(country) : null;
      if (cName) {
        dorks.push({
          query: `${quote(v)} ${quote(cName)} (contact OR profile OR resume OR "about us")`,
          purpose: `Contact/profile pages in ${cName}`,
        });
      }
      return dorks;
    }

    case 'username':
    case 'social':
      return [
        { query: quote(v), purpose: 'Exact mentions anywhere' },
        { query: `intitle:${quote(v)}`, purpose: 'Pages titled with this handle' },
        { query: `${quote(v)} (resume OR cv OR bio OR "about me")`, purpose: 'Personal bio/resume pages' },
        { query: `${quote(v)} filetype:pdf`, purpose: 'Exposed in a PDF' },
        { query: `site:pastebin.com ${quote(v)}`, purpose: 'Leak/paste sites' },
      ];

    case 'ic':
      return [
        { query: quote(v), purpose: 'Exact mentions anywhere' },
        { query: `${quote(v)} filetype:pdf OR filetype:xlsx`, purpose: 'Exposed in a document' },
      ];

    case 'general': {
      if (IPV4_RE.test(v)) {
        return [
          { query: quote(v), purpose: 'Exact mentions anywhere' },
          { query: `${quote(v)} (shodan OR censys OR abuse)`, purpose: 'Threat-intel / abuse mentions' },
        ];
      }
      if (DOMAIN_RE.test(v)) {
        return [
          { query: `site:${v}`, purpose: 'Everything Google has indexed on this domain' },
          { query: `site:${v} filetype:pdf OR filetype:xlsx OR filetype:docx`, purpose: 'Exposed documents' },
          { query: `site:${v} intitle:"index of"`, purpose: 'Open directory listings' },
          { query: `site:${v} inurl:admin OR inurl:login`, purpose: 'Admin/login pages' },
          { query: `site:${v} ext:sql OR ext:env OR ext:log OR ext:bak`, purpose: 'Accidentally exposed config/backup files' },
        ];
      }
      // Treat as a free-text keyword or a person's name.
      return [
        { query: quote(v), purpose: 'Exact mentions anywhere' },
        { query: `${quote(v)} resume filetype:pdf`, purpose: 'Resume/CV mentions' },
        { query: `${quote(v)} (site:linkedin.com OR site:facebook.com OR site:instagram.com)`, purpose: 'Social profile mentions' },
        { query: `${quote(v)} (obituary OR wedding OR graduation)`, purpose: 'Public life-event records' },
        { query: `${quote(v)} ("phone" OR "email" OR "contact")`, purpose: 'Pages listing contact info' },
      ];
    }

    default:
      return [{ query: quote(v), purpose: 'Exact mentions anywhere' }];
  }
}

export function dorkSearchUrl(query: string): string {
  return `https://www.google.com/search?q=${encodeURIComponent(query)}`;
}
