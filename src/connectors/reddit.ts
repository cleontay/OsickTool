import type { Connector, Finding, SearchQuery } from '../types';
import { fetchJson, nextId } from '../lib/fetchUtils';

interface RedditAboutResponse {
  data?: {
    name: string;
    total_karma: number;
    link_karma: number;
    comment_karma: number;
    created_utc: number;
    is_mod: boolean;
    has_verified_email: boolean;
    icon_img?: string;
    subreddit?: { public_description?: string; over_18?: boolean };
  };
}

export const redditConnector: Connector = {
  id: 'reddit',
  name: 'Reddit',
  description: 'Public Reddit profile (best-effort, Reddit may block unauthenticated cross-origin reads).',
  supports: ['username', 'social'],
  async run(query: SearchQuery, ctx): Promise<Finding[]> {
    const res = await fetchJson<RedditAboutResponse>(
      `https://www.reddit.com/user/${encodeURIComponent(query.value)}/about.json`,
      { signal: ctx.signal },
    );
    const d = res?.data;
    if (!d || !d.name) return [];

    return [
      {
        id: nextId(),
        connectorId: 'reddit',
        connectorName: 'Reddit',
        tab: 'accounts',
        title: `Reddit: u/${d.name}`,
        detail: d.subreddit?.public_description || `${d.total_karma} total karma`,
        link: `https://www.reddit.com/user/${encodeURIComponent(d.name)}`,
        confidence: 'confirmed',
        query,
        timestamp: Date.now(),
        data: {
          totalKarma: d.total_karma,
          linkKarma: d.link_karma,
          commentKarma: d.comment_karma,
          createdUtc: new Date(d.created_utc * 1000).toISOString(),
          verifiedEmail: d.has_verified_email,
          isMod: d.is_mod,
        },
      },
    ];
  },
};
