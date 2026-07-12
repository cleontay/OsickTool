import type { Connector, Finding, SearchQuery } from '../types';
import { fetchJson, nextId, redactUrl } from '../lib/fetchUtils';
import { md5 } from '../lib/md5';
import { looksLikeEmail } from '../lib/classify';

interface GravatarProfile {
  entry?: Array<{
    hash: string;
    displayName?: string;
    aboutMe?: string;
    currentLocation?: string;
    profileUrl: string;
    urls?: Array<{ title: string; value: string }>;
    accounts?: Array<{ domain: string; username: string; url: string; shortname: string }>;
  }>;
}

/**
 * Gravatar exposes an avatar for any hashed email, and returns a real
 * 404 (via ?d=404) when no avatar is registered. Loading it through an
 * <img> tag sidesteps CORS entirely (image loads aren't subject to CORS
 * for load/error signalling, only for pixel reads), so this existence
 * check works even if Gravatar's JSON API ever blocks fetch().
 */
function gravatarAvatarExists(hash: string, signal: AbortSignal): Promise<boolean> {
  return new Promise((resolve) => {
    const img = new Image();
    let settled = false;
    const finish = (result: boolean) => {
      if (settled) return;
      settled = true;
      resolve(result);
    };
    img.onload = () => finish(true);
    img.onerror = () => finish(false);
    signal.addEventListener('abort', () => finish(false), { once: true });
    img.src = `https://www.gravatar.com/avatar/${hash}?d=404`;
  });
}

export const gravatarConnector: Connector = {
  id: 'gravatar',
  name: 'Gravatar',
  description: 'Checks for a registered Gravatar avatar/profile for this email address.',
  supports: ['email'],
  async run(query: SearchQuery, ctx): Promise<Finding[]> {
    if (!looksLikeEmail(query.value)) return [];
    const hash = md5(query.value.trim().toLowerCase());
    const profileUrl = `https://www.gravatar.com/${hash}.json`;
    const [hasAvatar, profile] = await Promise.all([
      gravatarAvatarExists(hash, ctx.signal),
      fetchJson<GravatarProfile>(profileUrl, { signal: ctx.signal }),
    ]);

    if (!hasAvatar && !profile?.entry?.length) return [];

    const entry = profile?.entry?.[0];
    const findings: Finding[] = [
      {
        id: nextId(),
        connectorId: 'gravatar',
        connectorName: 'Gravatar',
        tab: 'email',
        title: entry?.displayName ? `Gravatar: ${entry.displayName}` : 'Gravatar avatar registered',
        detail: entry?.aboutMe,
        link: entry?.profileUrl ?? `https://www.gravatar.com/${hash}`,
        confidence: entry ? 'confirmed' : 'likely',
        query,
        timestamp: Date.now(),
        raw: profile ?? { hasAvatar },
        rawSourceUrl: redactUrl(profileUrl),
        data: {
          hasAvatar,
          location: entry?.currentLocation ?? undefined,
          avatarUrl: `https://www.gravatar.com/avatar/${hash}?d=404`,
          links: entry?.urls?.map((u) => u.value).join(', ') || undefined,
        },
      },
    ];

    for (const acc of entry?.accounts ?? []) {
      findings.push({
        id: nextId(),
        connectorId: 'gravatar',
        connectorName: 'Gravatar (linked account)',
        tab: 'accounts',
        title: `${acc.shortname}: ${acc.username}`,
        detail: `Linked via Gravatar profile for this email`,
        link: acc.url,
        confidence: 'confirmed',
        query,
        timestamp: Date.now(),
        raw: profile,
        rawSourceUrl: redactUrl(profileUrl),
        data: { domain: acc.domain, username: acc.username },
      });
    }

    return findings;
  },
};
