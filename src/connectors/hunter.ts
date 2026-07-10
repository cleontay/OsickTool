import type { Connector, Finding, SearchQuery } from '../types';
import { fetchJson, nextId } from '../lib/fetchUtils';

interface HunterVerifyResponse {
  data?: {
    email: string;
    result: string; // deliverable | undeliverable | risky | unknown
    score: number;
    disposable: boolean;
    webmail: boolean;
    mx_records: boolean;
    smtp_check: boolean;
    sources?: Array<{ domain: string; uri: string }>;
  };
}

export const hunterConnector: Connector = {
  id: 'hunter',
  name: 'Hunter.io',
  description: 'Email deliverability verification and public source mentions (requires a free Hunter.io API key in Settings).',
  supports: ['email'],
  apiKeyId: 'hunter',
  async run(query: SearchQuery, ctx): Promise<Finding[]> {
    const apiKey = ctx.apiKeys.hunter;
    if (!apiKey) return [];

    const res = await fetchJson<HunterVerifyResponse>(
      `https://api.hunter.io/v2/email-verifier?email=${encodeURIComponent(query.value)}&api_key=${encodeURIComponent(apiKey)}`,
      { signal: ctx.signal },
    );
    const d = res?.data;
    if (!d) return [];

    const findings: Finding[] = [
      {
        id: nextId(),
        connectorId: 'hunter',
        connectorName: 'Hunter.io',
        tab: 'email',
        title: `Hunter.io: ${d.result} (score ${d.score})`,
        detail: `MX records: ${d.mx_records ? 'yes' : 'no'} - SMTP check: ${d.smtp_check ? 'passed' : 'failed'}`,
        confidence: d.result === 'deliverable' ? 'confirmed' : 'info',
        query,
        timestamp: Date.now(),
        data: {
          result: d.result,
          score: d.score,
          disposable: d.disposable,
          webmail: d.webmail,
        },
      },
    ];

    for (const s of d.sources ?? []) {
      findings.push({
        id: nextId(),
        connectorId: 'hunter',
        connectorName: 'Hunter.io (public mention)',
        tab: 'web',
        title: `Mentioned on ${s.domain}`,
        link: s.uri,
        confidence: 'info',
        query,
        timestamp: Date.now(),
      });
    }

    return findings;
  },
};
