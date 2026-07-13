/**
 * Given a person's name, generates the common handle patterns real people
 * actually use - the same fixed set every username-guessing OSINT tool
 * relies on - rather than naively splitting on whitespace or truncating the
 * string to fit some length. Deliberately bounded (not a full permutation
 * of every ordering) so it stays a handful of *plausible* guesses, not
 * dozens of low-value combinations that would just burn auto-enrich budget.
 */
export function generateUsernamePermutations(fullName: string): string[] {
  const words = fullName
    .trim()
    .split(/\s+/)
    .map((w) => w.replace(/[^a-zA-Z]/g, '').toLowerCase())
    .filter((w) => w.length > 0);

  if (words.length < 2) return [];

  const first = words[0];
  const last = words[words.length - 1];
  const middleInitial = words.length > 2 ? words[1][0] : '';

  const candidates = [
    // Every word run together in order - the single most realistic guess
    // for any multi-part name, and especially so for romanized CJK names
    // (e.g. "Song Yu Qi" -> "songyuqi"), where people commonly register
    // handles as their full pinyin rather than an English-style
    // first-initial/last-name contraction.
    words.join(''),
    `${first}${last}`,
    `${first}.${last}`,
    `${first}_${last}`,
    `${first[0]}${last}`,
    `${first}${last[0]}`,
    `${last}${first}`,
    `${last}.${first}`,
    middleInitial ? `${first}${middleInitial}${last}` : null,
  ].filter((c): c is string => c !== null && c.length >= 3);

  return [...new Set(candidates)];
}
