import { parsePhoneNumberFromString, type CountryCode } from 'libphonenumber-js';
import type { QueryType } from '../types';

/**
 * Canonicalizes a query value so the same real-world target always produces
 * the same dedupe key, regardless of how it was typed/formatted. This
 * matters most for phone numbers - "4155552671", "+14155552671", and
 * "(415) 555-2671" are the same number but would never string-match each
 * other, which would otherwise let the auto-enrichment queue re-search (and
 * re-bill, for BYO-key connectors) a number it already has.
 */
function canonicalizeValue(type: QueryType, value: string, country?: string): string {
  const trimmed = value.trim();
  if (type === 'phone') {
    const parsed = parsePhoneNumberFromString(trimmed, country as CountryCode | undefined);
    if (parsed) return parsed.number; // E.164 - unambiguous
  }
  return trimmed.toLowerCase();
}

export function queryKey(type: QueryType, value: string, country?: string): string {
  return `${type}:${canonicalizeValue(type, value, country)}`;
}
