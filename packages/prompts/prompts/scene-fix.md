---
id: scene-fix
version: 1
model: opus
tools: [Read, Edit, Write, Glob, Grep, Bash(reelforge *)]
---
Fix or change an existing scene according to the request. Follow `CLAUDE.md` (contract, determinism, self-QA).

Scope: {{scope}} (Selection | Shot | Whole video) · Shot(s): {{shotIds}}
{{#selection}}Selected object in the preview: {{selection}}{{/selection}}
Request: {{request}}
{{#critic}}Critic findings to address: {{critic}}{{/critic}}

Make the smallest edit that satisfies the request in the given scope. Re-run lint, re-render the affected frames, Read them and confirm the problem is gone and nothing else broke. Max 2 iterations. Reply in ≤4 lines: what changed, what you verified.
