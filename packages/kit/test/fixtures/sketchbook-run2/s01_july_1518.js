/* eslint-disable @typescript-eslint/no-unused-vars -- verbatim scene of real film 2 (docs/real-run-sketchbook-2.md) */
// focal: the huge crooked marker "1518" (left two thirds), red inserts "14" before the loose pencil JULY | traces: a marker smudge dragged through 1518, a red caret insert above a pencil word, a pencil source note in the margin
export const meta = {
  id: 's01_july_1518',
  title: 'July 1518: a woman starts to dance',
  treatment: 'title-card',
};

export function build(ctx) {
  const { kit, scene, anchor, sfx, shot, ease } = ctx;
  const page = kit.fx.sketchPage({
    size: [shot.width, shot.height],
    duration: shot.duration,
    stock: 'lined',
    page: 1,
    anchor,
    rest: 'off',
  });
  scene.add(page);

  const year = anchor('1518');
  const stepped = anchor('stepped');
  const town = anchor('Strasbourg');
  const dance = anchor('dance');

  // already on the page: the loose pencil JULY, the drawn street on the right, the source note
  page.write('JULY', { x: 150, y: 150, size: 34, hand: 'scrawl', tool: 'pencil', rot: -4, at: -3 });
  const ground = page.stroke([560, 452, 680, 448, 800, 455, 905, 450], {
    tool: 'fine',
    at: -2.4,
    dur: 0.15,
  });
  const house1 = page.stroke([590, 450, 592, 340, 640, 296, 688, 338, 686, 449], {
    tool: 'fine',
    at: ground.end + 0.05,
    dur: 0.14,
  });
  page.stroke([830, 452, 828, 318, 868, 286, 902, 320], {
    tool: 'fine',
    at: house1.end + 0.05,
    dur: 0.12,
  });
  page.write('en.wikipedia.org', {
    x: 640,
    y: 96,
    size: 14,
    hand: 'scrawl',
    tool: 'pencil',
    rot: -2,
    at: -1,
  });

  // the one loud number, fast and crooked, smudged where the hand dragged
  const num = page.write('1518', {
    x: 96,
    y: 395,
    size: 170,
    hand: 'marker',
    tool: 'marker',
    nib: [19, -42, 3],
    rot: -3,
    at: Math.max(0.05, year.t - 0.7),
  });
  page.smudge(380, 365, 70, 22, -14, { at: num.end });

  // still beat, then the red caret and "14" inserted before JULY
  const red = num.end + 0.5;
  const caret = page.stroke([132, 168, 142, 150, 152, 170], { tool: 'red', at: red, dur: 0.08 });
  page.write('14', {
    x: 104,
    y: 124,
    size: 38,
    hand: 'print',
    tool: 'red',
    rot: -6,
    at: caret.end + 0.02,
  });

  // "stepped": she is drawn into the street, then dances on "dance"
  const pose = (t) => {
    const k = ease.smoothstep(Math.min(1, Math.max(0, (t - dance.t) / 0.3)));
    const w = Math.sin((t - dance.t) * 7.5);
    return {
      armR: [30 + k * (95 + 30 * w), 15 + k * (110 - 40 * w)],
      armL: [-30 - k * (95 - 30 * w), -15 - k * (110 + 40 * w)],
    };
  };
  const woman = page.figure({
    x: 745,
    y: 452,
    h: 150,
    at: Math.max(stepped.t, page.doneAt() + 0.05),
    pose,
    expression: (t) => ({ mouth: t < dance.t ? 'flat' : 'smile' }),
  });

  // "Strasbourg": a felt label under the street
  page.write('STRASBOURG', {
    x: 590,
    y: 506,
    size: 22,
    hand: 'marker',
    tool: 'felt',
    rot: -2,
    at: town.t,
    parallel: true,
  });
  page.keepClear(690, 280, 110, 180);

  sfx.at(num.at, 'scribble');
  sfx.at(red, 'hit-soft');
  sfx.at(stepped.t, 'scribble');
  sfx.at(dance.t, 'pop');
  return { page };
}

export function update(t, s) {
  s.page.update(t);
}
