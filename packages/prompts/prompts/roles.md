---
id: roles
version: 1
model: sonnet
tools: [Read, Edit, Write, Glob, Grep, Bash(reelforge *)]
output: characters/roles/{{roleId}}.json
---
The video needs a person the character pack does not have: **{{label}}** (`{{roleId}}`). Create it as a project role in the pack's style: write `characters/roles/{{roleId}}.json`, a role spec (JSON data, no code), which every scene can then call as `ctx.kit.cast.person('{{roleId}}')`. Follow `CLAUDE.md` in this project. Edit only this file (and, only when step 3 applies, one new file in `characters/accessories/`).

Who it is: {{description}}
Where it appears: {{shots}}
Style bible: `styles/{{styleId}}/STYLE.md`.
{{#findings}}
This is fix {{attempt}}: the previous version failed QA. Fix every point (keep what already works):
{{findings}}
{{/findings}}

Steps:
1. `reelforge kit-docs characters` (the format, the vocabulary, the colours) and `reelforge cast list` (the pack and this project's roles). Start from the closest cast member's spec (the examples in kit-docs), with `"id": "{{roleId}}"`. Use only the listed body presets, hair styles, headgear, layers, accessories, held props and colours; never invent an id.
2. Make the profession readable at a glance by its silhouette: one headgear, one or two layers and one held prop that identify it (firefighter: fireHelmet, turnoutCoat, airTank, axe or hose; chef: chefHat, chefJacket, neckerchief, spatula; farmer: strawHat, overalls, pitchfork; pilot or police: peakedCap, suit + tie, badge; judge: robe, gavel; courier: capBack, backpack, parcel; nurse: scrubCap, stethoscope). At most 4 outfit colours (top, layers with their trim/detail, legs, headgear), pack swatch names or style tokens only. The standard body (kid only for a child), eyes `dots`. `label` = the display name, `description` = one line of what they wear and hold.
3. Only when the vocabulary lacks a piece the profession cannot be recognised without, add ONE accessory `characters/accessories/<camelCaseId>.json` (format in kit-docs characters: slot head, torso, back or hand; at most 16 boxes in voxels, each touching the body or another box; colours as slots or swatches) and name it in `accessories` (a hand accessory in `held`). Prefer the vocabulary.
4. Self-QA loop (max 2 fixes): `reelforge cast check characters/roles/{{roleId}}.json` → `reelforge cast preview {{roleId}}` → Read the sheet it prints and judge honestly: does it read as a {{label}} from the front and the side, and does it look like a sibling of the pack (same proportions, boxes and colours)? Fix and re-run.

Reply in ≤4 lines: what you built (headgear, layers, held prop, outfit colours, any accessory file), the cast preview checks result, and what you could not get right (if anything).
