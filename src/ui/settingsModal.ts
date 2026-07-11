import { API_KEY_DEFS, getApiKeys, setApiKey, clearApiKeys, getProxyEnabled, setProxyEnabled } from '../lib/apiKeys';
import {
  getAutoEnrichEnabled,
  setAutoEnrichEnabled,
  getMaxDepth,
  setMaxDepth,
  getMaxAutoSearches,
  setMaxAutoSearches,
  ABSOLUTE_MAX_DEPTH,
  ABSOLUTE_MAX_AUTO_SEARCHES,
} from '../lib/enrichmentPrefs';

export function openSettingsModal(): void {
  const backdrop = document.createElement('div');
  backdrop.className = 'modal-backdrop';
  backdrop.addEventListener('click', (e) => {
    if (e.target === backdrop) backdrop.remove();
  });

  const modal = document.createElement('div');
  modal.className = 'modal';

  const keys = getApiKeys();

  modal.innerHTML = `
    <h2>Settings</h2>
    <p class="help" style="margin-top:-8px;margin-bottom:16px;">
      Everything below is stored only in this browser's local storage. Nothing is ever sent to us or to any
      server other than the API you're configuring, and API keys are never included in exported reports.
    </p>
    <div id="api-key-fields"></div>

    <div class="toggle-row">
      <div>
        <label style="margin-bottom:2px;">Auto-enrich new leads</label>
        <div class="help">
          When a search turns up a new email, username, phone number, or name, automatically search that too -
          and keep going on whatever it finds. Also toggleable from the checkbox next to the search bar.
        </div>
      </div>
      <input type="checkbox" id="auto-enrich-toggle" ${getAutoEnrichEnabled() ? 'checked' : ''} />
    </div>
    <div class="field" style="margin-top:14px;">
      <label for="max-depth-input">Max chain depth</label>
      <input type="number" id="max-depth-input" min="1" max="${ABSOLUTE_MAX_DEPTH}" value="${getMaxDepth()}" />
      <div class="help">How many hops a fully-automatic chain can go: your search is depth 0, a lead it finds is depth 1, a lead <em>that</em> finds is depth 2, and so on. Higher goes deeper but slower.</div>
    </div>
    <div class="field">
      <label for="max-searches-input">Max auto-searches per session</label>
      <input type="number" id="max-searches-input" min="1" max="${ABSOLUTE_MAX_AUTO_SEARCHES}" value="${getMaxAutoSearches()}" />
      <div class="help">A hard cap on total automatic searches, regardless of depth - protects free-tier API quotas (NumVerify, Hunter.io, Shodan) from being burned through by a long chain. Resets when you clear the session.</div>
    </div>

    <div class="toggle-row">
      <div>
        <label style="margin-bottom:2px;">Enable third-party CORS proxy for site checks</label>
        <div class="help">
          Routes "Site Directory" existence checks through the public proxy api.allorigins.win, so the
          username you're searching for is visible to that proxy operator. Off by default.
        </div>
      </div>
      <input type="checkbox" id="proxy-toggle" ${getProxyEnabled() ? 'checked' : ''} />
    </div>
    <div class="modal-footer">
      <button class="ghost" id="clear-keys">Clear all keys</button>
      <button class="primary" id="close-settings">Done</button>
    </div>
  `;

  const fieldsContainer = modal.querySelector('#api-key-fields') as HTMLDivElement;
  for (const def of API_KEY_DEFS) {
    const field = document.createElement('div');
    field.className = 'field';
    field.innerHTML = `
      <label for="key-${def.id}">${def.label}</label>
      <input type="password" id="key-${def.id}" placeholder="Paste your free API key" value="${keys[def.id] ?? ''}" autocomplete="off" />
      <div class="help">${def.helpText} <a href="${def.helpUrl}" target="_blank" rel="noopener">Get a free key &rarr;</a></div>
    `;
    const input = field.querySelector('input') as HTMLInputElement;
    input.addEventListener('change', () => setApiKey(def.id, input.value));
    fieldsContainer.appendChild(field);
  }

  modal.querySelector('#proxy-toggle')?.addEventListener('change', (e) => {
    setProxyEnabled((e.target as HTMLInputElement).checked);
  });

  modal.querySelector('#auto-enrich-toggle')?.addEventListener('change', (e) => {
    const checked = (e.target as HTMLInputElement).checked;
    setAutoEnrichEnabled(checked);
    // Keep the quick-access checkbox next to the search bar in sync.
    const mainToggle = document.getElementById('auto-enrich-checkbox') as HTMLInputElement | null;
    if (mainToggle) mainToggle.checked = checked;
  });

  modal.querySelector('#max-depth-input')?.addEventListener('change', (e) => {
    setMaxDepth(Number((e.target as HTMLInputElement).value));
  });

  modal.querySelector('#max-searches-input')?.addEventListener('change', (e) => {
    setMaxAutoSearches(Number((e.target as HTMLInputElement).value));
  });

  modal.querySelector('#clear-keys')?.addEventListener('click', () => {
    clearApiKeys();
    for (const def of API_KEY_DEFS) {
      const input = modal.querySelector(`#key-${def.id}`) as HTMLInputElement;
      if (input) input.value = '';
    }
  });

  modal.querySelector('#close-settings')?.addEventListener('click', () => backdrop.remove());

  backdrop.appendChild(modal);
  document.body.appendChild(backdrop);
}
