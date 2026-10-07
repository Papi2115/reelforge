// focal: the big blue ballpoint "400" (right third) on a yellow highlighter sweep, red "AS MANY AS" hedging it | traces: an uneven loop round 400, a pencil "?" in the margin by the estimate, a coffee ring under the tallies
export const meta = {
  id: 's03_four_hundred',
  title: 'Dozens, then as many as 400',
  treatment: 'counter/odometer',
};

export function build(ctx) {
  const { kit, scene, anchor, sfx, shot, ease } = ctx;
  const page = kit.fx.sketchPage({
    size: [shot.width, shot.height],
    duration: shot.duration,
    stock: 'graph',
    page: 3,
    pageTool: 'bic',
    boilFps: 8,
    anchor,
    rest: 'off',
  });
  scene.add(page);

  const dozens = anchor('dozens');
  const joined = anchor('joined');
  const some = anchor('some estimates');
  const four = anchor('four hundred');

  // already on the page: a coffee ring, the source note, her (the first dancer)
  page.coffeeRing(470, 470, 46, { at: -9 });
  page.write('en.wikipedia.org', {
    x: 700,
    y: 500,
    size: 14,
    hand: 'scrawl',
    tool: 'pencil',
    rot: -2,
    at: -8,
  });
  const dance = (phase) => (t) => {
    const w = Math.sin(t * 7 + phase);
    return { armR: [110 + 30 * w, 100 - 40 * w], armL: [-110 + 30 * w, -100 - 40 * w] };
  };
  const smile = () => ({ mouth: 'smile' });
  page.figure({ x: 120, y: 470, h: 96, at: -6, pose: dance(0), expression: smile });
  page.write('?', { x: 900, y: 150, size: 34, hand: 'scrawl', tool: 'pencil', rot: 8, at: -3 });

  // "within days ... dozens": tally rows pile up, faster as they go
  const rows = [118, 182, 246];
  const groupsPerRow = [5, 5, 4];
  let k = 0;
  const total = 70;
  rows.forEach((y, r) => {
    for (let g = 0; g < groupsPerRow[r]; g++) {
      const gx = 80 + g * 64 + r * 6;
      for (let i = 0; i < 5; i++) {
        const at = 0.05 + 1.0 * ease.easeOutCubic(k / total);
        const pts =
          i < 4
            ? [gx + i * 10, y - 2 + (i % 2) * 3, gx + i * 10 + 2, y + 44]
            : [gx - 6, y + 34, gx + 40, y + 8];
        page.stroke(pts, { tool: 'bic', at, dur: 0.02 });
        k++;
      }
    }
  });
  // "joined her": a second little dancer beside her
  // (drawn on purpose without the hand, which goes on to the estimate)
  page.figure({
    x: 230,
    y: 472,
    h: 84,
    at: joined.t,
    pose: dance(1.7),
    expression: smile,
    parallel: true,
  });

  // still beat, then the one red hedge on "some estimates say as many as"
  const red = page.write('AS MANY AS', {
    x: 520,
    y: 150,
    size: 20,
    hand: 'print',
    tool: 'red',
    rot: -3,
    at: some.t,
  });

  // "four hundred": highlighter sweep, then the number drawn fast in heavy ballpoint strokes, then the loop
  page.stroke([505, 300, 640, 292, 780, 298, 860, 290], {
    tool: 'hi',
    at: four.t - 0.28,
    dur: 0.18,
  });
  const zero = (cx) => {
    const pts = [];
    for (let i = 0; i <= 14; i++) {
      const a = -Math.PI / 2 + (i / 14) * Math.PI * 2.08;
      pts.push(cx + 42 * Math.cos(a), 280 + 66 * Math.sin(a));
    }
    return pts;
  };
  const four1 = page.stroke([590, 212, 528, 310, 628, 306], { tool: 'bic', at: four.t, dur: 0.1 });
  const four2 = page.stroke([600, 250, 598, 350], { tool: 'bic', at: four1.end + 0.02, dur: 0.06 });
  const zero1 = page.stroke(zero(690), { tool: 'bic', at: four2.end + 0.03, dur: 0.12 });
  const num = page.stroke(zero(790), { tool: 'bic', at: zero1.end + 0.03, dur: 0.12 });
  page.loop(685, 285, 185, 98, { tool: 'bic', at: num.end + 0.1, dur: 0.25 });
  page.keepClear(510, 190, 360, 170);

  sfx.at(dozens.t, 'scribble');
  sfx.at(red.at, 'hit-soft');
  sfx.at(four1.at, 'scribble');
  return { page };
}

export function update(t, s) {
  s.page.update(t);
}
