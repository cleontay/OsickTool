import type { Connector, Finding, SearchQuery } from '../types';
import { fetchJson, nextId, redactUrl } from '../lib/fetchUtils';

interface NpmSearchResult {
  objects: Array<{
    package: {
      name: string;
      version: string;
      description?: string;
      links?: { npm?: string; homepage?: string; repository?: string };
      publisher?: { username: string; email?: string };
      maintainers?: Array<{ username: string; email?: string }>;
    };
  }>;
  total: number;
}

export const npmConnector: Connector = {
  id: 'npm',
  name: 'npm Registry',
  description: 'Packages published or maintained by this username on npm.',
  supports: ['username', 'social'],
  async run(query: SearchQuery, ctx): Promise<Finding[]> {
    const url = `https://registry.npmjs.org/-/v1/search?text=maintainer:${encodeURIComponent(query.value)}&size=10`;
    const data = await fetchJson<NpmSearchResult>(url, { signal: ctx.signal });
    if (!data || !data.objects || data.objects.length === 0) return [];

    const packages = data.objects.map((o) => o.package.name);
    const emails = new Set<string>();
    for (const o of data.objects) {
      if (o.package.publisher?.email) emails.add(o.package.publisher.email);
      for (const m of o.package.maintainers ?? []) if (m.email) emails.add(m.email);
    }

    return [
      {
        id: nextId(),
        connectorId: 'npm',
        connectorName: 'npm Registry',
        tab: 'accounts',
        title: `npm: ${data.total} package(s) maintained by "${query.value}"`,
        detail: packages.slice(0, 10).join(', '),
        link: `https://www.npmjs.com/~${encodeURIComponent(query.value)}`,
        confidence: 'confirmed',
        query,
        timestamp: Date.now(),
        raw: data,
        rawSourceUrl: redactUrl(url),
        data: {
          packageCount: data.total,
          packages: packages.slice(0, 20).join(', '),
          emails: [...emails].join(', ') || undefined,
        },
      },
    ];
  },
};
