import type { QueryType } from '../types';

export interface Classification {
  type: QueryType;
  reason: string;
}

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const DOMAIN_RE = /^(?:[a-z0-9-]+\.)+[a-z]{2,}$/i;
const IPV4_RE = /^(\d{1,3}\.){3}\d{1,3}$/;
const MYKAD_RE = /^(\d{2})(\d{2})(\d{2})-?\d{2}-?\d{4}$/;
const SG_NRIC_RE = /^[STFGMstfgm]\d{7}[A-Za-z]$/;
const DORK_OPERATOR_RE = /\b(?:site|filetype|intitle|inurl|intext|ext):|(?:^|\s)-site:|\s(?:OR|AND)\s/;
const HANDLE_RE = /^@?[a-zA-Z0-9_.]{2,32}$/;

/** A string containing no letters at all can never be a phone number's
 * distinguishing feature by definition - but digits/spaces/+/-/() alone
 * aren't enough either (an IC number is also all-digit), so this is a
 * necessary-not-sufficient shape check, used both for classification and
 * as a direct connector guard ("don't call NumVerify on text with
 * letters in it"). */
export function looksLikePhoneShape(value: string): boolean {
  const trimmed = value.trim();
  if (!trimmed) return false;
  if (/[a-zA-Z]/.test(trimmed)) return false;
  const digits = trimmed.replace(/[^\d]/g, '');
  return digits.length >= 6 && digits.length <= 15;
}

export function looksLikeEmail(value: string): boolean {
  return EMAIL_RE.test(value.trim());
}

export function looksLikeDomain(value: string): boolean {
  return DOMAIN_RE.test(value.trim());
}

export function looksLikeIPv4(value: string): boolean {
  return IPV4_RE.test(value.trim());
}

/** Malaysia MyKad: YYMMDD-PB-####, with a plausible calendar date - guards
 * against a 12-digit phone number happening to match the raw digit shape. */
export function looksLikeMyKad(value: string): boolean {
  const m = value.trim().replace(/\s/g, '').match(MYKAD_RE);
  if (!m) return false;
  const month = Number(m[2]);
  const day = Number(m[3]);
  return month >= 1 && month <= 12 && day >= 1 && day <= 31;
}

export function looksLikeSgNric(value: string): boolean {
  return SG_NRIC_RE.test(value.trim().replace(/\s/g, ''));
}

export function looksLikeIc(value: string): boolean {
  return looksLikeMyKad(value) || looksLikeSgNric(value);
}

export function looksLikeDorkSyntax(value: string): boolean {
  return DORK_OPERATOR_RE.test(value);
}

/** A bare handle: no spaces, no @ mid-string, plausible length - the
 * catch-all for "probably a username" once nothing more specific matched. */
export function looksLikeHandle(value: string): boolean {
  return HANDLE_RE.test(value.trim());
}

/** Two or three capitalized words, letters only - the shape of a person's
 * full name, as opposed to a single word or a longer free-text phrase. */
export function looksLikePersonName(value: string): boolean {
  const words = value.trim().split(/\s+/);
  if (words.length < 2 || words.length > 4) return false;
  return words.every((w) => /^[A-Za-z][A-Za-z'-]*$/.test(w));
}

/**
 * Priority-ordered auto-detection for a single unlabeled search box. Each
 * rule is deliberately specific enough to avoid false positives before
 * falling through to the next - e.g. IC is checked (with a calendar-date
 * plausibility check) before the much looser phone-shape check, so a valid
 * MyKad number doesn't get misread as a phone number.
 */
export function classifyQuery(rawValue: string): Classification {
  const value = rawValue.trim();

  if (!value) return { type: 'general', reason: 'Empty' };
  if (looksLikeDorkSyntax(value)) return { type: 'dork', reason: 'Contains Google dork syntax' };
  if (looksLikeEmail(value)) return { type: 'email', reason: 'Email address' };
  if (looksLikeIc(value)) return { type: 'ic', reason: 'National ID number' };
  if (looksLikePhoneShape(value)) return { type: 'phone', reason: 'Digits only, no letters' };
  if (looksLikeIPv4(value)) return { type: 'general', reason: 'IPv4 address' };
  if (looksLikeDomain(value)) return { type: 'general', reason: 'Domain name' };
  if (value.startsWith('@') || (looksLikeHandle(value) && !looksLikePersonName(value))) {
    return { type: 'username', reason: 'Handle-shaped (no spaces)' };
  }
  return { type: 'general', reason: looksLikePersonName(value) ? 'Person name' : 'Free-text keyword' };
}
