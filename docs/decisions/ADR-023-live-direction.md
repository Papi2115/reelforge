# ADR-023: Live co-direction as host-level shot overrides (PLAN 12.14)

Status: accepted (2026-10-04). Code: `packages/shared/src/live-direction*.ts` (schema, parser,
word lookup), `packages/engine/src/direction*.ts` + `runtime.ts` (`setShotDirection`, harness RPC
`direct`), `apps/desktop/src/main/directions-*.ts`, `apps/desktop/src/renderer/direction/`,
`project-manifest.ts`, `pipeline/src/export/cache-key.ts`. Docs: `docs/live-direction.md`.

## Context

PLAN 12.14 asks for commands typed while the film plays ("slower", "darker", "arrow on the word
X", "make it a terminal") that change a shot in under a second. The plan builds it on the
word-driven scene templates of 11.7, which are deferred. Scenes are Claude-written code; rebuilding
one takes a Claude turn, far over a second.

## Decisions

- **Overrides on top of the scene, not scene edits.** `directions.json` (tracked) stores per shot
  `rate`, `dim`, `zoom` and `overlays`; the render manifest carries them as `shot.direction`; the
  engine applies them at render time. The scene source is never touched, so locked shots, QA and
  the scene cache keep their meaning. Preview and export share the manifest (cache key covers it).
- **Rate keeps the sync.** No uniform time scale (it would move every anchor). The reveal-moment
  remap curve (time-remap.ts) is reused over the gaps between visual hits (built anchors + sfx
  cues), so hits and VO words keep their times; a shot without hits gets one window = the shot.
  Composed with moment windows (direction, then moment): identity outside both, monotone.
- **Palette purity.** Tone = the 12.27 palette-shift pass toward darker or lighter tone-family
  neighbours; zoom = integer nearest-neighbour index maps; marks = the ADR-008 annotation layer in
  an own surface snapped through the style LUT. Every output pixel is a palette colour.
- **Idle path untouched.** Shots without a direction never reach the new code; the frame director
  and the overlay painter are created lazily. All existing goldens and hashes stay.
- **Hot apply.** A direction-only manifest change is planned as `directionShotIds` and applied with
  `setShotDirection` (no import, no build, no reload); the preview sees directions.json through the
  watcher like any video input.
- **Parser is local and pure.** English + Polish grammar, diacritics/case-insensitive word lookup
  with one typo, nearest occurrence to the playhead. Unknown commands are `needs-claude` and become
  an explicit "Rebuild with Claude" offer (shot variants with the command as the note) — never an
  automatic Claude turn (it costs the user's plan).
- **Locks and history.** Main refuses a locked shot (`status: 'locked'`, the bar offers "Unlock
  this shot"); each command is one commit with step `direction`; undo/redo of the session is an
  in-memory stack whose steps are again commits.
- **Voice** stays outside the app: Windows dictation (Win+H) types into the bar.

## Consequences

- "Faster" cannot shorten the time between two spoken hits; it reshapes the motion between them.
- `reelforge frames`/QA render scenes as authored (directions are a presentation layer, like
  reveal moments).
- When 11.7 (templates) lands, `needs-claude` commands that map to template parameters can move
  into the parser without changing the file format.
