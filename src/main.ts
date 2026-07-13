import './style.css';
import type { QueryType, TabId } from './types';
import { store } from './state';
import { openSettingsModal } from './ui/settingsModal';
import { renderFindingCard } from './ui/findingCard';
import { downloadCsv } from './lib/csvExport';
import { downloadRawJson } from './lib/rawExport';
import { getCountryOptions, getRecentCountry, setRecentCountry, guessCountryFromLocale } from './lib/countries';
import { buildIdentitySummary } from './lib/identitySummary';
import { getAutoEnrichEnabled, setAutoEnrichEnabled, getMaxDepth, getMaxAutoSearches } from './lib/enrichmentPrefs';
import { classifyQuery } from './lib/classify';
import { buildChainTree } from './lib/enrichmentChain';
import { renderChainView } from './ui/chainView';

const QUERY_TYPE_LABELS: Record<QueryType, string> = {
  username: 'Username',
  email: 'Email address',
  phone: 'Phone number',
  ic: 'IC / National ID',
  social: 'Social media handle',
  general: 'General / domain / IP / name',
  dork: 'Google Dork (custom query)',
};
const QUERY_TYPE_ORDER: QueryType[] = ['general', 'username', 'email', 'phone', 'ic', 'social', 'dork'];

const TABS: Array<{ id: TabId; label: string }> = [
  { id: 'identity', label: 'Identity' },
  { id: 'accounts', label: 'Accounts' },
  { id: 'email', label: 'Email' },
  { id: 'phone', label: 'Phone' },
  { id: 'web', label: 'Web & Infra' },
  { id: 'other', label: 'General' },
  { id: 'dorks', label: 'Google Dorks' },
  { id: 'chain', label: 'Enrichment Chain' },
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
      <input
        type="text"
        id="query-value"
        placeholder="Search a username, email, phone number, IC/NRIC, domain, name, or Google dork…"
        autocomplete="off"
      />
      <select id="query-type" class="type-badge" title="Auto-detected category - change if it guessed wrong"></select>
      <select id="query-country" class="hidden"></select>
      <button type="submit" class="primary">Search</button>
    </form>
    <div class="search-hint" id="search-hint"></div>
    <label class="auto-enrich-toggle" id="auto-enrich-row">
      <input type="checkbox" id="auto-enrich-checkbox" />
      <span>🔗 Auto-enrich &mdash; automatically search every new email, username, phone number, and name this uncovers</span>
    </label>
    <div class="query-history" id="query-history"></div>
  </section>

  <div class="budget-banner hidden" id="budget-banner">
    <span>⏸ Auto-enrich paused &mdash; it hit its limit for this session. Findings so far are untouched, and remaining leads are still listed in the Pivots tab to search manually.</span>
    <button class="small primary" id="btn-resume-enrich">Resume</button>
  </div>

  <div class="toolbar">
    <div class="status" id="status-line"></div>
    <div class="export-actions">
      <button class="hidden" id="btn-stop">⏹ Stop</button>
      <button id="btn-export-raw">⬇ Export Raw JSON</button>
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
const countrySelect = document.getElementById('query-country') as HTMLSelectElement;
const valueInput = document.getElementById('query-value') as HTMLInputElement;
const searchForm = document.getElementById('search-form') as HTMLFormElement;
const searchHint = document.getElementById('search-hint') as HTMLDivElement;
const queryHistoryEl = document.getElementById('query-history') as HTMLDivElement;
const statusLine = document.getElementById('status-line') as HTMLDivElement;
const tabsEl = document.getElementById('tabs') as HTMLElement;
const resultsEl = document.getElementById('results') as HTMLElement;
const autoEnrichCheckbox = document.getElementById('auto-enrich-checkbox') as HTMLInputElement;
const budgetBanner = document.getElementById('budget-banner') as HTMLDivElement;
const stopBtn = document.getElementById('btn-stop') as HTMLButtonElement;

autoEnrichCheckbox.checked = getAutoEnrichEnabled();
autoEnrichCheckbox.addEventListener('change', () => setAutoEnrichEnabled(autoEnrichCheckbox.checked));

for (const id of QUERY_TYPE_ORDER) {
  const opt = document.createElement('option');
  opt.value = id;
  opt.textContent = QUERY_TYPE_LABELS[id];
  typeSelect.appendChild(opt);
}

// Country dropdown - only relevant (and required) for phone searches, so a
// number typed in local format resolves against the right region.
const placeholderOpt = document.createElement('option');
placeholderOpt.value = '';
placeholderOpt.textContent = 'Select country…';
placeholderOpt.disabled = true;
countrySelect.appendChild(placeholderOpt);
for (const c of getCountryOptions()) {
  const opt = document.createElement('option');
  opt.value = c.code;
  opt.textContent = `${c.name} (+${c.callingCode})`;
  countrySelect.appendChild(opt);
}
countrySelect.value = getRecentCountry() ?? guessCountryFromLocale() ?? '';
if (!countrySelect.value) countrySelect.value = '';

// The type selector auto-follows live classification of whatever's typed,
// until the user manually touches it - then their choice sticks until the
// box is cleared or a search is submitted, so one search's manual pick
// never silently carries over to the next.
let typeManuallySet = false;

function updateDerivedUI(): void {
  const type = typeSelect.value as QueryType;
  const value = valueInput.value;
  const isPhone = type === 'phone';
  countrySelect.classList.toggle('hidden', !isPhone);
  countrySelect.required = isPhone;
  countrySelect.disabled = !isPhone;

  if (!value.trim()) {
    searchHint.textContent =
      'Type anything - the category (username, email, phone, IC/NRIC, domain, name, or a raw Google dork) is detected automatically. Wrong guess? Use the dropdown to correct it.';
    return;
  }
  const detected = classifyQuery(value);
  searchHint.textContent = typeManuallySet
    ? `Searching as: ${QUERY_TYPE_LABELS[type]} (manually set).`
    : `Detected: ${QUERY_TYPE_LABELS[type]} — ${detected.reason}.`;
}

function classifyAndUpdate(): void {
  if (!typeManuallySet) typeSelect.value = classifyQuery(valueInput.value).type;
  updateDerivedUI();
}

valueInput.addEventListener('input', classifyAndUpdate);
typeSelect.addEventListener('change', () => {
  typeManuallySet = true;
  updateDerivedUI();
});
classifyAndUpdate();

searchForm.addEventListener('submit', (e) => {
  e.preventDefault();
  const value = valueInput.value.trim();
  if (!value) return;
  const type = typeSelect.value as QueryType;

  if (type === 'phone' && !countrySelect.value) {
    countrySelect.reportValidity();
    return;
  }

  const country = type === 'phone' ? countrySelect.value : undefined;
  if (country) setRecentCountry(country);

  store.search({ type, value, country });
  valueInput.value = '';
  typeManuallySet = false;
  classifyAndUpdate();
});

document.getElementById('btn-settings')?.addEventListener('click', openSettingsModal);
document.getElementById('btn-reset')?.addEventListener('click', () => {
  if (confirm('Clear all findings from this session? This cannot be undone.')) store.reset();
});
stopBtn.addEventListener('click', () => store.stop());
document.getElementById('btn-resume-enrich')?.addEventListener('click', () => store.resumeAutoEnrich());

function findingsForExport(): typeof store.state.findings {
  const summary = buildIdentitySummary(store.state.findings);
  return summary ? [summary, ...store.state.findings] : store.state.findings;
}

document.getElementById('btn-export-csv')?.addEventListener('click', () => {
  if (store.state.findings.length === 0) return;
  downloadCsv(findingsForExport(), `osicktool-report-${Date.now()}.csv`);
});

document.getElementById('btn-export-raw')?.addEventListener('click', () => {
  if (store.state.findings.length === 0) return;
  downloadRawJson(store.state.findings, `osicktool-raw-${Date.now()}.json`);
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
    downloadReportPdf(findingsForExport(), targets, `osicktool-report-${Date.now()}.pdf`);
  } finally {
    btn.disabled = false;
    btn.textContent = originalLabel;
  }
});

function render(): void {
  const { findings, pivots, isSearching, activeTab, queryHistory, runLog, autoQueue, autoEnrichCount, autoEnrichBudgetExhausted } = store.state;

  // Status line
  const sourceCount = new Set(runLog.map((r) => r.connectorName)).size;
  const baseStatus =
    findings.length > 0
      ? `${findings.length} finding(s) across ${sourceCount} source(s)`
      : queryHistory.length > 0
        ? 'No findings yet for this query.'
        : 'Run a search to get started.';

  if (isSearching) {
    const queued = autoQueue.length;
    const enrichSuffix = autoEnrichCount > 0 || queued > 0 ? ` — auto-enriching (${autoEnrichCount} searched, ${queued} queued)` : '';
    statusLine.innerHTML = `<span class="spinner"></span> Querying sources…${enrichSuffix}`;
  } else {
    const enrichSuffix = autoEnrichCount > 0 ? ` · auto-enriched ${autoEnrichCount} lead(s)` : '';
    statusLine.textContent = baseStatus + enrichSuffix;
  }

  stopBtn.classList.toggle('hidden', !isSearching);
  budgetBanner.classList.toggle('hidden', !autoEnrichBudgetExhausted);

  // Query history chips
  queryHistoryEl.innerHTML = '';
  for (const q of queryHistory) {
    const chip = document.createElement('span');
    chip.className = q.auto ? 'chip chip-auto' : 'chip';
    const label = q.country ? `${q.type} (${q.country}): ${q.value}` : `${q.type}: ${q.value}`;
    chip.textContent = q.auto ? `⚡ ${label}` : label;
    chip.title = q.auto ? `Auto-enriched at depth ${q.depth}` : 'Manually searched';
    queryHistoryEl.appendChild(chip);
  }

  const identitySummary = buildIdentitySummary(findings);

  // Tabs
  tabsEl.innerHTML = '';
  for (const tab of TABS) {
    let count =
      tab.id === 'pivots'
        ? pivots.length
        : tab.id === 'chain'
          ? queryHistory.length
          : findings.filter((f) => f.tab === tab.id).length;
    if (tab.id === 'identity' && identitySummary) count += 1;
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
  } else if (activeTab === 'chain') {
    resultsEl.appendChild(renderChainView(buildChainTree(queryHistory, findings)));
  } else {
    const items = findings.filter((f) => f.tab === activeTab);
    if (activeTab === 'identity' && identitySummary) items.unshift(identitySummary);
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
  // Defensive filter: a pivot can briefly remain in state.pivots between
  // being auto-queued and actually dequeued/removed - never show something
  // that's already been searched.
  const visible = store.state.pivots.filter((p) => !store.hasSearched(p.type, p.value, p.country));
  if (visible.length === 0) {
    wrap.innerHTML = `<div class="empty-state"><div class="big">🧭</div><div>No new pivot candidates discovered yet. Run a search first.</div></div>`;
    return wrap;
  }

  const queuedKeys = new Set(store.state.autoQueue.map((item) => `${item.query.type}:${item.query.value.toLowerCase()}`));

  const intro = document.createElement('p');
  intro.className = 'search-hint';
  intro.style.marginBottom = '12px';
  intro.textContent = getAutoEnrichEnabled()
    ? `New identifiers discovered in the results above. Auto-enrich (depth ${getMaxDepth()}, up to ${getMaxAutoSearches()} searches) is chasing these automatically — click one to jump the queue, or ✕ to skip it.`
    : 'New identifiers discovered in the results above. Auto-enrich is off, so click one to search it and pull in more data.';
  wrap.appendChild(intro);

  const list = document.createElement('div');
  list.className = 'pivot-list';
  for (const p of visible) {
    const item = document.createElement('div');
    item.className = 'pivot-item';
    const queued = queuedKeys.has(`${p.type}:${p.value.toLowerCase()}`);
    item.innerHTML = `<span class="pv-type">${p.type}</span><span>${p.value}${p.country ? ` (${p.country})` : ''}</span>${queued ? '<span class="pv-queued">queued</span>' : ''}`;
    const searchBtn = document.createElement('button');
    searchBtn.className = 'small primary';
    searchBtn.textContent = 'Search';
    searchBtn.addEventListener('click', () => {
      store.removePivot(p.value, p.type, p.country);
      const lineage = p.parentKey ? { parentKey: p.parentKey, originConnector: p.origin, depth: p.depth ?? 1 } : undefined;
      store.search({ type: p.type, value: p.value, country: p.country }, lineage);
    });
    const dismissBtn = document.createElement('button');
    dismissBtn.className = 'small ghost';
    dismissBtn.textContent = '✕';
    dismissBtn.title = 'Dismiss';
    dismissBtn.addEventListener('click', () => store.removePivot(p.value, p.type, p.country));
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
