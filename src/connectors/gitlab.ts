import type { Connector, Finding, SearchQuery } from '../types';
import { fetchJson, nextId, redactUrl } from '../lib/fetchUtils';

interface GlUser {
  id: number;
  username: string;
  name: string;
  state: string;
  avatar_url: string;
  web_url: string;
  bio?: string;
  location?: string;
  public_email?: string;
  organization?: string;
  job_title?: string;
  linkedin?: string;
  twitter?: string;
  website_url?: string;
}

export const gitlabConnector: Connector = {
  id: 'gitlab',
  name: 'GitLab',
  description: 'Public GitLab.com profile via the GitLab REST API.',
  supports: ['username', 'social'],
  async run(query: SearchQuery, ctx): Promise<Finding[]> {
    const url = `https://gitlab.com/api/v4/users?username=${encodeURIComponent(query.value)}`;
    const users = await fetchJson<GlUser[]>(url, { signal: ctx.signal });
    if (!users || users.length === 0) return [];
    const user = users[0];

    return [
      {
        id: nextId(),
        connectorId: 'gitlab',
        connectorName: 'GitLab',
        tab: 'accounts',
        title: `GitLab: @${user.username}`,
        detail: [user.name, user.bio].filter(Boolean).join(' — '),
        link: user.web_url,
        confidence: 'confirmed',
        query,
        timestamp: Date.now(),
        raw: users,
        rawSourceUrl: redactUrl(url),
        data: {
          name: user.name,
          state: user.state,
          location: user.location ?? undefined,
          organization: user.organization ?? undefined,
          jobTitle: user.job_title ?? undefined,
          email: user.public_email || undefined,
          linkedin: user.linkedin ?? undefined,
          twitter: user.twitter ?? undefined,
          website: user.website_url ?? undefined,
          avatar: user.avatar_url,
        },
      },
    ];
  },
};
