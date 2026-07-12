import type { Connector, Finding, SearchQuery } from '../types';
import { fetchJson, nextId, redactUrl } from '../lib/fetchUtils';

interface GhCommit {
  sha: string;
  author: { name: string; email: string };
  message: string;
}

interface GhEvent {
  type: string;
  created_at: string;
  repo?: { name: string };
  payload?: { commits?: GhCommit[] };
}

interface HarvestedIdentity {
  name: string;
  email: string;
  commitCount: number;
  repos: Set<string>;
  lastSeen: string;
}

/**
 * Classic OSINT technique: even when a GitHub profile hides its email, every
 * public commit carries the author's name + email in its metadata. This
 * walks the account's recent public activity and surfaces those directly -
 * often the single highest-value pivot a username search can produce.
 */
export const githubCommitsConnector: Connector = {
  id: 'github-commits',
  name: 'GitHub Commit Identity',
  description: 'Harvests real name/email pairs from public commit authorship in recent GitHub activity.',
  supports: ['username', 'social'],
  async run(query: SearchQuery, ctx): Promise<Finding[]> {
    const url = `https://api.github.com/users/${encodeURIComponent(query.value)}/events/public?per_page=100`;
    const events = await fetchJson<GhEvent[]>(url, {
      signal: ctx.signal,
      headers: { Accept: 'application/vnd.github+json' },
    });
    if (!events || events.length === 0) return [];

    const identities = new Map<string, HarvestedIdentity>();
    for (const event of events) {
      if (event.type !== 'PushEvent') continue;
      for (const commit of event.payload?.commits ?? []) {
        const email = commit.author?.email?.trim();
        const name = commit.author?.name?.trim();
        if (!email || !name) continue;
        // GitHub's privacy-preserving noreply addresses don't identify anyone.
        if (email.endsWith('@users.noreply.github.com')) continue;

        const key = email.toLowerCase();
        const existing = identities.get(key);
        if (existing) {
          existing.commitCount += 1;
          existing.lastSeen = event.created_at;
          if (event.repo?.name) existing.repos.add(event.repo.name);
        } else {
          identities.set(key, {
            name,
            email,
            commitCount: 1,
            repos: new Set(event.repo?.name ? [event.repo.name] : []),
            lastSeen: event.created_at,
          });
        }
      }
    }

    if (identities.size === 0) return [];

    return [...identities.values()]
      .sort((a, b) => b.commitCount - a.commitCount)
      .slice(0, 10)
      .map((identity) => ({
        id: nextId(),
        connectorId: 'github-commits',
        connectorName: 'GitHub Commit Identity',
        tab: 'identity' as const,
        title: `Commit identity: ${identity.name} <${identity.email}>`,
        detail: `Authored ${identity.commitCount} public commit(s) across ${identity.repos.size} repo(s), most recently ${new Date(identity.lastSeen).toLocaleDateString()}.`,
        link: `https://github.com/${encodeURIComponent(query.value)}?tab=repositories`,
        confidence: 'confirmed' as const,
        query,
        timestamp: Date.now(),
        raw: events,
        rawSourceUrl: redactUrl(url),
        data: {
          name: identity.name,
          email: identity.email,
          commitCount: identity.commitCount,
          repos: [...identity.repos].slice(0, 5).join(', '),
        },
      }));
  },
};
