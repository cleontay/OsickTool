import type { Connector, Finding, SearchQuery } from '../types';
import { fetchJson, nextId } from '../lib/fetchUtils';
import { USERNAME_SITES } from '../data/usernameSites';

function buildUrl(template: string, username: string): string {
  return template.replace('{u}', encodeURIComponent(username));
}

interface AllOriginsResponse {
  contents: string;
  status: { http_code: number };
}

async function checkViaProxy(url: string, signal: AbortSignal): Promise<boolean | null> {
  const res = await fetchJson<AllOriginsResponse>(
    `https://api.allorigins.win/get?url=${encodeURIComponent(url)}`,
    { signal, timeoutMs: 6000 },
  );
  if (!res?.status) return null;
  return res.status.http_code >= 200 && res.status.http_code < 400;
}

/**
 * Generates candidate profile links across popular platforms that don't
 * expose a public, CORS-friendly API. By default these are surfaced as
 * "unverified" - links the analyst opens manually to confirm. If the user
 * has opted in to the CORS-proxy setting, a bounded number of them are
 * additionally checked for a live (2xx/3xx) response through a public
 * proxy (api.allorigins.win) - still not proof of an actual match, just
 * that *something* exists at that URL, so results stay labelled "likely".
 */
export const unverifiedSitesConnector: Connector = {
  id: 'site-directory',
  name: 'Site Directory',
  description: `Generates candidate profile URLs across ${USERNAME_SITES.length}+ popular platforms lacking a public API. Optionally verified through a third-party CORS proxy if enabled in Settings.`,
  supports: ['username', 'social'],
  requiresProxy: false,
  async run(query: SearchQuery, ctx): Promise<Finding[]> {
    const candidates = USERNAME_SITES.map((site) => ({
      site,
      url: buildUrl(site.urlTemplate, query.value),
    }));

    if (!ctx.proxyEnabled) {
      return candidates.map(({ site, url }) => ({
        id: nextId(),
        connectorId: 'site-directory',
        connectorName: 'Site Directory',
        tab: 'accounts' as const,
        title: `${site.name}: possible profile`,
        detail: 'Not verified - open the link to confirm this is the target.',
        link: url,
        confidence: 'unverified' as const,
        query,
        timestamp: Date.now(),
        data: { category: site.category },
      }));
    }

    // Bound concurrency/requests through the proxy to be a reasonable citizen.
    const CAP = 25;
    const toCheck = candidates.slice(0, CAP);
    const results = await Promise.all(
      toCheck.map(async ({ site, url }) => {
        const alive = await checkViaProxy(url, ctx.signal);
        return { site, url, alive };
      }),
    );

    return results
      .filter((r) => r.alive !== false)
      .map(({ site, url, alive }) => ({
        id: nextId(),
        connectorId: 'site-directory',
        connectorName: 'Site Directory',
        tab: 'accounts' as const,
        title: `${site.name}: possible profile`,
        detail:
          alive === true
            ? 'Page responded live via proxy check - still confirm manually, false positives are possible.'
            : 'Not verified (proxy check inconclusive) - open the link to confirm.',
        link: url,
        confidence: (alive === true ? 'likely' : 'unverified') as 'likely' | 'unverified',
        query,
        timestamp: Date.now(),
        data: { category: site.category },
      }));
  },
};
