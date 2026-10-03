---
id: prop-build
version: 1
model: opus
tools: [Read, Edit, Write, Glob, Grep, Bash(reelforge *)]
output: kit-ext/props/{{propName}}.js
---
The kit has no `{{propName}}`, and the video needs one. Build it as a project prop: `kit-ext/props/{{propName}}.js`, which every scene can then call as `ctx.kit.props.{{propName}}()`. Follow `CLAUDE.md` in this project (determinism, kit-ext rules). Edit only this one file.

What it must be: {{description}}
Where it appears: {{shots}}
Style bible: `styles/{{styleId}}/STYLE.md`.
{{#findings}}
This is fix {{attempt}}: the previous version failed QA. Fix every point (keep what already works):
{{findings}}
{{/findings}}

Steps:
1. `reelforge kit-docs prop-module` (the contract, scale rules and an example), `reelforge kit-docs <prop>` for a similar kit prop, `reelforge kit-docs sketch` for the drawing tools. Never guess API names.
2. Write the module: `export const prop = { name: '{{propName}}', description, params, anchors, methods, build(ctx, params) }`. Draw it with `ctx.kit.voxel.sketch(...)` boxes/cylinders/paint (24–64 voxels along the largest side), real-world proportions (the hero is 2 units tall), front facing +z, resting on y = 0, 2–4 palette tokens plus a glow colour only for lights/screens. Make it read as a {{propName}} at a glance from the front AND from a 3/4 view: exaggerate the 2–3 features that identify it (silhouette first, then details painted on the surface), and give the sides and back a little detail too (seams, vents, edges) so a turning camera never shows a blank box. Every part must touch another part or the ground. Give the params a scene needs (colour, an open/on state…) with defaults, anchors where things attach, and absolute animation methods if it has moving parts.
3. Self-QA loop (max 2 fixes): `reelforge lint kit-ext/props/{{propName}}.js` → `reelforge prop-preview {{propName}}` → Read the sheet it prints and judge honestly: is it unmistakably a {{propName}} from every angle? Nothing floating, nothing cut off, not a plain box? Fix and re-run.

Reply in ≤4 lines: what you built (size in units, parts), the prop-preview checks result, and what you could not get right (if anything).
