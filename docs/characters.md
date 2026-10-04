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
  `pose(name, { at })`, `expression(name, { at })`, `walkTo([x, y, z], { at, speed = 0.8,
  then = 'calm' })`, `lookAt(kitObjectOrWorldPoint, { at, until })`, `walkEnd()`.
- Poses (page keys 1-8): `calm`, `wave`, `think`, `point`, `shrug`, `joy`, `walk`, `eureka`. A
  change blends over 0.35 s from the previous pose (which keeps playing); the head lags the body
  by `0.05 + 0.1 * energy` s; springs give overshoot, wave/point/joy have anticipation, squash and
  stretch scale with energy. `eureka` loops every 4.6 s: think, freeze, pop (finger up, jump),
  Bulb's glass glows with a flicker, rays and a point light, then fades.
- Expressions (page keys Q-I): `auto` (what the pose suggests), `neutral`, `joy`, `curious`,
  `surprised`, `thinking`, `sceptical`, `alarm` (pink "!" above the head, Screen flashes).
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
  "skin": "tan",
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
| `headgear` | `none`, `scrubCap`, `hardHat`, `cap`, `capBack`, `beanie`, `hood`, `fedora`, `spaceHelmet`, `fireHelmet`, `chefHat` |
| `layers` (in order, over `top`) | `labCoat`, `hiVis`, `suit`, `tie`, `vNeck`, `skirt`, `tweed`, `hoodie`, `trenchCoat`, `spaceSuit`, `turnoutCoat`, `chefJacket`, `apron` |
| `legs.style` / `shoes.style` | `pants`, `shorts` / `shoes`, `boots` |
| `eyes.style` | `dots`, `glow`, `none` |
| `accessories` | `goggles`, `mask`, `glassesSquare`, `glassesRound`, `beard`, `stethoscope`, `badge`, `backpack`, `lifePack`, `airTank`, `neckerchief` |
| `held` | `flask`, `clipboard`, `wrench`, `briefcase`, `pointer`, `scroll`, `tablet`, `magnifier`, `hammer`, `hose`, `axe`, `microphone`, `laptop`, `book`, `phone`, `spatula` (+ `hand`) |

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
  RTX 4050 ~450 fps).
- Staging note: the Style's palette LUT snaps lit colours to swatches, so warm mid-tones (tan,
  cream) need a warm fill to keep their hue; the test stage uses the page's light directions
  with a cream fill (`kit.env.lights()` presets work too).
