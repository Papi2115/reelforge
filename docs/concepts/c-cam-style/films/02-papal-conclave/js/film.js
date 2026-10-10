/* The cut: order, durations and the narration lines ([from, to, text] in shot time). Hard cuts. Script + storyboard:
   ../script.txt, ../storyboard.md (the title card carries the first script line in the poster lettering). */
'use strict';
(function () {
  window.ST.FILM = [
    { id: 'title', dur: 4.0, lines: [] },
    { id: 'death', dur: 5.0, lines: [[0.2, 5.0, 'Viterbo, Italy. 1268. The pope has died.']] },
    { id: 'hall', dur: 6.0, lines: [[0.2, 6.0, 'Now the cardinals must choose a new one.']] },
    { id: 'years', dur: 7.0, lines: [[0, 3.4, 'They argue. For months. Then for years.'], [3.4, 7.0, 'Reports say it took nearly three years.']] },
    { id: 'patience', dur: 5.0, lines: [[0.2, 5.0, 'The townspeople lose patience.']] },
    { id: 'lock', dur: 5.0, lines: [[0, 5.0, 'First, they lock the cardinals inside.']] },
    { id: 'nopope', dur: 5.0, lines: [[0.3, 5.0, 'Still no pope.']] },
    { id: 'bread', dur: 6.0, lines: [[0, 6.0, 'So they cut the food. Bread and water.']] },
    { id: 'refuse', dur: 5.0, lines: [[0.3, 5.0, 'Still no pope.']] },
    { id: 'roof', dur: 6.0, lines: [[0, 6.0, 'Reports say they even removed the roof.']] },
    { id: 'choice', dur: 5.0, lines: [[0, 1.7, 'Finally, the cardinals chose Gregory the Tenth.'], [1.7, 3.4, 'Later, the rules were changed: electors would be locked in.'], [3.4, 5.0, 'The word is conclave. It means: with a key.']] },
    { id: 'payoff', dur: 4.0, lines: [[0.2, 4.0, 'Survival tip: when the locals take your roof, vote.']] },
  ];
})();
