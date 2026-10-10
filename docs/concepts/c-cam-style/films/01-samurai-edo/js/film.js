/* The cut: order, durations and the narration lines ([from, to, text] in shot time). Hard cuts, like a TV show. */
'use strict';
(function () {
  window.ST.FILM = [
    { id: 'title', dur: 4.0, lines: [[0.3, 4.0, 'Would you survive as a samurai in peaceful Japan?']] },
    { id: 'wake', dur: 6.0, lines: [[0.3, 5.8, 'Japan, 1750. You wake up a samurai.']] },
    { id: 'dream', dur: 6.0, lines: [[0.1, 5.9, 'You expected battles. Glory. Dramatic sword fights.']] },
    { id: 'office', dur: 6.0, lines: [[0, 2.8, 'Instead, Japan has been at peace for generations.'], [2.8, 6.0, 'So most samurai worked as clerks and officials for their lord.']] },
    { id: 'street', dur: 6.0, lines: [[0.2, 5.9, 'You still carry two swords. Proudly. Mostly for show.']] },
    { id: 'rice', dur: 6.0, lines: [[0.2, 5.9, 'Your pay comes in rice. Not coins. Rice.']] },
    { id: 'market', dur: 6.0, lines: [[0.2, 5.9, 'But rice has to be sold, and prices keep changing.']] },
    { id: 'loan', dur: 7.0, lines: [[0.2, 6.9, 'So you borrow money from a merchant. Many samurai did.']] },
    { id: 'ledger', dur: 6.0, lines: [[0.1, 3.0, 'In theory, merchants rank below you.'], [3.0, 5.9, 'In practice, they hold your debts.']] },
    { id: 'wrongbow', dur: 5.0, lines: [[0.1, 4.9, 'Etiquette is strict. One wrong bow, and your whole day is ruined.']] },
    { id: 'payoff', dur: 4.0, lines: [[0.1, 4.0, 'Survival tip: be very polite to your rice merchant.']] },
  ];
})();
