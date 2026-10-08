/**
 * Fixtures of the Comic anti-slop calibration (PLAN.md#13.3 part c): the narration of the approved
 * showcase film (docs/worlds/comic-panels-v2, the `narration` of shots 1-10) plus the narration of
 * the kit's three comic examples on other topics (their header comments), the facts of the
 * showcase's research notes (NOTES.md "Facts on screen", the DSKY line), and the kit's comic
 * template scenes.
 */
import { readdirSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

/** The showcase's narration (docs/worlds/comic-panels-v2/shots-*.js) and the examples' own. */
export const COMIC_NARRATION = [
  'July 20, 1969. Eagle is falling toward the Moon when its computer flashes an alarm the crew has to ask Houston about: 1202.',
  'The crew asks Houston what the alarm means. In Mission Control, guidance officer Steve Bales has seconds to decide: go, or abort.',
  'Eight years earlier, in 1961, the country had set itself a goal: a person on the Moon before the decade was out. Meanwhile, somebody had to build the computer that would fly them there.',
  'Too many jobs, no room to run them. So the computer restarted, dropped the low-priority work and kept only what mattered: guidance and navigation. Then the load climbed again.',
  'Back in Houston, Bales has his answer: the alarm is real, but the computer is still doing the work that matters. His call: go. CAPCOM passes it up to Eagle.',
  'And the alarms keep coming - 1202, then 1201. The autopilot is heading for a field of boulders. Armstrong takes manual control. Houston: sixty seconds.',
  'So what did 1202 mean? Executive overflow: no room left for new jobs. But the computer restarts, keeps the key jobs and is still steering. Not abort. Go.',
  '... Tranquility Base.',
  'Contact light. ... Okay. Engine stop.',
  'Engine stop. Outside, the dust they threw up falls straight back down - there is no air to hold it. Then: "Houston, Tranquility Base here. The Eagle has landed."',
  // Examples on other topics (f2, s2: a different topic and mechanism).
  'Why do we call it a bug? On September 9, 1947, the operators of the Harvard Mark II found a moth caught in relay 70, panel F. They taped it into the logbook: first actual case of bug being found.',
  'Mount Everest. Eight thousand eight hundred and forty-nine metres. On 29 May 1953, Edmund Hillary and Tenzing Norgay stood on top.',
].join(' ');

/** The showcase's research notes (docs/worlds/comic-panels-v2/NOTES.md, "Facts on screen"). */
export const COMIC_RESEARCH =
  'On screen: 20 Jul 1969; Eagle; program alarm 1202 and 1201; "Give us a reading on the 1202 ' +
  'program alarm"; Steve Bales, guidance officer; CAPCOM; "We\'re go on that alarm"; restart, ' +
  'low-priority jobs dropped; boulders, manual control, "60 seconds"; 1961 goal: the Moon before ' +
  'the decade was out; Sea of Tranquility; "Houston, Tranquility Base here. The Eagle has ' +
  'landed."; 20:17 UTC; no air, so the dust does not drift. Executive overflow = the alarm family ' +
  'name. DSKY V05 N09 / P63. ' +
  // The research note of the f2 example (the Harvard Mark II logbook, 9 September 1947).
  'Logbook entry: 1545 Relay #70 Panel F (moth) in relay. First actual case of bug being found.';

const KIT = fileURLToPath(new URL('../../../kit/', import.meta.url));

/** The kit's comic template scenes (looks A/B/C, flashbacks, spreads): file name -> source. */
export function comicExamples(): Map<string, string> {
  const dir = path.join(KIT, 'examples', 'comic');
  const files = readdirSync(dir).filter((name) => name.endsWith('.js'));
  return new Map(files.map((name) => [name, readFileSync(path.join(dir, name), 'utf8')]));
}
