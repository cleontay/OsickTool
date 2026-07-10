import type { Connector, Finding, SearchQuery } from '../types';
import { fetchJson, nextId } from '../lib/fetchUtils';

interface DdgTopic {
  Text?: string;
  FirstURL?: string;
  Topics?: DdgTopic[];
}
interface DdgResponse {
  Heading?: string;
  AbstractText?: string;
  AbstractURL?: string;
  AbstractSource?: string;
  Answer?: string;
  Definition?: string;
  DefinitionURL?: string;
  RelatedTopics?: DdgTopic[];
}

export const duckduckgoConnector: Connector = {
  id: 'duckduckgo',
  name: 'DuckDuckGo',
  description: 'DuckDuckGo Instant Answer API - general-purpose lookups for names, brands, and topics.',
  supports: ['general', 'social', 'username'],
  async run(query: SearchQuery, ctx): Promise<Finding[]> {
    const res = await fetchJson<DdgResponse>(
      `https://api.duckduckgo.com/?q=${encodeURIComponent(query.value)}&format=json&no_html=1&skip_disambig=1`,
      { signal: ctx.signal },
    );
    if (!res) return [];

    const findings: Finding[] = [];
    if (res.AbstractText) {
      findings.push({
        id: nextId(),
        connectorId: 'duckduckgo',
        connectorName: 'DuckDuckGo',
        tab: 'other',
        title: res.Heading || 'DuckDuckGo instant answer',
        detail: res.AbstractText,
        link: res.AbstractURL || undefined,
        confidence: 'info',
        query,
        timestamp: Date.now(),
        data: { source: res.AbstractSource },
      });
    }
    if (res.Answer) {
      findings.push({
        id: nextId(),
        connectorId: 'duckduckgo',
        connectorName: 'DuckDuckGo',
        tab: 'other',
        title: 'DuckDuckGo direct answer',
        detail: res.Answer,
        confidence: 'info',
        query,
        timestamp: Date.now(),
      });
    }
    const related = (res.RelatedTopics ?? []).flatMap((t) => (t.Topics ? t.Topics : [t])).slice(0, 8);
    for (const t of related) {
      if (!t.Text || !t.FirstURL) continue;
      findings.push({
        id: nextId(),
        connectorId: 'duckduckgo',
        connectorName: 'DuckDuckGo (related)',
        tab: 'other',
        title: t.Text.split(' - ')[0],
        detail: t.Text,
        link: t.FirstURL,
        confidence: 'info',
        query,
        timestamp: Date.now(),
      });
    }

    return findings;
  },
};
