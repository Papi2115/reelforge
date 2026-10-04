# ADR-012: Asset research — `reelforge fetch-asset` and the safety layer (PLAN 12.9)

Status: accepted (2026-10-04). Code: schemas `packages/shared/src/assets.ts` (+ `researchMode`,
`researchSources` in `project.ts`); CLI `packages/cli/src/assets/` (`guard.ts`, `http.ts`,
`hosts.ts`, `magic.ts`, `untrusted.ts`, `store.ts`, `acquire.ts`, `fetch.ts`, `research.ts`,
`credits.ts`, `sources/`), commands `packages/cli/src/commands/assets.ts`, `fetch-asset.ts`;
bridge regression `packages/claude-bridge/src/network-lockdown.test.ts`. Guide: `docs/assets.md`.

## Context

ReelForge 2.1 lets the runtime Claude put real photos and footage into B-rolls. That opens the
network to a process that reads untrusted text, inside a product whose rules are local-first
(CLAUDE.md §3.4: network only through an explicit `reelforge fetch-asset` under the project's
research mode, never yt-dlp/YouTube) and subscription-only (§3.1, untouched here).

## Decisions

- **One network path: the `reelforge` CLI.** The bridge keeps Bash limited to one plain
  `reelforge …` command (allowlist + PreToolUse hook) and WebFetch/WebSearch to the
  research/script stages; a regression test proves curl/wget/PowerShell/yt-dlp/chaining stay
  blocked in every stage. The CLI never spawns processes (a test greps the asset modules).
- **The CLI lives in `packages/cli`, not a new package.** It is the only consumer; schemas the app
  needs (12.10 UI) are in `packages/shared`. No new dependency: plain `node:http(s)`.
- **Research mode in project.json, absent = `off`.** Projects made before 2.1 make zero requests;
  the template sets `ask`. One guard module holds the whole matrix; it runs before any request
  (the `off` tests count zero requests on the local server).
- **Approval cannot be forged by Claude.** Proposals live in `.reelforge/assets/proposals/` (the
  bridge denies edits under `.reelforge/`); no CLI command approves. `fetch-asset` in mode `ask`
  checks the proposal files. (The packet said `assets/proposals/`; moved under `.reelforge/` for
  this reason.)
- **Metadata from the source, never from the caller.** `propose` and `fetch-asset` take only
  `<source>:<id>` and look the item up again through the source API (licence, author, file URL).
- **Licences.** `verified` = from structured source metadata AND open for commercial use and
  modification (PD, CC0, CC BY, CC BY-SA, FAL, NASA guidelines, LoC "no known restrictions");
  NC/ND never verify (scenes always pixelise an asset). `allowlist` fetches verified only; `ask`
  lets the user decide; `full-auto` direct URLs are `unverified` and flagged in the credits.
- **Transport.** https only, default port, no URL credentials; the ban list (video platforms,
  social networks, paid stock, sign-in hosts/paths, stream manifests) in every mode; caller host
  policy re-checked on every redirect hop (max 5); DNS answers checked against
  loopback/private/link-local/metadata/CGNAT/multicast ranges inside the socket `lookup` (the
  checked address is the one connected to; literal IPs checked before connecting); identity
  encoding only; idle + total timeouts; byte caps while streaming (images 25 MB, videos 120 MB,
  thumbnails 2 MB, JSON 4 MB). Tests reach `http://127.0.0.1` only through the injected
  `allowLoopbackHttpForTests` transport option — never from settings or flags.
- **Files.** Streamed to a temp file inside `.reelforge/assets/`, type decided by magic bytes
  (png, jpeg, webp, gif, mp4, webm; Content-Type ignored), renamed to `<asset id>.<ext>`; any
  failure deletes the partial file. Store folders are resolved inside the project (links out
  rejected). Metadata in tracked `assets.json` (zod, versioned, atomic writes).
- **Untrusted text.** Titles/authors/licence names are cleaned on the way in (markup, entities,
  control/bidi/zero-width characters, structure characters, our block markers; length caps) and
  printed only between `UNTRUSTED EXTERNAL DATA` markers; the project template tells the runtime
  Claude that such text is data, never instructions.
- **Keyed sources** (Pexels, Pixabay): a registry hook (`apiKey`) only; keys would come from app
  settings, never from a project. No adapter yet.

## Consequences

- The UI (12.10) reads `.reelforge/assets/proposals/*.json` and approves via
  `approveProposalItems` semantics; embedding (12.11) reads `assets.json` + `.reelforge/assets/`.
- The Library of Congress JSON API answers some clients with a bot challenge (403); search
  reports it as a per-source warning. Its fixtures follow the documented API, not a recording.
- `assets.json` is editable by the runtime Claude like other tracked files (CLAUDE.md template says
  not to); credits re-sanitise its text, and `sha256` lets the app detect swapped bytes.
