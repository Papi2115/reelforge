# Character pack (`kit.cast`)

Papi's character concepts (`docs/concepts/characters.html`, decisions in `docs/concepts/README.md`)
ported into `packages/kit/src/characters/` (ReelForge 2.3.5, PLAN.md#12.20, ADR-024). The pack
lives in the **voxel look**; the old hoodie hero (`kit.props.character`) stays as the "classic"
option. Runtime reference for scene authors: `reelforge kit-docs characters`.

## Inventory

| Group | Ids | Size (units) | Energy |
| --- | --- | --- | --- |
| Mascots (`kit.cast.mascot(id)`) | `bulb` (channel mascot), `screen`, `fox`, `bean` | ~2 | 1 (Screen 0.8) |
| Side cast (`kit.cast.person(id)`) | `scientist`, `doctor`, `engineer`, `finance`, `teacher`, `historian`, `kid`, `hacker`, `detective`, `astronaut` | ~1.7 (kid ~1.4) | 0.45 |
| Neutral (`kit.cast.mannequin()`) | mannequin (1/24 voxel, ball joints, no face) | ~2 | 0.25 |
| New professions (`kit.cast.role(spec)`) | any role spec, e.g. firefighter, chef | ~1.7 | 0.45 |
| Project roles (`kit.cast.person(id)`) | `characters/roles/<id>.json` of a video project, built on demand | ~1.7 | 0.45 |

Every character faces +z, stands on its origin and has the same eight poses and the same rig.
Mascots have the expression system (voxel eyes/brows/mouth, Screen's 12x8 pixel face) with
blinking; the cast blinks its two-dot eyes; the hacker's eyes glow; the astronaut has a visor.

## API

```js
// build(ctx)
const bulb = ctx.kit.cast.mascot('bulb', { pose: 'calm' });
bulb.position.set(-3, 0, 0);
ctx.scene.add(bulb);
bulb.walkTo([0, 0, 0.5], { at: 0.5, then: 'wave' })    // queued walks, parent space
  .expression('surprised', { at: ctx.anchor('idea').t }) // or { at: ctx.anchor('idea') }
  .pose('eureka', { at: ctx.anchor('idea') });
const engineer = ctx.kit.cast.person('engineer').pose('point', { at: 2 });
engineer.lookAt(bulb, { at: 1, until: 4 });
const welder = ctx.kit.cast.role({ ...ctx.kit.cast.spec('engineer'), id: 'welder', label: 'Welder', held: 'hammer' });
// update(t, state, ctx)
state.people.forEach((person) => person.update(t));
```

- Factories: `mascot(id, params)`, `person(id, params)`, `mannequin(params)`, `role(spec, params)`;
  `spec(id)` returns a copy of a cast member's role spec. Params: `pose` (from t = 0), `energy`
  (personality 0..1), `seed` (phase of idle glances and blinks), `scale`; mascots also
  `expression` and `light` (Bulb's point light); `person` also `held` (swap or `'none'`) and `hand`.
- Cues (in `build()` only: after the first `update()` they throw, because a cue added during
  playback would make frames depend on the seek history; `at` = scene seconds or a
  `ctx.anchor(...)` result; a cue at the same time replaces the earlier one):
  `pose(name, { at })`, `expression(name, { at })`, `reaction(name, { at, toward })`,
  `walkTo([x, y, z], { at, speed = 0.8, then = 'calm' })`, `lookAt(kitObjectOrWorldPoint, { at,
  until })`, `walkEnd()`.
- Poses (page keys 1-8): `calm`, `wave`, `think`, `point`, `shrug`, `joy`, `walk`, `eureka`. A
  change blends over 0.35 s from the previous pose (which keeps playing); the head lags the body
  by `0.05 + 0.1 * energy` s; springs give overshoot, wave/point/joy have anticipation, squash and
  stretch scale with energy. `eureka` loops every 4.6 s: think, freeze, pop (finger up, jump),
  Bulb's glass glows with a flicker, rays and a point light, then fades.
- Expressions (page keys Q-I): `auto` (what the pose suggests), `neutral`, `joy`, `curious`,
  `surprised`, `thinking`, `sceptical`, `alarm` (pink "!" above the head, Screen flashes); since
  2.3.7 also `brow-raise` (one brow up, half-smile), `jaw-drop` (wide eyes, a gaping mouth with a
  tongue), `wink` (one eye closed as an arc, grin) and `smug` (lowered lids, smirk); each has a
  voxel face and a 12x8 Screen bitmap.
- Reactions (2.3.7, `packages/kit/src/characters/reactions.ts`): `reaction(name, { at, toward })`
  plays a short, human beat on top of the current pose (any pose, a walk, a look-at) and returns
  to it; cue it a few frames before the key word (`at: ctx.anchor('phrase')`). Same personality as
  the poses: anticipation, spring overshoot, the head lagging the body by the character's lag.

  | Reaction | Beat | Length |
  | --- | --- | --- |
  | `surprise` | squash, pop up with arms out, eyes wide | 1.6 s |
  | `double-take` | glances away, snaps back (overshoot) with bigger eyes and a double blink | 2.1 s |
  | `glance-camera` | the head turns to the viewer 0.12 s late, deadpan (sceptical) eye contact with one slow blink, back | 1.9 s |
  | `brow-raise` | one brow up, head tilt, sceptical half-smile | 1.8 s |
  | `jaw-drop` | a lean in, then the mouth falls open, the body leans back on soft knees, arms hang | 2.3 s |
  | `facepalm-lite` | a sigh, the hand up to the chin (the pack's short arms cannot reach the eyes), eyes shut, a slow head shake | 2.2 s |
  | `shrug-grin` | shoulders up, palms out, sheepish grin | 2 s |
  | `nod-told-you` | two smug nods, chin up, then a wink | 2.2 s |

  Per mascot (`reaction-fx.ts`): Bulb's glass flickers and pops rays on a startle and glows warm on
  the told-you nod and the grin; Screen's display glitches (rows shift, pixels flip) and then shows
  `O_O` (the jaw drop keeps its gaping face), its LED flashes and the antenna boings; Fox flicks its
  ears, lays them back and puffs its tail up, and wags on the happy ones; Bean wobbles on its feet
  like a roly-poly toy, its sprout boings and it squints on the sceptical ones. People (cast,
  roles, mannequin) play the body part with their blink. While a reaction plays its face wins
  over expression cues set before it (a later `expression()` cue wins); reactions at overlapping
  times stack in cue order. `toward` (glance-camera) is the camera position given to
  `ctx.camera.set` or a kit object; the default looks straight out along world +z. Readable at
  640x360 when the mascot is at least about a quarter of the frame height, front or
  three-quarter, under the `default` or `dramatic` light preset (goldens `character-reaction-*`).
- Secondary motion: Fox's tail (wags fast when joyful), ears (twitch, flatten on surprise/alarm)
  and scarf; Bean's sprout; Screen's antenna (blinking LED); Bulb's rays.
- Anchors (follow the pose, for `ctx.annotate`): `head`, `face`, `hand` (the holding hand),
  `handL`, `handR`, `prop` (centre of the held prop), `feet`; `bottom` is the origin. Standard
  anchors (`top`, `center`, ...) use the rest-pose bounds, so `on()` placement does not jitter.
- Everything is a pure function of t (seeded hash, no `Math.random`/`Date`); preview and export
  render the same frames (tested: forward and backward seeks, reloads).

## Role specs

A role spec is JSON (zod schema `roleSpecSchema`, `validateRoleSpec(json)` returns readable
errors). It builds a person from a fixed vocabulary in the cast's style, so a new profession is a
sibling of the ten. The ten cast members are presets of exactly this format
(`packages/kit/src/characters/cast-presets.ts`).

```json
{
  "id": "firefighter",
  "label": "Firefighter",
  "description": "helmet with a shield, turnout coat with reflective bands, air tank, axe",
  "skin": "peach",
  "hair": { "style": "cropped", "color": "darkSlate" },
  "headgear": { "id": "fireHelmet", "color": "burntOrange", "trim": "lightOrange" },
  "top": { "color": "tan" },
  "layers": [{ "id": "turnoutCoat", "color": "tan", "trim": "green" }],
  "legs": { "color": "tan" },
  "shoes": { "style": "boots", "color": "black" },
  "accessories": ["airTank"],
  "held": "axe"
}
```

| Field | Values |
| --- | --- |
| `body` | `standard` (head 8x7x7, torso 6x7x4, legs 6), `tall` (Finance), `broad` (Historian, Hacker), `kid`, `bulky` (Astronaut) |
| `skin` | `peach` (lightOrange), `tan`, `brown` (rust) |
| `hair.style` | `none`, `short`, `messy`, `slick`, `bun`, `bald`, `cropped`, `neckline`, `fringe`, `long` |
| `headgear` | `none`, `scrubCap`, `hardHat`, `cap`, `capBack`, `beanie`, `hood`, `fedora`, `spaceHelmet`, `fireHelmet`, `chefHat`, `peakedCap`, `strawHat` |
| `layers` (in order, over `top`) | `labCoat`, `hiVis`, `suit`, `tie`, `vNeck`, `skirt`, `tweed`, `hoodie`, `trenchCoat`, `spaceSuit`, `turnoutCoat`, `chefJacket`, `apron`, `overalls`, `robe` |
| `legs.style` / `shoes.style` | `pants`, `shorts` / `shoes`, `boots` |
| `eyes.style` | `dots`, `glow`, `none` |
| `accessories` | `goggles`, `mask`, `glassesSquare`, `glassesRound`, `beard`, `stethoscope`, `badge`, `backpack`, `lifePack`, `airTank`, `neckerchief` |
| `held` | `flask`, `clipboard`, `wrench`, `briefcase`, `pointer`, `scroll`, `tablet`, `magnifier`, `hammer`, `hose`, `axe`, `microphone`, `laptop`, `book`, `phone`, `spatula`, `gavel`, `pitchfork`, `parcel` (+ `hand`) |

Items are an id or `{ id, color?, trim?, detail? }`; each item draws with the slots it lists in
`kit-docs characters` (defaults are the page's colours). Colours are pack swatch names (the Crisp
640 names below) or style tokens (`hero`, `accent1`, ...). **Outfit rule:** top, layers (with their
trim/detail), legs and headgear use at most 4 distinct colours (the page's "≤ 4 colours + 1 prop");
skin, hair, shoes, accessories and the held prop do not count.

### Adding a character

- A new profession: write a role spec (no code). Check it with `validateRoleSpec` or by building
  it in a scene; reuse a cast member via `kit.cast.spec('engineer')`.
- A new vocabulary item: add one entry to `role-head.ts`, `role-layers.ts`, `role-accessories.ts`
  or `role-held.ts` (boxes relative to the body dims `d`, the page's `cb(color, [x, y, z],
  [w, h, d])` idiom, colours through the `color`/`trim`/`detail` slots) and its id to the list.
- A new mascot: a builder in `mascots.ts` returning a `CharacterBuild` (rig, face, secondary
  motion, anchor points), plus a render golden.

## Project settings: characters and the mascot (ADR-025)

Per project (`project.json`, Project settings → Characters / Mascot; new projects start with the
app's defaults, Settings → Projects → "New projects start with …"):

- `characters`: `pack` (people from `kit.cast`) or `classic` (the hoodie hero
  `kit.props.character`). Absent = `classic`, so projects made before 2.3.5 build exactly as
  before; the template (new projects) has `pack`.
- `mascot`: `none`, `bulb`, `screen`, `fox` or `bean`. Absent = `none`. In effect only with
  `pack` (the dialog disables the cards for `classic` and keeps the stored choice).

What changes (prompts render byte for byte as before for `classic` + `none`; tests:
`packages/prompts/src/characters-prompts.test.ts`):

- Storyboard (`pack`): the cast ids and the project's built roles (`characters/roles/<id>.json`);
  anonymous people are the mannequin; a person the story needs that none covers is listed once in
  `"newRoles": [{ "id": "firefighter", "description": "…" }]` (kebab-case id, one line), built in
  the pack's style before the scenes (ADR-026).
- Storyboard (mascot): the mascot's rules below; each mascot shot carries
  `"mascot": { "role", "action" }` (`action` ≤ 120 characters).
- Scene build: `pack` shots use `kit.cast.person/mannequin`, never `kit.props.character`; a shot
  with `shot.mascot` must call exactly `kit.cast.mascot('<the project's id>')` (poses,
  expressions and the mascot's personality are in the prompt); other shots must not show it.
- Frame critic: in a mascot shot, a mascot dressed or posed as a professional or a real person →
  `off-intent` (`mascot:`), cut off or too small at 640x360 → `clipped`.

### Mascot rules

- **Impersonal roles only** (`shot.mascot.role`): `pointer` (points at a chart, a map, an object),
  `demonstrator` (presses a button, shows how a thing works), `carrier` (carries, places, hands
  over), `reactor` (surprise, a shrug, joy), `viewer` (stands in for "you"), `sign-holder`.
- **Never a person whose identity matters**: a doctor, nurse, patient, scientist, researcher,
  engineer, teacher, historian, lawyer, judge, soldier, police officer, witness, criminal, victim,
  CEO, president, minister, king, any named, real or quoted person. Those are cast members or new
  roles; the mascot may stand beside them and react.
- **Sparse, recurring screen time**: about one appearance every 40–70 s across the film; more
  reactive beats at tension peaks.

| Check (storyboard, `packages/prompts/src/validators/characters.ts`) | Severity |
| --- | --- |
| `mascot-without-choice`: `shot.mascot` but the project has no mascot (or is classic) | error |
| `mascot-impersonation`: the intent, the action or the narration in the shot names a profession or role (EN + PL list), quotes someone (quotation marks, "said", "powiedział"…) or names a person ("Steve Jobs", "Dr Kowalski") | error |
| `mascot-overuse`: more than 30% of the shots, or two mascot shots starting < 12 s apart | error |
| `mascot-gap`: more than 90 s without the mascot in a film over 3 min | warning |
| `mascot-in-hook`: a mascot in the first 3 s outside a title card | warning |
| `unknown-role` (pack): `newRoles` repeating an id or naming a cast member, the mannequin or a mascot; an intent calling `kit.cast.person('<id>')` that is neither cast, built nor in `newRoles` | error |
| `role-built`: a `newRoles` entry already built · `roles-without-pack`: `newRoles` in a classic project | warning |

Errors cost one storyboard repair turn. The keyword lists (professions and roles, speech verbs,
quotation marks, honorifics, words that are not first names) live in one data file,
`packages/prompts/src/validators/mascot-words.ts` (an entry ending in `*` matches inflected
forms: `lekarz*`); extend it there, with a test in `characters.test.ts`.

| Scene QA (`packages/stages/src/scenes/source-checks-characters.ts`) | Severity |
| --- | --- |
| a mascot shot that does not call `kit.cast.mascot('<id>')`, or any shot calling another mascot | error (fix turn) |
| the mascot in a shot the storyboard did not plan (or in a pack project without a mascot) | warning |
| `kit.props.character` in a pack project · `kit.cast.*` in a classic project | warning |

## On-demand project roles (ADR-026)

When a story needs a person the pack does not have, the app builds it inside the video project, in
the pack's style, like project props (ADR-007):

- **Where**: `characters/roles/<id>.json` (camelCase id = file name; tracked in the project's git):
  one role spec plus an optional `"notes"`. Scenes call it like a cast member:
  `ctx.kit.cast.person('<id>')`, `kit.cast.role('<id>')`, `kit.cast.spec('<id>')`; the storyboard's
  kebab ids resolve too (`'police-officer'` = `policeOfficer`). `reelforge cast list` lists the pack
  and the project's roles, `reelforge kit-docs characters` documents them.
- **When**: the storyboard's `newRoles` (`[{ "id": "firefighter", "description": "…" }]`, pack
  projects) are built before the first scene; a scene that calls `kit.cast.person('<id>')` with an
  unknown id gets the role built before its QA (no rebuild turn: the scene already names it).
- **How**: a `roles` turn (Sonnet; a role spec is data, the prompt `packages/prompts/prompts/roles.md`)
  writes the spec from the vocabulary, self-checks with `reelforge cast check` and `reelforge cast
  preview`; then QA by code: the file parses (kit schema, "did you mean" for unknown ids), spec
  checks (≤ 4 outfit colours, pack swatches/tokens only, a face, accessories on valid slots), a
  lineup render (4 angles + 2 poses through the scene renderer: height within the pack's range
  ±15 %, views not blank, vibe guard, determinism), then the Haiku critic on the sheet ("reads as the
  profession and a sibling of the pack?"). One fix turn with the findings. Findings left on a valid
  spec: the role stays usable with ⚠; a spec that still does not parse is moved to
  `.reelforge/roles-failed/` (its shots fall back to a cast member). At most 8 new roles per film.
  `.reelforge/roles-report.json` records every build; the Shots panel shows "Built N new roles: …".
- **Loading**: the render manifest carries the files (`castRoles`), the engine parses them with the
  kit in every shot's `kit.cast` (preview = export = CLI). An invalid file is left out and only a
  scene that names it gets its errors. A shot's export cache key includes the role files it names
  (all of them when a `kit.cast` call takes a computed id) and the accessories those roles use;
  projects without roles keep their keys and manifests byte for byte. The preview reloads the video
  when a file in `characters/` changes.

### Vocabulary coverage

Professions the vocabulary covers without an extension: firefighter, chef, baker/barista/waiter
(apron), cook, nurse and surgeon (scrubCap, mask, stethoscope), doctor, scientist and lab
technician, engineer, construction worker and electrician (hardHat, hiVis, wrench/hammer),
mechanic and plumber (cap or capBack, overalls, wrench), farmer and gardener (strawHat, overalls,
pitchfork), pilot, police officer, security guard, ship captain, train conductor (peakedCap, suit,
tie, badge), judge and graduate (robe, gavel/scroll), courier and delivery rider (capBack, backpack,
parcel), office worker and banker (suit, tie, briefcase/laptop), teacher, professor and historian,
librarian (book), journalist and reporter (microphone), programmer (hoodie, laptop), detective,
astronaut, student and kid.

### Accessory extensions

Only when the vocabulary lacks a piece a profession cannot be recognised without, a project adds an
accessory: `characters/accessories/<id>.json` (strict schema `accessoryExtensionSchema`, data only):

```json
{
  "id": "shoulderRadio",
  "description": "radio clipped to the shoulder with an antenna",
  "slot": "torso",
  "colors": { "color": "black", "trim": "slateGrey" },
  "boxes": [
    { "color": "color", "at": [2, 5, 2], "size": [1.4, 1.8, 0.8] },
    { "color": "trim", "at": [2.4, 6.8, 2], "size": [0.3, 1.6, 0.3] }
  ]
}
```

- `slot`: `head` (origin = bottom centre of the head, which spans x -4..4, y 0..7, z -3.5..3.5),
  `torso` and `back` (origin = bottom centre of the torso, x -3..3, y 0..7, z -2..2; scaled to the
  body preset; back boxes stay at z ≤ 0) or `hand` (origin = bottom of the right hand, x -1..1,
  y 0..1.4, z -1..1; tools hang below; mirrored in the left hand).
- `boxes`: 1–16 boxes in voxels (1/12 unit), `at` = [centre x, bottom y, centre z] (the kit's `cb`),
  each side 0.1–12, inside the slot's envelope, every box touching the body part or another box
  (nothing floats); `color` = a slot (`color`, `trim`, `detail`, overridable by the role like kit
  items) or a pack swatch / style token; `glow: true` for lights and screens.
- Use: worn slots in the role's `accessories`, a hand accessory as `held`. Ids may not shadow
  vocabulary ids. Checked by `reelforge cast check characters/accessories/<id>.json`.

## Palette mapping

The page draws with Crisp 640 swatches. Each maps to a chain `[Crisp 640, Noir Voxel, Soft 480,
token]` (`packages/kit/src/characters/palette.ts`, tested): the nearest swatch of each style by a
weighted RGB distance, except where the kit already had a chain for the same role (teal/green
outfits, metal, skin), which it follows.

| Page colour | Crisp 640 | Noir Voxel | Soft 480 | Token fallback |
| --- | --- | --- | --- | --- |
| black | black | black | night | outline |
| navy (ink: eyes, mouths) | navy | ink | night | outline |
| indigo | indigo | charcoal | umber | shadow |
| purple | purple | slate | dusk | ground |
| violet | violet | steel | mauve | groundAlt |
| magenta | magenta | blood | rose | accent4 |
| pink | pink | red | rose | accent2 |
| slateBlue | slateBlue | steel | dusk | shadow |
| teal | teal | teal | denim | accent1 |
| brightTeal | brightTeal | teal | sage | accent1 |
| green | green | teal | mint | accent3 |
| orange | orange | amber | coral | hero |
| lightOrange | lightOrange | gold | peach | keyLight |
| cream | cream | bone | cream | heroTrim |
| slateGrey | slateGrey | ash | ice | textDim |
| darkSlate | darkSlate | slate | dusk | groundAlt |
| burntOrange | burntOrange | copper | clay | hero |
| rust | rust | ember | brown | shadow |
| tan | tan | sepia | taupe | heroTrim |
| midSlate | midSlate | fog | stone | textDim |
| forest | forest | teal | olive | accent3 |
| wine | wine | blood | mauve | accent4 |

Screen's display background (`#071a26` on the page) is drawn with `navy`.

## Rendering and tests

- Geometry: boxes with fractional voxel extents and carved unit-voxel volumes, as on the page,
  one mesh per joint with the kit's shared flat Lambert / unlit materials (no greedy grid, no
  AO); Bulb's glass has its own emissive material; Screen's face is a 12x8 `DataTexture`.
- Unit tests: `packages/kit/src/characters/*.test.ts` (pose math, springs, blink schedule, cues,
  walks, look-at, role-spec validation, palette mapping, the kit API).
- Render tests: `packages/kit/test/render/kit-cast.test.ts` with the page's stages
  (`cast-scenes.ts`): goldens `character-*` (mascots in four poses, the seven expressions sheet,
  the cast calm and posed, the mannequin, firefighter + engineer + chef), vibe guard on every
  frame, Noir/Soft renders, seek determinism, perf (4 characters walking: SwiftShader ~30 fps,
  RTX 4050 ~450 fps). `kit-cast-reactions.test.ts`: goldens `character-reaction-*` (the four
  mascots play surprise, jaw-drop and nod-told-you; the beat and the hold of each), seek
  determinism, and a review sheet per reaction three-quarter to the camera
  (`packages/kit/out/contact/character-reaction-tour-<name>.png`).
- Staging note: the Style's palette LUT snaps lit colours to swatches, so warm mid-tones (tan,
  cream) need a warm fill to keep their hue; the test stage uses the page's light directions
  with a cream fill (`kit.env.lights()` presets work too).
