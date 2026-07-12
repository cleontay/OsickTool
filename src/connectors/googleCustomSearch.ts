import type { Connector, Finding, SearchQuery } from '../types';
import { fetchJson, nextId, redactUrl } from '../lib/fetchUtils';
import { buildDorkQueries } from '../lib/googleDork';

interface CseItem {
  title: string;
  link: string;
  snippet?: string;
  displayLink?: string;
}
interface CseResponse {
  items?: CseItem[];
  error?: { code: number; message: string };
}

/**
 * Real, ranked Google results via Google's own Custom Search JSON API - the
 * only officially supported, CORS-friendly way to get actual search results
 * into a client-only app (see googleDorkLinks.ts for why plain Google Search
 * itself isn't reachable this way). Free tier is 100 queries/day, so only
 * the single most broadly useful dork is run automatically per search
 * (the rest stay available as click-through links) to avoid burning through
 * that quota on one search.
 */
export const googleCustomSearchConnector: Connector = {
  id: 'google-cse',
  name: 'Google Custom Search',
  description: 'Real ranked Google results for the top dork query (requires a free Google Custom Search API key + Search Engine ID in Settings).',
  supports: ['username', 'email', 'phone', 'ic', 'social', 'general', 'dork'],
  apiKeyId: 'googleCseKey',
  async run(query: SearchQuery, ctx): Promise<Finding[]> {
    const apiKey = ctx.apiKeys.googleCseKey;
    const cx = ctx.apiKeys.googleCseId;
    if (!apiKey || !cx) return [];

    const [topDork] = buildDorkQueries(query.type, query.value);
    if (!topDork) return [];

    const url = `https://www.googleapis.com/customsearch/v1?key=${encodeURIComponent(apiKey)}&cx=${encodeURIComponent(cx)}&q=${encodeURIComponent(topDork.query)}&num=10`;
    const res = await fetchJson<CseResponse>(url, { signal: ctx.signal, timeoutMs: 10000 });
    if (!res?.items?.length) return [];
    const rawSourceUrl = redactUrl(url);

    return res.items.map((item) => ({
      id: nextId(),
      connectorId: 'google-cse',
      connectorName: 'Google Custom Search',
      tab: 'dorks' as const,
      title: item.title,
      detail: item.snippet,
      link: item.link,
      confidence: 'confirmed' as const,
      query,
      timestamp: Date.now(),
      raw: res,
      rawSourceUrl,
      data: { source: item.displayLink, dork: topDork.query },
    }));
  },
};
