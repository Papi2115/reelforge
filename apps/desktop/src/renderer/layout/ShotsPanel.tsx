/**
 * Shots of storyboard.json (PLAN.md#6.3, #7.4, #11.2): id, time range, treatment (and, in detailed
 * rows, intent and scene file), with the ✓/⚠/✗ QA badge of Scenes built (click it for the
 * findings, critic notes and missing props, "Rebuild this shot" and "Fix with Claude…"), the lock
 * of each shot (PLAN.md#11.4, plus "Lock all ✓"), "Variants…" (PLAN.md#11.3; also in the
 * right-click menu and on V), the build progress and the missing-props banner. The heading counts
 * the badges; a filter (text, "only ⚠/✗") and compact one-line rows keep 16+ shots usable at
 * 1280x720. Clicking a shot selects it and moves the preview to its start.
 */
import type { StoryboardShot } from '@reelforge/shared';
import { useCallback, useEffect, useState, type JSX } from 'react';
import type { FileState } from '../../shared/snapshot-contract.js';
import { plural } from '../../shared/plural.js';
import type { ShotBadge } from '../stages/scenes-view.js';
import { FilterIcon, LockIcon } from './icons.js';
import { ShotContextMenu, type ShotMenuAnchor } from './ShotContextMenu.js';
import { ShotDetails } from './ShotDetails.js';
import {
  DEFAULT_SHOTS_PREFS,
  FILTER_MIN_SHOTS,
  filterShots,
  filterSummary,
  isCompact,
  NO_FILTER,
  shotCounts,
  SHOTS_PREFS_KEY,
  shotsPrefsSchema,
  type ShotFilter,
} from './shots-view.js';
import { formatTime } from './timeline-scale.js';
import { usePref } from './ui-prefs.js';

export interface ShotsPanelProps {
  readonly storyboard: FileState<{ readonly shots: readonly StoryboardShot[] }> | undefined;
  readonly selectedId: string | undefined;
  readonly time: number;
  readonly onSelect: (shot: StoryboardShot) => void;
  readonly badges: ReadonlyMap<string, ShotBadge>;
  /** Build progress while Scenes built runs (scenes-view.ts). */
  readonly progress: string | null;
  readonly propsBanner: string | null;
  /** Why the shot actions are unavailable now (null = available). */
  readonly actionsBlocked: string | null;
  readonly onRebuild: (shotId: string) => void;
  readonly onFix: (shotId: string) => void;
  /** Locked shots (`locks.json`). */
  readonly locked: ReadonlySet<string>;
  /** Locked shots whose words moved (> ±150 ms): "Unlock and fix". */
  readonly outOfSync: ReadonlySet<string>;
  /** ✓ shots "Lock all ✓" would lock. */
  readonly lockable: readonly string[];
  readonly onLock: (shotIds: readonly string[], locked: boolean) => void;
  readonly onUnlockAndFix: (shotId: string) => void;
  /** Opens the Variants view of a shot (PLAN.md#11.3). */
  readonly onVariants: (shotId: string) => void;
  /** Shots with variants waiting for a decision. */
  readonly withVariants: ReadonlySet<string>;
  /** Shots carrying live directions (PLAN.md#12.14) and their summary for the tooltip. */
  readonly directed?: ReadonlySet<string>;
  readonly directionSummary?: (shotId: string) => string;
}

function Placeholder({ storyboard }: Pick<ShotsPanelProps, 'storyboard'>): JSX.Element {
  if (storyboard === undefined) return <p className="panel-empty">Reading the project…</p>;
  if (storyboard.status === 'missing') {
    return (
      <p className="panel-empty">
        No shots yet. Add your voiceover, then run Words timed and Storyboard: the shots appear
        here.
      </p>
    );
  }
  return (
    <p className="panel-empty panel-error" role="alert">
      {storyboard.status === 'error' ? storyboard.error.message : ''}
    </p>
  );
}

function useWindowHeight(): number {
  const [height, setHeight] = useState(() => window.innerHeight);
  useEffect(() => {
    const onResize = (): void => {
      setHeight(window.innerHeight);
    };
    window.addEventListener('resize', onResize);
    return () => {
      window.removeEventListener('resize', onResize);
    };
  }, []);
  return height;
}

function Counts(props: {
  readonly shots: readonly StoryboardShot[];
  readonly badges: ReadonlyMap<string, ShotBadge>;
  readonly locked: ReadonlySet<string>;
}): JSX.Element | null {
  const counts = shotCounts(props.shots, props.badges, props.locked);
  const parts: [string, number, string][] = [
    ['qa-ok', counts.ok, '✓'],
    ['qa-warning', counts.warning, '⚠'],
    ['qa-failed', counts.failed, '✗'],
  ];
  if (counts.ok + counts.warning + counts.failed + counts.locked === 0) return null;
  return (
    <span
      className="shot-counts"
      title={`${plural(counts.ok, 'shot')} ✓, ${String(counts.warning)} ⚠, ${String(counts.failed)} ✗, ${String(counts.locked)} locked`}
    >
      {parts
        .filter(([, count]) => count > 0)
        .map(([className, count, symbol]) => (
          <span key={className} className={className}>
            {symbol}
            {count}
          </span>
        ))}
      {counts.locked > 0 && (
        <span className="shot-counts-locked">
          <LockIcon locked />
          {counts.locked}
        </span>
      )}
    </span>
  );
}

function FilterBar(props: {
  readonly filter: ShotFilter;
  readonly onFilter: (filter: ShotFilter) => void;
  readonly summary: string | null;
}): JSX.Element {
  const { filter } = props;
  return (
    <div className="shots-filter" role="search">
      <input
        type="search"
        aria-label="Filter shots"
        placeholder="Filter by id or text"
        value={filter.query}
        onChange={(event) => {
          props.onFilter({ ...filter, query: event.target.value });
        }}
      />
      <button
        type="button"
        className="small-button"
        aria-pressed={filter.problemsOnly}
        title="Show only the shots with ⚠ or ✗"
        onClick={() => {
          props.onFilter({ ...filter, problemsOnly: !filter.problemsOnly });
        }}
      >
        <FilterIcon />
        ⚠/✗ only
      </button>
      {props.summary !== null && <span className="shots-filter-summary">{props.summary}</span>}
    </div>
  );
}

export function ShotsPanel(props: ShotsPanelProps): JSX.Element {
  const { storyboard, selectedId, time, onSelect, badges } = props;
  const [openId, setOpenId] = useState<string | null>(null);
  const [menu, setMenu] = useState<ShotMenuAnchor | null>(null);
  const [filter, setFilter] = useState<ShotFilter>(NO_FILTER);
  const [prefs, setPrefs] = usePref(SHOTS_PREFS_KEY, shotsPrefsSchema, DEFAULT_SHOTS_PREFS);
  const compact = isCompact(prefs.mode, useWindowHeight());
  const closeMenu = useCallback(() => {
    setMenu(null);
  }, []);
  const shots = storyboard?.status === 'ok' ? storyboard.data.shots : [];
  const shown = filterShots(shots, badges, filter);
  return (
    <section className={`panel shots-panel${compact ? ' compact' : ''}`} aria-label="Shots">
      <h2 className="panel-heading">
        Shots {shots.length > 0 && <span className="count">{shots.length}</span>}
        <Counts shots={shots} badges={badges} locked={props.locked} />
        {props.lockable.length > 0 && (
          <button
            type="button"
            className="small-button shots-lock-all"
            title={`Lock ${props.lockable.join(', ')}: builds, reviews and Claude leave them as they are`}
            onClick={() => {
              props.onLock(props.lockable, true);
            }}
          >
            <LockIcon locked />
            Lock all ✓
          </button>
        )}
        {shots.length > 0 && (
          <button
            type="button"
            className="small-button shots-mode"
            aria-pressed={compact}
            title={compact ? 'Show intent and scene file in every row' : 'One line per shot'}
            onClick={() => {
              setPrefs({ mode: compact ? 'detailed' : 'compact' });
            }}
          >
            Compact
          </button>
        )}
      </h2>
      {props.progress !== null && (
        <p className="shots-progress" aria-live="polite">
          {props.progress}
        </p>
      )}
      {props.propsBanner !== null && (
        <p className="shots-banner" role="status">
          {props.propsBanner}
        </p>
      )}
      {shots.length >= FILTER_MIN_SHOTS && (
        <FilterBar
          filter={filter}
          onFilter={setFilter}
          summary={filterSummary(shown.length, shots.length)}
        />
      )}
      {shots.length === 0 ? (
        <Placeholder storyboard={storyboard} />
      ) : shown.length === 0 ? (
        <p className="panel-empty">
          No shot matches the filter.{' '}
          <button
            type="button"
            className="link-button"
            onClick={() => {
              setFilter(NO_FILTER);
            }}
          >
            Clear the filter
          </button>
        </p>
      ) : (
        <ul className="shot-list">
          {shown.map((shot) => {
            const playing = time >= shot.t0 && time < shot.t1;
            const badge = badges.get(shot.id);
            const open = openId === shot.id;
            const locked = props.locked.has(shot.id);
            const offSync = props.outOfSync.has(shot.id);
            const range = `${formatTime(shot.t0)}–${formatTime(shot.t1)}`;
            return (
              <li key={shot.id} className="shot-entry">
                <button
                  type="button"
                  className={`shot-item${playing ? ' playing' : ''}${locked ? ' locked' : ''}`}
                  aria-pressed={shot.id === selectedId}
                  aria-label={`Shot ${shot.id}, ${formatTime(shot.t0)} to ${formatTime(shot.t1)}: ${shot.intent}`}
                  title={compact ? shot.intent : undefined}
                  onClick={() => {
                    onSelect(shot);
                  }}
                  onContextMenu={(event) => {
                    event.preventDefault();
                    onSelect(shot);
                    setMenu({ shotId: shot.id, x: event.clientX, y: event.clientY });
                  }}
                >
                  <span className="shot-line">
                    <span className="shot-id mono">{shot.id}</span>
                    {!compact && <span className="shot-time mono">{range}</span>}
                    <span className="chip">{shot.treatment}</span>
                    {props.withVariants.has(shot.id) && (
                      <span className="chip variants-chip" title="Variants wait for your pick">
                        variants
                      </span>
                    )}
                    {props.directed?.has(shot.id) === true && (
                      <span
                        className="chip direction-chip"
                        title={`Directions: ${props.directionSummary?.(shot.id) ?? ''}`}
                      >
                        directions
                      </span>
                    )}
                    {compact && <span className="shot-time mono">{formatTime(shot.t0)}</span>}
                  </span>
                  {!compact && <span className="shot-intent">{shot.intent}</span>}
                  {!compact && <span className="shot-scene mono">{shot.scene}</span>}
                </button>
                <button
                  type="button"
                  className={`shot-badge qa-${badge?.tone ?? 'none'}`}
                  aria-expanded={open}
                  aria-controls={`shot-qa-${shot.id}`}
                  aria-label={`QA of ${shot.id}: ${badge?.label ?? 'not built yet'}`}
                  title={`${badge?.label ?? 'Not built yet'}: click for details and actions`}
                  onClick={() => {
                    setOpenId(open ? null : shot.id);
                  }}
                >
                  {badge?.symbol ?? '○'}
                </button>
                <button
                  type="button"
                  className={`shot-lock${locked ? ' on' : ''}${offSync ? ' out-of-sync' : ''}`}
                  aria-pressed={locked}
                  aria-label={`${locked ? 'Unlock' : 'Lock'} ${shot.id}`}
                  title={
                    locked
                      ? `Locked${offSync ? ', may be out of sync' : ''}: click to unlock (Shift+L)`
                      : 'Lock this shot: builds, reviews and Claude leave it as it is (Shift+L)'
                  }
                  onClick={() => {
                    props.onLock([shot.id], !locked);
                  }}
                >
                  <LockIcon locked={locked} />
                </button>
                {open && (
                  <ShotDetails
                    shotId={shot.id}
                    badge={badge}
                    blocked={props.actionsBlocked}
                    locked={locked}
                    outOfSync={offSync}
                    onRebuild={props.onRebuild}
                    onFix={props.onFix}
                    onUnlockAndFix={props.onUnlockAndFix}
                    onVariants={props.onVariants}
                  />
                )}
              </li>
            );
          })}
        </ul>
      )}
      {menu !== null && (
        <ShotContextMenu
          anchor={menu}
          locked={props.locked.has(menu.shotId)}
          blocked={props.actionsBlocked}
          onVariants={props.onVariants}
          onRebuild={props.onRebuild}
          onLock={props.onLock}
          onClose={closeMenu}
        />
      )}
    </section>
  );
}
