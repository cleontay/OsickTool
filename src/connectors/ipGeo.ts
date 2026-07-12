import type { Connector, Finding, SearchQuery } from '../types';
import { fetchJson, nextId, redactUrl } from '../lib/fetchUtils';

const IPV4_RE = /^(\d{1,3}\.){3}\d{1,3}$/;

interface IpApiResponse {
  ip: string;
  city?: string;
  region?: string;
  country_name?: string;
  postal?: string;
  latitude?: number;
  longitude?: number;
  timezone?: string;
  org?: string;
  asn?: string;
  error?: boolean;
  reason?: string;
}

export const ipGeoConnector: Connector = {
  id: 'ip-geo',
  name: 'IP Geolocation',
  description: 'City/region/ISP-level geolocation for an IPv4 address, via ipapi.co\'s free JSON API.',
  supports: ['general'],
  async run(query: SearchQuery, ctx): Promise<Finding[]> {
    if (!IPV4_RE.test(query.value)) return [];

    const url = `https://ipapi.co/${query.value}/json/`;
    const res = await fetchJson<IpApiResponse>(url, { signal: ctx.signal });
    if (!res || res.error || !res.city) return [];

    return [
      {
        id: nextId(),
        connectorId: 'ip-geo',
        connectorName: 'IP Geolocation',
        tab: 'web',
        title: `${res.city}, ${res.region ?? ''} ${res.country_name ?? ''}`.replace(/\s+/g, ' ').trim(),
        detail: res.org ? `Network: ${res.org}` : undefined,
        link: `https://ipapi.co/${query.value}/`,
        confidence: 'likely',
        query,
        timestamp: Date.now(),
        raw: res,
        rawSourceUrl: redactUrl(url),
        data: {
          city: res.city,
          region: res.region ?? undefined,
          country: res.country_name ?? undefined,
          postal: res.postal ?? undefined,
          coordinates: res.latitude && res.longitude ? `${res.latitude}, ${res.longitude}` : undefined,
          timezone: res.timezone ?? undefined,
          isp: res.org ?? undefined,
          asn: res.asn ?? undefined,
        },
      },
    ];
  },
};
