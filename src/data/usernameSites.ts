export interface SiteTemplate {
  name: string;
  category: 'social' | 'dev' | 'creative' | 'gaming' | 'forum' | 'other';
  urlTemplate: string; // {u} is replaced with the username
  // Marker string that appears on that site's own "not found" page - used
  // only when the optional CORS-proxy verification is enabled, to reject
  // false positives on sites that return HTTP 200 for missing profiles.
  notFoundMarker?: string;
}

// A curated set of popular platforms without a public, CORS-friendly API.
// These entries are used to *generate candidate profile links* for the
// analyst to open and check manually (or, optionally, to verify via a
// user-enabled third-party CORS proxy - see connectors/unverifiedSites.ts).
// This mirrors how tools like Sherlock/WhatsMyName work, just without a
// server component.
export const USERNAME_SITES: SiteTemplate[] = [
  { name: 'Instagram', category: 'social', urlTemplate: 'https://www.instagram.com/{u}/' },
  { name: 'X (Twitter)', category: 'social', urlTemplate: 'https://x.com/{u}' },
  { name: 'Facebook', category: 'social', urlTemplate: 'https://www.facebook.com/{u}' },
  { name: 'TikTok', category: 'social', urlTemplate: 'https://www.tiktok.com/@{u}' },
  { name: 'LinkedIn', category: 'social', urlTemplate: 'https://www.linkedin.com/in/{u}' },
  { name: 'Threads', category: 'social', urlTemplate: 'https://www.threads.net/@{u}' },
  { name: 'Snapchat', category: 'social', urlTemplate: 'https://www.snapchat.com/add/{u}' },
  { name: 'Pinterest', category: 'social', urlTemplate: 'https://www.pinterest.com/{u}/' },
  { name: 'Tumblr', category: 'social', urlTemplate: 'https://{u}.tumblr.com' },
  { name: 'Mastodon (mastodon.social)', category: 'social', urlTemplate: 'https://mastodon.social/@{u}' },
  { name: 'Bluesky', category: 'social', urlTemplate: 'https://bsky.app/profile/{u}.bsky.social' },
  { name: 'VK', category: 'social', urlTemplate: 'https://vk.com/{u}' },
  { name: 'Telegram', category: 'social', urlTemplate: 'https://t.me/{u}' },
  { name: 'YouTube', category: 'social', urlTemplate: 'https://www.youtube.com/@{u}' },
  { name: 'Twitch', category: 'gaming', urlTemplate: 'https://www.twitch.tv/{u}' },
  { name: 'Medium', category: 'creative', urlTemplate: 'https://medium.com/@{u}' },
  { name: 'Dev.to', category: 'dev', urlTemplate: 'https://dev.to/{u}' },
  { name: 'Hashnode', category: 'dev', urlTemplate: 'https://hashnode.com/@{u}' },
  { name: 'Stack Overflow (search)', category: 'dev', urlTemplate: 'https://stackoverflow.com/users?tab=Reputation&filter=all&search={u}' },
  { name: 'Bitbucket', category: 'dev', urlTemplate: 'https://bitbucket.org/{u}/' },
  { name: 'SourceForge', category: 'dev', urlTemplate: 'https://sourceforge.net/u/{u}/' },
  { name: 'Replit', category: 'dev', urlTemplate: 'https://replit.com/@{u}' },
  { name: 'CodePen', category: 'dev', urlTemplate: 'https://codepen.io/{u}' },
  { name: 'HackerOne', category: 'dev', urlTemplate: 'https://hackerone.com/{u}' },
  { name: 'Behance', category: 'creative', urlTemplate: 'https://www.behance.net/{u}' },
  { name: 'Dribbble', category: 'creative', urlTemplate: 'https://dribbble.com/{u}' },
  { name: 'DeviantArt', category: 'creative', urlTemplate: 'https://www.deviantart.com/{u}' },
  { name: 'ArtStation', category: 'creative', urlTemplate: 'https://www.artstation.com/{u}' },
  { name: 'SoundCloud', category: 'creative', urlTemplate: 'https://soundcloud.com/{u}' },
  { name: 'Spotify', category: 'creative', urlTemplate: 'https://open.spotify.com/user/{u}' },
  { name: 'Flickr', category: 'creative', urlTemplate: 'https://www.flickr.com/people/{u}' },
  { name: 'Vimeo', category: 'creative', urlTemplate: 'https://vimeo.com/{u}' },
  { name: 'Letterboxd', category: 'creative', urlTemplate: 'https://letterboxd.com/{u}/' },
  { name: 'Goodreads', category: 'creative', urlTemplate: 'https://www.goodreads.com/{u}' },
  { name: 'Steam', category: 'gaming', urlTemplate: 'https://steamcommunity.com/id/{u}' },
  { name: 'Xbox Gamertag', category: 'gaming', urlTemplate: 'https://xboxgamertag.com/search/{u}' },
  { name: 'itch.io', category: 'gaming', urlTemplate: 'https://{u}.itch.io' },
  { name: 'Roblox (search)', category: 'gaming', urlTemplate: 'https://www.roblox.com/search/users?keyword={u}' },
  { name: 'Reddit', category: 'forum', urlTemplate: 'https://www.reddit.com/user/{u}' },
  { name: 'Quora', category: 'forum', urlTemplate: 'https://www.quora.com/profile/{u}' },
  { name: 'Discord (search)', category: 'forum', urlTemplate: 'https://discord.com/users/{u}' },
  { name: 'Patreon', category: 'other', urlTemplate: 'https://www.patreon.com/{u}' },
  { name: 'Ko-fi', category: 'other', urlTemplate: 'https://ko-fi.com/{u}' },
  { name: 'Venmo', category: 'other', urlTemplate: 'https://venmo.com/{u}' },
  { name: 'Cash App', category: 'other', urlTemplate: 'https://cash.app/${u}' },
  { name: 'PyPI', category: 'dev', urlTemplate: 'https://pypi.org/user/{u}/' },
  { name: 'Crates.io', category: 'dev', urlTemplate: 'https://crates.io/users/{u}' },
  { name: 'Product Hunt', category: 'dev', urlTemplate: 'https://www.producthunt.com/@{u}' },
  { name: 'AngelList / Wellfound', category: 'dev', urlTemplate: 'https://wellfound.com/u/{u}' },
  { name: 'About.me', category: 'other', urlTemplate: 'https://about.me/{u}' },
  { name: 'Linktree', category: 'other', urlTemplate: 'https://linktr.ee/{u}' },
];
