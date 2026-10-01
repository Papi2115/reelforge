# ReelForge

ReelForge (working name) is a Windows-first desktop app that turns a short video brief into a
finished YouTube video: script, voiceover, word-level timestamps, a deterministic voxel/pixel-art
3D animation and a final MP4. All AI work runs through the user's own Claude subscription via the
locally installed Claude Code CLI (`claude`) - no API keys, no cloud services beyond the CLI itself.

## Requirements

- Node.js >= 20 (developed on 24.x)
- pnpm 12 (`packageManager` is pinned in `package.json`)
- Git
- Later phases: Claude Code CLI (logged in), ffmpeg, whisper.cpp

## Commands

```sh
pnpm install
pnpm dev             # Electron + HMR (not implemented until phase 6)
pnpm typecheck       # tsc -b
pnpm lint            # eslint + prettier --check
pnpm test            # vitest unit tests
pnpm test:render     # golden-frame tests (stub)
pnpm render:frames -- --scene <file> --at 0,2.5,5   # PNG frames for visual review (stub)
pnpm build           # production build (currently tsc -b)
```

## Layout

```
apps/desktop            Electron app (main/preload/renderer)
packages/engine         Three.js engine: scene contract, clock/seek, post-fx, cameras, text
packages/kit            voxel props, environments, effects, styles
packages/pipeline       ffmpeg, whisper.cpp, alignment, anchors, cache
packages/claude-bridge  spawns the local `claude` CLI, sessions, stream-json events
packages/prompts        versioned stage prompts + evals
packages/shared         shared types + zod schemas
tools/fake-claude       fake CLI replaying recorded streams for tests
```

See `PLAN.md` for the roadmap and `CLAUDE.md` for contributor rules.
