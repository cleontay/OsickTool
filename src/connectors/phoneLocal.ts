import { parsePhoneNumberFromString, type CountryCode } from 'libphonenumber-js';
import type { Connector, Finding, SearchQuery } from '../types';
import { nextId } from '../lib/fetchUtils';

export const phoneLocalConnector: Connector = {
  id: 'phone-local',
  name: 'Phone Number Analysis',
  description: 'Local, offline parsing of a phone number - country, region, number type, and valid formats.',
  supports: ['phone'],
  async run(query: SearchQuery): Promise<Finding[]> {
    const parsed = parsePhoneNumberFromString(query.value, query.country as CountryCode | undefined);
    if (!parsed) {
      return [
        {
          id: nextId(),
          connectorId: 'phone-local',
          connectorName: 'Phone Number Analysis',
          tab: 'phone',
          title: 'Could not parse phone number',
          detail: query.country
            ? `Doesn't look like a valid number for the selected country.`
            : 'Select a country, or include the country code, e.g. +1 555 555 5555.',
          confidence: 'info',
          query,
          timestamp: Date.now(),
        },
      ];
    }

    const valid = parsed.isValid();
    return [
      {
        id: nextId(),
        connectorId: 'phone-local',
        connectorName: 'Phone Number Analysis',
        tab: 'phone',
        title: parsed.formatInternational(),
        detail: valid
          ? `Valid ${parsed.getType() ?? 'number'} number registered to ${parsed.country ?? 'an unknown region'}.`
          : 'Number does not pass structural validation for its country.',
        confidence: valid ? 'confirmed' : 'info',
        query,
        timestamp: Date.now(),
        data: {
          country: parsed.country ?? undefined,
          countryCallingCode: parsed.countryCallingCode,
          nationalFormat: parsed.formatNational(),
          internationalFormat: parsed.formatInternational(),
          e164: parsed.format('E.164'),
          type: parsed.getType() ?? undefined,
          valid,
        },
      },
    ];
  },
};
