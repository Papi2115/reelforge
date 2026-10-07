/* eslint-disable @typescript-eslint/no-unused-vars -- verbatim scene of real film 2 (docs/real-run-sketchbook-2.md) */
// focal: the three taped scraps (bowl, sick figure, frightened saint) gathered by one felt bracket, right two thirds | traces: "WHY?" crossed out with its red fix "BEST GUESS", a pencil hatch spilling off the sick man's blanket, angled tape on the scraps
export const meta = {
  id: 's11_best_guess',
  title: 'The best guess: famine, disease, fear',
  treatment: 'metaphor-object',
};

export function build(ctx) {
  const { kit, scene, anchor, sfx, shot } = ctx;
  const best = anchor('best guess');
  const famine = anchor('Famine');
  const disease = anchor('disease');
  const fear = anchor('fear');

  const page = kit.fx.sketchPage({
    size: [shot.width, shot.height],
    duration: shot.duration,
    stock: 'cartridge',
    page: 11,
    anchor,
    rest: 'off',
  });
  scene.add(page);

  // already on the page: the open question carried over from "So why?"
  page.write('WHY?', { x: 92, y: 150, size: 40, hand: 'scrawl', tool: 'felt', rot: -4, at: -6 });
  page.coffeeRing(210, 420, 48, { at: -8 });

  // still beat, then the red fix: strike WHY?, write the answer under it
  const strike = page.crossOut(84, 104, 140, 54, {
    style: 'strike',
    tool: 'red',
    at: Math.max(best.t, 0.4),
  });
  const guess = page.write('BEST GUESS', {
    x: 96,
    y: 228,
    size: 24,
    hand: 'print',
    tool: 'red',
    rot: -3,
    at: strike.end + 0.03,
    parallel: true,
  });

  // "Famine": an empty bowl on a slapped-on scrap
  page.sheet({ x: 440, y: 62, w: 190, h: 138, deg: -5, at: famine.t - 0.05 });
  page.tape(452, 70, 46, 18, -30, { at: famine.t - 0.05 });
  const bowl = page.stroke(
    [
      [470, 120],
      [480, 158],
      [530, 176],
      [578, 160],
      [590, 118],
    ],
    { tool: 'felt', at: famine.t, dur: 0.1 },
  );
  page.stroke(
    [
      [464, 120],
      [530, 112],
      [596, 118],
    ],
    { tool: 'felt', at: bowl.end + 0.02, dur: 0.06 },
  );

  // "disease": a sick stick figure in bed, fever wiggles over the head, hatch spilling off the blanket
  page.sheet({ x: 676, y: 150, w: 190, h: 220, deg: 4, at: disease.t - 0.05 });
  const bed = page.stroke(
    [
      [700, 336],
      [702, 290],
      [701, 306],
      [846, 310],
      [847, 338],
    ],
    { tool: 'felt', at: disease.t, dur: 0.08, corners: [1, 2, 3] },
  );
  const head = page.loop(726, 284, 16, 15, { tool: 'felt', at: bed.end + 0.02, dur: 0.05 });
  const blanket = page.stroke(
    [
      [744, 304],
      [764, 274],
      [804, 266],
      [836, 282],
      [846, 308],
    ],
    { tool: 'felt', at: head.end + 0.02, dur: 0.07 },
  );
  const w1 = page.stroke(
    [
      [716, 250],
      [724, 242],
      [716, 234],
      [724, 226],
    ],
    { tool: 'felt', at: blanket.end + 0.02, dur: 0.04 },
  );
  page.stroke(
    [
      [736, 252],
      [744, 244],
      [736, 236],
      [744, 228],
    ],
    { tool: 'felt', at: w1.end + 0.02, dur: 0.04 },
  );
  page.fill(
    [
      [750, 300],
      [768, 276],
      [806, 268],
      [834, 284],
      [840, 304],
    ],
    { color: 'graphite', at: page.doneAt() + 0.02, dur: 0.12 },
  );
  page.keepClear(676, 150, 200, 230);

  // "fear": a saint's face with a halo, wide eyes and an O mouth, on the third scrap
  page.sheet({ x: 452, y: 278, w: 170, h: 170, deg: -3, at: fear.t - 0.05 });
  page.tape(600, 284, 40, 18, 24, { at: fear.t - 0.05 });
  const halo = page.loop(536, 318, 46, 12, {
    tool: 'felt',
    at: Math.max(fear.t, page.doneAt() + 0.02),
    dur: 0.07,
  });
  const face = page.loop(536, 376, 40, 46, { tool: 'felt', at: halo.end + 0.02, dur: 0.08 });
  const eyeL = page.loop(520, 366, 7, 9, { tool: 'felt', at: face.end + 0.02, dur: 0.03 });
  const eyeR = page.loop(552, 364, 7, 9, { tool: 'felt', at: eyeL.end + 0.02, dur: 0.03 });
  const mouth = page.loop(537, 400, 8, 10, { tool: 'felt', at: eyeR.end + 0.02, dur: 0.03 });

  // one bracket gathering the three scraps, its tip toward the answer
  const bracket = page.stroke(
    [
      [420, 70],
      [402, 82],
      [400, 240],
      [380, 258],
      [400, 276],
      [402, 434],
      [422, 448],
    ],
    { tool: 'felt', at: mouth.end + 0.05, dur: 0.2, corners: [3] },
  );

  sfx.at(strike.at, 'scribble');
  sfx.at(famine.t, 'paper-slide');
  sfx.at(disease.t, 'paper-slide');
  sfx.at(fear.t, 'paper-slide');
  sfx.at(bracket.at, 'scribble');
  return { page };
}

export function update(t, s) {
  s.page.update(t);
}
