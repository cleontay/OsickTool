import type { Connector, Finding, SearchQuery } from '../types';
import { fetchJson, nextId } from '../lib/fetchUtils';

interface HnUser {
  id: string;
  created: number;
  karma: number;
  about?: string;
  submitted?: number[];
}

export const hackernewsConnector: Connector = {
  id: 'hackernews',
  name: 'Hacker News',
  description: 'Public Hacker News (Y Combinator) account profile.',
  supports: ['username', 'social'],
  async run(query: SearchQuery, ctx): Promise<Finding[]> {
    const user = await fetchJson<HnUser>(
      `https://hacker-news.firebaseio.com/v0/user/${encodeURIComponent(query.value)}.json`,
      { signal: ctx.signal },
    );
    if (!user || !user.id) return [];

    return [
      {
        id: nextId(),
        connectorId: 'hackernews',
        connectorName: 'Hacker News',
        tab: 'accounts',
        title: `Hacker News: ${user.id}`,
        detail: user.about ? user.about.replace(/<[^>]+>/g, ' ').slice(0, 200) : `${user.karma} karma`,
        link: `https://news.ycombinator.com/user?id=${encodeURIComponent(user.id)}`,
        confidence: 'confirmed',
        query,
        timestamp: Date.now(),
        data: {
          karma: user.karma,
          createdAt: new Date(user.created * 1000).toISOString(),
          submissionCount: user.submitted?.length ?? 0,
        },
      },
    ];
  },
};
