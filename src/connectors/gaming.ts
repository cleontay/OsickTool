import type { Connector, Finding, SearchQuery } from '../types';
import { fetchJson, nextId } from '../lib/fetchUtils';

interface ChessComPlayer {
  username: string;
  name?: string;
  title?: string;
  country?: string;
  location?: string;
  joined?: number;
  followers?: number;
  is_streamer?: boolean;
  twitch_url?: string;
  url: string;
}

export const chessComConnector: Connector = {
  id: 'chesscom',
  name: 'Chess.com',
  description: 'Public Chess.com player profile.',
  supports: ['username'],
  async run(query: SearchQuery, ctx): Promise<Finding[]> {
    const player = await fetchJson<ChessComPlayer>(
      `https://api.chess.com/pub/player/${encodeURIComponent(query.value.toLowerCase())}`,
      { signal: ctx.signal },
    );
    if (!player || !player.username) return [];

    return [
      {
        id: nextId(),
        connectorId: 'chesscom',
        connectorName: 'Chess.com',
        tab: 'accounts',
        title: `Chess.com: ${player.username}`,
        detail: [player.name, player.title, player.location].filter(Boolean).join(' — '),
        link: player.url,
        confidence: 'confirmed',
        query,
        timestamp: Date.now(),
        data: {
          country: player.country?.split('/').pop() ?? undefined,
          followers: player.followers,
          joined: player.joined ? new Date(player.joined * 1000).toISOString() : undefined,
          streamer: player.is_streamer,
          twitch: player.twitch_url ?? undefined,
        },
      },
    ];
  },
};

interface LichessPlayer {
  id: string;
  username: string;
  profile?: { country?: string; location?: string; bio?: string; firstName?: string; lastName?: string };
  createdAt?: number;
  seenAt?: number;
  playTime?: { total: number };
  title?: string;
}

export const lichessConnector: Connector = {
  id: 'lichess',
  name: 'Lichess',
  description: 'Public Lichess player profile.',
  supports: ['username'],
  async run(query: SearchQuery, ctx): Promise<Finding[]> {
    const player = await fetchJson<LichessPlayer>(
      `https://lichess.org/api/user/${encodeURIComponent(query.value)}`,
      { signal: ctx.signal },
    );
    if (!player || !player.username) return [];

    const name = [player.profile?.firstName, player.profile?.lastName].filter(Boolean).join(' ');
    return [
      {
        id: nextId(),
        connectorId: 'lichess',
        connectorName: 'Lichess',
        tab: 'accounts',
        title: `Lichess: ${player.username}`,
        detail: [name, player.title, player.profile?.bio].filter(Boolean).join(' — '),
        link: `https://lichess.org/@/${encodeURIComponent(player.username)}`,
        confidence: 'confirmed',
        query,
        timestamp: Date.now(),
        data: {
          country: player.profile?.country ?? undefined,
          location: player.profile?.location ?? undefined,
          createdAt: player.createdAt ? new Date(player.createdAt).toISOString() : undefined,
          lastSeen: player.seenAt ? new Date(player.seenAt).toISOString() : undefined,
        },
      },
    ];
  },
};

interface CodeforcesResponse {
  status: string;
  result?: Array<{
    handle: string;
    firstName?: string;
    lastName?: string;
    country?: string;
    city?: string;
    organization?: string;
    rank?: string;
    rating?: number;
    maxRank?: string;
    maxRating?: number;
    registrationTimeSeconds?: number;
  }>;
}

export const codeforcesConnector: Connector = {
  id: 'codeforces',
  name: 'Codeforces',
  description: 'Public Codeforces competitive-programming profile.',
  supports: ['username'],
  async run(query: SearchQuery, ctx): Promise<Finding[]> {
    const res = await fetchJson<CodeforcesResponse>(
      `https://codeforces.com/api/user.info?handles=${encodeURIComponent(query.value)}`,
      { signal: ctx.signal },
    );
    const user = res?.status === 'OK' ? res.result?.[0] : undefined;
    if (!user) return [];

    const name = [user.firstName, user.lastName].filter(Boolean).join(' ');
    return [
      {
        id: nextId(),
        connectorId: 'codeforces',
        connectorName: 'Codeforces',
        tab: 'accounts',
        title: `Codeforces: ${user.handle}`,
        detail: [name, user.organization, user.rank].filter(Boolean).join(' — '),
        link: `https://codeforces.com/profile/${encodeURIComponent(user.handle)}`,
        confidence: 'confirmed',
        query,
        timestamp: Date.now(),
        data: {
          country: user.country ?? undefined,
          city: user.city ?? undefined,
          organization: user.organization ?? undefined,
          rating: user.rating,
          maxRating: user.maxRating,
          registered: user.registrationTimeSeconds
            ? new Date(user.registrationTimeSeconds * 1000).toISOString()
            : undefined,
        },
      },
    ];
  },
};
