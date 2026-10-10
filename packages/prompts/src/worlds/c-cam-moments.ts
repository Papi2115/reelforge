/**
 * The Grim Ink (c-cam) moment catalog (docs/worlds/README.md "Variety", QUALITY.md §8.2,
 * docs/concepts/c-cam-style/docs/05-CAMERA_GUIDE.md §4 and §7): the closed list of shot moments
 * the storyboard plans from the narration (`worldMoment`), the host look, the camera grammar the
 * scene builds with the exact calls (c-cam-api.ts) and what the critic must see. Every moment is
 * grammar, never content: what is drawn comes from the film's narration and its own people and
 * places. `reverse` and `poster` are the breakthroughs (about one per ~50 s, two kinds, never
 * adjacent: variety.ts); each needs an intent that names the claim, never the same mechanism
 * twice in a film. `insert` and `over-shoulder` are the everyday moments of the camera grammar.
 * A reaction may be the person's signature gag (PLAN.md#14.15), always on a beat with a reason.
 */
import { cCamSnippet as snippet } from './c-cam-api.js';
import type { WorldMomentOption } from './types.js';

const SCENE = 'ink-scene';
const INSERT = 'ink-insert';
const POSTER = 'ink-poster';

/** First line of the scene for a planned moment: the claim, so the critic and the guards read it. */
const INTENT_LINE =
  "`// moment: <id> | intent: <the claim in the narration's words>` as the first comment of the scene";

const REVERSE_BUILD = `A reveal from the other side, never a template (look \`ink-scene\`). First decide what the reverse must SHOW (the claim of THIS narration: who was watching, what stood behind the door, how many waited, that the room was empty), then build it: ${INTENT_LINE}. The cut table holds at least two framings of ONE place: the establishing side, then on the narration's phrase a hard cut to the opposite side (every person turns to the other \`view\`, the place's far wall becomes the near one, the foreground piece changes), solved before the camera so contacts and eyelines match across the cut (${snippet('cuts')}). The place must be drawn for both sides (its module or a set extension; never an edge in any framing). Hold the revealed side >= 0.6 s with one small acting beat on twos (a blink, a head jolt of 0.2 s, or a person's signature gag when the reveal gives it a reason). Never reverse the same place twice in a film, never the same kind of reveal twice; a reverse whose new side shows nothing the narration says is decoration.`;

const POSTER_BUILD = `The line the film turns on, as a hand-inked poster, never a template (look \`ink-poster\`): ${INTENT_LINE}. Screen space at zoom 1, no camera: one flat mud field, a worn border, ONE emblem of THIS narration drawn big and off-centre (${snippet('screenBlob')}: the thing the line is about, its 2-3 defining features, thick uneven ink 12-18), and the line itself, at most 6 words exactly as the narration says them, thudding in letter by letter on twos (${snippet('poster')}). Two or three colours (bone, rust, one mud, ink), one accent at most. It lands on the phrase with a short shake (8 px on twos for 0.2 s), then holds >= 0.6 s still (only line boil). Never the same emblem and layout twice in a film; the opening title card is a plain \`ink-poster\` shot, not this moment.`;

export const C_CAM_MOMENTS: readonly WorldMomentOption[] = [
  {
    id: 'reverse',
    breakthrough: true,
    looks: [SCENE],
    cue: 'a reveal from the other side',
    useWhen:
      'turns on what was on the other side (who was watching, what stood behind the door, the crowd that waited, the room that was empty; an A-roll shot); say in the intent what the reverse reveals and on which phrase, never the same place or the same kind of reveal twice in a film',
    build: REVERSE_BUILD,
    visible:
      'the same place seen from the opposite side after a hard cut (the people turned the other way, the far wall now near), and the revealed thing of the intent as the focal point; a reverse whose new side shows nothing the narration says is `off-intent` with a note starting `reverse:`',
    minShotS: 3.5,
  },
  {
    id: 'poster',
    breakthrough: true,
    looks: [POSTER],
    cue: 'the line the film turns on',
    useWhen:
      'lands the line the film turns on (a verdict, a rule, the payoff, the one sentence the viewer should remember; a C-roll shot); say in the intent the line (at most 6 words, as narrated) and the emblem it sits on, never the same emblem and layout twice in a film',
    build: POSTER_BUILD,
    visible:
      'a hand-inked poster: one emblem of the narration on a flat mud field, the line in fat ink capitals (bone fill, rust extrusion) landing letter by letter, then holding still; name the line and the emblem as the focal point; a generic emblem or words the narration never says is `off-intent` with a note starting `poster:`',
    minShotS: 2.5,
  },
  {
    id: 'insert',
    breakthrough: false,
    looks: [INSERT],
    useWhen:
      'names the one specific thing that carries the point (a price, a stamp, a gauge, a worn tool, a line in a ledger, a coin in a palm)',
    build: `an extreme close-up of that one thing (look \`ink-insert\`, zoom 2.4-5.4 or drawn big at zoom 1): it fills 60-80 % of the frame, off-centre, a foreground edge (a table, a sleeve, a hand solved onto it with ${snippet('reach')}) for depth; its wear tells the story (${snippet('stain')}, ${snippet('crack')}, dents, peeled paint as \`blob\` crescents and hatching); numbers and words only as hand lettering from the narration (${snippet('hand')}); the change lands on twos on the phrase, then a long still hold.`,
    visible:
      'one object of the narration in extreme close-up, filling most of the frame off-centre, worn and specific',
    minShotS: 1.5,
  },
  {
    id: 'over-shoulder',
    breakthrough: false,
    looks: [SCENE],
    useWhen:
      'has someone look at, read, wait for or face something (a letter, a crowd, a door, another person)',
    build: `a cast member's back huge in the foreground (\`view: 'back'\`, scale 1.25-4.2, feet far below the frame), drawn after the place and before any screen-space piece, never covering the focal point; the thing looked at sits off-centre in the free part of the frame; the cut table then cuts to a close-up of what they see or of the reaction on the beat (the reaction may be the person's signature gag, never as decoration; ${snippet('cuts')}). One foreground piece per framing, only in the framing that needs it.`,
    visible:
      "a person's back or shoulder huge in the foreground, the thing they look at off-centre beyond it",
    minShotS: 3,
  },
];
