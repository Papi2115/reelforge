/* B1 film: shot list, narration (dev captions), and the global facts the HUD reads.
   Transitions live at shot boundaries: the tail of shot N and the head of N+1 draw the same transition clock. */
'use strict';
(function () {
  const shots = [
    { title: 'Hook · the burial', role: 'hook', dur: 6.5, lines: [[0.3, '1983. New Mexico. Atari is burying its games.'], [3.5, 'How do you lose a fight that badly?']] },
    { title: 'A · Christmas 1982', role: 'A', dur: 8.0, lines: [[1.2, 'Christmas 1982. Atari rules the living room.'], [4.1, "Its big gift: a game of E.T. And it doesn't exist yet."]] },
    { title: 'C · Boss 1: the deadline', role: 'C', dur: 8.5, lines: [[1.0, 'Boss one: the deadline.'], [2.5, 'About five weeks to build the whole game.'], [5.6, "Its weak point: more time. There wasn't any."]] },
    { title: 'B · Market inventory', role: 'B', dur: 7.5, lines: [[1.4, 'It made Christmas. So did everyone else.'], [4.3, 'By 1983: consoles everywhere, and games from almost anyone.']] },
    { title: 'C · Boss 2: the flood', role: 'C', dur: 8.0, lines: [[0.5, 'Boss two: the flood.'], [2.3, "Too many games, too many copies. Buyers couldn't tell good from bad."], [5.1, 'Its weak point: quality control. Nobody was enforcing it.']] },
    { title: 'B · The returns counter', role: 'B', dur: 7.0, lines: [[1.4, 'So the games came back.'], [3.9, 'Unsold and returned cartridges piled up.']] },
    { title: 'A→C · Boss 3: the landfill', role: 'A→C', dur: 9.0, lines: [[1.0, 'Alamogordo, New Mexico. The cartridges go into the city landfill.'], [3.9, 'A game famous for its pits, buried in one.'], [5.9, 'Boss three: the landfill. Its weak point: it keeps everything.']] },
    { title: 'Payoff · continue?', role: 'payoff', dur: 9.0, lines: [[0.5, 'Game over? Not quite.'], [2.9, '1985: the NES brings home games back, with strict quality control.'], [5.0, '2014: a film crew digs up the landfill.'], [7.3, 'The cartridges were still there.']] },
  ];
  let acc = 0;
  shots.forEach((s) => { s.start = acc; acc += s.dur; });
  const total = acc;
  // Year shown by the HUD (global seconds). Each change leaves a burn-in ghost of the old year.
  const years = [[0.5, 1983], [5.85, 1982], [shots[3].start + 1.5, 1983], [shots[7].start + 3.0, 1985], [shots[7].start + 4.75, 2014]];
  function shotAt(gt) {
    for (let i = shots.length - 1; i >= 0; i--) if (gt >= shots[i].start - 1e-6) return i;
    return 0;
  }
  B1.film = { shots, total, years, shotAt, draw: [] };
})();
