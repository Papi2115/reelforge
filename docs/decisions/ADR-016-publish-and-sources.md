# ADR-016: Publish kit and sources / fact-check (PLAN 12.17, 12.18)

Status: accepted (2026-10-04). Code: publish kit `packages/pipeline/src/publish/`
(`chapter-plan.ts`, `publish-kit.ts`), app `apps/desktop/src/main/publish/publish-service.ts`,
UI `apps/desktop/src/renderer/publish/PublishKit.tsx` (export dialog); claims schema
`packages/shared/src/claims.ts` + `claims-ops.ts`, prompt `packages/prompts/prompts/claims.md` +
validator `src/validators/claims.ts`, turn `packages/stages/src/claims/check-sources.ts`, storyboard
hint `src/claims/source-chips.ts`, app `apps/desktop/src/main/publish/claims-service.ts`, UI
`apps/desktop/src/renderer/publish/SourcesPanel.tsx` (script view → Sources); engine annotation
`packages/engine/src/annotations/draw-source-chip.ts` (`ctx.annotate.sourceChip`). Guide:
`docs/publish.md`. Goldens: `source-chip-default|top-left|avoid`
(`packages/engine/test/render/source-chip.test.ts`, scene `examples/s04_source_chip.js`).

## Context

A finished film still needs its YouTube text: chapters, description, tags and the credits of the
real photos/footage it shows (12.9). The film also states facts; research.md has links for them,
but nothing tied a spoken claim to its source or told the user which claims have none. CLAUDE.md
§3.1 forbids any upload API, §3.4 keeps everything local, §3.2 keeps scenes pure.

## Decisions

- **Paste, never upload.** The publish kit is four text files (`description.txt`, `chapters.txt`,
  `tags.txt`, `credits.txt`) shown with Copy buttons and saved under `publish/` (tracked, one
  commit, step `publish`) on demand. No YouTube API, no OAuth, no network.
- **Chapters are planned, not just merged.** Chapter starts are shot starts chosen by dynamic
  programming over (shot, chapter count): every chapter ≥ 10 s in whole seconds (what YouTube
  reads), ≥ 3 chapters, first at 0:00; the score rewards starting at act changes (look change +3,
  roll change +1.5, C-roll +1, title card +2, non-cut transition +2, treatment change +0.5) and
  penalises the squared relative deviation from a target length (~1 chapter per minute, 3–15).
  A film with no valid split (the 30 s example) gets no chapters and a plain reason, never broken
  ones. Titles: Claude's suggested title for the same second (`out/metadata.json` from Claude),
  else the first clause of the chapter's first shot intent, ≤ 5 words, trailing filler words cut.
  The export's own `out/chapters.txt` (9.2) is unchanged.
- **Credits = assets the scenes use.** The app reuses `creditsMarkdown` / `usedAssetIds` of
  `@reelforge/cli/assets`; the user's own files are never credited. Any used asset with an
  unverified licence puts a `!!! WARNING` block at the top of `description.txt` and `credits.txt`
  (pasting it unedited is visible) and a banner in the dialog.
- **claims.json, versioned and tracked.** Claims (id, text, sentence, word range, kind
  number/date/name/causal/quote, sourceIds, status sourced/unsourced/disputed/user-confirmed,
  note) and sources (`r<n>` = research.md links, `u<n>` = added by the user: URL, document, note;
  a `name` for the chip, never a URL). The schema enforces: ids resolve, `sourced` has a source,
  `unsourced` has none. A script fingerprint (FNV-1a) tells the panel when the script changed.
- **Check sources = one read-only Sonnet turn, no web.** Prompt `claims` (JSON reply) runs under
  the critic's bridge permissions (read-only tools, no WebSearch/WebFetch); the app passes the
  prompt's model (Sonnet; Economy applies) explicitly, so the critic stage's Haiku default never
  applies. The validator requires quotes copied from the numbered sentence and only listed source
  ids; when building the file, misquoted/duplicate claims are dropped and unknown ids removed, so a
  claim Claude "remembers" a source for stays `unsourced`. A new check merges with the old file by
  normalised claim text: the user's sources, confirmations, disputes and notes survive.
- **Source chip is an annotation.** `ctx.annotate.sourceChip({ name, index?, corner? })` draws a
  palette-only "SOURCE: NAME" plate (+ tiny mono number) wiped in from the left, in a corner of
  the safe area. The layer now draws marks in three passes (others, source chips, spotlights), so
  the chip takes the first corner (preferred, then bottom-right, bottom-left, top-right, top-left)
  that covers no text card or annotation, else the least covered one. URLs in a name become hosts;
  long names are cut at a word. Same QA/card registry as the other annotations.
- **Storyboard hint only when claims exist.** With a claims.json that pins a nameable source, the
  storyboard prompt gets a `sourceChips` section (claims → source names) and may plan a
  `source-chip` annotation (new plan kind); otherwise the prompt renders byte-identically. Chips
  are not counted by the annotation run/density/variety rules (their phrase is still checked).

## Consequences

- A 30 s film never has chapters (YouTube's rules); the kit says so instead of failing.
- The two chapter algorithms (export `out/chapters.txt`, publish kit) can disagree; the publish
  kit is the one meant for pasting.
- Claude cannot add knowledge the research lacks: unsourced claims are visible work for the user.
