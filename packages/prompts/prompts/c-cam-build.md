---
id: c-cam-build
version: 2
model: opus
tools: [Read, Edit, Write, Glob, Grep, Bash(reelforge *)]
output: kit-ext/{{folder}}/{{id}}.js
---
Build `kit-ext/{{folder}}/{{id}}.js` by hand: one {{noun}} of a Grim Ink video (a hand-inked grim cartoon), which every scene of this film draws as `ctx.kit.{{folder}}.{{id}}`. The world is a style GRAMMAR, never a catalogue: there is no generator and nothing to reuse; this {{noun}} is designed for THIS film from its narration, whatever the topic. Follow `CLAUDE.md` in this project (determinism, kit-ext rules). Write only this one file: do not create or edit scenes, the storyboard or any other file.

What it must be: {{brief}}
Where it appears: {{shots}}
What the narration says there:
{{narration}}
{{#findings}}
This is fix {{attempt}} of `kit-ext/{{folder}}/{{id}}.js`: the previous version failed QA. Fix every point and keep what already works:
{{findings}}
{{/findings}}

The world's style rules (binding):
{{style}}

The module contract (`reelforge kit-docs {{folder}}`):
{{contract}}

{{#person}}A good person module of ANOTHER film. It shows the craft and the shape of the code only: never reuse its content (its job, clothes, colours, props, proportions, face, name or seeds). Your person comes from the narration above.
```js
// Grim Ink sample person (kit-ext/people/nightBaker.js, PLAN.md#14.8): "The Night Baker", a lanky,
// stooped baker in a rust shirt under a floury linen apron, a flat cap and a long nose. Original,
// simple; the reference fixture of the people module contract (tests, kit-docs people).
// No imports: every drawing gets `ink` (the brushes bound to this frame, the palette, time helpers).
const T = {
  skin: '#d2a184',
  skinD: '#a8765e',
  shirt: '#8e4a32',
  shirtD: '#64301f',
  apron: '#d9cfb4',
  apronD: '#b3a688',
  flour: '#ece6d2',
  cap: '#4b4a44',
  capD: '#2f2e2a',
  trousers: '#55504a',
  trousersD: '#38342f',
  shoe: '#2a2320',
  shoeD: '#16110f',
};
const S = 2100;
const SKIN = { lw: 6, shade: [T.skinD, -8, 5] };

// Shirt outline per view (figure space, feet at 0): front, three-quarter, profile, back.
// prettier-ignore
const SHIRT = [
  [-66, -626, -30, -640, 0, -634, 30, -640, 66, -626, 70, -540, 58, -440, 52, -360, 0, -350, -52, -360, -58, -440, -70, -540],
  [-50, -622, -16, -640, 22, -640, 54, -624, 60, -540, 50, -440, 46, -360, 0, -352, -42, -360, -46, -440, -54, -540],
  [-34, -626, 2, -644, 34, -630, 44, -560, 40, -440, 34, -360, 0, -352, -34, -360, -38, -440, -42, -560],
  [-66, -626, -30, -638, 0, -642, 30, -638, 66, -626, 70, -540, 58, -440, 52, -360, 0, -350, -52, -360, -58, -440, -70, -540],
];
// Apron per view (none on the back: only its strings).
// prettier-ignore
const APRON = [
  [-44, -560, 44, -560, 50, -420, 58, -270, 0, -262, -58, -270, -50, -420],
  [-26, -556, 48, -558, 52, -420, 60, -272, 6, -264, -40, -272, -36, -420],
  [10, -560, 44, -556, 46, -420, 54, -276, 30, -268, 8, -420],
];

export const person = {
  id: 'nightBaker',
  name: 'The Night Baker',
  D: {
    sw: 50,
    sy: -600,
    sz: 6,
    l1a: 128,
    l2a: 118,
    hw: 28,
    hy: -372,
    l1l: 186,
    l2l: 168,
    elbowOut: 0.7,
    top: -872,
    waist: [62, -440],
    hsz: 34,
    head: { x: [0, 26, 49, 0], top: -872, bottom: -614, hw: 86 },
  },
  neck: [
    [0, -618, 0, -660],
    [4, -616, 12, -658],
    [10, -612, 24, -654],
    [0, -618, 0, -660],
  ],
  headScale: 1.1,
  seed: S,
  tones: T,
  arm: {
    cloth: T.shirt,
    clothD: T.shirtD,
    w: [30, 26, 22],
    bare: 0.55,
    skin: T.skin,
    skinD: T.skinD,
    hsz: 34,
    lw: 6,
    hair: true,
    hatch: { c: 'rgba(40,16,10,0.4)', n: 3, len: 20, gap: 6, k: 3, ang: 30 },
  },
  leg: {
    cloth: T.trousers,
    clothD: T.trousersD,
    w: [40, 32, 26],
    shoe: T.shoe,
    shoeD: T.shoeD,
    len: 62,
    sw: 24,
    lw: 6,
    splay: 0.3,
    hatch: { c: 'rgba(24,20,16,0.4)', n: 3, len: 28, gap: 7, k: 3, ang: 80 },
  },
  defaultExpr: 'exhausted',
  // The one recurring tic (a gag kind): scenes use it 1-2 times a shot, on a narration beat.
  signatureGag: {
    kind: 'wipeBrow',
    note: 'wipes the oven heat off his brow and leaves a streak of flour',
  },
  // prettier-ignore
  faceAnchors: [
    { chin: [0, 6], cheek: [34, -56], nose: [0, -60], mouth: [0, -26], ear: [56, -92], forehead: [0, -140] },
    { chin: [20, 4], cheek: [48, -58], nose: [66, -62], mouth: [32, -26], ear: [-36, -90], forehead: [22, -142] },
    { chin: [36, 2], cheek: [26, -60], nose: [86, -66], mouth: [50, -26], ear: [-6, -92], forehead: [46, -140] },
    { ear: [56, -92] },
  ],
  torso(g, ink, view) {
    ink.blob(SHIRT[view], T.shirt, {
      lw: 7,
      seed: S + 60 + view,
      shade: [T.shirtD, -12, 6],
      hatch: { c: 'rgba(40,16,10,0.4)', n: 3, len: 24, gap: 7, k: 3, ang: 76 },
    });
    if (view === 3) {
      ink.brushStroke([-52, -440, 0, -430, 52, -440], { w: 5, seed: S + 66 });
      ink.brushStroke([0, -432, -14, -400], { w: 4, seed: S + 67 });
      ink.brushStroke([0, -432, 14, -398], { w: 4, seed: S + 68 });
      return;
    }
    ink.blob(APRON[view], T.apron, {
      lw: 6,
      seed: S + 70 + view,
      shade: [T.apronD, -10, 4],
      mottle: [T.flour, 9, 20],
    });
    // Neck strap and a floury hand print.
    const strapX = [0, 18, 30][view];
    ink.brushStroke([strapX - 30, -560, strapX - 10, -626], { w: 4, seed: S + 75 });
    ink.brushStroke([strapX + 30, -560, strapX + 12, -626], { w: 4, seed: S + 76 });
    ink.blob(ink.ellipseRing(strapX - 8, -380, 16, 10, 8), T.flour, { lw: 0, seed: S + 77 });
  },
  head(g, ink, view, face) {
    if (view === 0) front(ink, face);
    else if (view === 1) threeQuarter(ink, face);
    else if (view === 2) profile(ink, face);
    else back(ink);
  },
};

function ear(ink, x, y, seed) {
  ink.blob(ink.ellipseRing(x, y, 10, 18, 8), T.skin, { lw: 5, seed, shade: [T.skinD, -4, 2] });
}

function cap(ink, pts, seed) {
  ink.blob(pts, T.cap, { lw: 6, seed, shade: [T.capD, -8, 6] });
}

function front(ink, f) {
  ear(ink, -56, -92, S + 10);
  ear(ink, 56, -92, S + 11);
  // prettier-ignore
  ink.blob([-50, -24, -56, -90, -50, -150, -26, -178, 0, -184, 26, -178, 50, -150, 56, -90, 50, -24, 26, 2 + f.jaw * 10, 0, 8 + f.jaw * 14, -26, 2 + f.jaw * 10], T.skin, { ...SKIN, seed: S + 12 });
  // prettier-ignore
  cap(ink, [-64, -146, -56, -180, -20, -200, 22, -200, 58, -182, 70, -150, 40, -158, 0, -160, -40, -156], S + 13);
  ink.brow(-22, -126, 26, -1, f, { seed: S + 14, thick: 11 });
  ink.brow(22, -126, 26, 1, f, { seed: S + 15, thick: 11 });
  ink.eye(-22, -104, 11, 9, f, { skin: T.skin, seed: S + 16, side: 0, bags: 2 });
  ink.eye(22, -104, 11, 9, f, { skin: T.skin, seed: S + 17, side: 1, bags: 2 });
  // prettier-ignore
  ink.blob([-6, -100, 6, -100, 12, -50, 0, -40, -12, -50], T.skin, { lw: 5, seed: S + 18, shade: [T.skinD, -4, 3] });
  ink.mouth(0, -22 + f.jaw * 6, 30, f, { seed: S + 19, teeth: 'gap' });
  ink.blob(ink.ellipseRing(-30, -70, 9, 6, 8), T.flour, { lw: 0, seed: S + 20 });
}

function threeQuarter(ink, f) {
  ear(ink, -36, -90, S + 21);
  // prettier-ignore
  ink.blob([-44, -24, -52, -90, -46, -150, -20, -178, 8, -184, 34, -176, 54, -146, 60, -96, 58, -40, 44, -4 + f.jaw * 10, 18, 6 + f.jaw * 14, -18, 2 + f.jaw * 8], T.skin, { ...SKIN, seed: S + 22 });
  // prettier-ignore
  cap(ink, [-52, -144, -48, -178, -14, -200, 26, -200, 60, -180, 80, -152, 44, -160, 6, -162, -30, -154], S + 23);
  ink.brow(12, -126, 24, -1, f, { seed: S + 24, thick: 11 });
  ink.brow(46, -124, 18, 1, f, { seed: S + 25, thick: 10 });
  ink.eye(12, -104, 10, 9, f, { skin: T.skin, seed: S + 26, side: 0, bags: 2 });
  ink.eye(46, -104, 7, 8, f, { skin: T.skin, seed: S + 27, side: 1 });
  // prettier-ignore
  ink.blob([30, -100, 50, -98, 76, -58, 62, -44, 40, -52], T.skin, { lw: 5, seed: S + 28, shade: [T.skinD, -4, 3] });
  ink.mouth(32, -22 + f.jaw * 6, 24, f, { seed: S + 29, teeth: 'gap' });
}

function profile(ink, f) {
  // prettier-ignore
  ink.blob([-44, -24, -50, -90, -42, -150, -12, -178, 20, -182, 44, -160, 56, -124, 58, -96, 56, -50, 54, -18 + f.jaw * 10, 32, 4 + f.jaw * 14, 0, 4 + f.jaw * 8, -26, -2], T.skin, { ...SKIN, seed: S + 31 });
  // prettier-ignore
  cap(ink, [-50, -140, -44, -176, -8, -200, 34, -196, 64, -170, 96, -156, 60, -152, 20, -156, -20, -148], S + 32);
  ear(ink, -6, -92, S + 30);
  ink.brow(42, -126, 20, 1, f, { seed: S + 33, thick: 10 });
  ink.eye(42, -104, 8, 9, f, { skin: T.skin, seed: S + 34, side: 1, bags: 2 });
  // prettier-ignore
  ink.blob([54, -102, 72, -84, 96, -60, 74, -48, 56, -58], T.skin, { lw: 5, seed: S + 35, shade: [T.skinD, -4, 3] });
  ink.mouth(48, -22 + f.jaw * 6, 16, f, { seed: S + 36 });
}

function back(ink) {
  ear(ink, -56, -92, S + 50);
  ear(ink, 56, -92, S + 51);
  // prettier-ignore
  ink.blob([-50, -24, -56, -90, -50, -150, -26, -178, 0, -184, 26, -178, 50, -150, 56, -90, 50, -24, 0, 4], T.skin, { ...SKIN, seed: S + 52 });
  // prettier-ignore
  cap(ink, [-62, -120, -60, -176, -24, -200, 24, -200, 60, -176, 62, -120, 30, -112, 0, -110, -30, -112], S + 53);
  ink.brushStroke([-20, -30, -16, -6], { w: 4, seed: S + 54 });
  ink.brushStroke([20, -30, 16, -6], { w: 4, seed: S + 55 });
}
```
{{/person}}{{#place}}A good place module of ANOTHER film. It shows the craft and the shape of the code only: never reuse its content (its room, furniture, light, colours, anchors, name or seeds). Your place comes from the narration above.
```js
// Grim Ink sample place (kit-ext/places/bakeryBackRoom.js, PLAN.md#14.8): the back room of a
// night bakery. A plastered wall gone grey with flour and soot, a brick oven whose mouth is the one
// warm light, flour sacks slumped in a corner, a scarred work table, a dark window, a stone floor.
// Original, simple; the reference fixture of the places module contract (tests, kit-docs places).
// No imports: draw(g, ink, t) gets the brushes bound to this frame, the palette and time helpers.
const FLOOR = 900;

export const place = {
  id: 'bakeryBackRoom',
  name: 'The bakery back room',
  bounds: [2200, 1080],
  light: { x: 1560, y: 700, rx: 760, ry: 460, color: '#e0a443', alpha: 0.08 },
  anchors: { table: [760, 900], oven: [1500, 910], sacks: [300, 905] },
  collide: [
    [560, 760, 420, 150],
    [1300, 520, 460, 390],
  ],
  draw(g, ink, t) {
    wall(ink);
    floor(ink);
    oven(ink, t);
    sacks(ink);
    table(ink);
  },
};

function wall(ink) {
  const { C } = ink;
  ink.rect(-40, -40, 2280, FLOOR + 60, C.PLASTER, { lw: 0, seed: 1, mottle: [C.LINEN_D, 14, 120] });
  ink.bricks(-40, 640, 2280, FLOOR - 640, { bh: 26, bw: 64, seed: 2, density: 0.14 });
  ink.stain(420, 380, 240, 160, 3);
  ink.stain(1100, 200, 300, 140, 4, 'rgba(40,30,20,0.25)');
  ink.crack(240, 160, 180, 5);
  ink.crack(1960, 420, 140, 6, 2);
  ink.windowPane(980, 330, 180, 220, 7);
}

function floor(ink) {
  const { C } = ink;
  ink.rect(-40, FLOOR, 2280, 220, C.STONE_D, { lw: 0, seed: 8 });
  ink.inkLine([-40, FLOOR, 700, FLOOR + 4, 1500, FLOOR - 2, 2240, FLOOR + 3], { seed: 9, w: 8 });
  for (let i = 0; i < 9; i += 1) {
    const x = ink.time.rnd(0, 2200, 10, i);
    const y = ink.time.rnd(FLOOR + 30, 1060, 11, i);
    ink.blob(ink.ellipseRing(x, y, ink.time.rnd(40, 110, 12, i), 9, 8), C.LINEN, {
      lw: 0,
      seed: 12 + i,
    });
  }
}

function oven(ink, t) {
  const { C, time } = ink;
  // The brick hump with its arched mouth.
  ink.blob(
    [1300, FLOOR, 1300, 620, 1380, 520, 1530, 480, 1680, 520, 1760, 620, 1760, FLOOR],
    C.CLAY,
    {
      lw: 8,
      seed: 20,
      shade: [C.CLAY_D, -30, 0],
      hatch: { c: 'rgba(30,16,8,0.45)', n: 9, len: 50, gap: 9, k: 3, ang: 70 },
    },
  );
  ink.bricks(1310, 560, 440, 330, { bh: 24, bw: 52, seed: 21, density: 0.2, tone: C.RUST_D });
  ink.blob(
    [1420, 860, 1420, 740, 1460, 690, 1530, 676, 1600, 690, 1640, 740, 1640, 860],
    C.BLACK_D,
    { lw: 7, seed: 22 },
  );
  // Embers flicker in held steps (on twos, 0.25 s each).
  const beat = Math.floor(time.twos(t) / 0.25);
  for (let i = 0; i < 7; i += 1) {
    const x = time.rnd(1450, 1610, 23, i);
    const r = time.rnd(10, 26, 24, i, beat);
    ink.blob(ink.ellipseRing(x, 846, r, r * 0.6, 8), i % 2 ? C.FIRE : C.FIRE_D, {
      lw: 0,
      seed: 25 + i,
    });
  }
  // The peel leaning on the oven: a long handle and a flat blade.
  ink.beam(1250, 420, 1340, FLOOR, 12, 30, C.TIMBER);
  ink.blob([1220, 380, 1290, 370, 1296, 440, 1226, 452], C.TIMBER, { lw: 5, seed: 31 });
}

function sacks(ink) {
  const { C } = ink;
  [
    [150, 260, 32],
    [300, 280, 33],
    [230, 200, 34],
  ].forEach(([x, h, seed]) => {
    const pts = [
      x - 90,
      FLOOR,
      x - 100,
      FLOOR - h * 0.7,
      x - 50,
      FLOOR - h,
      x + 50,
      FLOOR - h,
      x + 100,
      FLOOR - h * 0.6,
      x + 90,
      FLOOR,
    ];
    ink.blob(pts, C.LINEN, { lw: 7, seed, shade: [C.LINEN_D, -20, 8], mottle: [C.EYE, 6, 18] });
    ink.brushStroke([x - 40, FLOOR - h + 10, x, FLOOR - h + 26, x + 40, FLOOR - h + 10], {
      w: 5,
      seed: seed + 10,
    });
  });
}

function table(ink) {
  const { C } = ink;
  ink.beam(600, 780, 610, FLOOR, 18, 40, C.TIMBER);
  ink.beam(940, 780, 930, FLOOR, 18, 41, C.TIMBER);
  ink.rect(560, 740, 420, 46, C.BROWN, { seed: 42, lw: 7, shade: [C.BROWN_D, 0, 10] });
  ink.blob(ink.ellipseRing(700, 734, 70, 16, 10), C.LINEN, {
    lw: 4,
    seed: 43,
    shade: [C.LINEN_D, 0, 4],
  });
  ink.brushStroke([820, 744, 900, 748], { w: 4, seed: 44 });
}
```
{{/place}}
Steps:
1. Design it from the narration before writing code. {{#person}}The person's job or role in THIS story, ONE exaggeration axis (a drooping face, a barrel chest, a tiny head on a huge coat, ...), one loud garment or prop detail, 4-6 muddy tones with their darker shades; four views (front, three-quarter, profile, back) that agree with each other; a face that can act (brows, eyes, mouth through `ink.brow`, `ink.eye`, `ink.mouth` with `face`). REQUIRED: exactly ONE `signatureGag: { kind, note }`, the person's one recurring tic: a gag kind from the contract's list that fits THIS person and the narration (nerves, boredom, impatience, effort), the note saying what it tells about them; scenes play it 1-2 times per shot on a narration beat, never as decoration; a person without it goes back to fix. When the narration has the person carry something from shot to shot, draw it from the shot's props `p` (`held`, `beforeHand`, with `arms(p)` for the hand shape) with a default for every prop; otherwise leave those out.{{/person}}{{#place}}The setting's few big shapes (walls, floor or ground, the one or two pieces the narration needs), its ONE warm light, grime as flat shapes (stains, cracks, peeling), anchors where people stand and things sit, collide boxes for solid furniture; bounds wider than the frame so no framing ever shows an edge. `draw(g, ink, t, opts)` reads the shot's place options `opts` with a default for each (`{}` when a shot names none); add a `foreground(g, ink, t, opts)` only when part of the place stands in front of the people (a counter's front, a door edge, smoke).{{/place}}
2. Write the module: `export const {{binding}} = { id: '{{id}}', name: '…', … }`: no imports, plain data plus the drawing functions, fixed seeds, a pure function of its inputs (time only through `ink.time`).
3. Self-QA, at most 2 rounds: `reelforge lint kit-ext/{{folder}}/{{id}}.js` until it reports 0 errors, then `reelforge {{folder}}-preview {{id}}` and Read the sheet it prints. Judge honestly: does it read as one specific, grimy {{noun}} of this narration, in the world's ink?{{#person}} Arms start at the shoulders (never out of the jowls), the head sits on the neck in every view, the face anchors lie on the head, `D.head` covers the drawn head in every view, `signatureGag` is set.{{/person}} Fix and run the second round, then stop: the step's own QA (lint, validators, contact sheet, critic) checks it afterwards.

Reply in ≤4 lines: what you built (the design in one line), the preview checks result, and what you could not get right (if anything).
