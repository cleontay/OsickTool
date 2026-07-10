import { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable';
import type { Finding, TabDef, TabId } from '../types';

const TAB_LABELS: Record<TabId, string> = {
  identity: 'Identity',
  accounts: 'Accounts & Handles',
  email: 'Email Intelligence',
  phone: 'Phone Intelligence',
  web: 'Web & Infrastructure',
  other: 'General / Other',
  pivots: 'Pivot Suggestions',
};

export function buildReportPdf(findings: Finding[], targetLabel: string): jsPDF {
  const doc = new jsPDF({ unit: 'pt', format: 'a4' });
  const pageWidth = doc.internal.pageSize.getWidth();
  const margin = 40;

  doc.setFontSize(20);
  doc.setTextColor(37, 99, 235);
  doc.text('OSINT Reconnaissance Report', margin, 60);

  doc.setFontSize(11);
  doc.setTextColor(60, 60, 60);
  doc.text(`Target: ${targetLabel}`, margin, 84);
  doc.text(`Generated: ${new Date().toLocaleString()}`, margin, 100);
  doc.text(`Total findings: ${findings.length}`, margin, 116);

  doc.setFontSize(9);
  doc.setTextColor(120, 120, 120);
  const disclaimer =
    'Generated entirely client-side by OsickTool from free, public sources. Nothing was stored server-side. ' +
    'Unverified items are candidate leads only and must be manually confirmed. Use this report responsibly and ' +
    'in accordance with applicable laws and each source’s terms of service.';
  const disclaimerLines = doc.splitTextToSize(disclaimer, pageWidth - margin * 2);
  doc.text(disclaimerLines, margin, 136);

  let cursorY = 136 + disclaimerLines.length * 12 + 20;

  const byTab = new Map<TabId, Finding[]>();
  for (const f of findings) {
    if (!byTab.has(f.tab)) byTab.set(f.tab, []);
    byTab.get(f.tab)!.push(f);
  }

  const order: TabId[] = ['identity', 'accounts', 'email', 'phone', 'web', 'other'];
  for (const tabId of order) {
    const items = byTab.get(tabId);
    if (!items || items.length === 0) continue;

    if (cursorY > doc.internal.pageSize.getHeight() - 120) {
      doc.addPage();
      cursorY = 50;
    }

    doc.setFontSize(14);
    doc.setTextColor(37, 99, 235);
    doc.text(TAB_LABELS[tabId], margin, cursorY);
    cursorY += 10;

    autoTable(doc, {
      startY: cursorY,
      margin: { left: margin, right: margin },
      head: [['Source', 'Finding', 'Detail', 'Confidence', 'Link']],
      body: items.map((f) => [
        f.connectorName,
        f.title,
        f.detail ?? '',
        f.confidence,
        f.link ?? '',
      ]),
      styles: { fontSize: 8, cellPadding: 4, overflow: 'linebreak' },
      headStyles: { fillColor: [37, 99, 235], textColor: 255 },
      columnStyles: {
        0: { cellWidth: 80 },
        1: { cellWidth: 110 },
        2: { cellWidth: 150 },
        3: { cellWidth: 55 },
        4: { cellWidth: 100 },
      },
      didDrawPage: (data) => {
        cursorY = data.cursor?.y ?? cursorY;
      },
    });

    // @ts-expect-error - jspdf-autotable augments doc with lastAutoTable at runtime
    cursorY = (doc.lastAutoTable?.finalY ?? cursorY) + 24;
  }

  return doc;
}

export function downloadReportPdf(findings: Finding[], targetLabel: string, filename: string): void {
  const doc = buildReportPdf(findings, targetLabel);
  doc.save(filename);
}

export const TAB_DEFS: TabDef[] = [
  { id: 'identity', label: 'Identity' },
  { id: 'accounts', label: 'Accounts & Handles' },
  { id: 'email', label: 'Email' },
  { id: 'phone', label: 'Phone' },
  { id: 'web', label: 'Web & Infrastructure' },
  { id: 'other', label: 'General' },
  { id: 'pivots', label: 'Pivots' },
];
