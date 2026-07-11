/**
 * Optional "bring your own free-tier API key" store.
 * Keys never leave the browser except in direct requests to that key's own
 * provider - they are not sent anywhere else, and are never bundled into
 * exported reports. Note: because calls are made directly from the browser,
 * the key is visible in devtools/network requests, same as any purely
 * client-side app. Use low-value/free-tier keys and rotate them if in doubt.
 * (Have I Been Pwned is intentionally not offered here: its API blocks
 * unauthenticated browser CORS requests by design, so it cannot work from
 * a static client-only app.)
 */

const STORAGE_KEY = 'osicktool.apiKeys.v1';

export interface ApiKeyDef {
  id: string;
  label: string;
  helpUrl: string;
  helpText: string;
}

export const API_KEY_DEFS: ApiKeyDef[] = [
  {
    id: 'numverify',
    label: 'NumVerify (phone validation)',
    helpUrl: 'https://numverify.com/product',
    helpText: 'Free tier gives carrier/line-type lookups for phone numbers.',
  },
  {
    id: 'hunter',
    label: 'Hunter.io (email finder)',
    helpUrl: 'https://hunter.io/api-keys',
    helpText: 'Free tier can verify deliverability and find related company emails.',
  },
  {
    id: 'shodan',
    label: 'Shodan (host/IP intel)',
    helpUrl: 'https://account.shodan.io/',
    helpText: 'Free tier can look up basic host info for IPs/domains you pivot to.',
  },
  {
    id: 'googleCseKey',
    label: 'Google Custom Search - API key',
    helpUrl: 'https://developers.google.com/custom-search/v1/introduction',
    helpText: 'Free tier gives 100 real, ranked Google results/day for Google Dork searches. Needs both this key and the Search Engine ID below.',
  },
  {
    id: 'googleCseId',
    label: 'Google Custom Search - Search Engine ID (cx)',
    helpUrl: 'https://programmablesearchengine.google.com/controlpanel/create',
    helpText: 'Create a Programmable Search Engine, enable "Search the entire web", then copy its Search engine ID here.',
  },
];

export function getApiKeys(): Record<string, string> {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? JSON.parse(raw) : {};
  } catch {
    return {};
  }
}

export function setApiKey(id: string, value: string): void {
  const keys = getApiKeys();
  if (value.trim()) keys[id] = value.trim();
  else delete keys[id];
  localStorage.setItem(STORAGE_KEY, JSON.stringify(keys));
}

export function clearApiKeys(): void {
  localStorage.removeItem(STORAGE_KEY);
}

const PROXY_PREF_KEY = 'osicktool.proxyEnabled.v1';

export function getProxyEnabled(): boolean {
  return localStorage.getItem(PROXY_PREF_KEY) === 'true';
}

export function setProxyEnabled(enabled: boolean): void {
  localStorage.setItem(PROXY_PREF_KEY, String(enabled));
}
