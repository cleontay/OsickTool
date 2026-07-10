import { getCountries, getCountryCallingCode } from 'libphonenumber-js';

export interface CountryOption {
  code: string; // ISO 3166-1 alpha-2, e.g. "US"
  name: string;
  callingCode: string; // e.g. "1"
}

let cached: CountryOption[] | null = null;

/** Builds the phone-country list from libphonenumber-js's supported regions, with
 * display names resolved via the built-in Intl.DisplayNames API - no extra data file. */
export function getCountryOptions(): CountryOption[] {
  if (cached) return cached;

  const displayNames = new Intl.DisplayNames(['en'], { type: 'region' });
  cached = getCountries()
    .map((code) => {
      let name: string;
      try {
        name = displayNames.of(code) ?? code;
      } catch {
        name = code;
      }
      return { code, name, callingCode: getCountryCallingCode(code) };
    })
    .sort((a, b) => a.name.localeCompare(b.name));

  return cached;
}

const RECENT_KEY = 'osicktool.recentCountry.v1';

export function getRecentCountry(): string | null {
  return localStorage.getItem(RECENT_KEY);
}

export function setRecentCountry(code: string): void {
  localStorage.setItem(RECENT_KEY, code);
}

/** Best-effort guess from the browser locale, e.g. "en-MY" -> "MY". */
export function guessCountryFromLocale(): string | null {
  try {
    const locale = new Intl.Locale(navigator.language);
    const region = locale.maximize().region ?? locale.region;
    return region ?? null;
  } catch {
    return null;
  }
}
