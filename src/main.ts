import './style.css';
import type { QueryType, TabId } from './types';
import { store } from './state';
import { openSettingsModal } from './ui/settingsModal';
import { renderFindingCard } from './ui/findingCard';
import { downloadCsv } from './lib/csvExport';

const QUERY_TYPES: Array<{ id: QueryType; label: string; placeholder: string }> = [
  { id: 'username', label: 'Username', placeholder: 'e.g. torvalds' },
  { id: 'email', label: 'Email address', placeholder: 'e.g. name@example.com' },
  { id: 'phone', label: 'Phone number', placeholder: 'e.g. +1 555 123 4567' },
  { id: 'ic', label: 'IC / National ID', placeholder: 'e.g. 900101-14-5678' },
  { id: 'social', label: 'Social media handle', placeholder: 'e.g. @handle' },
  { id: 'general', label: 'General / domain / IP', placeholder: 'e.g. example.com or 8.8.8.8' },
];

const TABS: Array<{ id: TabId; label: string }> = [
  { id: 'identity', label: 'Identity' },
  { id: 'accounts', label: 'Accounts' },
  { id: 'email', label: 'Email' },
  { id: 'phone', label: 'Phone' },
  { id: 'web', label: 'Web & Infra' },
  { id: 'other', label: 'General' },
  { id: 'pivots', label: 'Pivots' },
];

const app = document.getElementById('app')!;

app.innerHTML = `
  <header class="app-header">
    <div class="brand">
      <div class="brand-icon">O</div>
      <div>
        <h1>OsickTool</h1>
        <div class="tagline">Client-side OSINT reconnaissance &mdash; free sources only</div>
      </div>
    </div>
    <div class="header-actions">
      <button class="ghost" id="btn-settings">⚙ Settings</button>
      <button class="ghost" id="btn-reset">Clear session</button>
    </div>
  </header>

  <div class="privacy-strip">
    🔒 Everything runs in your browser. No search, result, or report is ever stored on a server &mdash;
    closing this tab erases it all.
  </div>

  <section class="search-panel panel">
    <form id="search-form" class="search-row">
      <select id="query-type"></select>
      <input type="text" id="query-value" placeholder="" autocomplete="off" />
      <button type="submit" class="primary">Search</button>
    </form>
    <div class="search-hint" id="search-hint"></div>
    <div class="query-history" id="query-history"></div>
  </section>

  <div class="toolbar">
    <div class="status" id="status-line"></div>
    <div class="export-actions">
      <button id="btn-export-csv">⬇ Export CSV</button>
      <button class="primary" id="btn-export-pdf">⬇ Export PDF Report</button>
    </div>
  </div>

  <nav class="tabs" id="tabs"></nav>
  <main id="results"></main>

  <footer class="app-footer">
    <p>
      <strong>Use responsibly.</strong> OsickTool only surfaces information that its underlying sources already
      publish openly. It is intended for legitimate research, due diligence, and authorized security work.
      Respect each source's terms of service and applicable privacy laws (e.g. GDPR) in your jurisdiction.
      "Unverified" results are candidate leads generated from URL patterns &mdash; confirm them manually before
      relying on them.
    </p>
  </footer>
`;

const typeSelect = document.getElementById('query-type') as HTMLSelectElement;
const valueInput = document.getElementById('query-value') as HTMLInputElement;
const searchForm = document.getElementById('search-form') as HTMLFormElement;
const searchHint = document.getElementById('search-hint') as HTMLDivElement;
const queryHistoryEl = document.getElementById('query-history') as HTMLDivElement;
const statusLine = document.getElementById('status-line') as HTMLDivElement;
const tabsEl = document.getElementById('tabs') as HTMLElement;
const resultsEl = document.getElementById('results') as HTMLElement;

for (const t of QUERY_TYPES) {
  const opt = document.createElement('option');
  opt.value = t.id;
  opt.textContent = t.label;
  typeSelect.appendChild(opt);
}

function updatePlaceholder(): void {
  const t = QUERY_TYPES.find((q) => q.id === typeSelect.value)!;
  valueInput.placeholder = t.placeholder;
  searchHint.textContent = `Searching as: ${t.label}. Results are consolidated into the tabs below as they arrive.`;
}
typeSelect.addEventListener('change', updatePlaceholder);
updatePlaceholder();

searchForm.addEventListener('submit', (e) => {
  e.preventDefault();
  const value = valueInput.value.trim();
  if (!value) return;
  store.search({ type: typeSelect.value as QueryType, value });
  valueInput.value = '';
});

document.getElementById('btn-settings')?.addEventListener('click', openSettingsModal);
document.getElementById('btn-reset')?.addEventListener('click', () => {
  if (confirm('Clear all findings from this session? This cannot be undone.')) store.reset();
});

document.getElementById('btn-export-csv')?.addEventListener('click', () => {
  if (store.state.findings.length === 0) return;
  downloadCsv(store.state.findings, `osicktool-report-${Date.now()}.csv`);
});

document.getElementById('btn-export-pdf')?.addEventListener('click', async (e) => {
  if (store.state.findings.length === 0) return;
  const btn = e.currentTarget as HTMLButtonElement;
  const originalLabel = btn.textContent;
  btn.disabled = true;
  btn.textContent = 'Building PDF…';
  try {
    const { downloadReportPdf } = await import('./lib/pdfExport');
    const targets = [...new Set(store.state.queryHistory.map((q) => q.value))].join(', ');
    downloadReportPdf(store.state.findings, targets, `osicktool-report-${Date.now()}.pdf`);
  } finally {
    btn.disabled = false;
    btn.textContent = originalLabel;
  }
});

function render(): void {
  const { findings, pivots, isSearching, activeTab, queryHistory, runLog } = store.state;

  // Status line
  statusLine.innerHTML = isSearching
    ? `<span class="spinner"></span> Querying sources…`
    : findings.length > 0
      ? `${findings.length} finding(s) across ${new Set(runLog.map((r) => r.connectorName)).size} source(s)`
      : queryHistory.length > 0
        ? 'No findings yet for this query.'
        : 'Run a search to get started.';

  // Query history chips
  queryHistoryEl.innerHTML = '';
  for (const q of queryHistory) {
    const chip = document.createElement('span');
    chip.className = 'chip';
    chip.textContent = `${q.type}: ${q.value}`;
    queryHistoryEl.appendChild(chip);
  }

  // Tabs
  tabsEl.innerHTML = '';
  for (const tab of TABS) {
    const count = tab.id === 'pivots' ? pivots.length : findings.filter((f) => f.tab === tab.id).length;
    const btn = document.createElement('button');
    btn.className = `tab-btn${activeTab === tab.id ? ' active' : ''}`;
    btn.innerHTML = `${tab.label}${count > 0 ? `<span class="count">${count}</span>` : ''}`;
    btn.addEventListener('click', () => store.setActiveTab(tab.id));
    tabsEl.appendChild(btn);
  }

  // Results
  resultsEl.innerHTML = '';
  if (activeTab === 'pivots') {
    resultsEl.appendChild(renderPivotsPanel());
  } else {
    const items = findings.filter((f) => f.tab === activeTab);
    if (items.length === 0) {
      const empty = document.createElement('div');
      empty.className = 'empty-state';
      empty.innerHTML = `<div class="big">🔍</div><div>No results in this category yet.</div>`;
      resultsEl.appendChild(empty);
    } else {
      const grid = document.createElement('div');
      grid.className = 'results-grid';
      for (const f of items) grid.appendChild(renderFindingCard(f));
      resultsEl.appendChild(grid);
    }
  }
}

function renderPivotsPanel(): HTMLElement {
  const wrap = document.createElement('div');
  if (store.state.pivots.length === 0) {
    wrap.innerHTML = `<div class="empty-state"><div class="big">🧭</div><div>No new pivot candidates discovered yet. Run a search first.</div></div>`;
    return wrap;
  }

  const intro = document.createElement('p');
  intro.className = 'search-hint';
  intro.style.marginBottom = '12px';
  intro.textContent = 'New identifiers discovered in the results above. Click one to search it and pull in more data.';
  wrap.appendChild(intro);

  const list = document.createElement('div');
  list.className = 'pivot-list';
  for (const p of store.state.pivots) {
    const item = document.createElement('div');
    item.className = 'pivot-item';
    item.innerHTML = `<span class="pv-type">${p.type}</span><span>${p.value}</span>`;
    const searchBtn = document.createElement('button');
    searchBtn.className = 'small primary';
    searchBtn.textContent = 'Search';
    searchBtn.addEventListener('click', () => {
      store.removePivot(p.value, p.type);
      store.search({ type: p.type, value: p.value });
    });
    const dismissBtn = document.createElement('button');
    dismissBtn.className = 'small ghost';
    dismissBtn.textContent = '✕';
    dismissBtn.title = 'Dismiss';
    dismissBtn.addEventListener('click', () => store.removePivot(p.value, p.type));
    item.appendChild(searchBtn);
    item.appendChild(dismissBtn);
    list.appendChild(item);
  }
  wrap.appendChild(list);
  return wrap;
}

store.subscribe(render);
render();

if ('serviceWorker' in navigator) {
  import('virtual:pwa-register')
    .then(({ registerSW }) => registerSW({ immediate: true }))
    .catch(() => {
      /* PWA registration is best-effort; app works fine without it */
    });
}
