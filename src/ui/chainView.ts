import type { ChainNode } from '../lib/enrichmentChain';
import { countDescendants } from '../lib/enrichmentChain';

function escapeText(s: string): string {
  const div = document.createElement('div');
  div.textContent = s;
  return div.innerHTML;
}

function renderNode(node: ChainNode): HTMLElement {
  const li = document.createElement('li');
  li.className = 'chain-node';

  const row = document.createElement('div');
  row.className = 'chain-row';

  const marker = document.createElement('span');
  marker.className = node.entry.auto ? 'chain-marker auto' : 'chain-marker manual';
  marker.textContent = node.entry.auto ? '⚡' : '🔍';
  marker.title = node.entry.auto ? 'Auto-enriched' : 'Manually searched';
  row.appendChild(marker);

  const type = document.createElement('span');
  type.className = 'pv-type';
  type.textContent = node.entry.type;
  row.appendChild(type);

  const value = document.createElement('span');
  value.className = 'chain-value';
  value.textContent = node.entry.value;
  row.appendChild(value);

  if (node.findingCount > 0) {
    const count = document.createElement('span');
    count.className = 'chain-count';
    count.textContent = `${node.findingCount} finding${node.findingCount === 1 ? '' : 's'}`;
    row.appendChild(count);
  }

  const descendants = countDescendants(node);
  if (descendants > 0) {
    const spawned = document.createElement('span');
    spawned.className = 'chain-spawned';
    spawned.textContent = `→ led to ${descendants} more search${descendants === 1 ? '' : 'es'}`;
    row.appendChild(spawned);
  }

  li.appendChild(row);

  if (node.entry.originConnector) {
    const origin = document.createElement('div');
    origin.className = 'chain-origin';
    origin.textContent = `via ${node.entry.originConnector}`;
    li.appendChild(origin);
  }

  if (node.children.length > 0) {
    const childList = document.createElement('ul');
    childList.className = 'chain-tree';
    for (const child of node.children) childList.appendChild(renderNode(child));
    li.appendChild(childList);
  }

  return li;
}

export function renderChainView(roots: ChainNode[]): HTMLElement {
  const wrap = document.createElement('div');

  if (roots.length === 0) {
    wrap.innerHTML = `<div class="empty-state"><div class="big">🧬</div><div>No searches yet. Once you run one, every lead it discovers and chases will show up here as a tree.</div></div>`;
    return wrap;
  }

  const intro = document.createElement('p');
  intro.className = 'search-hint';
  intro.style.marginBottom = '14px';
  intro.innerHTML = `How each search led to the next &mdash; ${escapeText('⚡')} marks a search auto-enrichment ran on its own; ${escapeText('🔍')} marks one you searched yourself.`;
  wrap.appendChild(intro);

  const tree = document.createElement('ul');
  tree.className = 'chain-tree chain-tree-root';
  for (const root of roots) tree.appendChild(renderNode(root));
  wrap.appendChild(tree);

  return wrap;
}
