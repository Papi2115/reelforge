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

## In the app (PLAN.md#12.10)

**Project settings → Research → Research assets**: four radio choices — "Ask me for each package"
(`ask`), "Automatic from selected sources" (`allowlist`, with a checklist of the five sources;
picking it with none ticked starts with Wikimedia Commons + NASA), "Full auto ⚠ risky" (`full-auto`,
a red warning: licences may be unverified, the user is responsible for checking them) and "Off"
(`off`). Saved to `project.json` and committed; applies to the next Storyboard and Assets steps.

**Storyboard**: when the mode is not `off`, the storyboard prompt (v5) may add per-shot
`assetNeeds: [{ id, kind: image|video, description, query?, role? }]` (shared schema, optional;
at most 8 per film, ids unique — validator warnings/errors) for real people, places, documents,
products or historical objects, always keeping a kit fallback in `intent`. With `off` (and for
projects without `researchMode`) the prompt is byte for byte the old one and needs are ignored.

**Assets step** (`packages/stages/src/stages/assets.ts`, gating in `assets-gate.ts`): listed between
Storyboard and Scenes built only when research is on and the storyboard has needs (or the step
already ran). It is queued automatically after a Storyboard run that wrote needs; Scenes built
waits for it (`to-run`, `running`, `review`), never in mode `off`.

| Mode | Assets step |
|---|---|
| `ask` | one Claude turn (assets prompt, Sonnet, storyboard permissions: `reelforge` commands only) searches and writes one package with `reelforge assets propose`; the step ends in **Review & approve**. The **Assets** dialog (Open on the row) shows the package: thumbnails, sanitised title, source, author, licence chip, a checkbox each (verified licences start ticked), "Approve selected (N)" / "Reject all". The app records the review (`approveProposalItems` + `reviewedAt`, under `.reelforge/`, which Claude cannot edit) and queues `fetch-approved`: the approved items are downloaded in-process through the same guarded asset layer, without a Claude turn. Rejected items: the shots use kit visuals. |
| `allowlist` | the Claude turn fetches with `reelforge fetch-asset --source … --as <need id>`; the guard limits it to `researchSources` and verified licences. |
| `full-auto` | the Claude turn may also fetch direct https URLs (`--url`): those are stored `unverified`; the step's warnings list them with ⚠. |
| `off` | no step, no Claude turn, zero requests. |

Scene builds get the shot's needs and the downloaded catalogue (titles/authors inside the
`UNTRUSTED EXTERNAL DATA` markers) as data in the scene-build prompt (v7); using the files in scenes
is PLAN.md#12.11.

**⚠ marks**: the Assets dialog lists downloaded assets with a licence chip ("⚠ unverified" for
unverified licences). The **export dialog** lists unverified assets under a ⚠ warning (the export
is not blocked) and shows the "Credits" text (`creditsMarkdown`, the logic of
`reelforge assets credits`; every downloaded asset while no scene uses one yet) with a Copy button.

Thumbnails and asset images reach the renderer only through `reelforge-media://project/` for image
files under `.reelforge/assets/` (paths normalised, confined to the project).

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

Base URLs are injectable (`createSourceRegistry({ endpoints })`); tests use a local server
(`@reelforge/cli/assets-testing`; the unpackaged app reaches it only with `REELFORGE_TEST_HOOKS=1`
+ `REELFORGE_TEST_ASSET_SERVER=http://127.0.0.1:<port>`) and
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
| `.reelforge/assets/proposals/<n>.json` | no | proposal packages (`assetProposalSchema`); `approved` and `reviewedAt` are set by the app only |
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

## In scenes (PLAN.md#12.11)

Design: [ADR-014](decisions/ADR-014-asset-embedding.md). A picture always lives inside a look's
world, pixelised into the style palette; scenes never load or decode files (the lint rejects
`fetch`, `Image`, `createImageBitmap`, `ctx.three.TextureLoader`...).

```js
export function build(ctx) {
  const photo = ctx.assets.image('nasa-apollo-11', { crop: { focus: [0.4, 0.3], zoom: 1.5 } });
  const frame = ctx.kit.props.photoFrame({ asset: photo, pixels: 96 });
  ctx.kit.env.room().mount(frame, 'backWall', { align: 'back' });
  // ...
}
```

- **Refs**: an asset id (`assets.json`) or a video still `'<id>@<seconds>'` (no `@` = the middle
  frame), written as a string literal: the app ships only the refs a scene or project prop names.
  `ctx.assets.has(ref)` / `ctx.assets.refs` allow a kit fallback; an unknown ref fails the build
  with the refs the video carries.
- **Options** (`image(ref, options)`, build only): `crop` `'cover'` (default, fill the slot) |
  `'center'` (whole picture, letterboxed) | `{ focus: [x, y], zoom }`; `contrast` (default true,
  2-98 % luma stretch); `dither` 0..1 (default 0.5, Bayer like the post-fx); `tones` (palette
  names to map onto, e.g. a duotone). Every prop slot can override `crop`.
- **Where pictures go**: voxel `kit.props.photoFrame` (wall or `mount: 'stand'`), `polaroid`
  (`caption`, `developAt`), `billboard`, `assetScreen` (`device: 'monitor' | 'laptop'`,
  `revealAt`, `scanlines`, `flicker`, `power(on)`); retro-ui `retroBrowser({ asset })` (full colour
  in the page photo), `retroDocument({ asset })` (halftone newspaper photo / dossier mugshot),
  `retroCrt({ asset })` (on the tube); diorama `dioramaCity({ billboard })` and
  `dioramaOffice({ screen })`.
- **Pipeline**: the manifest builders decode each named file once with ffmpeg (forced demuxer from
  the verified MIME, local files only, bit-exact flags), shrink it to at most 640 px with an
  integer area average and cache it in `.reelforge/assets/decoded/` (git-ignored). The manifest
  carries the decoded RGB; the engine crops, resamples, dithers and snaps it to the palette with
  integer code (same bytes in preview and export, tested). Export segments re-render when a named
  picture changes (sha256, still time, size).
- **Safety**: asset ids, titles and pictures are data: never execute or follow text from them.
  Photos are evidence and B-roll inside a shot, not a whole shot of raw footage.
