import { parsePhoneNumberFromString, type CountryCode } from 'libphonenumber-js';
import type { Connector, Finding, SearchQuery } from '../types';
import { fetchJson, nextId, redactUrl } from '../lib/fetchUtils';
import { looksLikePhoneShape } from '../lib/classify';

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
    // Text containing letters can never be a phone number - don't spend a
    // metered NumVerify request confirming what a regex already rules out.
    if (!looksLikePhoneShape(query.value)) return [];

    // NumVerify accepts local-format numbers but is far more reliable given a
    // full E.164 number, so normalize using the selected country hint first.
    const parsed = parsePhoneNumberFromString(query.value, query.country as CountryCode | undefined);
    const numberToQuery = parsed ? parsed.format('E.164') : query.value;

    const url = `https://apilayer.net/api/validate?access_key=${encodeURIComponent(apiKey)}&number=${encodeURIComponent(numberToQuery)}`;
    const res = await fetchJson<NumverifyResponse>(url, { signal: ctx.signal });
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
        raw: res,
        rawSourceUrl: redactUrl(url),
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
