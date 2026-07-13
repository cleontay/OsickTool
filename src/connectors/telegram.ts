import type { Connector, Finding, SearchQuery } from '../types';
import { fetchJson, nextId } from '../lib/fetchUtils';

interface AllOriginsResponse {
  contents: string;
  status: { http_code: number };
}

// Telegram's default placeholder description for an account with no bio set
// ("You can contact @handle right away." / "Send me a message"-style text) -
// this is boilerplate about the *feature*, not something the account owner
// wrote about themselves, so it must never be surfaced as if it were a bio.
const PLACEHOLDER_BIO_RE = /^(you can contact|send.{0,20}message|if you have telegram)/i;

// Telegram's generic app-landing title shown for a username that isn't a
// real account/channel/bot - t.me still returns HTTP 200 for these, so the
// only way to tell "not found" apart from "found" is the page's own content.
const GENERIC_TITLES = new Set(['telegram', 'telegram messenger', 'telegram: contact @']);

function extractMetaContent(html: string, property: string): string | null {
  // Meta tags can have `property` before or after `content` - match either
  // attribute order rather than assuming one.
  const patterns = [
    new RegExp(`<meta[^>]+property=["']${property}["'][^>]+content=["']([^"']*)["']`, 'i'),
    new RegExp(`<meta[^>]+content=["']([^"']*)["'][^>]+property=["']${property}["']`, 'i'),
  ];
  for (const re of patterns) {
    const m = html.match(re);
    if (m) return m[1];
  }
  return null;
}

function decodeHtmlEntities(s: string): string {
  return s
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#0?39;/g, "'");
}

/**
 * Telegram serves a public, unauthenticated preview page at t.me/<handle>
 * for any user, channel, group, or bot that has a public username set -
 * complete with Open Graph name/bio/photo tags, the same metadata a link
 * preview would show. There's no equivalent lookup by phone number:
 * Telegram never exposes a phone number on this page (or anywhere public)
 * regardless of privacy settings, so this connector only supports
 * username/handle search - see WhatsApp's connector for why phone-based
 * messaging-app lookup is a link-only affair instead.
 *
 * t.me doesn't send CORS headers, so this only runs when the user has
 * opted in to the CORS-proxy setting (same api.allorigins.win proxy used
 * by the Site Directory connector) - with the proxy off, Telegram still
 * appears as a plain "possible profile" link via that connector instead.
 */
export const telegramConnector: Connector = {
  id: 'telegram',
  name: 'Telegram',
  description: 'Parses the public t.me profile preview (name, bio, photo) for a Telegram username. Requires the optional CORS proxy in Settings.',
  supports: ['username', 'social'],
  requiresProxy: true,
  async run(query: SearchQuery, ctx): Promise<Finding[]> {
    if (!ctx.proxyEnabled) return [];

    const handle = query.value.replace(/^@/, '').trim();
    if (!/^[a-zA-Z0-9_]{4,32}$/.test(handle)) return [];

    const targetUrl = `https://t.me/${encodeURIComponent(handle)}`;
    const proxyUrl = `https://api.allorigins.win/get?url=${encodeURIComponent(targetUrl)}`;
    const res = await fetchJson<AllOriginsResponse>(proxyUrl, { signal: ctx.signal, timeoutMs: 8000 });
    if (!res?.contents) return [];

    const html = res.contents;
    const rawTitle = extractMetaContent(html, 'og:title');
    if (!rawTitle || GENERIC_TITLES.has(rawTitle.trim().toLowerCase())) return [];

    const title = decodeHtmlEntities(rawTitle).trim();
    const rawDescription = extractMetaContent(html, 'og:description');
    const description = rawDescription ? decodeHtmlEntities(rawDescription).trim() : null;
    const bio = description && !PLACEHOLDER_BIO_RE.test(description) ? description : undefined;
    const avatar = extractMetaContent(html, 'og:image') ?? undefined;

    return [
      {
        id: nextId(),
        connectorId: 'telegram',
        connectorName: 'Telegram',
        tab: 'accounts',
        title: `Telegram: ${title}`,
        detail: bio ?? 'No bio set on this account.',
        link: targetUrl,
        confidence: 'confirmed',
        query,
        timestamp: Date.now(),
        raw: { ogTitle: rawTitle, ogDescription: rawDescription, ogImage: avatar },
        rawSourceUrl: proxyUrl,
        data: {
          name: title,
          username: handle,
          bio,
          avatar,
        },
      },
    ];
  },
};
