# Publish kit and sources (PLAN 12.17, 12.18)

Decisions: `docs/decisions/ADR-016-publish-and-sources.md`. Nothing here uploads anything: you
paste the texts into YouTube Studio yourself.

## Publish kit (export dialog → "Publish kit")

Four paste-ready texts of the finished film, built from the **final** storyboard (after locks and
timeline trims), the script, the YouTube suggestions (`out/metadata.json`, Claude's when you used
"Suggest with Claude") and the credits of the assets the scenes use:

| File | Content |
|---|---|
| `description.txt` | ⚠ warning block (only while a used asset's licence is unverified) · opening paragraph (Claude's description without its chapter lines, else the script's first two sentences) · `Chapters` block · `Links` placeholder · `Credits` · the first three tags as hashtags |
| `chapters.txt` | `0:00 Title` lines (YouTube format), or `(no chapters: <why>)` |
| `tags.txt` | Claude's / the template's tags, comma separated, ≤ 500 characters together |
| `credits.txt` | ⚠ warning block (as above) + the `reelforge assets credits` text of the used assets |

Each text has a **Copy** button. **Save to publish/** writes the four files to `<project>/publish/`
(tracked in git, one commit "Save the publish kit"); **Open folder** opens it. **Refresh** reads the
project again (the section also refreshes after "Suggest with Claude").

### Chapters

YouTube only shows chapters when the first starts at 0:00, there are at least 3 and each lasts at
least 10 s (timestamps are whole seconds). Chapter starts are shot starts; short shots are merged
into the chapter they fall in. Among all valid splits the kit picks the one that starts chapters at
the storyboard's act changes (a new look or roll, a C-roll, a title card, a crossfade/glitch/wipe)
and keeps chapters near ~1 minute (3–15 chapters). Titles: Claude's suggested chapter title for the
same second if there is one, else the first clause of the first shot's intent, at most 5 words
("A school calculator on an exam bench; …" → "A school calculator").

A film without a valid split (e.g. the 30 s example project) gets no chapters and the reason.

### Credits and unverified licences

Only assets that a scene module or `storyboard.json` names are credited; your own files never are.
While any of them has an unverified licence (research mode "Full auto ⚠"), the dialog shows a
banner and `description.txt` / `credits.txt` start with:

```
!!! WARNING: 1 asset has an UNVERIFIED licence: "TI-84 photo".
!!! Confirm its licence or replace it before publishing, then delete this block.
```

## Sources (script view → Sources)

`claims.json` (tracked, versioned zod schema in `packages/shared/src/claims.ts`) pins sources to
the factual claims of the script.

- **Check sources** (one Claude turn, Sonnet, read-only tools, **no web**): Claude lists the claims
  (number, date, name, causal, quote) quoting the script and pins only research.md links that state
  the same fact. A claim the research does not cover stays **without a source**: Claude cannot
  vouch for it from memory. Running it again keeps your own sources and decisions.
- Per claim: **Add source** (a link, a document you name, or a note; optional "Name on screen"),
  **Remove** a source, **Confirm** (you vouch for it), **Dispute**, **Clear decision**. Every edit
  is committed ("Sources: attach c3" …).
- The report: "12 claims: 9 sourced, 2 without a source, 1 disputed, 0 confirmed by you", with a
  **Without a source** filter. The panel says when the script changed since the last check.
- The research links of `research.md` stay listed below the claims.

### Source chip on screen

When `claims.json` pins a nameable source to a claim, the storyboard may plan a `source-chip`
annotation for the shot that states it (usually B-roll). The scene draws it with

```js
ctx.annotate.sourceChip({ name: 'nasa.gov', index: 1, phrase: '61 KB' });
```

a small "SOURCE: NAME" plate in a free corner of the safe area (bottom right first; it never covers
text cards, callouts or other marks when a corner is free). Options: `name` (a URL shows as its
host; cut at a word after `maxChars` = 24), `label` = "SOURCE", `index` 1–99 (tiny number tag),
`corner` = auto | bottom-right | bottom-left | top-right | top-left (preferred corner), `scale`,
`textColor`, `plate`, plus the common annotation options. `reelforge kit-docs annotate` lists them.
