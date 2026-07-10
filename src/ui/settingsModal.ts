import { API_KEY_DEFS, getApiKeys, setApiKey, clearApiKeys, getProxyEnabled, setProxyEnabled } from '../lib/apiKeys';

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
