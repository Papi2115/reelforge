/**
 * Fixtures of the Grim Ink (`c-cam`) anti-slop calibration (PLAN.md#14.12): the narration the kit's
 * c-cam examples were written to (their header comments: the stage on its own, the night baker in
 * the bakery's back room) and the Apollo 11 fixture film the people and places were built for
 * (packages/kit/examples/c-cam/apollo, docs/concepts/c-cam-style/films/03-apollo-11), the kit's
 * example scenes and project modules, and the world's goldens (its looks and contact sheets).
 */
import { readdirSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

/** The examples' own narration (their header comments) and the Apollo fixture film's. */
export const C_CAM_NARRATION = [
  // s1_person_place.js: the night baker holds up the loaf; the chalk sign says what is wrong.
  'Every night the baker pulls the same loaf out of the oven, and every night it is burnt. The sign over the oven says it plainly: no burnt loaves.',
  // apollo/*: the crew, Mission Control and the places of the landing.
  'July 20, 1969. Eagle is falling toward the Moon when the master alarm goes off: 1202. In Mission Control, the guidance officer has seconds to decide: go, or abort. Go. Descent fuel is low. Then: contact light. The Eagle has landed.',
].join(' ');

const KIT = fileURLToPath(new URL('../../../kit/', import.meta.url));
const EXAMPLES = path.join(KIT, 'examples', 'c-cam');

function sources(dir: string): Map<string, string> {
  const files = readdirSync(dir).filter((name) => name.endsWith('.js'));
  return new Map(files.map((name) => [name, readFileSync(path.join(dir, name), 'utf8')]));
}

/** The kit's c-cam example scenes (`examples/c-cam/*.js`): file name -> source. */
export function cCamExampleScenes(): Map<string, string> {
  return sources(EXAMPLES);
}

/**
 * The kit's c-cam project modules (people and places of the bakery example and of the Apollo
 * fixture film): `people/<id>.js` -> source.
 */
export function cCamExampleModules(): Map<string, string> {
  const dirs = ['people', 'places', 'apollo/people', 'apollo/places'];
  return new Map(
    dirs.flatMap((dir) =>
      [...sources(path.join(EXAMPLES, ...dir.split('/')))].map(
        ([name, source]): [string, string] => [`${dir}/${name}`, source],
      ),
    ),
  );
}

/** The goldens of the world's looks (frames of a shot, judged like a film's frames). */
export const C_CAM_LOOK_GOLDENS = /^look-ink-.*\.png$/;
/** The world's contact sheets and module goldens (people, faces, places, acting, brushes). */
export const C_CAM_SHEET_GOLDENS = /^ccam-.*\.png$/;
