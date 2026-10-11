/* The cut: order, durations and the narration lines ([from, to, text] in shot time). Hard cuts, like a TV show. */
'use strict';
(function () {
  window.ST.FILM = [
    { id: 'title', dur: 4.0, lines: [[0.3, 4.0, 'Would you survive as a Miami gangster in the 80s?']] },
    { id: 'tv', dur: 5.0, lines: [[0, 1.6, 'Miami, the mid-1980s.'], [1.6, 5.0, "On TV, it's pastel suits, speedboats and neon."]] },
    { id: 'hotel', dur: 5.0, lines: [[0, 2.6, 'Real life: a shabby South Beach hotel.'], [2.6, 5.0, 'Your neighbours are retirees.']] },
    { id: 'car', dur: 4.2, lines: [[0, 2.0, 'Your sports car is borrowed.'], [2.0, 4.2, "It doesn't start."]] },
    { id: 'bus', dur: 4.6, lines: [[0, 1.6, 'So you take the bus.'], [1.6, 4.6, 'In a white linen suit. In August.']] },
    { id: 'boss', dur: 5.0, lines: [[0, 5.0, 'Your boss yells for an hour about money you never even saw.']] },
    { id: 'freezer', dur: 5.2, lines: [[0, 2.4, 'Banks have to report big cash deposits.'], [2.4, 5.2, 'So the cash lives in a freezer.']] },
    { id: 'mitts', dur: 3.8, lines: [[0, 3.8, 'Your accountant counts it in oven mitts.']] },
    { id: 'watch', dur: 4.8, lines: [[0, 4.8, 'Since 1982, a federal task force has been hunting people like you.']] },
    { id: 'wire', dur: 5.4, lines: [[0, 2.0, 'So everyone suspects everyone.'], [2.0, 5.4, 'Your best friend is wearing a wire.']] },
    { id: 'boat', dur: 5.4, lines: [[0, 2.4, 'You try to escape by speedboat.'], [2.4, 5.4, 'It runs out of fuel.']] },
    { id: 'court', dur: 5.0, lines: [[0, 5.0, 'The glamour ends in a courtroom, under fluorescent lights.']] },
    { id: 'payoff', dur: 4.8, lines: [[0, 2.2, 'Survival tip: it never ends well.'], [2.2, 4.8, 'Get a boring job. Wear sunscreen.']] },
  ];
})();
