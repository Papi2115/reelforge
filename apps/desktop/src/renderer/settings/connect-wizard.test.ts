import { describe, expect, it } from 'vitest';
import type { ClaudeStatus } from '../../shared/settings-contract.js';
import { claudeChip, connectWizardView, subscriptionLabel } from './connect-wizard.js';

const stepStates = (status: ClaudeStatus | undefined): string[] =>
  connectWizardView(status, false).steps.map((step) => `${step.id}:${step.state}`);

describe('connectWizardView', () => {
  it('checking: install step current, nothing to click but Check again', () => {
    const view = connectWizardView(undefined, true);
    expect(view).toMatchObject({ tone: 'checking', canCheckAgain: false, canOpenTerminal: false });
    expect(stepStates(undefined)).toEqual(['install:current', 'login:todo', 'connected:todo']);
  });

  it('not installed: shows the install command and Check again', () => {
    const status: ClaudeStatus = {
      state: 'not-installed',
      installCommand: 'npm install -g @anthropic-ai/claude-code',
      searchedDirs: 4,
    };
    const view = connectWizardView(status, false);
    expect(view).toMatchObject({
      tone: 'action',
      headline: 'Claude Code is not installed',
      installCommand: 'npm install -g @anthropic-ai/claude-code',
      canCheckAgain: true,
      canOpenTerminal: false,
      connected: false,
    });
    expect(stepStates(status)).toEqual(['install:current', 'login:todo', 'connected:todo']);
  });

  it('not logged in: offers the login terminal', () => {
    const status: ClaudeStatus = {
      state: 'not-logged-in',
      version: '2.1.287',
      loginCommand: 'claude auth login',
    };
    const view = connectWizardView(status, false);
    expect(view).toMatchObject({ tone: 'action', canOpenTerminal: true, canCheckAgain: true });
    expect(view.detail).toContain('claude auth login');
    expect(stepStates(status)).toEqual(['install:done', 'login:current', 'connected:todo']);
    expect(connectWizardView(status, true).canOpenTerminal).toBe(false);
  });

  it('connected: version and plan, all steps done', () => {
    const status: ClaudeStatus = {
      state: 'connected',
      version: '2.1.287',
      aboveTested: false,
      authMethod: 'claude.ai',
      subscriptionType: 'max',
    };
    const view = connectWizardView(status, false);
    expect(view).toMatchObject({ tone: 'ok', headline: 'Connected', connected: true });
    expect(view.detail).toBe('Claude Code 2.1.287 · Claude Max.');
    expect(stepStates(status)).toEqual(['install:done', 'login:done', 'connected:done']);
    expect(
      connectWizardView({ ...status, aboveTested: true, subscriptionType: null }, false).detail,
    ).toBe('Claude Code 2.1.287. Newer than the version ReelForge was tested with.');
  });

  it('errors: outdated asks for an update, others show the message', () => {
    const outdated = connectWizardView(
      { state: 'error', reason: 'outdated', message: 'claude 1.0.0 is older than 2.1.287' },
      false,
    );
    expect(outdated).toMatchObject({ tone: 'error', headline: 'Claude Code needs an update' });
    expect(outdated.installCommand).toBeDefined();
    const apiKey = connectWizardView(
      { state: 'error', reason: 'api-key-source', message: 'would bill an API key' },
      false,
    );
    expect(apiKey.headline).toBe('Claude Code is set up to bill an API key');
    expect(apiKey.steps.map((step) => step.state)).toEqual(['done', 'failed', 'todo']);
  });
});

describe('claudeChip / subscriptionLabel', () => {
  it('labels every state', () => {
    expect(claudeChip(undefined)).toEqual({ label: 'Claude: checking…', tone: 'checking' });
    expect(
      claudeChip({
        state: 'connected',
        version: '2.1.287',
        aboveTested: false,
        authMethod: null,
        subscriptionType: null,
      }),
    ).toEqual({ label: 'Claude: connected · 2.1.287', tone: 'ok' });
    expect(claudeChip({ state: 'error', reason: 'timeout', message: 'x' }).tone).toBe('error');
    expect(subscriptionLabel('pro')).toBe('Claude Pro');
    expect(subscriptionLabel('something')).toBe('something');
    expect(subscriptionLabel(null)).toBeUndefined();
  });
});
