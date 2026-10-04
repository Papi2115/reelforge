# ADR-015: Own assets and the global asset library (PLAN 12.12, 12.19)

Status: accepted (2026-10-04). Code: schemas `packages/shared/src/assets.ts` (`own` origin,
`OWN_LICENCE`, `description`, `fromLibrary`), `packages/shared/src/asset-library.ts`,
`storyboard.ts` (`shot.assets`), `app-settings.ts` (`assetLibrary`); CLI
`packages/cli/src/assets/own.ts`, `packages/cli/src/assets/library/`, commands
`assets library search|use` (`commands/assets-library.ts`), `validate` (assigned ids); stages
`stages/storyboard-assets.ts`, `stages/assets-library.ts`, `scenes/shot-assets.ts`; app
`apps/desktop/src/main/assets/{asset-actions,library-service}.ts`, renderer
`assets/{OwnAssets,LibraryPanel}.tsx`. Guide: `docs/assets.md`.

## Context

Research mode `off` (ADR-012) promises zero network: Claude builds the film from the kit and the
user's own assets. 2.1 needs those own files in the project, a way for the storyboard to place them,
and a cache so approved downloads are not fetched again for every project.

## Decisions

- **Own files are ordinary catalogue records.** `assets.json` records with `source: 'own'`,
  licence `{ id: 'own', verified: true }`, `approved: true`, a user-editable `title` and
  `description` (default: the file name). Same store (`.reelforge/assets/<id>.<ext>`), same
  magic-byte check and size caps as downloads, sha256 dedupe, ids `own-<file name>`. Everything that
  already works on assets (scene embedding 12.11, manifests, export cache) works on them unchanged.
  Credits skip them; they are never ⚠.
- **Storyboard assignment: a new optional `shot.assets: string[]`** (asset ids, at most 4 per
  shot) instead of overloading `assetNeeds` (a need is a request to research; an assignment points
  at an existing file). The storyboard validator (and `reelforge validate`) errors on ids missing
  from `assets.json`, read fresh after the turn (Claude may copy library assets in during it).
- **The prompt changes only when there is something to say.** The storyboard prompt gets the
  asset catalogue (inside the untrusted-data block) only when the project has assets, research is
  on, or the library has entries; with none of these it is byte for byte the old prompt. In mode
  `off` it adds "build every B-roll ONLY from the kit and these assets". Scene builds get the
  assigned assets as `shotAssets` in every mode (needs/downloads only with research on, as before).
  The scene-build prompt text itself is unchanged.
- **No Assets step in mode `off`.** Imports happen in the app, never in a Claude turn; the gating
  of ADR-012 is untouched.
- **One library, shared code.** The store lives in `packages/cli/src/assets/library/` so the app
  (main process) and the `reelforge` CLI use the same code. Location: `<app data>/library`
  (`library.json` + `files/<sha256>.<ext>`), outside every project and outside git. The index is
  zod-versioned, written atomically, serialised per folder; a damaged index is moved to
  `library.corrupt-<time>.json` like the app settings. Entries keep source, author, licence, links,
  description, tags, favourite, `addedAt`, origin project (folder name only) — an unverified licence
  stays unverified in every project that uses the entry.
- **Only the app adds to the library.** Automatically after the Assets step for downloads the user
  approved or with a verified licence (setting "Save downloaded assets", default on); own imports
  only with "Save my own files" (default off); per asset with "Save to library". The runtime Claude
  can only `search` and `use` (copy into the project, `fromLibrary: true`, `approved: false`); both
  are allowed in every research mode because they never touch the network.
- **The CLI finds the library through `REELFORGE_ASSET_LIBRARY`**, added to the bridge's extra-env
  allowlist (next to the render service URL/token); it is a folder path, not a credential. Without
  it (outside the app) the library commands refuse with a clear message.
- **Pictures reach the renderer** through `reelforge-media://library/<sha256>.<ext>` (strict file
  name, images only, `?w=` thumbnails for PNG/JPEG), confined to `library/files` after resolving
  links. Drag and drop uses Electron `webUtils.getPathForFile` in the preload; main checks every
  file again.

## Consequences

- Removing an asset from a project does not touch the library and vice versa (copies, not links).
- A library entry is identified by its bytes: the same picture saved from two projects is stored
  once with the first project's metadata.
- Video assets are listed and can be assigned, but scenes still show stills only (video playback
  is out of scope).
