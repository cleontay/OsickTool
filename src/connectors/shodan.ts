import type { Connector, Finding, SearchQuery } from '../types';
import { fetchJson, nextId, redactUrl } from '../lib/fetchUtils';

const IPV4_RE = /^(\d{1,3}\.){3}\d{1,3}$/;

interface InternetDbResponse {
  ip: string;
  ports?: number[];
  hostnames?: string[];
  cpes?: string[];
  vulns?: string[];
  tags?: string[];
}

// InternetDB is Shodan's free, keyless lookup for basic host exposure data.
export const internetDbConnector: Connector = {
  id: 'internetdb',
  name: 'Shodan InternetDB',
  description: 'Free, keyless lookup of open ports, hostnames, and known CVEs for an IPv4 address.',
  supports: ['general'],
  async run(query: SearchQuery, ctx): Promise<Finding[]> {
    if (!IPV4_RE.test(query.value)) return [];

    const url = `https://internetdb.shodan.io/${query.value}`;
    const res = await fetchJson<InternetDbResponse>(url, { signal: ctx.signal });
    if (!res || !res.ip) return [];

    return [
      {
        id: nextId(),
        connectorId: 'internetdb',
        connectorName: 'Shodan InternetDB',
        tab: 'web',
        title: `Host exposure: ${res.ip}`,
        detail: res.vulns?.length ? `${res.vulns.length} known CVE(s) associated with this host.` : undefined,
        link: `https://www.shodan.io/host/${res.ip}`,
        confidence: 'confirmed',
        query,
        timestamp: Date.now(),
        raw: res,
        rawSourceUrl: redactUrl(url),
        data: {
          openPorts: res.ports?.join(', ') || undefined,
          hostnames: res.hostnames?.join(', ') || undefined,
          vulns: res.vulns?.join(', ') || undefined,
          tags: res.tags?.join(', ') || undefined,
        },
      },
    ];
  },
};

interface ShodanHostResponse {
  ip_str: string;
  org?: string;
  isp?: string;
  country_name?: string;
  city?: string;
  os?: string | null;
  ports?: number[];
  hostnames?: string[];
  domains?: string[];
}

export const shodanConnector: Connector = {
  id: 'shodan',
  name: 'Shodan',
  description: 'Full host intelligence lookup for an IPv4 address (requires a free Shodan API key in Settings).',
  supports: ['general'],
  apiKeyId: 'shodan',
  async run(query: SearchQuery, ctx): Promise<Finding[]> {
    const apiKey = ctx.apiKeys.shodan;
    if (!apiKey || !IPV4_RE.test(query.value)) return [];

    const url = `https://api.shodan.io/shodan/host/${query.value}?key=${encodeURIComponent(apiKey)}`;
    const res = await fetchJson<ShodanHostResponse>(url, { signal: ctx.signal });
    if (!res || !res.ip_str) return [];

    return [
      {
        id: nextId(),
        connectorId: 'shodan',
        connectorName: 'Shodan',
        tab: 'web',
        title: `Shodan: ${res.ip_str}`,
        detail: [res.org, res.isp, res.city, res.country_name].filter(Boolean).join(' — '),
        link: `https://www.shodan.io/host/${res.ip_str}`,
        confidence: 'confirmed',
        query,
        timestamp: Date.now(),
        raw: res,
        rawSourceUrl: redactUrl(url),
        data: {
          org: res.org ?? undefined,
          isp: res.isp ?? undefined,
          os: res.os ?? undefined,
          ports: res.ports?.join(', ') || undefined,
          hostnames: res.hostnames?.join(', ') || undefined,
          domains: res.domains?.join(', ') || undefined,
        },
      },
    ];
  },
};
