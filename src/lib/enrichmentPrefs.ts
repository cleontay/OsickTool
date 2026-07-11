/**
 * Auto-enrichment preferences - all stored only in localStorage, same
 * pattern as the API keys and CORS-proxy toggle.
 */

const ENABLED_KEY = 'osicktool.autoEnrich.enabled.v1';
const MAX_DEPTH_KEY = 'osicktool.autoEnrich.maxDepth.v1';
const MAX_SEARCHES_KEY = 'osicktool.autoEnrich.maxSearches.v1';

export const DEFAULT_MAX_DEPTH = 4;
export const DEFAULT_MAX_AUTO_SEARCHES = 40;

// Hard ceiling regardless of what a user types into the Settings field -
// keeps a mistyped "9999" from turning into an actual runaway loop.
export const ABSOLUTE_MAX_DEPTH = 10;
export const ABSOLUTE_MAX_AUTO_SEARCHES = 200;

export function getAutoEnrichEnabled(): boolean {
  const raw = localStorage.getItem(ENABLED_KEY);
  return raw === null ? true : raw === 'true';
}

export function setAutoEnrichEnabled(enabled: boolean): void {
  localStorage.setItem(ENABLED_KEY, String(enabled));
}

function getBoundedInt(key: string, fallback: number, max: number): number {
  const raw = Number(localStorage.getItem(key));
  if (!Number.isFinite(raw) || raw <= 0) return fallback;
  return Math.min(raw, max);
}

export function getMaxDepth(): number {
  return getBoundedInt(MAX_DEPTH_KEY, DEFAULT_MAX_DEPTH, ABSOLUTE_MAX_DEPTH);
}

export function setMaxDepth(value: number): void {
  localStorage.setItem(MAX_DEPTH_KEY, String(Math.max(1, Math.min(value, ABSOLUTE_MAX_DEPTH))));
}

export function getMaxAutoSearches(): number {
  return getBoundedInt(MAX_SEARCHES_KEY, DEFAULT_MAX_AUTO_SEARCHES, ABSOLUTE_MAX_AUTO_SEARCHES);
}

export function setMaxAutoSearches(value: number): void {
  localStorage.setItem(MAX_SEARCHES_KEY, String(Math.max(1, Math.min(value, ABSOLUTE_MAX_AUTO_SEARCHES))));
}
