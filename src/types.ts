export type QueryType =
  | 'username'
  | 'email'
  | 'phone'
  | 'ic'
  | 'social'
  | 'general';

export interface SearchQuery {
  type: QueryType;
  value: string;
}

export type TabId =
  | 'identity'
  | 'accounts'
  | 'email'
  | 'phone'
  | 'web'
  | 'other'
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
}
