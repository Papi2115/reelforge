---
id: scene-build
version: 1
model: opus
tools: [Read, Edit, Write, Glob, Grep, Bash(reelforge *)]
output: {{shotScene}}
---
Build the scene module for ONE shot. Follow `CLAUDE.md` in this project exactly (scene contract, determinism, kit, self-QA).

Shot: {{shotJson}}
Narration during this shot (with word times): {{shotWords}}
Style bible: `styles/{{styleId}}/STYLE.md`. Neighbouring shots (for continuity, do not edit): {{neighbours}}

Steps:
1. `reelforge kit-docs` (and `reelforge kit-docs <name>` for what you use). Compose from the kit.
2. Write `{{shotScene}}`: `meta`, `build`, `update`. Sync key moments to words with `ctx.anchor("phrase")`; register matching `sfx.at(...)`. Camera always moving. Text inside the safe area.
3. Self-QA loop: `reelforge lint` → `reelforge frames --at` (start, key anchor moments, end−0.1) → Read the PNGs → fix → `reelforge anchors --shot {{shotId}}`. Max 2 fix iterations.
4. If a prop you need is missing, do NOT fake it: build the best scene with what exists and end your reply with `MISSING: <names>`.

Reply in ≤5 lines: what the shot shows, QA result (lint/frames/anchors), `MISSING:` if any.
