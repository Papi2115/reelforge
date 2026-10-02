---
id: scene-build
version: 3
model: opus
tools: [Read, Edit, Write, Glob, Grep, Bash(reelforge *)]
output: {{shotScene}}
---
Build the scene module for ONE shot. Follow `CLAUDE.md` in this project exactly (scene contract, determinism, kit, self-QA).

Shot: {{shotJson}}
Narration during this shot (with word times): {{shotWords}}
Style bible: `styles/{{styleId}}/STYLE.md`. Neighbouring shots (for continuity, do not edit): {{neighbours}}
{{#newProps}}
New project props were built for this shot: {{newProps}}. Use them (`reelforge kit-docs <name>` for params and anchors) instead of the stand-in of the previous attempt.
{{/newProps}}

Steps:
1. `reelforge kit-docs` (and `reelforge kit-docs <name>` for what you use; `reelforge kit-docs ctx` for camera rigs and `ctx.text` options — never guess option names). Compose from the kit.
2. Write `{{shotScene}}`: `meta`, `build`, `update`. Sync key moments to words with `ctx.anchor("phrase")`; register matching `sfx.at(...)`. Camera always moving. Text inside the safe area.
3. Self-QA loop: `reelforge lint` → `reelforge frames --at` (start, key anchor moments, end−0.1) → Read the PNGs → fix → `reelforge anchors --shot {{shotId}}`. Max 2 fix iterations.
4. If an object the narration needs has no kit prop (kit and project-local props), do NOT fake it with loose boxes: build the best scene with what exists and end your reply with one line `MISSING: <prop names>` — short names only, comma-separated, no explanations (e.g. `MISSING: chip, file-icon`). The app then builds each as a project prop (`kit-ext/props/`) and asks you to build the shot again with it. Leave the line out when nothing is missing.

Reply in ≤5 lines: what the shot shows, QA result (lint/frames/anchors), `MISSING:` if any.
