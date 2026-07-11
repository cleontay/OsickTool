/** Placeholder/boilerplate values that show up in "name" fields and aren't
 * actually anyone's name - not worth surfacing in a profile or re-searching. */
export const GENERIC_NAME_RE = /^(n\/a|none|unknown|redacted|privacy|proxy|withheld|not disclosed|data protected)$/i;

export function isUsableName(value: string | undefined | null): value is string {
  if (!value) return false;
  const trimmed = value.trim();
  return trimmed.length > 0 && !GENERIC_NAME_RE.test(trimmed);
}
