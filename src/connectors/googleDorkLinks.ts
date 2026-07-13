import type { Connector, Finding, SearchQuery } from '../types';
import { nextId } from '../lib/fetchUtils';
import { buildDorkQueries, dorkSearchUrl } from '../lib/googleDork';

/**
 * Google Search has no free, CORS-enabled API and blocks unauthenticated
 * scraping - there is no honest way for a static client-only app to fetch
 * and parse Google results without a backend. This generates the dork
 * queries themselves as one-click links instead: you open them in your own
 * browser exactly as if you'd typed them into Google yourself. No request
 * is ever made on your behalf.
 *
 * For real ranked results inline, see connectors/googleCustomSearch.ts,
 * which uses Google's official (free-tier) Custom Search JSON API.
 */
export const googleDorkLinksConnector: Connector = {
  id: 'google-dork-links',
  name: 'Google Dork',
  description: 'Curated Google dork queries as one-click links - opens in your own browser, nothing is fetched automatically.',
  supports: ['username', 'email', 'phone', 'ic', 'social', 'general', 'dork'],
  async run(query: SearchQuery): Promise<Finding[]> {
    const dorks = buildDorkQueries(query.type, query.value, query.country);

    return dorks.map((d) => ({
      id: nextId(),
      connectorId: 'google-dork-links',
      connectorName: 'Google Dork',
      tab: 'dorks' as const,
      title: d.query,
      detail: d.purpose,
      link: dorkSearchUrl(d.query),
      confidence: 'unverified' as const,
      query,
      timestamp: Date.now(),
      data: { engine: 'Google' },
    }));
  },
};
