import type { Finding } from '../types';

function escapeHtml(s: string): string {
  return s.replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]!));
}

function humanizeKey(key: string): string {
  return key
    .replace(/([a-z])([A-Z])/g, '$1 $2')
    .replace(/^./, (c) => c.toUpperCase());
}

export function renderFindingCard(finding: Finding): HTMLElement {
  const card = document.createElement('article');
  card.className = 'finding-card panel';

  const head = document.createElement('div');
  head.className = 'fc-head';
  head.innerHTML = `
    <div>
      <div class="fc-source">${escapeHtml(finding.connectorName)}</div>
      <div class="fc-title">${escapeHtml(finding.title)}</div>
    </div>
    <span class="badge ${finding.confidence}">${finding.confidence}</span>
  `;
  card.appendChild(head);

  if (finding.detail) {
    const detail = document.createElement('div');
    detail.className = 'fc-detail';
    detail.textContent = finding.detail;
    card.appendChild(detail);
  }

  const dataEntries = Object.entries(finding.data ?? {}).filter(([, v]) => v !== undefined && v !== null && v !== '');
  if (dataEntries.length > 0) {
    const dl = document.createElement('dl');
    dl.className = 'fc-data';
    for (const [k, v] of dataEntries) {
      const dt = document.createElement('dt');
      dt.textContent = humanizeKey(k);
      const dd = document.createElement('dd');
      dd.textContent = String(v);
      dl.appendChild(dt);
      dl.appendChild(dd);
    }
    card.appendChild(dl);
  }

  if (finding.link) {
    const link = document.createElement('a');
    link.className = 'fc-link';
    link.href = finding.link;
    link.target = '_blank';
    link.rel = 'noopener noreferrer';
    link.textContent = 'Open source ↗';
    card.appendChild(link);
  }

  return card;
}
