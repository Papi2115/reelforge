# ReelForge v3.3.0-beta.2 — release notes

Fix release on top of v3.3.0-beta.1.

## Fixes
- **Export no longer fails with "render window closed" on world projects (Comic).** Cause: the render windows of one export share a renderer process; loading a 22-scene Comic project takes ~10 s per window and blocks it, so the first frame of a shot waited longer than the 30 s frame limit, and the timeout was reported (wrongly) as "render window closed". Now: window loads go through one shared gate (one at a time, each with its own limit), a frame deadline extends while another window is loading, a window that dies or times out is replaced and the same frame is retried (2 times per worker), and the final message names the real reason with advice (Resume, fewer export workers in Settings → Performance, restart the app).
- The real reason of a crashed render or GPU process is written to the app log (`%APPDATA%\ReelForge\logs\main.log`).
