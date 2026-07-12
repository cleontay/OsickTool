import type { Finding } from '../types';

export interface RawExportEntry {
  connector: string;
  queryType: string;
  queryValue: string;
  sourceUrl?: string;
  timestamp: string;
  raw: unknown;
}

/** Every finding that actually came from a network call, with its raw
 * response - local-only connectors (IC decoder, phone parser, etc.) never
 * set `raw`, so they're naturally excluded. */
export function findingsToRawExport(findings: Finding[]): RawExportEntry[] {
  return findings
    .filter((f) => f.raw !== undefined)
    .map((f) => ({
      connector: f.connectorName,
      queryType: f.query.type,
      queryValue: f.query.value,
      sourceUrl: f.rawSourceUrl,
      timestamp: new Date(f.timestamp).toISOString(),
      raw: f.raw,
    }));
}

export function downloadRawJson(findings: Finding[], filename: string): void {
  const entries = findingsToRawExport(findings);
  const blob = new Blob([JSON.stringify(entries, null, 2)], { type: 'application/json;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}
