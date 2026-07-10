import type { Connector, Finding, SearchQuery } from '../types';
import { fetchJson, nextId } from '../lib/fetchUtils';

interface DohAnswer {
  name: string;
  type: number;
  TTL: number;
  data: string;
}
interface DohResponse {
  Status: number;
  Answer?: DohAnswer[];
}

const RECORD_TYPES = ['MX', 'A', 'TXT', 'NS'] as const;

async function queryDoh(domain: string, type: string, signal: AbortSignal): Promise<DohAnswer[]> {
  const res = await fetchJson<DohResponse>(
    `https://dns.google/resolve?name=${encodeURIComponent(domain)}&type=${type}`,
    { signal, headers: { Accept: 'application/dns-json' } },
  );
  return res?.Answer ?? [];
}

function extractDomain(query: SearchQuery): string | null {
  if (query.type === 'email') {
    const at = query.value.lastIndexOf('@');
    return at >= 0 ? query.value.slice(at + 1) : null;
  }
  if (query.type === 'general' && /^[a-z0-9.-]+\.[a-z]{2,}$/i.test(query.value)) {
    return query.value;
  }
  return null;
}

export const dnsConnector: Connector = {
  id: 'dns',
  name: 'DNS (Google DoH)',
  description: 'Resolves MX/A/TXT/NS records for the domain of an email address or a bare domain query, via Google\'s public DNS-over-HTTPS JSON API.',
  supports: ['email', 'general'],
  async run(query: SearchQuery, ctx): Promise<Finding[]> {
    const domain = extractDomain(query);
    if (!domain) return [];

    const results = await Promise.all(RECORD_TYPES.map((t) => queryDoh(domain, t, ctx.signal)));
    const [mx, a, txt, ns] = results;
    if (mx.length === 0 && a.length === 0 && txt.length === 0 && ns.length === 0) return [];

    const mailProvider = mx[0]?.data.toLowerCase() ?? '';
    let provider: string | undefined;
    if (mailProvider.includes('google') || mailProvider.includes('gmail')) provider = 'Google Workspace / Gmail';
    else if (mailProvider.includes('outlook') || mailProvider.includes('protection.outlook'))
      provider = 'Microsoft 365 / Outlook';
    else if (mailProvider.includes('zoho')) provider = 'Zoho Mail';
    else if (mailProvider.includes('proton')) provider = 'Proton Mail';

    return [
      {
        id: nextId(),
        connectorId: 'dns',
        connectorName: 'DNS (Google DoH)',
        tab: query.type === 'email' ? 'email' : 'web',
        title: `DNS records: ${domain}`,
        detail: provider ? `Likely mail provider: ${provider}` : undefined,
        link: `https://dns.google/query?name=${encodeURIComponent(domain)}&type=MX`,
        confidence: 'confirmed',
        query,
        timestamp: Date.now(),
        data: {
          domain,
          mxRecords: mx.map((r) => r.data).join(', ') || undefined,
          aRecords: a.map((r) => r.data).join(', ') || undefined,
          txtRecords: txt.map((r) => r.data).join(', ') || undefined,
          nsRecords: ns.map((r) => r.data).join(', ') || undefined,
          mailProvider: provider,
        },
      },
    ];
  },
};
