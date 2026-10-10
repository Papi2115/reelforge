/**
 * How the storyboard, scene-build and critic prompts of a Grim Ink film read `direction.json`
 * (PLAN.md#14.16): the storyboard gets the whole plan as a digest (`worldDirection`), a scene the
 * exact plan of its shot (`worldDirectionPlan`: framings, beats in shot time, gag calls, the
 * accident, the climax ECU, the title frame through `env.ink.titleCard`), the critic what must be
 * visible (`worldDirectionCheck`). No plan or a shot without refs = no variable (the prompts are
 * exactly as before).
 */
import type { DirectionBeat, DirectionFile, FramingStep, StoryboardShot } from '@reelforge/shared';
import { C_CAM_API } from './c-cam-api.js';

const SECONDS = (value: number): string => value.toFixed(1);

/** At most this many characters per quoted beat in the storyboard digest. */
const QUOTE_BUDGET = 90;

function clip(text: string, budget: number): string {
  return text.length <= budget ? text : `${text.slice(0, budget - 1)}…`;
}

export function framingText(step: FramingStep): string {
  return `${step.framing}: ${step.subject}${step.why === undefined ? '' : ` (why: ${step.why})`}`;
}

function beatLine(beat: DirectionBeat): string {
  const parts = [
    `${beat.id} ${SECONDS(beat.span.t0)}–${SECONDS(beat.span.t1)} s ${beat.intent} "${clip(beat.span.text, QUOTE_BUDGET)}"`,
    beat.camera.progression.map(framingText).join(' > '),
    ...(beat.camera.tilt === true ? ['tilt'] : []),
    ...(beat.gagRefs.length === 0 ? [] : [`gags: ${beat.gagRefs.join(', ')}`]),
    ...(beat.accident === undefined ? [] : [`accident: ${beat.accident}`]),
  ];
  return `- ${parts.join(' | ')}`;
}

function titleLine(plan: DirectionFile): string {
  const { titleFrame } = plan;
  const acting = titleFrame.acting
    .map(
      (entry) =>
        `${entry.person} ${entry.pose}, ${entry.expr}${entry.note === undefined ? '' : ` (${entry.note})`}`,
    )
    .join('; ');
  const subtitle = titleFrame.subtitle === undefined ? '' : ` / "${titleFrame.subtitle}"`;
  return `Title frame: "${titleFrame.title}"${subtitle} — ${acting}; place ${titleFrame.background.placeId} (${titleFrame.background.why}); accent: ${titleFrame.accentObject}.`;
}

function castLine(person: DirectionFile['cast'][number]): string {
  const { kind, note, arc } = person.signatureGag;
  const role = person.role === undefined ? '' : ` (${person.role})`;
  const escalations = arc.escalations.length === 0 ? '' : ` → ${arc.escalations.join(', ')}`;
  return `- ${person.id}${role}: gag \`${kind}\`${note === undefined ? '' : ` — ${note}`}; ${arc.setup}${escalations} → payoff ${arc.payoff} (${arc.why})`;
}

/** The storyboard's digest of the whole plan. */
export function storyboardDirectionVars(plan: DirectionFile | undefined): Record<string, string> {
  if (plan === undefined) return {};
  const motifs =
    plan.motifs.length === 0
      ? []
      : [`Motifs: ${plan.motifs.map((motif) => `${motif.object} (${motif.meaning})`).join('; ')}.`];
  const lines = [
    titleLine(plan),
    'Cast and signature gags (setup → escalations → payoff):',
    ...plan.cast.map(castLine),
    'Beats (id, span, intent, quote | framing progression | tilt | gags | accident):',
    ...plan.beats.map(beatLine),
    `Climax: ${plan.climax.beatRef} — ECU of ${plan.climax.ecuSubject} (${plan.climax.why}).`,
    ...motifs,
  ];
  return { worldDirection: lines.join('\n') };
}

function localBeat(beat: DirectionBeat, shot: Pick<StoryboardShot, 't0' | 't1'>): string {
  const from = Math.max(0, beat.span.t0 - shot.t0);
  const to = Math.min(shot.t1 - shot.t0, beat.span.t1 - shot.t0);
  return `${beat.id} at ${SECONDS(from)}–${SECONDS(Math.max(from, to))} s of the shot (${beat.intent}, "${beat.span.text}")${beat.camera.tilt === true ? ', Dutch tilt' : ''}`;
}

function gagRole(person: DirectionFile['cast'][number], beatIds: readonly string[]): string {
  const { arc } = person.signatureGag;
  if (beatIds.includes(arc.payoff)) return 'the PAYOFF: land it big and clear, then hold';
  if (beatIds.includes(arc.setup)) return 'the setup: plant it small while nothing depends on it';
  return 'an escalation: bigger than last time, under the pressure of the beat';
}

function gagLines(
  plan: DirectionFile,
  shot: StoryboardShot,
  beats: readonly DirectionBeat[],
): string[] {
  const gags = shot.direction?.gags ?? [];
  return plan.cast
    .filter((person) => gags.includes(person.id))
    .map((person) => {
      const beat = beats.find((entry) => entry.gagRefs.includes(person.id)) ?? beats[0];
      const t0 = beat === undefined ? 0 : Math.max(0, beat.span.t0 - shot.t0);
      const ids = beats.map((entry) => entry.id);
      return `- ${person.id} plays \`${person.signatureGag.kind}\`${person.signatureGag.note === undefined ? '' : ` (${person.signatureGag.note})`}: \`gag: { kind: '${person.signatureGag.kind}', t0 }\` with t0 ≈ ${SECONDS(t0)} s (on the beat's words, \`ctx.anchor(…)\`), ${gagRole(person, ids)}; the face at least 1/12 of the frame height (90 px of 1080) at that moment.`;
    });
}

function titlePlan(plan: DirectionFile): string {
  const { titleFrame } = plan;
  const cast = titleFrame.acting
    .map(
      (entry) => `{ person: '${entry.person}', pose: '${entry.pose}', expr: '${entry.expr}', … }`,
    )
    .join(', ');
  return `This is the TITLE FRAME (the thumbnail): draw it with \`${C_CAM_API.ink}.titleCard(g, env, { title, subtitle?, cast: [{ person, view, pose, expr, x, y, s }], place?, accent? })\`: title "${titleFrame.title}"${titleFrame.subtitle === undefined ? '' : `, subtitle "${titleFrame.subtitle}"`}, cast [${cast}] acting the premise (${titleFrame.acting.map((entry) => entry.note ?? `${entry.person} ${entry.expr}`).join('; ')}), place '${titleFrame.background.placeId}' (${titleFrame.background.why}), accent ${titleFrame.accentObject}; the lettering thuds in letter by letter on twos, one framing (a slow push-in or pull-back), then a still hold.`;
}

/** The scene's exact plan of its shot; undefined refs = no variable. */
export function sceneDirectionVars(
  plan: DirectionFile | undefined,
  shot: StoryboardShot,
): Record<string, string> {
  const direction = shot.direction;
  if (plan === undefined || direction === undefined) return {};
  if (direction.titleFrame === true) return { worldDirectionPlan: titlePlan(plan) };
  const beats = plan.beats.filter((beat) => direction.beats?.includes(beat.id) === true);
  const framings = direction.framings
    .map((step, index) => `${String(index + 1)}. ${framingText(step)}`)
    .join('; ');
  const accidents = beats.filter((beat) => beat.accident !== undefined);
  const climax = beats.some((beat) => beat.id === plan.climax.beatRef);
  const lines = [
    `- Cut table, these framings in this order, each cut on its beat: ${framings}.`,
    ...(beats.length === 0
      ? []
      : [`- Beats: ${beats.map((beat) => localBeat(beat, shot)).join('; ')}.`]),
    ...gagLines(plan, shot, beats),
    ...accidents.map(
      (beat) =>
        `- Accident on ${beat.id}: ${beat.accident ?? ''} (not narrated: play it physically on its beat, then a reaction hold).`,
    ),
    ...(climax
      ? [
          `- CLIMAX of the film: the extreme close-up (zoom 2.4-5.4) of ${plan.climax.ecuSubject}, held >= 0.6 s (${plan.climax.why}).`,
        ]
      : []),
  ];
  return { worldDirectionPlan: lines.join('\n') };
}

/** What the critic must see of the shot's plan; undefined refs = no variable. */
export function criticDirectionVars(
  plan: DirectionFile | undefined,
  shot: StoryboardShot,
): Record<string, string> {
  const direction = shot.direction;
  if (plan === undefined || direction === undefined) return {};
  if (direction.titleFrame === true) {
    const cast = plan.titleFrame.cast.join(', ');
    return {
      worldDirectionCheck: `the title frame: the title "${plan.titleFrame.title}" in poster lettering (whole once settled) over ${cast} in character, their place behind them`,
    };
  }
  const ids = direction.beats ?? [];
  const checks: string[] = [];
  const ecu = direction.framings.find((step) => step.framing === 'ecu');
  if (ecu !== undefined) checks.push(`an extreme close-up of ${ecu.subject}`);
  for (const person of plan.cast.filter((entry) => direction.gags?.includes(entry.id) === true)) {
    const payoff = ids.includes(person.signatureGag.arc.payoff)
      ? ' (its payoff: drawn and clear)'
      : '';
    checks.push(
      `${person.id} playing \`${person.signatureGag.kind}\`${payoff} with the face at least 1/12 of the frame height (90 px of 1080)`,
    );
  }
  if (ids.includes(plan.climax.beatRef)) {
    checks.push(`the climax ECU of ${plan.climax.ecuSubject}`);
  }
  return checks.length === 0 ? {} : { worldDirectionCheck: checks.join('; ') };
}
