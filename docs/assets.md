# Assets from the internet (ReelForge 2.1, PLAN.md#12.9)

The runtime Claude can search and download openly licensed images and footage into a project —
only through the `reelforge` CLI, only as the project's research mode allows, with licence
metadata for every file. Design: [ADR-012](decisions/ADR-012-assets.md). Commands: [cli.md](cli.md).

## Research modes (`project.json` → `researchMode`)

| Mode | Meaning | Default for |
|---|---|---|
| `ask` | Claude searches and proposes packages; the user approves each item in the app; only approved items are fetched | new projects (template) |
| `allowlist` | automatic, only the sources in `researchSources`, verified open licences only | — |
| `full-auto` ⚠ | automatic; also direct https URLs from any host except the ban list; unknown licences are `unverified` and flagged | — |
| `off` | zero network; kit + the user's own assets only | projects without the field (made before 2.1) |

`researchSources` (allowlist mode): any of `wikimedia`, `openverse`, `internet-archive`, `nasa`,
`loc`.

## Guard matrix (`packages/cli/src/assets/guard.ts`)

| Mode | `assets search` | `assets propose` | `fetch-asset --source --id` | `fetch-asset --url` |
|---|---|---|---|---|
| `off` | refused, 0 requests | refused, 0 requests | refused, 0 requests | refused, 0 requests |
| `ask` | all 5 allowlisted sources | yes (fresh lookup + thumbnails) | approved proposal items only (any licence; the user saw it) | refused |
| `allowlist` | `researchSources` only | refused | `researchSources`, verified licence only | refused |
| `full-auto` | all 5 allowlisted sources | refused | any allowlisted source | any https host except the ban list; licence `unverified` |

In every mode: https only, the ban list, SSRF checks, size/time caps, magic-byte type check. `list`
and `credits` never use the network. Pexels/Pixabay are refused (need an app-provided key; no
adapter yet).

## Sources

| Id | Catalogue | Search / lookup | Licence | Hosts |
|---|---|---|---|---|
| `wikimedia` | Wikimedia Commons | MediaWiki API `generator=search` (File namespace) / `pageids` | `extmetadata` LicenseShortName + LicenseUrl | `*.wikimedia.org` |
| `openverse` | Openverse (aggregator) | `/v1/images/?license_type=commercial,modification` / `/v1/images/<uuid>/` | Openverse `license` + `license_version` | `*.openverse.org` + the provider host Openverse names for the item |
| `internet-archive` | Internet Archive | `advancedsearch.php` restricted to CC0 / Public Domain Mark / `metadata/<id>` | `licenseurl` | `*.archive.org` |
| `nasa` | NASA Image and Video Library | `/search` / `/search?nasa_id=` + `/asset/<id>` | NASA media usage guidelines | `*.nasa.gov` |
| `loc` | Library of Congress | `/photos/?fo=json` / `/item/<id>/?fo=json` | rights advisory "No known restrictions" = verified | `*.loc.gov` |

Base URLs are injectable (`createSourceRegistry({ endpoints })`); tests use a local server and
recorded fixtures in `packages/cli/test/fixtures/assets/` (LoC fixtures follow the documented API:
loc.gov answers some clients with a bot challenge, reported as a per-source warning).

Licence `verified` = from the source's structured metadata and one of: public domain / PDM, CC0,
CC BY, CC BY-SA, Free Art License, NASA guidelines, LoC "no known restrictions". NC and ND licences
never verify (scenes always pixelise and recolour an asset, and videos may be monetised).

## Safety limits

- **Transport** (`http.ts`): https only, default port, no credentials in URLs; manual redirects
  (max 5), each hop re-checked against the ban list and the caller's host policy; DNS answers
  checked in the socket `lookup` against loopback, private, link-local, cloud-metadata, CGNAT,
  multicast and reserved ranges (literal IPs before connecting); `Accept-Encoding: identity`;
  idle timeout 20 s; deadlines 45 s (API, thumbnails), 2 min (images), 10 min (videos).
- **Sizes**: images 25 MB, videos 120 MB, thumbnails 2 MB, API JSON 4 MB — enforced on
  `Content-Length` and while streaming; the partial file is deleted.
- **Types** (`magic.ts`): png, jpeg, webp, gif, mp4 (ISO BMFF, MP4 brands), webm (EBML DocType)
  by content; SVG, HTML, scripts, executables, archives, QuickTime, HEIC, Matroska rejected.
- **Ban list** (`hosts.ts`, every mode): YouTube (incl. youtu.be, googlevideo, ytimg), Vimeo,
  Dailymotion, Twitch, TikTok, Netflix and other streaming services, Facebook/Instagram/X/Reddit,
  Patreon/OnlyFans, Getty/iStock/Shutterstock/Adobe Stock/Alamy and other paid stock, sign-in
  hosts (`login.*`, `accounts.*`, `auth.*`, `sso.*`…) and sign-in/paywall paths, `.m3u8`/`.mpd`.
- **Files**: written only inside `<project>/.reelforge/assets/` (links out of the project
  rejected), named `<asset id>.<ext>` (never the server's name), never executed; no process is
  ever spawned by the asset layer.
- **Untrusted text** (`untrusted.ts`): markup, entities, control/bidi/zero-width characters,
  structure characters and the block markers are removed, lengths capped (title 200, author 120);
  CLI output prints it only between `--- BEGIN UNTRUSTED EXTERNAL DATA … ---` and
  `--- END UNTRUSTED EXTERNAL DATA ---`.

## Files

| Path | Tracked | Content |
|---|---|---|
| `assets.json` | yes | catalogue (`assetsFileSchema`, version 1) |
| `.reelforge/assets/<id>.<ext>` | no | the bytes |
| `.reelforge/assets/proposals/<n>.json` | no | proposal packages (`assetProposalSchema`); `approved` is set by the app only |
| `.reelforge/assets/thumbnails/p<n>-<i>.<ext>` | no | proposal thumbnails |

Asset record (`assets.json` → `assets[]`): `id` (file name: `wm-105654713`, `nasa-…`, `ia-…`,
`ov-…`, `loc-…`, `web-…` or `--as`), `kind` (`image`/`video`), `source` (source id or `web`),
`sourceItemId`, `sourceUrl` (human page), `downloadUrl` (final URL after redirects), `title`,
`author` (sanitised), `licence { id, url, verified }`, `file`, `sha256`, `bytes`, `mime`,
`width`/`height` (images), `mode` (research mode at fetch time), `approved` (user approval in
`ask`), `fetchedAt` (ISO).

## Credits

`reelforge assets credits` prints one line per asset a scene module or `storyboard.json` names
(`--all`: every asset): `- "Title" by Author, Licence (licence URL), source URL`. Unverified
licences get `[check licence]` and a closing `WARNING:` line. The publish kit (12.17) reuses
`creditsMarkdown`.
