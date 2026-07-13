import type { Finding } from '../types';
import type { HistoryEntry } from '../state';
import { queryKey } from './queryKey';

export interface ChainNode {
  key: string;
  entry: HistoryEntry;
  findingCount: number;
  children: ChainNode[];
}

/**
 * Rebuilds the actual discovery tree from the flat, timestamp-ordered
 * queryHistory - each entry already knows its parentKey (see state.ts's
 * seedPivot), so this is just a grouping pass, not a guess. A search with
 * no parent (typed directly into the search bar, or whose parent search
 * somehow isn't in history) becomes a root.
 */
export function buildChainTree(queryHistory: HistoryEntry[], findings: Finding[]): ChainNode[] {
  const findingCounts = new Map<string, number>();
  for (const f of findings) {
    const k = queryKey(f.query.type, f.query.value, f.query.country);
    findingCounts.set(k, (findingCounts.get(k) ?? 0) + 1);
  }

  const nodeByKey = new Map<string, ChainNode>();
  for (const entry of queryHistory) {
    const key = queryKey(entry.type, entry.value, entry.country);
    nodeByKey.set(key, { key, entry, findingCount: findingCounts.get(key) ?? 0, children: [] });
  }

  const roots: ChainNode[] = [];
  for (const node of nodeByKey.values()) {
    const parent = node.entry.parentKey ? nodeByKey.get(node.entry.parentKey) : undefined;
    if (parent) parent.children.push(node);
    else roots.push(node);
  }

  return roots;
}

export function countDescendants(node: ChainNode): number {
  return node.children.reduce((sum, child) => sum + 1 + countDescendants(child), 0);
}
