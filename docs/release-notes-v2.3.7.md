# ReelForge v2.3.7 — release notes

Builds on v2.3.6.

## New
- **Wow transitions (11 new styles)**, palette-pure and identical in preview and export, chosen by the storyboard to fit the content and used
  sparingly (budget: about one per 40–90 s, never back to back):
  - **Enter-through:** `enter-lens` (spyglass/magnifier), `enter-binoculars`, `enter-window`, `enter-keyhole`. The incoming shot is revealed
    inside the lens/window/keyhole while the outgoing one zooms in; the storyboard can aim the move at the thing being entered (`focus`).
  - **Content-texture:** `paper-roll`, `cube-smash`, `sponge-wipe`, `page-turn`, `shatter`.
  - **Scale dive:** `dive-in` and `dive-out` for "flat → street → city → globe" sequences (chained only when the storyboard marks a scale sequence).
  - Each style has content tags the storyboard matches (binoculars for watching, keyhole for secrets, shatter for a failure…) and its own sound
    (one new SFX, `glass-crack`). Repetition control treats a repeated wow style as a repeat.
- **Mascot reactions:** surprise, double-take, glance at the camera, brow raise, jaw drop, wink, smug, shrug-and-grin, nod, adapted to each mascot
  (Bulb flickers, Screen glitches to O_O, Fox puffs its tail, Bean wobbles). With a mascot chosen, the storyboard may use short reactor beats at
  tension peaks, reveal moments and surprising facts, still only in impersonal roles and within the sparse-screen-time budget.

## Notes
- Projects without looks mixed/mascot behave as before; goldens of existing transitions are unchanged.
- Known: the facepalm reaction is a compromise (the mascots' arms are short); glass-crack was checked by automatic sound QA only.
