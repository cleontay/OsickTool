import type { Finding } from '../types';

function csvEscape(value: unknown): string {
  const s = value === undefined || value === null ? '' : String(value);
  if (/[",\n]/.test(s)) return `"${s.replace(/"/g, '""')}"`;
  return s;
}

export function findingsToCsv(findings: Finding[]): string {
  const headers = ['Query Type', 'Query Value', 'Tab', 'Source', 'Title', 'Detail', 'Link', 'Confidence', 'Data'];
  const rows = findings.map((f) => [
    f.query.type,
    f.query.value,
    f.tab,
    f.connectorName,
    f.title,
    f.detail ?? '',
    f.link ?? '',
    f.confidence,
    f.data ? JSON.stringify(f.data) : '',
  ]);
  const lines = [headers, ...rows].map((row) => row.map(csvEscape).join(','));
  return lines.join('\n');
}

export function downloadCsv(findings: Finding[], filename: string): void {
  const csv = findingsToCsv(findings);
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}
