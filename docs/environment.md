# Environment digest (PLAN.md#0.5)

Checked 2026-10-02 on the dev machine (Windows 11 Home).

| Tool | Version | Status |
|---|---|---|
| node | 24.17.0 | OK |
| pnpm | 12.8.1 | OK (installed via `npm i -g pnpm` during bootstrap) |
| npm / corepack | 11.13.0 / 0.35.0 | OK |
| git | 2.54.0.windows.1 | OK (user.name/email configured) |
| gh | 2.96.0 | OK (logged in to github.com) |
| ffmpeg / ffprobe | 8.1.1 | OK — GPL build; NVENC, AMF, QSV, libx264 encoders present |
| python | 3.12.10 | OK (optional) |
| claude CLI | — | **MISSING** (needed from phase 1.1; install + log in before then) |

Hardware: RTX 4050 Laptop GPU, 6 CPU cores, 15 GB RAM, 66 GB free on C:.

Notes:
- ffmpeg is a GPL build: fine for personal use; see licensing risk in PLAN.md §8 and task 9.4 before distribution.
