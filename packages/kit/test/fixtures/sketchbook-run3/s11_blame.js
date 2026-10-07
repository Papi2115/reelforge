// focal: the accusing arrow and "ANARCHISTS", struck through in red on "auditor" | traces: a two-stroke accusing arrow, a pencil source note in the corner, a smudge under the bomb
export const meta = {
  id: 's11_blame',
  title: 'The company blames anarchists, the auditor disagrees',
  treatment: 'character-scene',
};

export function build(ctx) {
  const { kit, scene, anchor, sfx, shot } = ctx;
  const page = kit.fx.sketchPage({
    size: [shot.width, shot.height],
    duration: shot.duration,
    stock: 'cartridge',
    page: 11,
    layout: 'wide-strip',
    anchor,
  });
  scene.add(page);

  const blamed = anchor('blamed');
  const anarchists = anchor('anarchists');
  const court = anchor('court-appointed');
  const auditor = anchor('auditor');

  // ground and the suited company man, already on the page
  page.stroke(
    [
      [70, 472],
      [300, 468],
      [560, 474],
      [900, 470],
    ],
    { tool: 'felt', at: -3, dur: 0.5 },
  );
  const boss = page.figure({
    x: 170,
    y: 470,
    h: 210,
    at: -2.6,
    pose: [
      { at: 0, armR: [24, 12] },
      { at: blamed.t - 0.15, to: blamed.t + 0.1, armR: [92, 88] },
    ],
    expression: { mouth: 'flat' },
  });
  sfx.at(blamed.t, 'whoosh');
  page.stroke(
    [
      [0, 1.3],
      [0.35, 2.4],
      [0, 3.1],
      [-0.35, 2.4],
      [0, 1.3],
    ],
    { tool: 'felt', at: -2.1, dur: 0.15, attach: boss.head() },
  );

  // the auditor with a clipboard, right third, already there
  const aud = page.figure({
    x: 790,
    y: 470,
    h: 180,
    at: -1.8,
    pose: { armL: [40, 70] },
    expression: [
      { at: 0, mouth: 'flat' },
      { at: auditor.t, mouth: 'frown' },
    ],
  });
  page.stroke(
    [
      [-14, -6],
      [14, -6],
      [14, 26],
      [-14, 26],
      [-14, -6],
    ],
    { tool: 'fine', at: -1.2, dur: 0.15, attach: aud.joint('handL') },
  );
  page.smudge(500, 488, 44, 14, -8, { at: -1 });
  page.write('worldatlas.com', {
    x: 90,
    y: 506,
    size: 14,
    hand: 'print',
    tool: 'pencil',
    appear: 'bloom',
    at: 0.1,
  });

  // the scribbled anarchist, drawn as the company starts to blame; the bomb lands on "anarchists"
  const anarch = page.figure({
    x: 480,
    y: 470,
    h: 140,
    at: 0.05,
    hero: true,
    pose: { armR: [110, 100] },
    expression: { mouth: 'o' },
  });
  const bomb = page.loop(0, -14, 13, 12, {
    tool: 'felt',
    attach: anarch.joint('handR'),
    at: anarch.end,
  });
  page.stroke(
    [
      [4, -26],
      [10, -36],
      [6, -42],
    ],
    { tool: 'fine', dur: 0.08, attach: anarch.joint('handR'), at: bomb.end },
  );
  sfx.at(anarch.at, 'scribble');

  // the accusation: name and a two-stroke arrow from the pointing hand
  page.write('ANARCHISTS', {
    x: 360,
    y: 160,
    size: 36,
    hand: 'marker',
    appear: 'bloom',
    at: anarchists.t,
  });
  sfx.at(anarchists.t, 'pop');
  const arrow = page.arrow(
    [
      [250, 300],
      [340, 290],
      [440, 318],
    ],
    { tool: 'felt', at: anarchists.t + 0.4 },
  );

  page.write('AUDITOR', {
    x: 720,
    y: 220,
    size: 24,
    hand: 'scrawl',
    quick: true,
    appear: 'bloom',
    at: court.t,
  });

  // red strike through the accusation, after a still beat, on "auditor"
  const red = page.crossOut(344, 112, 240, 76, {
    style: 'x',
    tool: 'red',
    at: Math.max(auditor.t, arrow.end + 0.45),
  });
  sfx.at(red.at, 'hit');

  return { page };
}

export function update(t, s, ctx) {
  ctx.camera.pushIn({ dist: [10, 9.4], target: [0, 0, 0], direction: [0, 0, 1] })(t);
  s.page.update(t);
}
