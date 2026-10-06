// The real film-2 shot s07 rewritten with the pop-up toolkit (the original, s07_popup_stage.js,
// needed a meaningless grey disc on a swinging arm to have a pull at all): STAGES and MUSICIANS
// stand up on their own words, then the ribbon raises the DANCED cut-out on "More people
// danced" and the red pen rings it.
export const meta = {
  id: 's07_popup_stage',
  title: 'Stages and musicians: more people danced',
  treatment: 'montage/transition',
};

export function build(ctx) {
  const { kit, scene, anchor, sfx, shot } = ctx;
  const stages = anchor('stages');
  const musicians = anchor('musicians');
  const more = anchor('More people danced');

  const page = kit.fx.sketchPage({
    size: [shot.width, shot.height],
    duration: shot.duration,
    stock: 'lined',
    page: 7,
    anchor,
    rest: 'off',
  });
  scene.add(page);

  const card = page.popup({
    intent: 'stages and musicians were added, and the pull raises more dancers: it made it worse',
    x: 380,
    y: 272,
    w: 412,
    depth: 196,
    at: 0,
    elements: [
      {
        kind: 'block',
        u: 118,
        w: 190,
        h: 80,
        depth: 30,
        band: 'BUILT',
        text: 'STAGES',
        at: stages.t,
      },
      { kind: 'cutout', u: 16, draw: 'figure', pose: 'cheer', text: 'MUSICIANS', at: musicians.t },
      { kind: 'cutout', id: 'more', u: 322, draw: 'figure', pose: 'cheer', text: 'DANCED' },
      { kind: 'tag', lines: ['more', 'people'] },
      { kind: 'note', text: 'publicdomainreview.org' },
    ],
    pull: {
      at: more.t,
      tab: 'ribbon',
      side: 'right',
      motions: [{ target: 'more', from: { rise: 0 }, to: { rise: 1 }, ease: 'back' }],
    },
  });

  sfx.at(card.at, 'paper');
  sfx.at(stages.t, 'hit-soft');
  sfx.at(musicians.t, 'pop');
  sfx.at(more.t, 'hit');
  return { page, card };
}

export function update(t, s) {
  s.page.update(t);
}
