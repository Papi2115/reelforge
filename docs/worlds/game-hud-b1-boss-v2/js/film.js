/* B1 v2 film: 10 shots on one timeline, narration (dev captions), and the global facts the HUD reads.
   Transitions live at shot boundaries: the tail of shot N and the head of N+1 draw the same transition clock.
   film.draw[i]  = what the player calls for shot i (index = shot number - 1).
   film.scene[i] = raw scene content for the two new shots (3 = high-score table, 7 = manual); trans.js wraps them
                   with their seams, so the scene files never draw transitions themselves. */
'use strict';
(function () {
  const shots = [
    { title: 'Hook · the burial', role: 'hook', dur: 6.5, lines: [[0.3, '1983. New Mexico. Atari is burying its games.'], [3.5, 'How do you lose a fight that badly?']] },
    { title: 'A · Christmas 1982', role: 'A', dur: 8.0, lines: [[1.2, 'Christmas 1982. Atari rules the living room.'], [4.1, "Its big gift: a game of E.T. And it doesn't exist yet."]] },
    { title: 'C · Boss 1: the deadline', role: 'C', dur: 8.5, lines: [[1.0, 'Boss one: the deadline.'], [2.5, 'About five weeks to build the whole game.'], [5.6, "Its weak point: more time. There wasn't any."]] },
    { title: 'Attract · high scores', role: 'attract', dur: 7.5, lines: [[0.6, 'Game over. Back to attract mode.'], [2.7, '1982 was a boom year for home games.'], [5.2, 'Insert coin. Everyone wanted in.']] },
    { title: 'B · Market inventory', role: 'B', dur: 7.5, lines: [[1.4, 'E.T. made Christmas. So did everyone else.'], [4.3, 'By 1983: consoles everywhere, and games from almost anyone.']] },
    { title: 'C · Boss 2: the flood', role: 'C', dur: 8.0, lines: [[0.5, 'Boss two: the flood.'], [2.3, "Too many games, too many copies. Buyers couldn't tell good from bad."], [5.1, 'Its weak point: quality control. Nobody was enforcing it.']] },
    { title: 'B · The returns counter', role: 'B', dur: 7.0, lines: [[1.4, 'So the games came back.'], [3.9, 'Unsold and returned cartridges piled up.']] },
    { title: 'Manual · how to flood a market', role: 'manual', dur: 8.5, lines: [[0.3, 'How to play: flood a market.'], [2.0, 'A hit sells. Everyone copies it.'], [3.8, "Shelves fill. Buyers can't tell good from bad."], [5.75, 'So they stop buying. Any of it.']] },
    { title: 'A→C · Boss 3: the landfill', role: 'A→C', dur: 9.0, lines: [[1.0, 'Alamogordo, New Mexico. The cartridges go into the city landfill.'], [3.9, 'A game famous for its pits, buried in one.'], [5.9, 'Boss three: the landfill. Its weak point: it keeps everything.']] },
    { title: 'Payoff · continue?', role: 'payoff', dur: 9.0, lines: [[0.5, 'Game over? Not quite.'], [2.9, '1985: the NES brings home games back, with strict quality control.'], [5.0, '2014: a film crew digs up the landfill.'], [7.3, 'The cartridges were still there.']] },
  ];
  let acc = 0;
  shots.forEach((s) => { s.start = acc; acc += s.dur; });
  const total = acc;
  // Named shot indices, so cross-shot references survive reordering.
  const S = { hook: 0, xmas: 1, deadline: 2, scores: 3, market: 4, flood: 5, returns: 6, manual: 7, landfill: 8, payoff: 9 };
  // Year shown by the HUD (global seconds). Each change leaves a burn-in ghost of the old year.
  const years = [[0.5, 1983], [5.85, 1982], [shots[S.market].start + 1.5, 1983], [shots[S.payoff].start + 3.0, 1985], [shots[S.payoff].start + 4.75, 2014]];
  // The HUD year steps aside (dissolves out at [0], back in at [1]) while the picture shows the same year right
  // under it: the 4->5 pull-back shrinks the score table (gold 1982) into the family TV under the HUD year; it
  // returns when the cartridge clicks in and the TV drops the score table (shot 5 t 0.7).
  const yearAside = [[shots[S.scores].start + 6.9, shots[S.market].start + 0.7]];
  function shotAt(gt) {
    for (let i = shots.length - 1; i >= 0; i--) if (gt >= shots[i].start - 1e-6) return i;
    return 0;
  }
  B1.film = { shots, total, years, yearAside, shotAt, S, draw: [], scene: [] };
})();
