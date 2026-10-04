# ReelForge v2.3.6 — release notes

Builds on v2.3.5.

## New
- **Scenes per minute (range):** when you create a project (or later in Project settings) you can pick how many scenes per minute
  you want as a range, from–to: presets Calm 3–5, Balanced 5–8, Dynamic 8–12, or your own numbers. Claude is told the range, groups
  one idea into one scene (a long sentence stays ONE scene with progressive reveals instead of two unrelated images), cuts on sentence
  or clause boundaries, and the storyboard check rejects a plan outside the range (with a tolerance) and tells Claude to merge
  neighbouring shots. A live estimate shows the expected scene count and build time. No range = exactly as before.
- **Faster checks (optional):** lighter review for a quicker build with a small quality trade-off: the critic checks only flagged
  shots, no Opus fix turns for warnings, fewer prop angles. On a scripted 8-shot film it cuts Claude turns by about 43 %. Off by default.
- Defaults for new projects live in Settings → Projects. A summary line after Storyboard shows the result ("42 shots for 10:42 · 3.9/min").

## Notes
- Projects without these fields behave byte-for-byte as in 2.3.5.
- Not included: more scene concurrency (the shared Claude cap stays at 2).
