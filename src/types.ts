export type QueryType =
  | 'username'
  | 'email'
  | 'phone'
  | 'ic'
  | 'social'
  | 'general'
  | 'dork';

export interface SearchQuery {
  type: QueryType;
  value: string;
  /** ISO 3166-1 alpha-2 region code, e.g. "US" - used as a parsing hint for phone queries. */
  country?: string;
  /** True if this query is a guessed handle (e.g. a generated username
   * permutation) rather than something extracted from data already
   * confirmed about the target. An account existing under a guessed handle
   * only confirms the handle is taken - not that it belongs to the target -
   * so findings from a speculative query must never be folded into the
   * Consolidated Profile as if they were verified facts. Propagates to any
   * further pivots discovered from a speculative search's own results,
   * since everything downstream of an unverified guess is equally
   * unverified. */
  speculative?: boolean;
}

export type TabId =
  | 'identity'
  | 'accounts'
  | 'email'
  | 'phone'
  | 'web'
  | 'other'
  | 'dorks'
  | 'chain'
  | 'pivots';

export interface TabDef {
  id: TabId;
  label: string;
}

export type Confidence = 'confirmed' | 'likely' | 'unverified' | 'info';

export interface Finding {
  id: string;
  connectorId: string;
  connectorName: string;
  tab: TabId;
  title: string;
  detail?: string;
  data?: Record<string, string | number | boolean | null | undefined>;
  link?: string;
  confidence: Confidence;
  query: SearchQuery;
  timestamp: number;
  /** The parsed API response this finding was derived from, if it came from
   * a network call - lets you inspect exactly what a source returned rather
   * than just the fields OsickTool chose to surface. Absent for local-only
   * connectors (IC decoder, phone parser, etc.) that never call an API. */
  raw?: unknown;
  /** The endpoint that was queried, with any API key/token query params
   * redacted - shown alongside the raw response for context. */
  rawSourceUrl?: string;
}

export interface ConnectorContext {
  apiKeys: Record<string, string>;
  signal: AbortSignal;
  proxyEnabled: boolean;
}

export interface Connector {
  id: string;
  name: string;
  description: string;
  supports: QueryType[];
  /** true if this connector calls out to a third-party CORS proxy when proxyEnabled is on */
  requiresProxy?: boolean;
  /** name of the optional API key this connector can use, if any (see src/lib/apiKeys.ts) */
  apiKeyId?: string;
  run: (query: SearchQuery, ctx: ConnectorContext) => Promise<Finding[]>;
}

export interface PivotCandidate {
  value: string;
  type: QueryType;
  origin: string; // connector name that surfaced it
  /** For phone pivots: the region libphonenumber-js resolved while extracting it. */
  country?: string;
  /** queryKey() of the search that led to this pivot being discovered -
   * lets the enrichment-chain view trace it back to its parent even if it's
   * searched much later via a manual click. */
  parentKey?: string;
  /** The depth this pivot would be searched at (parent's depth + 1). */
  depth?: number;
  /** See SearchQuery.speculative - true for a guessed handle (e.g. a name
   * permutation) rather than something extracted from confirmed data. */
  speculative?: boolean;
}
