// focal: the little St Vitus shrine at the end of the dotted road, upper right, dancers marching toward it | traces: the musician crossed out in red, a two-stroke dimension arrow under the road, a pencil doubt "SAVERNE?" by the shrine, angled tape
export const meta = {
  id: 's08_shrine',
  title: "Music banned, dancers sent to St Vitus's shrine",
  treatment: 'character-scene',
};

export function build(ctx) {
  const { kit, scene, anchor, sfx, shot } = ctx;
  const music = anchor('banned music');
  const dancers = anchor('dancers');
  const saint = anchor("Saint Vitus's");
  const thirty = anchor('thirty miles');

  const page = kit.fx.sketchPage({
    size: [shot.width, shot.height],
    duration: shot.duration,
    stock: 'cartridge',
    page: 8,
    anchor,
    rest: 'off',
  });
  scene.add(page);

  // already on the page: the drummer from the last page, a tape strip
  page.tape(88, 70, 70, 20, -14, { at: -9 });
  page.figure({
    x: 125,
    y: 420,
    h: 150,
    at: -8,
    parallel: true,
    pose: { armR: [70, 40], armL: [-70, -40] },
    expression: { mouth: 'smile' },
  });
  page.loop(125, 352, 26, 16, { at: -7, dur: 0.1, parallel: true });

  // still beat, then the red pen bans the music
  const ban = page.crossOut(70, 255, 115, 175, {
    style: 'x',
    tool: 'red',
    at: Math.max(music.t + 0.05, 0.45),
  });

  // the dotted road, drawn from the drummer toward the right
  const road = [
    [230, 425],
    [330, 418],
    [430, 400],
    [530, 380],
    [620, 356],
    [700, 338],
    [760, 330],
  ];
  let at = ban.end + 0.1;
  for (let i = 0; i < road.length - 1; i++) {
    const [x0, y0] = road[i],
      [x1, y1] = road[i + 1];
    const seg = page.stroke(
      [
        [x0, y0],
        [x0 + (x1 - x0) * 0.45, y0 + (y1 - y0) * 0.45],
      ],
      { at, dur: 0.03 },
    );
    const seg2 = page.stroke(
      [
        [x0 + (x1 - x0) * 0.6, y0 + (y1 - y0) * 0.6],
        [x1 - (x1 - x0) * 0.05, y1 - (y1 - y0) * 0.05],
      ],
      { at: seg.end + 0.01, dur: 0.03 },
    );
    at = seg2.end + 0.015;
  }

  // "dancers": two stick dancers march along the road
  const march = (phase) => (t) => {
    const w = Math.sin(t * 7 + phase);
    return {
      armR: [40 + 35 * w, 20],
      armL: [-40 + 35 * w, -20],
      legL: [-10 - 18 * w, 0],
      legR: [10 - 18 * w, 0],
    };
  };
  const d1 = page.figure({
    x: 360,
    y: 412,
    h: 145,
    at: Math.max(dancers.t, at),
    parallel: true,
    pose: march(0),
    expression: { mouth: 'flat' },
  });
  page.figure({
    x: 505,
    y: 380,
    h: 138,
    at: d1.at + 0.15,
    parallel: true,
    pose: march(1.9),
    expression: [
      { at: 0, mouth: 'flat' },
      { at: saint.t, mouth: 'o' },
    ],
  });

  // the shrine is already on the page (the destination, upper right), with a pencil doubt beside it
  page.stroke(
    [
      [760, 330],
      [760, 245],
      [860, 245],
      [860, 330],
    ],
    { at: -6, dur: 0.12, corners: [1, 2], parallel: true },
  );
  page.stroke(
    [
      [748, 250],
      [810, 192],
      [872, 250],
    ],
    { at: -5.8, dur: 0.08, corners: [1], parallel: true },
  );
  page.stroke(
    [
      [810, 192],
      [810, 150],
    ],
    { at: -5.6, dur: 0.04, parallel: true },
  );
  page.stroke(
    [
      [796, 166],
      [824, 164],
    ],
    { at: -5.5, dur: 0.03, parallel: true },
  );
  page.write('SAVERNE?', {
    x: 742,
    y: 360,
    size: 18,
    hand: 'scrawl',
    tool: 'pencil',
    at: -5,
    parallel: true,
  });
  page.keepClear(740, 140, 140, 200);

  // "Saint Vitus's shrine": the hand names it and shades it in
  const s0 = Math.max(saint.t, at);
  const name = page.write('ST VITUS', { x: 690, y: 128, size: 24, hand: 'marker', at: s0 });
  page.fill(
    [
      [768, 250],
      [852, 250],
      [856, 325],
      [764, 325],
    ],
    { color: 'graphite', at: name.end + 0.05, dur: 0.15 },
  );

  // "thirty miles": a two-stroke dimension arrow under the road, the hand writes the distance
  const dim = page.arrow(
    [
      [240, 462],
      [500, 450],
      [750, 410],
    ],
    { at: thirty.t, parallel: true },
  );
  const miles = page.write('30 MILES', { x: 430, y: 495, size: 24, hand: 'print', at: thirty.t });

  sfx.at(ban.at, 'hit-soft');
  sfx.at(d1.at, 'scribble');
  sfx.at(s0, 'paper');
  sfx.at(dim.at, 'whoosh');
  return { page, dim, miles };
}

export function update(t, s) {
  s.page.update(t);
}
