/**
 * Home → New project wizard in the app tests (PLAN.md#13.16): open it, move between its four steps
 * (Topic → Channel and genre → Style → Voice and create), open "More options" and create. The
 * caller stubs the folder picker first (electron-app.ts `stubFolderPicker`).
 */
import type { Locator, Page } from 'playwright';

export type WizardStepTitle = 'Topic' | 'Channel and genre' | 'Style' | 'Voice and create';

export function startRegion(page: Page): Locator {
  return page.getByRole('region', { name: 'Start' });
}

/** Clicks Home's "New project" and returns the wizard. */
export async function openNewProject(page: Page): Promise<Locator> {
  const start = startRegion(page);
  await start.getByRole('button', { name: 'New project', exact: true }).click();
  const wizard = start.getByRole('region', { name: 'New project' });
  await wizard.waitFor();
  return wizard;
}

/** Shows step `title` (its dot can be clicked once the steps before it are filled in). */
export async function goToStep(wizard: Locator, title: WizardStepTitle): Promise<void> {
  const heading = wizard.getByRole('heading', { name: new RegExp(`: ${title}$`) });
  if ((await heading.count()) > 0) return;
  await wizard
    .getByRole('list', { name: 'Steps' })
    .getByRole('button', { name: title, exact: true })
    .click();
  await heading.waitFor();
}

/** The last step's "More options" (language, scenes per minute, faster checks). */
export async function openMoreOptions(wizard: Locator): Promise<void> {
  await goToStep(wizard, 'Voice and create');
  const toggle = wizard.getByRole('button', { name: /^More options/ });
  if ((await toggle.getAttribute('aria-expanded')) !== 'true') await toggle.click();
}

/** Goes to the last step and presses "Create project…" (the folder picker follows). */
export async function finishNewProject(wizard: Locator): Promise<void> {
  await goToStep(wizard, 'Voice and create');
  await wizard.getByRole('button', { name: 'Create project…' }).click();
}

/** A project with just a title, everything else as the wizard proposes. */
export async function createProjectNamed(page: Page, title: string): Promise<void> {
  const wizard = await openNewProject(page);
  await wizard.getByLabel('Video title').fill(title);
  await finishNewProject(wizard);
}
