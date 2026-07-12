import type { Connector, Finding, SearchQuery } from '../types';
import { fetchJson, nextId, redactUrl } from '../lib/fetchUtils';

interface GhUser {
  login: string;
  id: number;
  name: string | null;
  company: string | null;
  blog: string | null;
  location: string | null;
  email: string | null;
  bio: string | null;
  twitter_username: string | null;
  public_repos: number;
  followers: number;
  following: number;
  created_at: string;
  avatar_url: string;
  html_url: string;
}

export const githubConnector: Connector = {
  id: 'github',
  name: 'GitHub',
  description: 'Public GitHub profile via the GitHub REST API.',
  supports: ['username', 'social'],
  async run(query: SearchQuery, ctx): Promise<Finding[]> {
    const url = `https://api.github.com/users/${encodeURIComponent(query.value)}`;
    const user = await fetchJson<GhUser>(url, {
      signal: ctx.signal,
      headers: { Accept: 'application/vnd.github+json' },
    });
    if (!user || !user.login) return [];

    return [
      {
        id: nextId(),
        connectorId: 'github',
        connectorName: 'GitHub',
        tab: 'accounts',
        title: `GitHub: @${user.login}`,
        detail: [user.name, user.bio].filter(Boolean).join(' — '),
        link: user.html_url,
        confidence: 'confirmed',
        query,
        timestamp: Date.now(),
        raw: user,
        rawSourceUrl: redactUrl(url),
        data: {
          name: user.name ?? undefined,
          company: user.company ?? undefined,
          blog: user.blog ?? undefined,
          location: user.location ?? undefined,
          email: user.email ?? undefined,
          twitter: user.twitter_username ?? undefined,
          publicRepos: user.public_repos,
          followers: user.followers,
          following: user.following,
          createdAt: user.created_at,
          avatar: user.avatar_url,
        },
      },
    ];
  },
};
