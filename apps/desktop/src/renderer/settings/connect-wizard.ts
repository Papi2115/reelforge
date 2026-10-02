/**
 * "Connect Claude" wizard as a pure view of the connection status (PLAN.md §2.1): which step is
 * current (install -> log in -> connected), what to say and which buttons to offer. Also the
 * status-bar chip. Only version / auth method / subscription type are ever shown.
 */
import type { ClaudeStatus } from '../../shared/settings-contract.js';

export type WizardStepId = 'install' | 'login' | 'connected';
export type WizardStepState = 'done' | 'current' | 'todo' | 'failed';
export type WizardTone = 'checking' | 'ok' | 'action' | 'error';

export interface WizardStep {
  readonly id: WizardStepId;
  readonly label: string;
  readonly state: WizardStepState;
}

export interface WizardView {
  readonly tone: WizardTone;
  readonly headline: string;
  readonly detail: string;
  readonly steps: readonly WizardStep[];
  /** Shown as a copyable command when Claude Code must be installed or updated. */
  readonly installCommand: string | undefined;
  readonly canCheckAgain: boolean;
  readonly canOpenTerminal: boolean;
  readonly connected: boolean;
}

/** The CLI's own installer alternative (no URL: the app does not open web pages). */
export const NATIVE_INSTALLER_NOTE =
  "Or use Anthropic's official native installer (see the Claude Code setup docs).";

export const PRIVACY_NOTE =
  'ReelForge only runs your locally installed Claude Code; it never reads or stores your credentials. Personal use.';

const STEP_LABELS: Readonly<Record<WizardStepId, string>> = {
  install: 'Install Claude Code',
  login: 'Log in',
  connected: 'Connected',
};

function steps(states: readonly [WizardStepState, WizardStepState, WizardStepState]): WizardStep[] {
  return (['install', 'login', 'connected'] as const).map((id, index) => ({
    id,
    label: STEP_LABELS[id],
    state: states[index] ?? 'todo',
  }));
}

/** `max` -> `Claude Max`; unknown values are shown as given. */
export function subscriptionLabel(type: string | null): string | undefined {
  if (type === null || type === '') return undefined;
  const known: Readonly<Record<string, string>> = {
    pro: 'Claude Pro',
    max: 'Claude Max',
    team: 'Claude Team',
    enterprise: 'Claude Enterprise',
  };
  return known[type.toLowerCase()] ?? type;
}

export function connectWizardView(status: ClaudeStatus | undefined, checking: boolean): WizardView {
  const base = {
    installCommand: undefined,
    canCheckAgain: !checking,
    canOpenTerminal: false,
    connected: false,
  };
  if (status === undefined) {
    return {
      ...base,
      tone: 'checking',
      headline: 'Checking Claude Code…',
      detail: 'Looking for the claude command on this computer.',
      steps: steps(['current', 'todo', 'todo']),
    };
  }
  switch (status.state) {
    case 'not-installed':
      return {
        ...base,
        tone: 'action',
        headline: 'Claude Code is not installed',
        detail: 'Install it once with the command below, then press Check again.',
        steps: steps(['current', 'todo', 'todo']),
        installCommand: status.installCommand,
      };
    case 'not-logged-in':
      return {
        ...base,
        tone: 'action',
        headline: 'Log in to Claude Code',
        detail: `Claude Code ${status.version} is installed but not logged in. Open a terminal, finish the login there (it runs ${status.loginCommand}), then come back.`,
        steps: steps(['done', 'current', 'todo']),
        canOpenTerminal: !checking,
      };
    case 'connected': {
      const plan = subscriptionLabel(status.subscriptionType);
      const tested = status.aboveTested ? ' Newer than the version ReelForge was tested with.' : '';
      return {
        ...base,
        tone: 'ok',
        headline: 'Connected',
        detail: `Claude Code ${status.version}${plan === undefined ? '' : ` · ${plan}`}.${tested}`,
        steps: steps(['done', 'done', 'done']),
        connected: true,
      };
    }
    case 'error':
      if (status.reason === 'outdated') {
        return {
          ...base,
          tone: 'error',
          headline: 'Claude Code needs an update',
          detail: status.message,
          steps: steps(['failed', 'todo', 'todo']),
          installCommand: 'npm install -g @anthropic-ai/claude-code',
        };
      }
      return {
        ...base,
        tone: 'error',
        headline:
          status.reason === 'api-key-source'
            ? 'Claude Code is set up to bill an API key'
            : 'Could not check Claude Code',
        detail: status.message,
        steps: steps(['done', 'failed', 'todo']),
      };
  }
}

export interface ClaudeChip {
  readonly label: string;
  readonly tone: WizardTone;
}

export function claudeChip(status: ClaudeStatus | undefined): ClaudeChip {
  if (status === undefined) return { label: 'Claude: checking…', tone: 'checking' };
  switch (status.state) {
    case 'connected':
      return { label: `Claude: connected · ${status.version}`, tone: 'ok' };
    case 'not-installed':
      return { label: 'Claude: not installed', tone: 'action' };
    case 'not-logged-in':
      return { label: 'Claude: not logged in', tone: 'action' };
    case 'error':
      return { label: 'Claude: not connected', tone: 'error' };
  }
}
