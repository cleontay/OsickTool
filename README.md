# OsickTool

A client-side OSINT (open-source intelligence) reconnaissance toolkit. Everything runs
in your browser — search, results, and reports are never sent to or stored on a
server. It's a static site that can be hosted for free on GitHub Pages and installed
as a PWA.

## What it does

1. There's just **one search box** - type a username, email, phone number,
   IC/national ID, domain/IP, a person's name, or a raw Google Dork query, and
   OsickTool detects which one it is as you type (see [Auto-detected search](#auto-detected-search)).
   A small badge shows the detected category and doubles as a manual override
   if it guesses wrong; a country selector appears automatically once it
   detects a phone number.
2. OsickTool fans the query out to every free/public source that supports that
   detected type and consolidates results into tabs: **Identity, Accounts,
   Email, Phone, Web & Infrastructure, General**.
3. **Auto-enrich** (on by default, toggle next to the search bar) means you don't
   have to drive this by hand: every new email, username, phone number, or name a
   result turns up is automatically searched too, and whatever *that* turns up
   keeps going - so one email search can chain into usernames, phone numbers,
   and further emails without you clicking anything. See [Auto-enrichment](#auto-enrichment)
   below for how the chain is kept from running away with itself, and the
   **Enrichment Chain** tab (see [Enrichment Chain](#enrichment-chain)) for a
   tree view of exactly how each search led to the next.
4. Sources that can reveal a real name/email behind a handle - GitHub commit
   authorship, domain WHOIS/RDAP registrant records, cross-referenced profile
   fields - feed a **Consolidated Profile** card pinned atop the Identity tab,
   built by aggregating name/email/phone/username/location/organization/date-of-birth
   fields across every source collected so far (age is estimated from a decoded
   birth date when one's available).
5. Anything auto-enrich didn't get to - because it's off, or the chain hit its
   depth/budget limit - is still listed in the **Pivots** tab to search manually.
6. Every finding that came from a network call has a **View raw API response**
   toggle - the exact JSON that source returned, not just the fields OsickTool
   chose to surface, so you can judge the underlying data yourself. See [Raw
   responses](#raw-responses) below.
7. Export everything collected so far - including the consolidated profile - as
   a **PDF report**, a **CSV**, or the full **raw JSON** of every API response,
   at any time.

Nothing persists between sessions unless you export it yourself. Reloading the page
wipes all findings. The layout is responsive (desktop and mobile) and installable
as a PWA.

## Auto-detected search

One box, no manual category picker. `src/lib/classify.ts` runs a priority-ordered
set of shape checks against whatever you type - Google dork syntax, then email,
then a national-ID pattern (with a calendar-date plausibility check, so a valid
MyKad number doesn't get misread as a phone number), then a phone-number shape
(digits/spaces/`+`/`-`/`()` only - **text containing letters is never treated as
a phone number**, so metered APIs like NumVerify never get an obviously-wrong
request), then a domain/IPv4 shape, then a bare handle, falling through to a
general keyword/name search if nothing more specific matched. The detected
category shows as a small badge next to the input, live-updated as you type;
change it manually if it guessed wrong and your choice sticks until you clear
the box or search again.

This same shape-checking is duplicated as a direct guard inside the connectors
that cost real, metered quota (NumVerify, Hunter.io, Google Custom Search) -
even if a pivot or a manual override ever hands one of them a wrong-shaped
value, the connector itself refuses to spend a request on it.

When the detected category is a person's name (two to four capitalized words),
OsickTool doesn't search it word-by-word or truncate it - it searches the full
name as typed, *and* generates the common handle patterns real people actually
use (`johndoe`, `john.doe`, `j.doe`, `jdoe`, `doejohn`, ...) via
`src/lib/namePermutations.ts`, feeding them into the same auto-enrichment queue
as any other discovered lead.

## Auto-enrichment

Turning an email into a name, a phone number, other emails, and further usernames
is the actual point of the tool - so by default it doesn't wait for you to click
through the Pivots tab one lead at a time. When a search result contains a new
email, username/handle, phone number, or name, it's queued and searched
automatically, and anything *that* search turns up is queued in turn. A query
history chip marked with ⚡ means it was auto-triggered, not typed by you.

This is bounded on two axes, both adjustable in Settings:

- **Max chain depth** (default 4) - your own search is depth 0; a lead it finds
  is depth 1; a lead *that* finds is depth 2, and so on. A lead beyond the max
  depth stays in the Pivots tab for a manual click instead of auto-firing.
- **Max auto-searches per session** (default 40) - a hard ceiling on total
  automatic searches regardless of depth, so a long chain can't quietly exhaust
  a free-tier API quota (NumVerify, Hunter.io, Shodan) or just run for a very
  long time. When it's hit, a banner appears with a **Resume** button that
  continues the chain right where it left off - useful after raising the limit.

Auto-triggered searches run **one at a time** (not in a burst) to stay a
reasonable citizen of the free APIs it's calling, while a manual search you
type yourself always runs immediately rather than waiting behind the queue.
Hit **Stop** at any time to abort everything in flight and clear the queue -
findings already collected are kept, nothing is lost.

Turn it off entirely with the checkbox next to the search bar (or in Settings)
to go back to click-to-pivot behavior.

### Guessed handles vs. confirmed leads

A person's name has no dedicated "search by name" API, so OsickTool also
generates a handful of common handle patterns from it (`firstlast`,
`first.last`, all words run together, etc.) and checks whether each one
exists - the same approach every username-guessing OSINT tool uses. That's
a *guess*: a generated handle existing as a real account only confirms the
handle is taken, not that the account belongs to your target - common names
in particular can and do collide with a completely unrelated person.

To keep that uncertainty from quietly becoming "fact," anything discovered
through a guessed handle (and anything discovered *from* that account's own
data, cascading down the chain) is marked **speculative**:

- It still shows up normally in its own tab, still gets exported, and still
  drives further auto-enrichment exactly like any other lead.
- It's flagged with an amber **⚠ Guessed handle match** banner on its finding
  card and a **guess** badge wherever it appears in the Pivots and
  Enrichment Chain tabs, so it's visually obvious at a glance.
- It is **excluded from the Consolidated Profile** - a stranger's name,
  company, or location never gets folded in as if it were a confirmed fact
  about your target just because a guessed handle happened to resolve to a
  real person.

## Enrichment Chain

Auto-enrichment makes a lot of searches happen without you clicking anything -
the **Enrichment Chain** tab is how you see *how you got there*. Instead of a
flat list of every query run, it's the actual discovery tree: your original
search at the root, and every lead it (directly or indirectly) turned into a
new search nested underneath, however deep the chain went.

Each node shows:

- The search itself (type + value), with ⚡ for one auto-enrichment fired on
  its own vs. 🔍 for one you typed or clicked yourself.
- How many findings that specific search produced.
- **via `<connector>`** underneath - which source is the reason this search
  happened at all (e.g. "via Gravatar (linked account)" means Gravatar's
  profile for the parent email listed this handle).
- A "led to N more searches" badge when a node has descendants, so you can
  spot which single result was the most productive lead without walking the
  whole tree.

A pivot you click manually from the Pivots tab keeps its place in the same
tree (attached under whatever search first surfaced it), even if you click it
long after that original search finished - so the chain stays accurate
whether enrichment was automatic, manual, or a mix of both.

## Google Dorking

Every search - whatever type it is - also populates a **Google Dorks** tab with a
handful of curated dork queries tailored to what you searched (exact-phrase
matches, `site:`/`filetype:` scoping, common leak-hosting sites, exposed
directory listings for a domain, and so on). Pick **Google Dork** as the search
type to type a fully custom dork instead (e.g.
`site:example.com filetype:sql "password"`).

A phone number search gets one extra dork on top of the usual set once a
country is selected: the same contact/profile/resume query narrowed by the
number's resolved country name (e.g. `"+65..." "Singapore" (contact OR
profile OR resume OR "about us")`). A bare phone number is ambiguous across
whatever local format a site happens to display it in, so tying the search
to its country cuts down on unrelated results from elsewhere in the world.

This works in two tiers, because **Google Search has no free, CORS-enabled API**
- there's no honest way for a static client-only app to fetch and parse Google
results without a backend, so this doesn't pretend to:

- **Link-only (always on, no setup)** - each dork becomes a one-click "open in
  Google" link. Nothing is fetched on your behalf; it's exactly as if you'd
  typed the query into Google yourself.
- **Live ranked results (optional)** - with a free Google Custom Search API key
  and Search Engine ID in Settings, the single most useful dork per search also
  runs for real through [Google's official Custom Search JSON
  API](https://developers.google.com/custom-search/v1/introduction) and comes
  back as real title/snippet/link results (free tier: 100 queries/day). To set
  it up:
  1. Create a [Programmable Search Engine](https://programmablesearchengine.google.com/controlpanel/create),
     turn on **"Search the entire web"**, and copy its **Search engine ID**.
  2. Get an API key from the [Custom Search API
     page](https://developers.google.com/custom-search/v1/introduction) (via
     Google Cloud Console).
  3. Paste both into Settings.

  Only the top dork runs automatically (to stay well within the free daily
  quota) - the rest of the generated dorks stay available as links. Real
  snippets feed the same pivot/auto-enrichment engine as everything else, so a
  name or email in a live result can trigger further searches.

## Raw responses

Every finding card that came from a network call has a **View raw API
response** toggle at the bottom - the exact JSON the source returned, exactly
as it came back, not just the handful of fields OsickTool chose to summarize
into the card above it. Alongside it is the endpoint that was queried (with
any API key redacted) and a **Copy JSON** button.

This is deliberately per-finding rather than a single combined log: several
findings can come from one API call (e.g. Keybase's proven-account findings
all share one profile lookup), and each shows that same response so you can
always see exactly what backs a given card. Findings from local-only
connectors (IC decoder, phone parser, email format analysis) don't have one,
since no network call produced them - there's nothing to show.

For pulling everything at once, **Export Raw JSON** (next to Export CSV/PDF)
downloads every raw response collected so far as a single JSON file, each
entry tagged with which connector and query produced it - useful for feeding
into your own tooling or just reviewing offline.

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
| **GitHub Commit Identity** | username, social | Harvests real name/email pairs from public commit authorship - reveals the person behind a handle even when their profile email is hidden |
| **Domain Registration (RDAP)** | general (domain) | WHOIS/RDAP registrant name/email/org when not privacy-redacted |
| **IP Geolocation** | general (IPv4) | City/region/ISP/coordinates via ipapi.co |
| Google DNS-over-HTTPS | email, general | MX/A/TXT/NS records for a domain |
| DuckDuckGo Instant Answer | general, social, username | General-purpose lookups |
| Wikipedia | general, social, username | Full-text article search |
| Shodan InternetDB | general (IPv4) | Free, keyless open-port/CVE lookup |
| Email format analysis | email | Local: disposable/free-provider detection, plus-tag parsing |
| Phone number analysis | phone | Local: `libphonenumber-js` parsing/validation against the country you select |
| IC/NRIC decoder | ic | Local: Malaysia MyKad + Singapore NRIC/FIN decoding & checksum |
| Site Directory | username, social | Generates candidate profile links across 45+ popular platforms that don't expose a public API (Instagram, X, TikTok, LinkedIn, etc.) — unverified by default |
| **Google Dork (links)** | all types | Curated Google dork queries as one-click links - no request is ever made on your behalf |
| **Google Custom Search** | all types | Optional — real ranked Google results for the top dork query; needs a free API key + Search Engine ID in Settings |
| NumVerify, Hunter.io, Shodan (full) | phone, email, general | Optional — bring your own free-tier API key in Settings |
| **Consolidated Profile** | (all) | Not a source - synthesizes name/email/phone/username/location/organization/birth-date fields already returned by the sources above into one cross-referenced identity card, with age estimated from a decoded birth date |

Connectors are defensive by design: if a source blocks the request (CORS, rate
limiting, downtime), that connector silently contributes zero results instead of
breaking the search. "Unverified" findings are candidate leads generated from known
URL patterns, not confirmed matches — always open the link and check manually.

### Optional API keys

Settings lets you paste your own free-tier API key for NumVerify (phone carrier
lookup), Hunter.io (email verification), Shodan (host intelligence), or Google
Custom Search (real dork results - see [Google Dorking](#google-dorking) above).
Keys are stored only in `localStorage` in your browser, are sent only directly to
that provider, and are never included in exported reports. Have I Been Pwned is
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
confirm, not facts. The Google Dork queries are standard, widely-documented OSINT
recon patterns (the same techniques search engines themselves index and anyone
can type manually) - they only ever surface what's already publicly indexed,
never anything requiring unauthorized access.

## Extending

- Add a connector: create `src/connectors/yourSource.ts` exporting a `Connector`,
  register it in `src/connectors/index.ts`.
- Add a platform to the unverified link generator: append an entry to
  `src/data/usernameSites.ts`.
- Pivot extraction (`src/lib/pivot.ts`) scans finding text/data for new
  emails/domains/handles/IPs/phone numbers/names automatically — no
  per-connector wiring needed. It also reads a few known structured fields
  (`username`, `nametag`, `twitter`, `name`, `fullName`) directly, since not
  every discovered identifier shows up as free text.
