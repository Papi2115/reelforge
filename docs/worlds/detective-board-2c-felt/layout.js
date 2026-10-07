/* detective-board 2c "felt" - the ONE persistent canvas. World units: 1 unit = 1 typewriter font pixel.
 * The whole tapestry spans roughly 2400 x 1350 units; every item keeps its place for the whole film. */
(function () {
  'use strict';
  const F = window.FELT;
  // Shot table: global start times. One continuous timeline; "play shot" plays a slice of it.
  F.SHOTS = [
    { title: 'hook', start: 0, dur: 6,
      narration: 'The man on Flight 305 bought his ticket as Dan Cooper.',
      note: 'macro: one red stitch under the typed name, pulled tight. The whole board starts from this knot.' },
    { title: 'A - the passenger', start: 6, dur: 8,
      narration: 'November 24, 1971. A man in a dark suit, Portland to Seattle.',
      note: 'zoom out from the stitch to the cluster; the thread runs on to the dark-suit silhouette.' },
    { title: 'A - the demand', start: 14, dur: 9,
      narration: 'His briefcase held a bomb, he said. He wanted $200,000 and four parachutes.',
      note: 'the camera rides the thread to the briefcase, then the sum is cross-stitched in red.' },
    { title: 'B - the route', start: 23, dur: 8.5,
      narration: 'In Seattle the passengers walked off. Refuelled, the 727 turned south.',
      note: 'felt map; the button-magnifier slides down the new route and finds the jet.' },
    { title: 'B - the jump', start: 31.5, dur: 8,
      narration: 'Somewhere over the Pacific Northwest he jumped from the rear stairs. Did he live? Did he die?',
      note: 'stair drops, a knot marks the spot, then the theories fan out in every direction.' },
    { title: 'C - the suspects', start: 39.5, dur: 8.5,
      narration: 'Suspect after suspect. Every thread came loose.',
      note: 'tug: the linen puckers, the knot gives, the stitch is unpicked; needle holes stay.' },
    { title: 'turn - 1980', start: 48, dur: 8,
      narration: 'In 1980 a boy on a Columbia River bank found $5,800 of the ransom.',
      note: 'quiet: the slowest thread of the film, one knot on the buried notes, a long hold.' },
    { title: 'payoff - 2016', start: 56, dur: 9,
      narration: 'In 2016 the FBI suspended the case. He was never identified. We still call him D. B. Cooper.',
      note: 'last knot, the needle is parked in the linen, and the camera pulls back to the whole tapestry.' },
  ];
  F.TOTAL = 65;

  // Item placements (x, y = centre in world units, rot in radians, scale).
  F.L = {
    heading: { x: 136, y: 118 },
    ticket: { x: 452, y: 648, rot: -0.035 },
    man: { x: 676, y: 566, rot: 0.03 },
    plane: { x: 420, y: 520, rot: -0.05, scale: 0.9 },
    y1971: { x: 296, y: 548 },
    briefcase: { x: 985, y: 470, rot: 0.045 },
    cash: { x: 1122, y: 414, rot: -0.06 },
    sum: { x: 1064, y: 470 },
    chutes: [
      { x: 1240, y: 410, rot: -0.08, land: 20.25 },
      { x: 1282, y: 446, rot: 0.06, land: 20.47 },
      { x: 1318, y: 404, rot: 0.02, land: 20.86 },
      { x: 1360, y: 440, rot: -0.12, land: 21.02 },
    ],
    map: { x: 1690, y: 520, rot: 0.025 },
    lens: { x: 1545, y: 420 },
    liveScrap: { x: 1968, y: 772, rot: 0.06 },
    dieScrap: { x: 1440, y: 742, rot: -0.05 },
    suspects: [
      { x: 850, y: 902, rot: -0.07, col: 'RUST', kind: 'hat', scale: 1.04 },
      { x: 976, y: 950, rot: 0.04, col: 'TEAL', kind: 'round', scale: 0.92 },
      { x: 1120, y: 872, rot: -0.025, col: 'STEEL', kind: 'part', scale: 1 },
    ],
    river: { x: 1480, y: 1122, rot: -0.03 },
    y1980: { x: 1282, y: 958 },
    sum2: { x: 1526, y: 1000 },
    tag: { x: 2010, y: 884, rot: -0.045 },
    park: { x: 2096, y: 968 },
  };

  // Map projection (local map units): lon/lat -> map-local u, v (centre near 46.6N 122.5W).
  F.geo = (lon, lat) => [(lon + 122.5) * 55.2, -(lat - 46.6) * 80];
})();
