// focal: four tally strokes on the taped calendar, looped in red, beside the lone boot | traces: a pencil margin note "one victim" with a two-stroke arrow to the boot, angled tape on the calendar, a smudge by the puddle
export const meta = {
  id: 's09_four_months',
  title: 'One victim not found for four months',
  treatment: 'character-scene',
};

export function build(ctx) {
  const { kit, scene, anchor, sfx, shot } = ctx;
  const page = kit.fx.sketchPage({
    size: [shot.width, shot.height],
    duration: shot.duration,
    stock: 'cartridge',
    page: 9,
    layout: 'hero-left',
    anchor,
  });
  scene.add(page);

  const four = anchor('four');
  const months = anchor('months');

  // the brown puddle and the boot sticking out of it, sole up, already on the page
  page.stroke(
    [
      [90, 420],
      [150, 382],
      [260, 372],
      [380, 386],
      [440, 418],
      [380, 454],
      [220, 462],
      [110, 448],
      [90, 420],
    ],
    { tool: 'felt', at: -3, dur: 0.5 },
  );
  page.fill(
    [
      [96, 420],
      [160, 386],
      [380, 390],
      [436, 420],
      [370, 450],
      [120, 446],
    ],
    { color: 'coffee', at: -2.5, dur: 0.5 },
  );
  page.stroke(
    [
      [232, 400],
      [238, 300],
      [246, 232],
    ],
    { tool: 'felt', at: -2, dur: 0.25 },
  );
  page.stroke(
    [
      [304, 402],
      [302, 330],
      [306, 276],
    ],
    { tool: 'felt', at: -1.8, dur: 0.25 },
  );
  page.stroke(
    [
      [246, 232],
      [254, 196],
      [372, 182],
      [392, 206],
      [384, 230],
      [306, 276],
    ],
    { tool: 'felt', at: -1.6, dur: 0.4, corners: [1, 2, 3, 4] },
  );
  page.stroke(
    [
      [252, 190],
      [270, 172],
      [292, 170],
      [298, 188],
    ],
    { tool: 'felt', at: -1.3, dur: 0.15, corners: [1, 2] },
  );
  page.stroke(
    [
      [300, 186],
      [314, 176],
      [328, 186],
      [342, 174],
      [356, 184],
      [370, 176],
    ],
    { tool: 'fine', at: -1.15, dur: 0.15 },
  );
  page.stroke(
    [
      [284, 290],
      [304, 304],
      [282, 318],
      [302, 334],
      [280, 350],
      [300, 364],
    ],
    { tool: 'fine', at: -1.05, dur: 0.2 },
  );
  page.keepClear(80, 170, 370, 300);
  page.smudge(470, 450, 46, 16, -10, { at: -1 });

  // the calendar page, taped in beside it
  const cal = page.sheet({ x: 580, y: 90, w: 290, h: 320, deg: 3, at: -0.9 });
  cal.rule();
  page.tape(820, 84, 70, 20, 22, { at: -0.8 });
  page.write('JAN 1919', {
    x: 610,
    y: 140,
    size: 22,
    hand: 'print',
    tool: 'fine',
    appear: 'bloom',
    at: -0.7,
  });

  // pencil margin note with a two-stroke arrow to the boot
  page.write('one victim', {
    x: 100,
    y: 110,
    size: 26,
    hand: 'scrawl',
    tool: 'pencil',
    appear: 'bloom',
    at: anchor('victim').t,
  });
  page.arrow(
    [
      [190, 126],
      [220, 150],
      [244, 186],
    ],
    { tool: 'pencil', at: 0.4 },
  );

  // four tally strokes, one per month, on "four"
  let tally = null;
  [650, 682, 712, 744].forEach((x, i) => {
    const s = page.stroke(
      [
        [x, 196 + (i % 2) * 4],
        [x + 4 + (i % 3), 290 - (i % 2) * 6],
      ],
      { tool: 'felt', at: four.t + i * 0.11, dur: 0.08, hero: true },
    );
    tally = tally || s;
    if (i === 3) tally = { at: tally.at, end: s.end };
  });
  sfx.at(tally.at, 'scribble');
  page.write('4 MONTHS', {
    x: 620,
    y: 350,
    size: 34,
    hand: 'marker',
    appear: 'bloom',
    at: months.t,
  });
  sfx.at(months.t, 'tick');
  page.write('boston.com', {
    x: 780,
    y: 490,
    size: 14,
    hand: 'print',
    tool: 'pencil',
    appear: 'bloom',
    at: 0.2,
  });

  // the one red mark, after a still beat
  const red = page.loop(698, 244, 78, 66, { tool: 'red', at: tally.end + 0.45 });
  sfx.at(red.at, 'pop');

  return { page };
}

export function update(t, s, ctx) {
  ctx.camera.pushIn({ dist: [10, 9], target: [0, 0, 0], direction: [0, 0, 1] })(t);
  s.page.update(t);
}
