import type { Finding, PivotCandidate, QueryType, SearchQuery, TabId } from './types';
import { connectorsFor } from './connectors/index';
import { safe } from './lib/fetchUtils';
import { extractPivots } from './lib/pivot';
import { getApiKeys, getProxyEnabled } from './lib/apiKeys';

export interface SearchRunLog {
  query: SearchQuery;
  connectorName: string;
  count: number;
}

interface State {
  findings: Finding[];
  pivots: PivotCandidate[];
  searchedValues: Set<string>; // `${type}:${value.toLowerCase()}`
  queryHistory: SearchQuery[];
  isSearching: boolean;
  activeTab: TabId;
  runLog: SearchRunLog[];
}

type Listener = () => void;

class Store {
  state: State = {
    findings: [],
    pivots: [],
    searchedValues: new Set(),
    queryHistory: [],
    isSearching: false,
    activeTab: 'identity',
    runLog: [],
  };

  private listeners = new Set<Listener>();
  private currentAbort: AbortController | null = null;

  subscribe(fn: Listener): () => void {
    this.listeners.add(fn);
    return () => this.listeners.delete(fn);
  }

  private emit(): void {
    for (const fn of this.listeners) fn();
  }

  setActiveTab(tab: TabId): void {
    this.state.activeTab = tab;
    this.emit();
  }

  hasSearched(type: QueryType, value: string): boolean {
    return this.state.searchedValues.has(`${type}:${value.trim().toLowerCase()}`);
  }

  async search(query: SearchQuery): Promise<void> {
    const value = query.value.trim();
    if (!value) return;
    const key = `${query.type}:${value.toLowerCase()}`;
    if (this.state.searchedValues.has(key)) return;

    const normalizedQuery: SearchQuery = { type: query.type, value, country: query.country };

    this.state.searchedValues.add(key);
    this.state.queryHistory.push(normalizedQuery);
    this.state.isSearching = true;
    this.emit();

    this.currentAbort?.abort();
    const abort = new AbortController();
    this.currentAbort = abort;

    const ctx = {
      apiKeys: getApiKeys(),
      signal: abort.signal,
      proxyEnabled: getProxyEnabled(),
    };

    const connectors = connectorsFor(query.type);
    await Promise.all(
      connectors.map((connector) =>
        safe(async () => {
          const results = await connector.run(normalizedQuery, ctx);
          if (abort.signal.aborted) return [];
          if (results.length > 0) {
            this.state.findings.push(...results);
            this.state.runLog.push({ query: normalizedQuery, connectorName: connector.name, count: results.length });
            const newPivots = results.flatMap(extractPivots);
            for (const p of newPivots) {
              const pKey = `${p.type}:${p.value.toLowerCase()}`;
              if (this.state.searchedValues.has(pKey)) continue;
              if (this.state.pivots.some((existing) => `${existing.type}:${existing.value.toLowerCase()}` === pKey)) continue;
              this.state.pivots.push(p);
            }
            this.emit();
          }
          return results;
        }),
      ),
    );

    if (!abort.signal.aborted) {
      this.state.isSearching = false;
      this.emit();
    }
  }

  removePivot(value: string, type: QueryType): void {
    this.state.pivots = this.state.pivots.filter((p) => !(p.value === value && p.type === type));
    this.emit();
  }

  reset(): void {
    this.currentAbort?.abort();
    this.state = {
      findings: [],
      pivots: [],
      searchedValues: new Set(),
      queryHistory: [],
      isSearching: false,
      activeTab: 'identity',
      runLog: [],
    };
    this.emit();
  }
}

export const store = new Store();
