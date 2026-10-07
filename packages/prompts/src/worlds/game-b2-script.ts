/**
 * "Explained as a game" (PLAN.md#13.15, Papi's verdict in docs/beta-feedback.md): a Game B2 film is
 * "how <a topic> works", told as one first-person game run, so the narration is WRITTEN for the
 * game (levels as chapters, stats for the key quantities, bosses for the misconceptions, power-ups
 * for the insights) instead of a plain explainer drawn as a game afterwards. The script prompt gets
 * the framing and a `## Game map` in `beats.md`; the storyboard maps that map onto the world's
 * moments (game-b2-moments.ts). Topic-neutral on purpose (game-b2-bias.test.ts): the game words
 * are the grammar, the content always comes from the film's research.
 */

/** Script prompt (`{{worldScript}}`): how the narration of a Game B2 film is written. */
export const GAME_B2_SCRIPT = `Game framing (binding for this world): the film explains how its topic works as ONE first-person game run. Write the narration for that game from the first line; it is not a plain explainer dressed up as a game later.
- Voice: the narrator guides the player in the second person ("you"): you start the run, you enter a level, you pick up what you learn. Plain, warm and exact; the game words carry the explanation, never replace it.
- Start screen: the hook names the quest (the question the film answers) and what is at stake, in one or two lines.
- Levels = the chapters of the explanation, in the order the idea builds: each opens with its plain name said aloud ("Level two: <its name>") and a checkpoint line that recaps what you carry so far. About one level per 1–2 minutes, never more than 6.
- Stats = the key quantities of the topic (HP, XP, a timer, a score, a resource): give each its real value and unit from the research the first time it matters and say what changes it. A stat without a real number is named, never given an invented one.
- Enemies and bosses = the obstacles: the common misconceptions, limits and hard parts. A level's boss is its hardest idea or most common mistake; the final boss is the core question of the film, beaten with what the run collected.
- Power-ups and items = the insights, rules and tools you learn: name each once when you gain it and use it later (to beat a boss or open the next level); a wrong turn may cost HP only where the topic really has a cost.
- Ending: the final boss falls on the film's answer; a short end screen sums up what the run taught; no cliffhanger.
- Restraint: every game term stands for a real fact, mechanism or number, said in plain words in the same breath; only a few game words (level, checkpoint, boss, power-up, HP, XP); no "press start" filler, no menu chatter, no gag that bends a fact or invents one. Keep it engaging for the whole length: each level raises the stakes or the difficulty.
- In \`beats.md\` (never in \`script.txt\`) add a section \`## Game map\`: one line per beat with its number, its game role (start screen, level N and its name, checkpoint, enemy, boss, power-up, final boss, end screen), the stat it moves with its real value, and the item gained. The storyboard plans the game's levels and screens from it.`;

/** Storyboard (appended to the rolls): the `## Game map` of `beats.md` on the world's moments. */
export const GAME_B2_STRUCTURE = `Game structure: the film is one game run; read the \`## Game map\` of \`beats.md\` (when it has one) and let the shots follow it, every game element on the phrase the narration says it.
- A new level opens with a \`level-card\` shot (its name on the compass, its chapter flag on the progress strip); its A-roll walks are the places of that chapter.
- A checkpoint, a recap or a stat that changes = a \`quest-log\` (the stat sheet with the run's real values) or an \`automap\` (the levels done, the next one ahead); the end of a level summed up in numbers = a \`tally\`.
- A power-up or item the narration names = an \`inventory-pick\`, later used where it beats an obstacle; an enemy or a level boss (a misconception, a hard idea) = a C-roll pressure shot, or a \`dialogue\` with struck wrong options only when the narration quotes someone (never invent a speaker).
- The final boss is the film's central problem: the one boss bar (\`boss-card\`), named in the narration's words, draining as the levels beat it and falling on the answer; the verdict phrase may be the \`stinger\`.
- The stat the narration tracks (its HP, XP, timer or score) is the film's one meter, with the narration's real values only. Never add a level, boss, item or stat the narration does not name.`;
