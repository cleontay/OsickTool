import type { Connector, Finding, SearchQuery } from '../types';
import { nextId } from '../lib/fetchUtils';
import { MYKAD_PLACE_CODES } from '../data/myKadPlaceCodes';

const MYKAD_RE = /^(\d{2})(\d{2})(\d{2})-?(\d{2})-?(\d{4})$/;
const SG_NRIC_RE = /^([STFGM])(\d{7})([A-Z])$/i;

function decodeMyKad(value: string): Finding['data'] | null {
  const m = value.replace(/\s/g, '').match(MYKAD_RE);
  if (!m) return null;
  const [, yy, mm, dd, place, serial] = m;
  const month = Number(mm);
  const day = Number(dd);
  if (month < 1 || month > 12 || day < 1 || day > 31) return null;

  const currentYY = new Date().getFullYear() % 100;
  const century = Number(yy) > currentYY ? 1900 : 2000;
  const year = century + Number(yy);
  const lastDigit = Number(serial[3]);
  const gender = lastDigit % 2 === 1 ? 'Male' : 'Female';
  const placeName = MYKAD_PLACE_CODES[place] ?? `Unknown/unlisted code (${place})`;

  return {
    format: 'Malaysia MyKad',
    birthDate: `${year}-${mm}-${dd}`,
    gender,
    placeOfBirthCode: place,
    placeOfBirth: placeName,
    serial,
  };
}

function decodeSgNric(value: string): Finding['data'] | null {
  const m = value.replace(/\s/g, '').toUpperCase().match(SG_NRIC_RE);
  if (!m) return null;
  const [, prefix, digits, checkLetter] = m;

  // Official NRIC/FIN checksum algorithm (weights + offset by prefix).
  const weights = [2, 7, 6, 5, 4, 3, 2];
  let sum = 0;
  for (let i = 0; i < 7; i++) sum += Number(digits[i]) * weights[i];
  if (prefix === 'T' || prefix === 'G') sum += 4;
  if (prefix === 'M') sum += 3;

  const remainder = sum % 11;
  const stLetters = ['J', 'Z', 'I', 'H', 'G', 'F', 'E', 'D', 'C', 'B', 'A'];
  const fgLetters = ['X', 'W', 'U', 'T', 'R', 'Q', 'P', 'N', 'M', 'L', 'K'];
  const mLetters = ['K', 'L', 'J', 'N', 'P', 'Q', 'R', 'T', 'U', 'W', 'X'];

  let expected: string;
  if (prefix === 'S' || prefix === 'T') expected = stLetters[remainder];
  else if (prefix === 'M') expected = mLetters[remainder];
  else expected = fgLetters[remainder];

  const valid = expected === checkLetter;
  const type = prefix === 'S' || prefix === 'T' ? 'Citizen/PR (NRIC)' : prefix === 'M' ? 'FIN (Work Pass, new format)' : 'Foreigner (FIN)';
  const centuryHint = prefix === 'S' ? 'Born before 2000' : prefix === 'T' ? 'Born 2000 or later' : undefined;

  return {
    format: 'Singapore NRIC/FIN',
    type,
    checksumValid: valid,
    // The M-series FIN (introduced 2022) checksum table is less widely
    // documented than the classic S/T/F/G scheme - treat its result as
    // indicative rather than authoritative.
    checksumExperimental: prefix === 'M',
    centuryHint,
  };
}

export const icDecoderConnector: Connector = {
  id: 'ic-decoder',
  name: 'IC/NRIC Decoder',
  description: 'Local, offline decoding of Malaysian MyKad and Singapore NRIC/FIN numbers (birthdate, gender, birthplace, checksum validity).',
  supports: ['ic'],
  async run(query: SearchQuery): Promise<Finding[]> {
    const value = query.value.trim();

    const mykad = decodeMyKad(value);
    if (mykad) {
      return [
        {
          id: nextId(),
          connectorId: 'ic-decoder',
          connectorName: 'IC/NRIC Decoder',
          tab: 'identity',
          title: `MyKad decoded: born ${mykad.birthDate}`,
          detail: `${mykad.gender}, born in ${mykad.placeOfBirth}`,
          confidence: 'confirmed',
          query,
          timestamp: Date.now(),
          data: mykad,
        },
      ];
    }

    const nric = decodeSgNric(value);
    if (nric) {
      return [
        {
          id: nextId(),
          connectorId: 'ic-decoder',
          connectorName: 'IC/NRIC Decoder',
          tab: 'identity',
          title: `Singapore ${nric.type}: checksum ${nric.checksumValid ? 'valid' : 'INVALID'}${nric.checksumExperimental ? ' (experimental)' : ''}`,
          detail: nric.centuryHint as string | undefined,
          confidence: nric.checksumExperimental ? 'info' : nric.checksumValid ? 'confirmed' : 'info',
          query,
          timestamp: Date.now(),
          data: nric,
        },
      ];
    }

    return [
      {
        id: nextId(),
        connectorId: 'ic-decoder',
        connectorName: 'IC/NRIC Decoder',
        tab: 'identity',
        title: 'Unrecognized ID format',
        detail: 'Currently supports Malaysian MyKad (YYMMDD-PB-###G) and Singapore NRIC/FIN (S/T/F/G/M + 7 digits + letter).',
        confidence: 'info',
        query,
        timestamp: Date.now(),
      },
    ];
  },
};
