import type { Connector, Finding, SearchQuery } from '../types';
import { fetchJson, nextId, redactUrl } from '../lib/fetchUtils';

const IPV4_RE = /^(\d{1,3}\.){3}\d{1,3}$/;
const DOMAIN_RE = /^(?:[a-z0-9-]+\.)+[a-z]{2,}$/i;

type VCardField = [string, Record<string, unknown>, string, ...unknown[]];
interface RdapEntity {
  roles?: string[];
  vcardArray?: [string, VCardField[]];
}
interface RdapEvent {
  eventAction: string;
  eventDate: string;
}
interface RdapResponse {
  ldhName?: string;
  entities?: RdapEntity[];
  events?: RdapEvent[];
  status?: string[];
  nameservers?: Array<{ ldhName: string }>;
  errorCode?: number;
}

function parseVCard(entity: RdapEntity): { name?: string; email?: string; org?: string } {
  const fields = entity.vcardArray?.[1] ?? [];
  const get = (key: string): string | undefined => {
    const field = fields.find((f) => f[0] === key);
    const value = field?.[3];
    return typeof value === 'string' && value.trim() ? value.trim() : undefined;
  };
  return { name: get('fn'), email: get('email'), org: get('org') };
}

// Redacted/proxy registrant boilerplate that WHOIS-privacy services commonly
// use - not worth surfacing as if it were a real name.
const REDACTED_RE = /redacted|privacy|proxy|withheld|not disclosed|data protected/i;

export const rdapConnector: Connector = {
  id: 'rdap',
  name: 'Domain Registration (RDAP)',
  description: 'Best-effort WHOIS/RDAP registrant lookup for a domain. Many domains use registrar privacy and will show nothing personal - that itself is a useful signal.',
  supports: ['general'],
  async run(query: SearchQuery, ctx): Promise<Finding[]> {
    const domain = query.value.trim().toLowerCase();
    if (IPV4_RE.test(domain) || !DOMAIN_RE.test(domain)) return [];

    const url = `https://rdap.org/domain/${encodeURIComponent(domain)}`;
    const res = await fetchJson<RdapResponse>(url, { signal: ctx.signal, timeoutMs: 10000 });
    if (!res || res.errorCode || !res.ldhName) return [];

    const registrant = res.entities?.find((e) => e.roles?.includes('registrant'));
    const registrar = res.entities?.find((e) => e.roles?.includes('registrar'));
    const registrantInfo = registrant ? parseVCard(registrant) : undefined;
    const registrarInfo = registrar ? parseVCard(registrar) : undefined;

    const registered = res.events?.find((e) => e.eventAction === 'registration')?.eventDate;
    const expires = res.events?.find((e) => e.eventAction === 'expiration')?.eventDate;

    const hasPersonalInfo =
      registrantInfo?.name && !REDACTED_RE.test(registrantInfo.name);

    return [
      {
        id: nextId(),
        connectorId: 'rdap',
        connectorName: 'Domain Registration (RDAP)',
        tab: 'web',
        title: hasPersonalInfo
          ? `Registrant: ${registrantInfo!.name}`
          : `${res.ldhName}: registrant is privacy-protected`,
        detail: registrarInfo?.name ? `Registered via ${registrarInfo.name}` : undefined,
        link: `https://rdap.org/domain/${encodeURIComponent(domain)}`,
        confidence: hasPersonalInfo ? 'confirmed' : 'info',
        query,
        timestamp: Date.now(),
        raw: res,
        rawSourceUrl: redactUrl(url),
        data: {
          registrantName: registrantInfo?.name,
          registrantEmail: registrantInfo?.email,
          registrantOrg: registrantInfo?.org,
          registrar: registrarInfo?.name,
          registered: registered ?? undefined,
          expires: expires ?? undefined,
          status: res.status?.join(', ') || undefined,
        },
      },
    ];
  },
};
