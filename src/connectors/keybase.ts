import type { Connector, Finding, SearchQuery } from '../types';
import { fetchJson, nextId } from '../lib/fetchUtils';

interface KeybaseResponse {
  status: { code: number; name: string };
  them?: Array<{
    id: string;
    basics: { username: string; ctime: number };
    profile?: { full_name?: string; location?: string; bio?: string };
    proofs_summary?: {
      all: Array<{ proof_type: string; nametag: string; service_url: string }>;
    };
  }>;
}

export const keybaseConnector: Connector = {
  id: 'keybase',
  name: 'Keybase',
  description: 'Keybase identity + linked/proven social accounts (a great pivot source).',
  supports: ['username', 'social'],
  async run(query: SearchQuery, ctx): Promise<Finding[]> {
    const res = await fetchJson<KeybaseResponse>(
      `https://keybase.io/_/api/1.0/user/lookup.json?username=${encodeURIComponent(query.value)}&fields=basics,profile,proofs_summary`,
      { signal: ctx.signal },
    );
    const them = res?.them?.[0];
    if (!them) return [];

    const proofs = them.proofs_summary?.all ?? [];
    const findings: Finding[] = [
      {
        id: nextId(),
        connectorId: 'keybase',
        connectorName: 'Keybase',
        tab: 'accounts',
        title: `Keybase: ${them.basics.username}`,
        detail: [them.profile?.full_name, them.profile?.bio].filter(Boolean).join(' — '),
        link: `https://keybase.io/${encodeURIComponent(them.basics.username)}`,
        confidence: 'confirmed',
        query,
        timestamp: Date.now(),
        data: {
          fullName: them.profile?.full_name ?? undefined,
          location: them.profile?.location ?? undefined,
          proofCount: proofs.length,
          linkedAccounts: proofs.map((p) => `${p.proof_type}:${p.nametag}`).join(', ') || undefined,
        },
      },
    ];

    for (const p of proofs) {
      findings.push({
        id: nextId(),
        connectorId: 'keybase',
        connectorName: 'Keybase (proven account)',
        tab: 'accounts',
        title: `${p.proof_type}: ${p.nametag}`,
        detail: `Cryptographically proven via Keybase for ${them.basics.username}`,
        link: p.service_url,
        confidence: 'confirmed',
        query,
        timestamp: Date.now(),
        data: { proofType: p.proof_type, nametag: p.nametag },
      });
    }

    return findings;
  },
};
