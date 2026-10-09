/**
 * New project wizard (PLAN.md#13.16), in place of the old narrow form: Topic → Channel and genre →
 * Style → Voice and create, with step dots, Back / Next (Enter goes on), Esc back to the projects.
 * Creating makes a typed new channel first (channels service), then the project (the same
 * newProject request as before: genre, style, scenes per minute, faster checks, language), then
 * saves the brief (title or "what it is about" + length) so the Script step starts from it.
 */
import { useEffect, useMemo, useRef, useState, type JSX, type SyntheticEvent } from 'react';
import type { ShotsPerMinute } from '@reelforge/shared';
import type { ProjectSummary } from '../../shared/project-contract.js';
import { styleChoices } from '../../shared/style-choices.js';
import { channelDefaultStyle, nextChannelColor } from '../channels/channel-view.js';
import type { ChannelsController } from '../channels/use-channels.js';
import type { NewProjectDefaults } from '../home/HomeScreen.js';
import { errorMessage, rendererLog } from '../log.js';
import {
  chosenGenre,
  genreFormValues,
  genreStyleNote,
  withTouched,
  type TouchedFields,
} from '../project/genre-view.js';
import { chosenStyle } from '../project/world-settings-view.js';
import { ChannelStep } from './ChannelStep.js';
import { StyleStep } from './StyleStep.js';
import { TopicStep } from './TopicStep.js';
import { VoiceStep } from './VoiceStep.js';
import { WizardFrame } from './WizardFrame.js';
import {
  canReachStep,
  DEFAULT_MINUTES,
  defaultVoicePlan,
  firstProblemStep,
  nextWizardStep,
  reviewLines,
  stepProblem,
  voiceOptions,
  wizardBrief,
  type ChannelChoice,
  type VoicePlan,
  type WizardDraft,
  type WizardStep,
} from './wizard-view.js';

const log = rendererLog('wizard');

type Language = ProjectSummary['language'];

export interface NewProjectWizardProps {
  readonly channels: ChannelsController;
  /** The channel it starts in (a channel section's "+ New project"); undefined = the default. */
  readonly initialChannelId: string | undefined;
  readonly defaults: NewProjectDefaults;
  readonly onCancel: () => void;
  readonly onCreated: (project: ProjectSummary) => void;
}

export function NewProjectWizard(props: NewProjectWizardProps): JSX.Element {
  const { defaults } = props;
  const list = props.channels.list;
  const experimental = defaults.experimentalWorlds === true;
  const [step, setStep] = useState<WizardStep>('topic');
  const [draft, setDraft] = useState<WizardDraft>({
    title: '',
    about: '',
    minutes: DEFAULT_MINUTES,
    channel: undefined,
  });
  const [language, setLanguage] = useState<Language>(defaults.language ?? 'en');
  const [shotsPerMinute, setShotsPerMinute] = useState<ShotsPerMinute | null>(
    defaults.shotsPerMinute ?? null,
  );
  const [fasterChecks, setFasterChecks] = useState(defaults.fasterChecks ?? false);
  const [pickedStyle, setPickedStyle] = useState<string | undefined>(undefined);
  const [pickedGenre, setPickedGenre] = useState<string | null | undefined>(undefined);
  const [touched, setTouched] = useState<TouchedFields>(new Set());
  const [pickedVoice, setPickedVoice] = useState<VoicePlan | undefined>(undefined);
  const [moreOpen, setMoreOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | undefined>(undefined);

  // The channel it starts in, once the list is there (and when a section asks for another; a
  // later change of the list, e.g. the channel made here, keeps the choice).
  const appliedStart = useRef<string | null>(null);
  useEffect(() => {
    if (list === undefined) return;
    const id = props.initialChannelId ?? list.defaultChannelId;
    if (appliedStart.current === id) return;
    appliedStart.current = id;
    const known = list.channels.some((channel) => channel.id === id);
    setDraft((current) => ({
      ...current,
      channel: { kind: 'existing', id: known ? id : list.defaultChannelId },
    }));
  }, [list, props.initialChannelId]);
  useEffect(() => {
    if (defaults.language !== undefined) setLanguage(defaults.language);
  }, [defaults.language]);
  useEffect(() => {
    if (defaults.shotsPerMinute !== undefined) setShotsPerMinute(defaults.shotsPerMinute);
  }, [defaults.shotsPerMinute]);
  useEffect(() => {
    if (defaults.fasterChecks !== undefined) setFasterChecks(defaults.fasterChecks);
  }, [defaults.fasterChecks]);

  const choice = draft.channel;
  const channel =
    choice?.kind === 'existing'
      ? list?.channels.find((entry) => entry.id === choice.id)
      : undefined;
  const styles = useMemo(() => styleChoices(experimental), [experimental]);
  const genre = chosenGenre(pickedGenre, channel?.genrePreset);
  const values = genreFormValues({
    genre,
    touched,
    experimentalWorlds: experimental,
    style: chosenStyle(pickedStyle, channelDefaultStyle(channel, defaults.style), styles),
    shotsPerMinute,
    fasterChecks,
  });
  const voice = pickedVoice ?? defaultVoicePlan(channel);
  const channels = list?.channels ?? [];
  const problem = stepProblem(step, draft, channels);

  const changeChannel = (next: ChannelChoice): void => {
    setDraft((current) => ({ ...current, channel: next }));
    // Typing a new channel's name is no switch.
    if (next.kind === 'new' && choice?.kind === 'new') return;
    // The new channel's style, genre and voice apply until they are picked again.
    setPickedStyle(undefined);
    setPickedGenre(undefined);
    setPickedVoice(undefined);
    setTouched((previous) => new Set([...previous].filter((field) => field !== 'style')));
  };

  const create = async (): Promise<void> => {
    const missing = firstProblemStep(draft, channels);
    if (missing !== undefined) {
      setStep(missing);
      return;
    }
    setBusy(true);
    setError(undefined);
    try {
      let channelId = channel?.id;
      if (choice?.kind === 'new') {
        const made = await props.channels.create({
          name: choice.name.trim(),
          color: nextChannelColor(channels),
        });
        if (!made.ok) {
          setError(made.message);
          setStep('channel');
          return;
        }
        channelId = made.changedId ?? undefined;
        // A second try (e.g. after closing the folder picker) must not make it again; the
        // style, genre and voice picked so far stay.
        const createdId = channelId;
        if (createdId !== undefined) {
          setDraft((current) => ({ ...current, channel: { kind: 'existing', id: createdId } }));
        }
      }
      const { style } = values;
      const result = await window.reelforge.newProject({
        title: draft.title.trim(),
        language,
        shotsPerMinute: values.shotsPerMinute,
        fasterChecks: values.fasterChecks,
        ...(style === undefined ? {} : { style }),
        ...(channelId === undefined ? {} : { channelId }),
        genrePreset: genre,
        explicitFields: [...touched],
      });
      if (result.status === 'error') setError(result.error.message);
      if (result.status !== 'opened') return;
      const saved = await window.reelforge.saveBrief(wizardBrief(draft, language));
      if (saved.status === 'error') log.warn(`brief not saved: ${saved.message ?? 'no reason'}`);
      props.onCreated(result.project);
    } catch (reason) {
      log.error(`new project failed: ${errorMessage(reason)}`);
      setError(errorMessage(reason));
    } finally {
      setBusy(false);
    }
  };

  const submit = (event: SyntheticEvent): void => {
    event.preventDefault();
    if (busy || problem !== undefined) return;
    const next = nextWizardStep(step, 1);
    if (next === undefined) void create();
    else setStep(next);
  };

  return (
    <WizardFrame
      step={step}
      onStep={setStep}
      canReach={(target) => canReachStep(target, draft, channels)}
      problem={problem}
      error={error}
      busy={busy}
      onSubmit={submit}
      onCancel={props.onCancel}
    >
      {step === 'topic' && (
        <TopicStep
          draft={draft}
          onDraft={(patch) => {
            setDraft((current) => ({ ...current, ...patch }));
          }}
          disabled={busy}
        />
      )}
      {step === 'channel' && (
        <ChannelStep
          channels={list?.channels}
          channelsError={props.channels.loadError}
          choice={choice}
          onChoice={changeChannel}
          genre={genre}
          resolution={values.resolution}
          touched={touched}
          experimentalWorlds={experimental}
          onGenre={setPickedGenre}
          disabled={busy}
        />
      )}
      {step === 'style' && (
        <StyleStep
          choices={styles}
          value={values.style}
          onChange={(picked) => {
            setPickedStyle(picked);
            setTouched((previous) => withTouched(previous, 'style'));
          }}
          experimentalWorlds={experimental}
          genreNote={
            values.resolution === undefined
              ? undefined
              : genreStyleNote(values.resolution, experimental)
          }
          disabled={busy}
        />
      )}
      {step === 'voice' && (
        <VoiceStep
          options={voiceOptions(channel, choice?.kind === 'new')}
          voice={voice}
          onVoice={setPickedVoice}
          moreOpen={moreOpen}
          onMoreOpen={setMoreOpen}
          language={language}
          onLanguage={setLanguage}
          shotsPerMinute={values.shotsPerMinute}
          fasterChecks={values.fasterChecks}
          onShotsPerMinute={(range) => {
            setShotsPerMinute(range);
            setTouched((previous) => withTouched(previous, 'shotsPerMinute'));
          }}
          onFasterChecks={(on) => {
            setFasterChecks(on);
            setTouched((previous) => withTouched(previous, 'fasterChecks'));
          }}
          review={reviewLines({
            draft,
            channelName: choice?.kind === 'new' ? choice.name.trim() : channel?.name,
            genre,
            style: values.style,
            voice,
            language,
          })}
          disabled={busy}
        />
      )}
    </WizardFrame>
  );
}
