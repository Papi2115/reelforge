/* The cut: order, durations and the narration lines ([from, to, text] in shot time). Hard cuts, like a TV show. */
'use strict';
(function () {
  window.ST.FILM = [
    { id: 'title', dur: 4.0, lines: [[0.3, 4.0, 'Would you survive landing on the Moon?']] },
    { id: 'pad', dur: 5.0, lines: [[0.2, 5.0, '1969. You are an astronaut.']] },
    { id: 'lander', dur: 6.0, lines: [[0, 3.0, 'Your lander is famously light.'], [3.0, 6.0, 'Its walls are famously thin.']] },
    { id: 'computer', dur: 5.0, lines: [[0, 5.0, 'Your computer is far weaker than a modern phone.']] },
    { id: 'descent', dur: 6.0, lines: [[0.2, 6.0, 'During the descent, an alarm starts blaring.']] },
    { id: 'alarm', dur: 5.0, lines: [[0, 2.4, 'It is called a 1202 alarm.'], [2.4, 5.0, 'Nobody has seen it in training.']] },
    { id: 'control', dur: 5.0, lines: [[0, 5.0, 'Mission control says: keep going.']] },
    { id: 'window', dur: 6.0, lines: [[0, 3.0, 'Then you spot the landing area.'], [3.0, 6.0, 'It is full of boulders.']] },
    { id: 'manual', dur: 6.0, lines: [[0, 6.0, 'So the commander flies the last part by hand.']] },
    { id: 'fuel', dur: 4.0, lines: [[0, 4.0, 'Reports say fuel is dangerously low.']] },
    { id: 'land', dur: 4.0, lines: [[0.3, 4.0, 'You land.']] },
    { id: 'orbit', dur: 4.0, lines: [[0, 2.2, 'One crew member stays in orbit alone, the whole time.'], [2.2, 4.0, 'Then you step outside, and come home safely.']] },
    { id: 'payoff', dur: 3.0, lines: [[0, 1.4, 'Survival tip: stay calm.'], [1.4, 3.0, 'And trust the person flying.']] },
  ];
})();
