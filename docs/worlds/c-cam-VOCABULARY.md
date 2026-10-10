# Grim Ink (c-cam) — prop, set-piece, crowd and acting vocabulary

Inventory for PLAN.md#14.20 (brief `docs/worlds/briefs/ccam/13-prop-and-acting-vocabulary.md`): every
prop, set piece, crowd device and two-body gag the three C-CAM concept films wrote once per film
(`docs/concepts/c-cam-style/films/*/js/{props,edo,lunar,acting}.js`, `cast/*.js`, `sets/*.js`,
`shots/*.js`), grouped into the families the kit now ships as parameterized, period-neutral
vocabulary (`env.ink.props.*`, `env.ink.instruments.*`, `env.ink.crowd.*`, `env.ink.acting.*`,
`env.ink.fx.*`; the same names on `ink.*` inside people / places modules, bound to the module's g
and ink width; `reelforge kit-docs ink-props | ink-things | ink-instruments | ink-crowd |
ink-acting | ink-fx`).

Sources: `docs/concepts/styles7/17-samurai-edo/` holds only two c-plus `proof/validate.log` files
(no drawing code); `docs/concepts/styles7/18-papal-conclave/` is not in the repository. The papal
conclave and samurai code therefore comes from the C-CAM films `02-papal-conclave` and
`01-samurai-edo`. Film refs below: E = 01-samurai-edo, P = 02-papal-conclave, A = 03-apollo-11.

Rule kept from the films: a thing is never decoration. Each entry says how it carries narration;
the kit gives the drawing, the scene gives the reason (one accent object per shot, every prop gets
a gag use, hands ON props).

## 1. Props (`props`)

### 1.1 Architecture and set pieces

| Prototype | What it is | Params used | Film / shot | Narration | Kit |
|---|---|---|---|---|---|
| `ST.palaceDoor` | big arched planked door, keyhole, studs | state open / shut / planked, drape | P street, lock | the town locks the cardinals in | `props.door` kind arch, state open / shut / ajar / barred / broken, planks |
| `ST.setDoorClose` | door close-up, keyhole, iron bands, shake | keyhole, shake px, planked | P lock, choice | the slam, the key in the lock | `props.door` (+ `fx.shake`), `instruments`-free |
| `ST.grilleFrame` / `setGrilleClose` | barred judas window, bars in front of a face | w, h | P lock | glaring through bars | `props.windowFrame` kind barred |
| `ST.window` (grime) / `windowAt` (A) | leaded window / metal bezel round a view | lit, view callback | P title, A lm | what is outside | `props.windowFrame` kind arched / square / barred / porthole, state lit / dark / broken, `view(bb)` hook |
| `ST.shoji` | paper screen, lattice, lit glow, torn panes | lit, torn | E house, office | dawn, a shabby room | `props.windowFrame` kind screen (lit, wear = torn panes) |
| `ST.noren` | split cloth curtain, sways on twos, mark | col, t, mark | E street, shop front | the shop's sign | `props.banner` kind curtain |
| palace loggia / gothic windows | arches on slim columns | count | P street | the palace | `props.arch`, `props.column` |
| bell tower | bell swinging in a belfry + clang lines | swing rad | P death | the pope is dead | `props.bell` (+ `fx.shakeLines`) |
| `ST.lowDesk` | low writing desk front, hides kneeling legs | w, h | E office | paperwork = peace | `props.table` kind low |
| `ST.hallTable` | long table, dirty cloth, items on top | x0, x1, top | P every hall shot | the deadlock at the table | `props.table` kind long, cloth |
| `ST.chair` | high-backed chair behind a sitter | k | P hall | rank, waiting | `props.seat` kind highBack |
| bench / stool (implied) | — | — | — | — | `props.seat` kind stool / bench / chair |
| `ST.candleStand` | iron stand, candle wax 0..1, flicker, pool | wax, t, lit | P hall | time passing (wax burns down) | `props.lamp` kind candle (level), pool hook |
| paper lamp (andon) | the one warm light on the floor | — | E shop | lamp-lit counting room | `props.lamp` kind paper |
| work lamp / floodlight (A) | hanging shade + pool | — | A pad, lm | — | `props.lamp` kind hanging |
| `ST.ladder` | rails + rungs between two world points | x0 y0 x1 y1 | P patience, roof | the roofer at work | `props.ladder` |
| `ST.plank` | board with two nails | ang | P lock, choice | the door planked shut | `props.board` (kind board / tile / beam, nails, broken) |
| price board | framed sign, flipping panel with arrows | up, flip | E market | prices move | `instruments.flipBoard` |
| hanging duty boards / account books on a rail | tags on a rail | n | E office, shop | names, debts | `props.paper` kind tags (row) |
| rain barrel + buckets | barrel, small tubs | — | E street | street clutter | `props.container` kind barrel / tub |
| futon base + quilt | mattress, patched quilt drawn over the body | reach | E house | waking up | not ported (one-film set piece; a place draws it) |
| roof / tatami / planks / lattice / kura / dirt / towers / palace / moon ground / craters / boulders / lander / metal panel / white room / consoles row | place materials | — | all | the place | stay place-module drawing (brushes + grime); `props.panel` covers a riveted metal panel |

### 1.2 Things held, used, carried

| Prototype | What it is | Params | Film / shot | Narration | Kit |
|---|---|---|---|---|---|
| `ST.daisho` / `rackSword` | two swords at the hip / a sword on a rack, gleam | tilt, gleam | E house, street (CLACK), payoff (cat sits on it) | status for show | `props.weapon` kind sword (state sheathed / drawn / broken, wear, gleam) |
| spear, shield, club (implied by brief) | — | — | — | — | `props.weapon` kind spear / shield / club / dagger / axe |
| `ST.bigKey` | huge brass key, bow at the grip | ang | P title, lock, payoff | "cum clave" = with a key | `props.tool` kind key (size, wear) |
| hammer / shovel / broom (implied) | — | — | — | — | `props.tool` kind hammer / shovel / broom / saw / wrench |
| `ST.hanko` | seal stamp in the palm | g | E office | the elder stamps on a beat | `props.tool` kind stamp (+ `fx.mark` seals drawn by the scene) |
| `ST.bale` | straw drum, rope bands | w, h | E rice, market, storehouse | paid in rice, too big | `props.container` kind bale |
| sacks / crates (implied) | — | — | — | — | `props.container` kind sack / crate / barrel / basket / jar / tub, state open / spilled / broken |
| `ST.koban` | flat gold ovals in a fan | n | E loan | the money changes hands | `props.coins` kind oval / round / bar |
| `ST.abacus` | frame, rods, beads hop on twos | w, ang, tick | E shop, payoff | counting, the merchant's power | `instruments.counter` (beads by `tick`) |
| `ST.papers` | lop-sided document stack, tie cord | w, n | E office | the pile of work | `props.paper` kind stack |
| ledger (shots-d) | book that opens and unfolds pages | open, n | E ledger | the list of debts | `props.paper` kind book (state shut / open, pages) |
| `ST.slip` | ballot slip with scribble | rot, scale | P hall, payoff (ballots fly) | the vote | `props.paper` kind sheet |
| notebook of grievances | tiny book, open scribbles, worn as a hat | open | P hall, roof | the holdout | `props.paper` kind book small |
| `ST.checklist` (A) | ring-bound cards, page flip | page | A descent, alarm | reading faster and faster | existing `checklist` (gag-props) + `props.paper` kind cards |
| scroll / tablet / ledger / card (brief) | — | — | — | — | `props.paper` kind scroll / tablet / sheet / book / stack / cards / tags |
| stylus (P), pencil (A floaters), quill / brush (E) | writing tool in the hand | palm | P hall, A orbit | writing | `props.pen` kind quill / brush / stylus / pencil / pen / chalk |
| `ST.chalice` | gold cup (the accent) | — | P hall, payoff | ballots go in | `props.vessel` kind goblet |
| `ST.jug`, `ST.mug` (A) | water jug, coffee mug, steam | tilt, steam | P bread, A control | bread and water; calm | `props.vessel` kind cup / mug / goblet / bottle / jug / bowl / plate / pot (level, steam on twos, broken) |
| `ST.loaf`, `ST.sandwich` (A) | dark loaf, sandwich with bite | bite | P bread, A orbit | the one loaf | `props.food` kind loaf / fruit / fish / meat / cheese / pie / pile, state whole / bitten / rotten (the sandwich stays the `eat` gag's) |
| `ST.roofTile` | curved clay tile carried in two hands | — | P roof | the roof comes off | `props.board` kind tile |
| walking stick (P gregory) | stick from the palm to the floor | — | P choice | the pilgrim | `props.tool` kind stick |
| `ST.toyBear`, `ST.phone` (A) | floating toy, a modern phone (scale gag) | k, rot | A orbit, computer | loneliness, "your phone is bigger" | not ported as such (showcase objects); a scene draws them |
| `ST.controlStick` (A) | base + grip under the palm | base, grip | A manual | flying by hand | `instruments.joystick` |
| `ST.jingasa` | flat cone hat that falls and rolls | cx, top, w | E wrongbow | the wrong bow | people modules draw headwear; the fall is `acting.dropCatch` (catch: false) |
| `ST.cart` / boat (brief) | — | — | — | — | `props.cart`, `props.boat` (minimal, wheels turn with `roll`) |
| cobweb, tally marks, slate year | time passing | web, tally, year | P years | years go by | stays place drawing (`ink.brushStroke`) |

## 2. Instruments and consoles (`instruments`)

| Prototype | What it is | Params | Film / shot | Narration | Kit |
|---|---|---|---|---|---|
| `ST.switches` | bank of toggles, some guarded | cols, rows, sp | A lm, cm, panel wall | the cramped cabin | `instruments.switchPanel` (states from `pattern` / seed, `flip` index + `press`) |
| `ST.gauge` | dial, ticks, red zone, needle | r, a, label | A lm, fuel (climax ECU) | fuel running out | `instruments.gauge` (value 0..1, zone, tremble on twos) |
| `ST.dsky` | lights, display, keypad, pressed key | alarm, code, press | A lm, computer, alarm | 1202 | `instruments.keypad` (rows x cols, press index) + `instruments.lights` + `instruments.screen` (labels are drawText at returned spots) |
| master alarm light | red block, flashes, red pool | on | A descent, alarm | the scare | `instruments.lights` (blink, colour) |
| `ST.console` (A sets-c) | sloped desk, dim screens with bars | w, front | A control | mission control | `instruments.console` (N elements: gauges, switches, lights, keys, screen, lever) |
| `ST.controlStick` | stick under the palm | base, grip | A manual | small calm moves | `instruments.joystick` (dx, dy deflection; returns the grip point for `reachPalm`) |
| price board | flipping panel | up, flip | E market | prices up / down | `instruments.flipBoard` (flip 0..1, side up / down) |
| `ST.abacus` | beads on rods | tick | E shop | counting | `instruments.counter` |
| lever / dial / button (brief) | — | — | — | the climax press / turn / pull | `instruments.lever` (pull 0..1), `instruments.dial` (turn 0..1), `instruments.button` (press 0..1) |
| armrest squeeze (A fuel) | tube the glove grips | — | A fuel | fear | a scene `ink.tube` + `reachPalm` |

## 3. Crowds (`crowd`)

| Prototype | What it is | Params | Film / shot | Narration | Kit |
|---|---|---|---|---|---|
| `ST.crowdFigure` (E) | simplified rig figure, 5 kinds (cloth, bun, cone hat, topknot, boy) | kind, yaw, mode stand / point, col, colD | E street, market | a town watching | `crowd.figure` (body kinds robe / coat / dress / short / apron / child / suit / coverall; head kinds; reaction) |
| `ST.crowdFigure` (P) | 6 kinds (coif, cap, hood, shawl, lad hat, cardinal) | mode stand / mutter / point / vote / sit / sitpoint / cover / none | P death, patience, hall | the town loses patience | same; reactions mutter, point, hold (paper up), sit, cover (cloth over the head) |
| `ST.crowdFigure` (A) | engineers (tie, headset, glasses), technician | mode stand / work, ph | A control, pad | the calm room | same; reactions work (typing), hush; head kinds headset, cap, glasses |
| crowd lines (P death 9 figures, patience 11 figures) | rows with tones, alternating depth, staggered start | i % 2 offsets, t + i * 0.13 | P death, patience | mood spreads through a crowd | `crowd.rows` (rows, density, tones, deterministic jitter, reaction wave by `stagger`) |
| tiers (implied by brief: an arena, a council) | — | — | — | — | `crowd.rows` kind tiers (rows step up) |
| foreground backs at the lens (P death s 2.6, nopope s 4.2; A control shoulder; E market silhouette) | huge dark figure from behind | s, yaw 3 | P, A, E | depth, over-the-shoulder | `crowd.foreground` (flat ink backs, screen space via `fgScreen` or world) |
| TOWN_TONES | 4 tone triples [col, colD, skin] | — | P | variety without noise | `palette` option: town / muted / office / robes / dark (+ `tone` index or `colors` on one figure) |
| reactions on twos: mutter fist, cheer, gasp (implied), hush, wave, point, lean | — | — | — | — | `crowd` reactions: stand, cheer, gasp, hush, wave, point, lean, mutter, work, hold, sit, cover |

## 4. Acting and two-body gags (`acting`)

| Prototype | What happens | Film / shot | How it carries narration | Kit |
|---|---|---|---|---|
| scabbard bump CLACK | you turn, your scabbard end meets the rival's exactly (geometry solved), radial impact strokes, both heads jolt, then bows of apology | E street | status for show collides | `acting.clink` (two held things meet at a contact point; returns contact + impact mark + jolts) |
| bale handed over | keeper's palms carry the bale on an arc to your palms; your knees go (bob), you stagger | E rice | paid in something too heavy | `acting.handOver` (object travels palm to palm on an arc; receiver sags with `weight`) |
| coin exchange | hands meet, palms solved (within 1.3 px), koban change palms | E loan | who is in charge | `acting.handOver` (light object), `acting.handshake` (palms meet) |
| bow / lower bow | you bow, he bows lower and stays one bow lower | E loan, payoff | rank | `acting.bow` (two bows, second deeper by `outdo`) |
| hat falls and rolls to a toe | over-deep bow, hat drops, rolls, rocks against the toe | E wrongbow | etiquette disaster | `acting.dropCatch` (catch: false = lands and rolls to the other's feet) |
| cat jumps on the scabbard | — | E payoff | a stray steals the moment | not ported (animal) |
| stamp on a beat | stamp up / slam every 0.5 s, seals pile up | E office | paperwork | `acting.beat`-free: a scene uses `env.time` + `props.tool` stamp |
| key turns in the lock | palm solved at the keyhole, key bow turns | P lock | locked in | `props.tool` kind key with `turn` 0-1, held at a palm solved with `reachPalm` on `door`'s `points.handle` |
| slow "no" head shake | head yaw 3/4 left, front, 3/4 right on twos | P nopope, refuse | the holdout | `acting.doubleTake`'s shake helper `acting.headShake` |
| everyone points at one man | sitpoint crowd + both mains point | P choice | resolution | `acting.pointTurn` (the pointer points, the target turns to look; crowd reaction point) |
| loaf served onto the table | drop from the palm | P bread | cut the food | `acting.handOver` (to a surface point) |
| accusing fingers at the lens | fg arms | P refuse | pressure | `crowd.foreground` kind arm (`toward` the target) |
| shove / push (implied by brief) | — | — | — | `acting.push` (pusher's palms on the other's chest, receiver leans / steps back) |
| stumble (implied; E stagger) | — | E rice (stagger) | — | `acting.stumble` (trip, lean, arms out; the other reaches / catches) |
| drop and catch (implied) | — | — | — | `acting.dropCatch` (catch: true = the other's palm meets it mid-fall) |
| handshake (implied; E coin meet) | — | — | — | `acting.handshake` (palms meet, pump on twos) |
| flinch (A helmet jolt) | jolt + click lines | A pad | fear | `acting.flinch` (one raises a hand, the other jerks back) |
| shared-object tug (implied) | — | — | — | `acting.tug` (both palms on one object, it wobbles between them) |
| double take (A window, E street) | look, away, snap back with a jolt | A window, E street | realization | `acting.doubleTake` |
| squeeze another's arm (A payoff) | glove solved onto the other's arm | A payoff | reassurance | `acting.handOn` (one palm on a named body point of the other) |
| poke the wall dent (A lander) | finger to the wall, dent wobbles | A lander | thin walls | `fx.ripple` + `reachPalm` |

## 5. Small effects (`fx`)

| Prototype | What it is | Film / shot | Kit |
|---|---|---|---|
| touchdown dust (A land) | 11 grey puffs billowing out as k 0 -> 1 | A land | `fx.dust` |
| impact strokes (E street CLACK) | 8 radial strokes alternating on twos | E street | `fx.impact` (star + radial strokes) |
| sword gleam (E house) | 4-point flat star | E house | `fx.spark` (kind gleam / sparks) |
| sweat drops (A, head space) | drips on twos | A | existing `sweat` + `fx.sweat` (world space, t0, dur) |
| steam (A mug), cig smoke (A control) | curls on twos | A control | `fx.steam`, `fx.smoke` |
| groan / sniff marks (P) | three strokes fanning from a point | P nopope, bread | `fx.marks` |
| slam lines, clang lines, click lines | short parallel strokes | P lock, death; A pad | `fx.shakeLines` |
| dent ripple rings (A lander) | wobbling rings | A lander | `fx.ripple` |
| door shake / camera shake (+-8 px on twos) | offset | P lock, A land | `fx.shake` (returns an offset; draws nothing) |
| "?" / "z" marks | lettering | P choice, E office | lettering (`drawText`), not fx |
| rain, snow, flies | place weather | P roof, years; E | `ink.flies` exists; rain / snow stay place drawing |

## 6. What the kit does differently from the prototypes (all families)

- One period-neutral function per thing with a `kind` (a sword, a spear, a club are kinds of
  `weapon`), never a named film object: no koban, abacus, DSKY, jingasa, chalice by name; the Apollo
  objects stay in `packages/kit/examples/c-cam/apollo/`.
- `(g, e, opts)` with a checked options object (zod; an out-of-range value throws a KitError naming
  `reelforge kit-docs ink-<family>`), `seed` for every wobble (hash, no module state), `t` only for
  things that move on twos, `wear` 0..1 for grime, `tone` = a palette token (`CLAY`, `OLIVE`, …) or a
  material name (`wood`, `iron`, `brass`, `straw`, `paper`, `cloth`, `stone`, `glass`).
- Every prop returns its useful points (grip, top, mouth, light, label spots) so hands and other
  things can be solved ON it; lettering is never drawn by the vocabulary (labels are `drawText`
  calls at returned spots, so the text-provenance guard still sees every word).
- Acting functions draw nothing: they return draw options for both people (`pose` with solved hand
  targets, `bow`, `lean`, `headDy`, `expr`), the travelling prop's position and the contact point;
  the scene draws the people and the prop.
- Crowd figures use the real rig with a shared small body (as the films did) and reactions on twos;
  far planes stay flat (no hatching, dot eyes).

## 7. What the kit ships (PLAN.md#14.20)

Sources: `packages/kit/src/worlds/c-cam/vocabulary/` (registries `props.ts`, `instruments.ts`,
`crowd.ts`, `acting.ts`, `fx.ts`; one entry = doc line + options line + zod schema + pure function),
docs `packages/cli/src/commands/kit-docs-c-cam-vocab.ts` (from the registries), names and calls in
`packages/prompts/src/worlds/c-cam-vocab-api.ts` (re-exported by `c-cam-api.ts`), examples in
`packages/kit/examples/c-cam/vocab/` (one per family, each with its narrative reason), golden sheets
`packages/kit/test/goldens/swiftshader/ccam-vocab-<sheet>.png` (test/render/ccam-vocab.test.ts).

| Family | Entries | Golden sheets | Differs from the prototypes |
|---|---|---|---|
| props (22) | door, windowFrame, arch, column, ladder, board, panel, bell, table, seat, lamp, banner; container, coins, paper, pen, vessel, food, weapon, tool, cart, boat | `ccam-vocab-props` (doors, windows, tables, seats, lamps, banners), `ccam-vocab-goods` (containers, coins, paper, pens, vessels, food), `ccam-vocab-gear` (weapons, tools, cart, boat, columns, arch, ladder, panel, board, tile, bell) | one function per thing with `kind` / `state` / `wear` / `tone`; a sword is not a daisho (no obi geometry: the scene holds it at a palm); doors / windows / lamps are generic (no CUM CLAVE stone, no shoji-only screen); lettering is never drawn (label spots instead of `ST.label`); cart and boat are new (no film had them) |
| instruments (12) | lever, joystick, dial, button, gauge, switchPanel, keypad, lights, screen, flipBoard, counter, console | `ccam-vocab-instruments` | the guidance computer is split into keypad + lights + screen with no fixed labels; the gauge takes `value` 0-1, a red zone side and a tremble on twos instead of a raw angle; the console is a slot layout of N elements, not the Apollo centre panel; state values are explicit numbers (pull, turn, press) |
| crowd (3) | figure, rows, foreground | `ccam-vocab-crowd` | period-neutral body kinds (tunic, robe, coat, dress, stout, suit, coverall, child) and head kinds instead of per-film kinds; 12 reactions (adds cheer, gasp, hush, wave, lean); rows with density, depth falloff, turned share and a reaction ripple (stagger) instead of hand-placed lines; foreground pieces are flat ink backs / heads / an arm |
| acting (13) | clink, handshake, handOver, dropCatch, push, stumble, flinch, bow, pointTurn, tug, doubleTake, headShake, handOn | `ccam-vocab-acting-0` (clink, hand-over, catch, handshake, push, bow), `ccam-vocab-acting-1` (stumble, flinch, point-and-turn, tug, double take, hand on) | the films hand-wrote each gag in one shot; here each is a pure solver over two figures that returns both people's draw options (hand targets solved with the rig's reachPalm, side views reaching from the centre line), the travelling thing and the impact; no cat, no hat physics beyond drop-and-roll; leans are converted to screen direction for mirrored figures |
| fx (10) | dust, impact, spark, sweat, steam, smoke, marks, shakeLines, ripple, shake | `ccam-vocab-fx` | every effect takes t0 / dur / seed and draws nothing outside its window; two-point strokes are drawn as three-point tapered dashes (the films' two-point strokes tapered to hairlines); the gleam tilts with the seed; `shake` returns an offset instead of moving a set |
