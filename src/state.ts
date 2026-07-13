import type { Finding, PivotCandidate, QueryType, SearchQuery, TabId } from './types';
import { connectorsFor } from './connectors/index';
import { safe } from './lib/fetchUtils';
import { extractPivots } from './lib/pivot';
import { getApiKeys, getProxyEnabled } from './lib/apiKeys';
import { queryKey } from './lib/queryKey';
import { getAutoEnrichEnabled, getMaxDepth, getMaxAutoSearches } from './lib/enrichmentPrefs';
import { looksLikePersonName } from './lib/classify';
import { generateUsernamePermutations } from './lib/namePermutations';

export interface SearchRunLog {
  query: SearchQuery;
  connectorName: string;
  count: number;
}

export interface HistoryEntry extends SearchQuery {
  depth: number;
  auto: boolean;
  /** queryKey() of the search that led to this one - undefined for a
   * genuinely fresh root search typed into the search bar. */
  parentKey?: string;
  /** Connector/mechanism that surfaced this lead (e.g. "GitHub Commit
   * Identity", "Name permutation") - undefined for a root search. */
  originConnector?: string;
}

interface AutoQueueItem {
  query: SearchQuery;
  depth: number;
  parentKey?: string;
  originConnector?: string;
}

export interface SearchLineage {
  parentKey: string;
  originConnector: string;
  depth: number;
}

interface State {
  findings: Finding[];
  pivots: PivotCandidate[];
  searchedValues: Set<string>; // queryKey(type, value, country)
  queryHistory: HistoryEntry[];
  isSearching: boolean;
  activeTab: TabId;
  runLog: SearchRunLog[];
  autoQueue: AutoQueueItem[];
  autoEnrichCount: number;
  autoEnrichBudgetExhausted: boolean;
}

type Listener = () => void;

function freshState(): State {
  return {
    findings: [],
    pivots: [],
    searchedValues: new Set(),
    queryHistory: [],
    isSearching: false,
    activeTab: 'identity',
    runLog: [],
    autoQueue: [],
    autoEnrichCount: 0,
    autoEnrichBudgetExhausted: false,
  };
}

class Store {
  state: State = freshState();

  private listeners = new Set<Listener>();
  private sessionAbort = new AbortController();
  private draining = false;
  private activeOperations = 0;

  subscribe(fn: Listener): () => void {
    this.listeners.add(fn);
    return () => this.listeners.delete(fn);
  }

  private emit(): void {
    for (const fn of this.listeners) fn();
  }

  private updateSearchingFlag(): void {
    // A non-empty auto-queue does NOT by itself mean "searching" - once the
    // queue is paused (budget exhausted), items sit there waiting for
    // Resume, and the spinner should clear rather than spin forever.
    this.state.isSearching = this.activeOperations > 0 || this.draining;
  }

  setActiveTab(tab: TabId): void {
    this.state.activeTab = tab;
    this.emit();
  }

  hasSearched(type: QueryType, value: string, country?: string): boolean {
    return this.state.searchedValues.has(queryKey(type, value, country));
  }

  /** Public entry point. A search bar submission passes no lineage (a fresh
   * root, depth 0); clicking a pivot chip passes its recorded lineage so
   * the enrichment-chain view can trace it back to what discovered it.
   * Always runs immediately rather than waiting behind the auto-queue. */
  async search(query: SearchQuery, lineage?: SearchLineage): Promise<void> {
    const value = query.value.trim();
    if (!value) return;
    const normalized: SearchQuery = { type: query.type, value, country: query.country };
    const normalizedKey = queryKey(normalized.type, normalized.value, normalized.country);
    if (this.state.searchedValues.has(normalizedKey)) return;

    await this.runBatch(normalized, lineage?.depth ?? 0, false, lineage?.parentKey, lineage?.originConnector);

    // A person's name has no dedicated "search by name" connector, but
    // common handle patterns are worth trying directly - generated
    // properly (see namePermutations.ts) rather than naively splitting on
    // whitespace or truncating the string.
    if (normalized.type === 'general' && looksLikePersonName(normalized.value)) {
      for (const handle of generateUsernamePermutations(normalized.value)) {
        this.seedPivot({ value: handle, type: 'username', origin: 'Name permutation' }, (lineage?.depth ?? 0) + 1, normalizedKey);
      }
      this.emit();
    }

    void this.drainAutoQueue();
  }

  /** Runs every connector matching this query's type, records results, and
   * queues any newly-discovered pivots for auto-enrichment if eligible. */
  private async runBatch(
    query: SearchQuery,
    depth: number,
    auto: boolean,
    parentKey?: string,
    originConnector?: string,
  ): Promise<void> {
    const key = queryKey(query.type, query.value, query.country);
    this.state.searchedValues.add(key);
    this.state.queryHistory.push({ ...query, depth, auto, parentKey, originConnector });
    this.activeOperations++;
    this.updateSearchingFlag();
    this.emit();

    const ctx = {
      apiKeys: getApiKeys(),
      signal: this.sessionAbort.signal,
      proxyEnabled: getProxyEnabled(),
    };

    const connectors = connectorsFor(query.type);

    await Promise.all(
      connectors.map((connector) =>
        safe(async () => {
          const results = await connector.run(query, ctx);
          if (this.sessionAbort.signal.aborted) return [];
          if (results.length > 0) {
            this.state.findings.push(...results);
            this.state.runLog.push({ query, connectorName: connector.name, count: results.length });

            for (const p of results.flatMap(extractPivots)) this.seedPivot(p, depth + 1, key);
            this.emit();
          }
          return results;
        }),
      ),
    );

    this.activeOperations--;
    this.updateSearchingFlag();
    this.emit();
  }

  /** Records a new candidate (a discovered pivot, or a generated name
   * permutation) as a manually-clickable lead, tagged with the search that
   * led to it, and additionally queues it for automatic pursuit if
   * auto-enrich is on and it's within the configured depth. Does not emit -
   * callers batch several of these together and emit once. */
  private seedPivot(p: PivotCandidate, depth: number, parentKey: string): void {
    const pKey = queryKey(p.type, p.value, p.country);
    if (this.state.searchedValues.has(pKey)) return;
    if (this.state.pivots.some((existing) => queryKey(existing.type, existing.value, existing.country) === pKey)) return;

    this.state.pivots.push({ ...p, parentKey, depth });
    if (getAutoEnrichEnabled() && depth <= getMaxDepth()) {
      this.state.autoQueue.push({
        query: { type: p.type, value: p.value, country: p.country },
        depth,
        parentKey,
        originConnector: p.origin,
      });
    }
  }

  /** Serially works through the auto-enrichment queue - one search at a
   * time, so a burst of newly-discovered leads doesn't fire dozens of
   * concurrent requests at once. Safe to call repeatedly; re-entrant calls
   * while already draining are no-ops (the active loop picks up anything
   * pushed onto the queue meanwhile). */
  private async drainAutoQueue(): Promise<void> {
    if (this.draining) return;
    this.draining = true;
    this.updateSearchingFlag();
    this.emit();

    while (this.state.autoQueue.length > 0 && !this.sessionAbort.signal.aborted) {
      if (this.state.autoEnrichCount >= getMaxAutoSearches()) {
        this.state.autoEnrichBudgetExhausted = true;
        break; // queue + pivots are left untouched so "Resume" can pick up exactly here
      }

      const item = this.state.autoQueue.shift()!;
      const key = queryKey(item.query.type, item.query.value, item.query.country);
      if (this.state.searchedValues.has(key)) continue; // a manual click already covered it

      this.state.autoEnrichCount++;
      this.state.pivots = this.state.pivots.filter((p) => queryKey(p.type, p.value, p.country) !== key);
      this.updateSearchingFlag();
      this.emit();

      await this.runBatch(item.query, item.depth, true, item.parentKey, item.originConnector);
    }

    this.draining = false;
    this.updateSearchingFlag();
    this.emit();
  }

  /** Re-enables draining after a budget pause (e.g. after the user raises
   * the limit in Settings) - resumes from exactly where the queue left off. */
  resumeAutoEnrich(): void {
    this.state.autoEnrichBudgetExhausted = false;
    void this.drainAutoQueue();
  }

  /** Aborts everything in flight and clears the pending auto-queue, but
   * keeps every finding collected so far. A fresh AbortController is armed
   * immediately so subsequent manual searches aren't doomed. */
  stop(): void {
    this.sessionAbort.abort();
    this.sessionAbort = new AbortController();
    this.state.autoQueue = [];
    this.activeOperations = 0;
    this.draining = false;
    this.updateSearchingFlag();
    this.emit();
  }

  removePivot(value: string, type: QueryType, country?: string): void {
    const key = queryKey(type, value, country);
    this.state.pivots = this.state.pivots.filter((p) => queryKey(p.type, p.value, p.country) !== key);
    this.state.autoQueue = this.state.autoQueue.filter((item) => queryKey(item.query.type, item.query.value, item.query.country) !== key);
    this.emit();
  }

  reset(): void {
    this.sessionAbort.abort();
    this.sessionAbort = new AbortController();
    this.activeOperations = 0;
    this.draining = false;
    this.state = freshState();
    this.emit();
  }
}

export const store = new Store();
