import type { Connector, Finding, SearchQuery } from '../types';
import { fetchJson, nextId, redactUrl } from '../lib/fetchUtils';

interface WikiSearchResponse {
  query?: {
    search?: Array<{ title: string; snippet: string; pageid: number }>;
  };
}

// MediaWiki officially supports anonymous cross-origin requests when the
// `origin=*` parameter is present. See:
// https://www.mediawiki.org/wiki/API:Cross-site_requests
export const wikipediaConnector: Connector = {
  id: 'wikipedia',
  name: 'Wikipedia',
  description: 'Full-text search across Wikipedia articles for the query.',
  supports: ['general', 'social', 'username'],
  async run(query: SearchQuery, ctx): Promise<Finding[]> {
    const url = `https://en.wikipedia.org/w/api.php?action=query&list=search&srsearch=${encodeURIComponent(
      query.value,
    )}&format=json&origin=*&srlimit=5`;
    const res = await fetchJson<WikiSearchResponse>(url, { signal: ctx.signal });
    const results = res?.query?.search ?? [];
    if (results.length === 0) return [];

    return results.map((r) => ({
      id: nextId(),
      connectorId: 'wikipedia',
      connectorName: 'Wikipedia',
      tab: 'other' as const,
      title: r.title,
      detail: r.snippet.replace(/<[^>]+>/g, ''),
      link: `https://en.wikipedia.org/wiki/${encodeURIComponent(r.title.replace(/ /g, '_'))}`,
      confidence: 'info' as const,
      query,
      timestamp: Date.now(),
      raw: res,
      rawSourceUrl: redactUrl(url),
      data: { pageId: r.pageid },
    }));
  },
};
