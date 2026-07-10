# OsickTool

A client-side OSINT (open-source intelligence) reconnaissance toolkit. Everything runs
in your browser — search, results, and reports are never sent to or stored on a
server. It's a static site that can be hosted for free on GitHub Pages and installed
as a PWA.

## What it does

1. Pick a search type — **username, email, phone number, IC/national ID, social
   media handle,** or **general** (domain/IP/keyword) — and enter a value.
2. OsickTool fans the query out to every free/public source that supports that type
   and consolidates results into tabs: **Identity, Accounts, Email, Phone,
   Web & Infrastructure, General**.
3. New identifiers found in the results (emails, usernames, domains, IPs) are
   surfaced in the **Pivots** tab so you can click to search them too and keep
   enriching the picture.
4. Export everything collected so far as a **PDF report** or a **CSV**, at any time.

Nothing persists between sessions unless you export it yourself. Reloading the page
wipes all findings.

## Sources

| Source | Query types | Notes |
|---|---|---|
| GitHub REST API | username, social | Public profile via `api.github.com` |
| GitLab REST API | username, social | Public profile via `gitlab.com/api/v4` |
| npm Registry | username, social | Packages maintained by a user |
| Docker Hub | username | Best-effort (provider CORS policy may block it) |
| Reddit | username, social | Best-effort |
| Hacker News (Firebase) | username, social | Public HN account |
| Keybase | username, social | Also surfaces cryptographically-proven linked accounts |
| Chess.com / Lichess / Codeforces | username | Public player profiles |
| Gravatar | email | Avatar existence check (via `<img>` load, CORS-proof) + profile JSON |
| Google DNS-over-HTTPS | email, general | MX/A/TXT/NS records for a domain |
| DuckDuckGo Instant Answer | general, social, username | General-purpose lookups |
| Wikipedia | general, social, username | Full-text article search |
| Shodan InternetDB | general (IPv4) | Free, keyless open-port/CVE lookup |
| Email format analysis | email | Local: disposable/free-provider detection, plus-tag parsing |
| Phone number analysis | phone | Local: `libphonenumber-js` parsing/validation |
| IC/NRIC decoder | ic | Local: Malaysia MyKad + Singapore NRIC/FIN decoding & checksum |
| Site Directory | username, social | Generates candidate profile links across 45+ popular platforms that don't expose a public API (Instagram, X, TikTok, LinkedIn, etc.) — unverified by default |
| NumVerify, Hunter.io, Shodan (full) | phone, email, general | Optional — bring your own free-tier API key in Settings |

Connectors are defensive by design: if a source blocks the request (CORS, rate
limiting, downtime), that connector silently contributes zero results instead of
breaking the search. "Unverified" findings are candidate leads generated from known
URL patterns, not confirmed matches — always open the link and check manually.

### Optional API keys

Settings lets you paste your own free-tier API key for NumVerify (phone carrier
lookup), Hunter.io (email verification), or Shodan (host intelligence). Keys are
stored only in `localStorage` in your browser, are sent only directly to that
provider, and are never included in exported reports. Have I Been Pwned is
intentionally not offered — its API blocks unauthenticated browser requests by
design, so it can't work from a static client-only app.

### Optional CORS proxy

The Site Directory connector can optionally verify links through the public proxy
`api.allorigins.win` instead of just generating unverified links. This is **off by
default** because it means the value you're searching is visible to that proxy
operator — enable it in Settings only if you're comfortable with that trade-off.

## Development

```bash
npm install
npm run dev      # local dev server
npm run build    # production build to dist/
npm run preview  # preview the production build
```

The app is built with Vite + TypeScript, no UI framework — just DOM APIs and a small
pub-sub store (`src/state.ts`). Connectors live in `src/connectors/`; each exports a
`Connector` object (`src/types.ts`) with a `supports` list of query types and a
`run()` function.

## Deployment (GitHub Pages)

`.github/workflows/deploy.yml` builds and publishes `dist/` to GitHub Pages on every
push to `main`. In the repo's **Settings → Pages**, set the source to **GitHub
Actions**. The Vite `base` path defaults to `/OsickTool/` (`vite.config.ts`) to match
a project page URL like `https://<user>.github.io/OsickTool/`; override it with the
`VITE_BASE_PATH` env var if you fork this under a different repo name.

## PWA

The app ships a web manifest and service worker (via `vite-plugin-pwa`) that
precache only the app shell (HTML/CSS/JS/icons) for offline loading. No OSINT
query or result is ever added to a cache — that would contradict the "nothing is
stored" design. Once deployed, most browsers will offer an "Install app" option.

## Use responsibly

OsickTool only surfaces information its underlying sources already publish
openly. It's intended for legitimate research, due diligence, and authorized
security work. Respect each source's terms of service and the privacy laws that
apply in your jurisdiction (e.g. GDPR). Treat "unverified" results as leads to
confirm, not facts.

## Extending

- Add a connector: create `src/connectors/yourSource.ts` exporting a `Connector`,
  register it in `src/connectors/index.ts`.
- Add a platform to the unverified link generator: append an entry to
  `src/data/usernameSites.ts`.
- Pivot extraction (`src/lib/pivot.ts`) scans finding text/data for new
  emails/domains/handles/IPs automatically — no per-connector wiring needed.
