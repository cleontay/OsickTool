import type { Connector, Finding, SearchQuery } from '../types';
import { fetchJson, nextId } from '../lib/fetchUtils';

interface DockerHubUser {
  id: string;
  uuid: string;
  username: string;
  full_name?: string;
  location?: string;
  company?: string;
  is_org: boolean;
  gravatar_url?: string;
  date_joined?: string;
}

export const dockerhubConnector: Connector = {
  id: 'dockerhub',
  name: 'Docker Hub',
  description: 'Public Docker Hub account (best-effort, may be blocked by the source\'s CORS policy).',
  supports: ['username'],
  async run(query: SearchQuery, ctx): Promise<Finding[]> {
    const user = await fetchJson<DockerHubUser>(
      `https://hub.docker.com/v2/users/${encodeURIComponent(query.value)}/`,
      { signal: ctx.signal },
    );
    if (!user || !user.username) return [];

    return [
      {
        id: nextId(),
        connectorId: 'dockerhub',
        connectorName: 'Docker Hub',
        tab: 'accounts',
        title: `Docker Hub: ${user.username}`,
        detail: [user.full_name, user.company, user.location].filter(Boolean).join(' — '),
        link: `https://hub.docker.com/u/${encodeURIComponent(user.username)}`,
        confidence: 'confirmed',
        query,
        timestamp: Date.now(),
        data: {
          fullName: user.full_name ?? undefined,
          company: user.company ?? undefined,
          location: user.location ?? undefined,
          isOrg: user.is_org,
          joined: user.date_joined ?? undefined,
        },
      },
    ];
  },
};
