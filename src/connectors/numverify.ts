import type { Connector, Finding, SearchQuery } from '../types';
import { fetchJson, nextId } from '../lib/fetchUtils';

interface NumverifyResponse {
  valid: boolean;
  number: string;
  local_format: string;
  international_format: string;
  country_prefix: string;
  country_code: string;
  country_name: string;
  location: string;
  carrier: string;
  line_type: string;
}

export const numverifyConnector: Connector = {
  id: 'numverify',
  name: 'NumVerify',
  description: 'Carrier, line type, and location lookup for a phone number (requires a free NumVerify API key in Settings).',
  supports: ['phone'],
  apiKeyId: 'numverify',
  async run(query: SearchQuery, ctx): Promise<Finding[]> {
    const apiKey = ctx.apiKeys.numverify;
    if (!apiKey) return [];

    const res = await fetchJson<NumverifyResponse>(
      `https://apilayer.net/api/validate?access_key=${encodeURIComponent(apiKey)}&number=${encodeURIComponent(
        query.value,
      )}`,
      { signal: ctx.signal },
    );
    if (!res || !res.valid) return [];

    return [
      {
        id: nextId(),
        connectorId: 'numverify',
        connectorName: 'NumVerify',
        tab: 'phone',
        title: `Phone: ${res.international_format}`,
        detail: `${res.carrier || 'Unknown carrier'} - ${res.line_type || 'unknown line type'} - ${res.location || res.country_name}`,
        confidence: 'confirmed',
        query,
        timestamp: Date.now(),
        data: {
          country: res.country_name,
          countryCode: res.country_code,
          carrier: res.carrier || undefined,
          lineType: res.line_type || undefined,
          location: res.location || undefined,
          localFormat: res.local_format,
        },
      },
    ];
  },
};
